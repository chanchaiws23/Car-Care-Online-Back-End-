const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { connection } = require("../config/passport-config");

// API ลงทะเบียนพนักงาน
router.post("/", (req, res) => {
  const { Employ_username, Employ_name, Employ_tel, Employ_address, Employ_email, Employ_password, Employ_status } = req.body;

  bcrypt.hash(Employ_password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Error hashing password",
      data: null
    });

    const query =
      "INSERT INTO Employee (Employ_username, Employ_name, Employ_tel, Employ_email, Employ_address, Employ_password, Employ_status) VALUES (?, ?, ?, ?, ?, ?, ?)";
    connection.query(
      query,
      [Employ_username, Employ_name, Employ_tel, Employ_email, Employ_address, hashedPassword, Employ_status],
      (err, results) => {
        if (err) return res.status(500).json({
          success: false,
          message: "Database error",
          data: null
        });

        res.status(201).json({
          success: true,
          message: "Employee registered successfully",
          data: {
            Employ_id: results.insertId,
            Employ_username,
            Employ_name,
            Employ_tel,
            Employ_email,
            Employ_address,
            Employ_status
          }
        });
      }
    );
  });
});

// API ดึงข้อมูลพนักงาน
router.get("/", (req, res) => {
  connection.query("SELECT * FROM Employee", (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Employees retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลพนักงานตาม ID
router.get("/:id", (req, res) => {
  const employeeId = req.params.id;
  connection.query("SELECT * FROM Employee WHERE Employ_id = ?", [employeeId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
        data: null
      });
    }

    res.json({
      success: true,
      message: "Employee retrieved successfully",
      data: results[0]
    });
  });
});

// API อัปเดตข้อมูลพนักงาน
router.put("/:id", (req, res) => {
  const employeeId = req.params.id;
  const { Employ_username, Employ_name, Employ_tel, Employ_email, Employ_address, Employ_status, Employ_password } = req.body;

  if (Employ_password) {
    // ถ้ามีการส่งรหัสผ่านใหม่มา ให้ hash ก่อน
    bcrypt.hash(Employ_password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Error hashing password",
        data: null
      });
      const query = "UPDATE Employee SET Employ_username = ?, Employ_name = ?, Employ_tel = ?, Employ_email = ?, Employ_address = ?, Employ_status = ?, Employ_password = ? WHERE Employ_id = ?";
      connection.query(query, [Employ_username, Employ_name, Employ_tel, Employ_email, Employ_address, Employ_status, hashedPassword, employeeId], (err, results) => {
        if (err) return res.status(500).json({
          success: false,
          message: "Database error",
          data: null
        });
        if (results.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Employee not found",
            data: null
          });
        }
        res.json({
          success: true,
          message: "Employee updated successfully (with password)",
          data: {
            Employ_id: parseInt(employeeId),
            Employ_username,
            Employ_name,
            Employ_tel,
            Employ_email,
            Employ_address,
            Employ_status
          }
        });
      });
    });
  } else {
    // ไม่เปลี่ยนรหัสผ่าน
    const query = "UPDATE Employee SET Employ_username = ?, Employ_name = ?, Employ_tel = ?, Employ_email = ?, Employ_address = ?, Employ_status = ? WHERE Employ_id = ?";
    connection.query(query, [Employ_username, Employ_name, Employ_tel, Employ_email, Employ_address, Employ_status, employeeId], (err, results) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });
      if (results.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
          data: null
        });
      }
      res.json({
        success: true,
        message: "Employee updated successfully",
        data: {
          Employ_id: parseInt(employeeId),
          Employ_username,
          Employ_name,
          Employ_tel,
          Employ_email,
          Employ_address,
          Employ_status
        }
      });
    });
  }
});

// API ลบพนักงาน
router.delete("/:id", (req, res) => {
  const employeeId = req.params.id;
  connection.query("DELETE FROM Employee WHERE Employ_id = ?", [employeeId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (results.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
        data: null
      });
    }

    res.json({
      success: true,
      message: "Employee deleted successfully",
      data: null
    });
  });
});

module.exports = router;
