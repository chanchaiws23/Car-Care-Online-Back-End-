const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { connection } = require("../config/passport-config");

// API ล็อกอิน
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log('Login attempt:', { email, password: password ? '***' : 'undefined' });

  // 1. เช็คใน User ก่อน
  const userQuery = "SELECT * FROM user WHERE User_email = ?";
  connection.query(userQuery, [email], (err, userResults) => {
    if (err) {
      console.error('Database error checking user:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }

    console.log('User query results:', userResults.length > 0 ? 'Found user' : 'No user found');

    if (userResults.length > 0) {
      const user = userResults[0];
      console.log('Attempting user login for:', user.User_email);

      bcrypt.compare(password, user.User_password, (err, match) => {
        if (err) {
          console.error('Error comparing user password:', err);
          return res.status(500).json({ success: false, message: "Error comparing password", data: null });
        }

        console.log('User password match:', match);

        if (!match) return res.status(401).json({ success: false, message: "Invalid email or password", data: null });

        const token = jwt.sign({ userId: user.User_id, role: "user" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        console.log('User login successful');

        return res.json({
          success: true,
          message: "Login successful",
          data: {
            token,
            role: "user",
            user: {
              User_id: user.User_id,
              User_name: user.User_name,
              User_email: user.User_email,
              User_tel: user.User_tel,
              User_address: user.User_address
            }
          }
        });
      });
    } else {
      // 2. ถ้าไม่เจอใน User ให้เช็คใน Employee (ทั้ง email และ username)
      const empQuery = "SELECT * FROM Employee WHERE Employ_email = ? OR Employ_username = ?";
      connection.query(empQuery, [email, email], (err, empResults) => {
        if (err) {
          console.error('Database error checking employee:', err);
          return res.status(500).json({ success: false, message: "Database error", data: null });
        }

        console.log('Employee query results:', empResults.length > 0 ? 'Found employee' : 'No employee found');
        if (empResults.length > 0) {
          console.log('Employee found:', empResults[0].Employ_username, empResults[0].Employ_email);
        }

        if (empResults.length === 0) {
          console.log('No user or employee found for:', email);
          return res.status(401).json({ success: false, message: "Invalid email/username or password", data: null });
        }

        const emp = empResults[0];
        console.log('Attempting employee login for:', emp.Employ_username, 'or', emp.Employ_email);
        console.log('Employee password hash:', emp.Employ_password);

        bcrypt.compare(password, emp.Employ_password, (err, match) => {
          if (err) {
            console.error('Error comparing employee password:', err);
            return res.status(500).json({ success: false, message: "Error comparing password", data: null });
          }

          console.log('Employee password match:', match);

          if (!match) {
            console.log('Employee password does not match');
            return res.status(401).json({ success: false, message: "Invalid email/username or password", data: null });
          }

          const token = jwt.sign({ userId: emp.Employ_id, role: "employee" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
          console.log('Employee login successful');

          return res.json({
            success: true,
            message: "Login successful",
            data: {
              token,
              role: "employee",
              employee: {
                Employ_id: emp.Employ_id,
                Employ_name: emp.Employ_name,
                Employ_email: emp.Employ_email,
                Employ_tel: emp.Employ_tel,
                Employ_address: emp.Employ_address,
                Employ_status: emp.Employ_status
              }
            }
          });
        });
      });
    }
  });
});


// API ลงทะเบียน
router.post("/register", (req, res) => {
  const { User_name, User_tel, User_address, User_email, User_password } = req.body;
  const name = User_name;
  const tel = User_tel;
  const address = User_address;
  const email = User_email;
  const password = User_password;

  // ตรวจสอบว่าอีเมลซ้ำหรือไม่
  const checkEmailQuery = "SELECT * FROM user WHERE User_email = ?";
  connection.query(checkEmailQuery, [email], (err, results) => {
    if (err) {
      console.error("Database error checking email:", err);
      return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });
    }

    if (results.length > 0) {
      return res.status(400).json({
        success: false,
        message: "อีเมลนี้ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่น",
        data: null
      });
    }

      // ตรวจสอบว่ามีการส่งรหัสผ่านมาหรือไม่
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required",
          data: null
        });
      }

      // Hash รหัสผ่าน
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          console.error("Hash error:", err);
          return res.status(500).json({
            success: false,
            message: "Error hashing password",
            data: null
          });
        }

        // บันทึกข้อมูลผู้ใช้ใหม่
        const query = "INSERT INTO user (User_name, User_tel, User_email, User_address, User_password) VALUES (?, ?, ?, ?, ?)";
        connection.query(
          query,
          [name, tel, email, address, hashedPassword],
          (err, results) => {
            if (err) {
              console.error("Database error:", err);
              return res.status(500).json({
                success: false,
                message: "Database error",
                data: null
              });
            }

            const userData = {
              User_id: results.insertId,
              User_name: name,
              User_tel: tel,
              User_email: email,
              User_address: address
            };

            res.status(201).json({
              success: true,
              message: "Registration successful",
              data: userData
            });
          }
        );
      });
    });
  });

  router.post('/reset-password', (req, res) => {
    const { email, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
      });
    }

    let query, params;

    if (email) {
      query = 'SELECT * FROM `user` WHERE User_email = ?';
      params = [email];
    } else {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ครบถ้วน'
      });
    }

    connection.query(query, params, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในระบบ'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบผู้ใช้ในระบบ'
        });
      }

      const user = results[0];

      bcrypt.hash(newPassword, 10, (hashErr, hashedPassword) => {
        if (hashErr) {
          console.error('Password hashing error:', hashErr);
          return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน'
          });
        }
        const updateQuery = 'UPDATE `user` SET User_password = ? WHERE User_id = ?';

        connection.query(updateQuery, [hashedPassword, user.User_id], (updateErr) => {
          if (updateErr) {
            console.error('Password update error:', updateErr);
            return res.status(500).json({
              success: false,
              message: 'เกิดข้อผิดพลาดในการอัปเดตรหัสผ่าน'
            });
          }

          res.json({
            success: true,
            message: 'รีเซ็ตรหัสผ่านสำเร็จ'
          });
        });
      });
    });
  });

  router.get("/verify-token", (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
        data: null
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      res.json({
        success: true,
        message: "Token is valid",
        data: { userId: decoded.userId }
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        data: null
      });
    }
  });

  // API ทดสอบ Google OAuth (สำหรับ Postman)
  router.post("/test-google-oauth", (req, res) => {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        data: null
      });
    }

    // จำลอง Google OAuth callback
    const mockProfile = {
      displayName: name || 'Test User',
      emails: [{ value: email }]
    };

    // ตรวจสอบ user ใน database
    connection.query('SELECT * FROM user WHERE User_email = ?', [email], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: "Database error",
          data: null
        });
      }

      if (results.length > 0) {
        // User มีอยู่แล้ว
        const user = results[0];
        console.log('User found:', user);
        res.json({
          success: true,
          message: "User found in database",
          data: {
            user: user,
            isNewUser: false,
            oauthProvider: 'google'
          }
        });
      } else {
        // สร้าง user ใหม่
        const newUser = {
          User_name: mockProfile.displayName,
          User_email: email,
          User_tel: '',
          User_address: '',
          User_password: ''
        };

        connection.query('INSERT INTO user SET ?', newUser, (err, result) => {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({
              success: false,
              message: "Error creating user",
              data: null
            });
          }

          newUser.User_id = result.insertId;
          console.log('New user created:', newUser);
          res.json({
            success: true,
            message: "New user created successfully",
            data: {
              user: newUser,
              isNewUser: true,
              oauthProvider: 'google'
            }
          });
        });
      }
    });
  });

  // API ตรวจสอบ session
  router.get("/verify-session", (req, res) => {
    // ตรวจสอบ session ของ Passport.js (สำหรับ OAuth)
    if (req.isAuthenticated() && req.user) {
      res.json({
        success: true,
        message: "User is authenticated via session",
        user: req.user,
        authType: 'session'
      });
    } else {
      res.status(401).json({
        success: false,
        message: "User is not authenticated via session",
        data: null,
        authType: 'none'
      });
    }
  });

  module.exports = router;
