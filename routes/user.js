const express = require("express");
const router = express.Router();
const { connection } = require("../config/passport-config");
const bcrypt = require("bcrypt");

router.get("/", (req, res) => {
  connection.query("SELECT * FROM User", (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Users retrieved successfully",
      data: results
    });
  });
});

router.get('/:id', (req, res) => {
  const userId = req.params.id;
  connection.query('SELECT * FROM User WHERE User_id = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null
      });
    }

    res.json({
      success: true,
      message: "User retrieved successfully",
      data: results[0]
    });
  });
});

router.get('/email/:email', (req, res) => {
  const email = req.params.email;
  connection.query('SELECT * FROM user WHERE User_email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null
      });
    }

    res.json({
      success: true,
      message: "User retrieved successfully",
      data: results[0]
    });
  });
});


router.post('/', (req, res) => {
  const { User_name, User_tel, User_email, User_address, User_password } = req.body;
  connection.query('INSERT INTO User (User_name, User_tel, User_email, User_address, User_password) VALUES (?, ?, ?, ?, ?)', [User_name, User_tel, User_email, User_address, User_password], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: 'User created successfully',
      data: { User_id: results.insertId, User_name, User_tel, User_email, User_address }
    });
  });
});

router.put('/:id', (req, res) => {
  const userId = req.params.id;
  const { User_name, User_tel, User_email, User_address } = req.body;

  connection.query('UPDATE User SET User_name = ?, User_tel = ?, User_email = ?, User_address = ? WHERE User_id = ?', [User_name, User_tel, User_email, User_address, userId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (results.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { User_id: parseInt(userId), User_name, User_tel, User_email, User_address }
    });
  });
});

router.put('/:id/password', (req, res) => {
  const userId = req.params.id;
  const { currentPassword, newPassword } = req.body;

  connection.query('SELECT * FROM User WHERE User_id = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    if (results.length === 0) return res.status(404).json({
      success: false,
      message: "User not found",
      data: null
    });

    const user = results[0];

    // เปรียบเทียบรหัสผ่านด้วย bcrypt
    bcrypt.compare(currentPassword, user.User_password, (compareErr, isMatch) => {
      if (compareErr) return res.status(500).json({
        success: false,
        message: "Password comparison error",
        data: null
      });

      if (!isMatch) return res.status(401).json({
        success: false,
        message: "Invalid current password",
        data: null
      });

      // Hash รหัสผ่านใหม่
      bcrypt.hash(newPassword, 10, (hashErr, hashedPassword) => {
        if (hashErr) return res.status(500).json({
          success: false,
          message: "Password hashing error",
          data: null
        });

        connection.query('UPDATE User SET User_password = ? WHERE User_id = ?', [hashedPassword, userId], (err, results) => {
          if (err) return res.status(500).json({
            success: false,
            message: "Database error",
            data: null
          });
          res.json({
            success: true,
            message: 'Password updated successfully',
            data: null
          });
        });
      });
    });
  });
});

router.get('/:id/reservations', async (req, res) => {
  const userId = req.params.id;
  const query = `SELECT * FROM Reservation WHERE User_id = ?`;
  connection.query(query, [userId], async (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    // สำหรับแต่ละ reservation ดึงราคาทั้งหมด
    const getSum = (sql, ids) => new Promise((resolve) => {
      if (!ids.length) return resolve(0);
      connection.query(sql, [ids], (err, rows) => {
        if (err) return resolve(0);
        const sum = rows.reduce((acc, cur) => acc + Number(Object.values(cur)[0] || 0), 0);
        resolve(sum);
      });
    });
    const reservationsWithPrice = await Promise.all(results.map(async (reservation) => {
      const serviceIds = reservation.Service_id && typeof reservation.Service_id === 'string' ? reservation.Service_id.split(',').map(Number) : [];
      const packageIds = reservation.Package_id && typeof reservation.Package_id === 'string' ? reservation.Package_id.split(',').map(Number) : [];
      const promotionIds = reservation.Promotion_id && typeof reservation.Promotion_id === 'string' ? reservation.Promotion_id.split(',').map(Number) : [];
      const serviceSum = await getSum('SELECT SUM(Service_price) as price FROM Service WHERE Service_id IN (?)', serviceIds);
      const packageSum = await getSum('SELECT SUM(Package_price) as price FROM Package WHERE Package_id IN (?)', packageIds);
      const promotionSum = await getSum('SELECT SUM(Promotion_price) as price FROM Promotion WHERE Promotion_id IN (?)', promotionIds);
      const total_price = Number(serviceSum) + Number(packageSum) + Number(promotionSum);
      return { ...reservation, total_price };
    }));
    res.json({
      success: true,
      message: "User reservations retrieved successfully",
      data: reservationsWithPrice
    });
  });
});

router.get('/:id/service-history', (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT us.*,
           r.Reser_code,
           r.Reser_date,
           r.Reser_time,
           r.Customer_name,
           r.Car_number,
           p.Payment_bankname,
           p.Payment_accname,
           p.completed_at as payment_date,
           r.completed_at as completed_at
    FROM UseSer us
    LEFT JOIN reservation r ON us.Reser_id = r.Reser_id
    LEFT JOIN payment p ON us.Payment_id = p.Payment_id
    WHERE r.User_id = ?
    ORDER BY us.Use_id DESC
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    const formattedResults = results.map((item) => {
      let formattedItem = { ...item };

      // แปลง payment_date
      if (item.payment_date) {
        const date = new Date(item.payment_date);
        const thaiDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
        const buddhaYear = thaiDate.getUTCFullYear();
        const formattedTime = `${thaiDate.getUTCHours().toString().padStart(2, '0')}:${thaiDate.getUTCMinutes().toString().padStart(2, '0')}`;
        const formattedDate = `${thaiDate.getUTCDate().toString().padStart(2, '0')}/${(thaiDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${buddhaYear}`;

        formattedItem.payment_date = formattedDate;
        formattedItem.payment_time = formattedTime;
      }

      // แปลง completed_at
      if (item.completed_at) {
        const dateT = new Date(item.completed_at);
        const thaiDateT = new Date(dateT.getTime() + (7 * 60 * 60 * 1000));
        const buddhaYearT = thaiDateT.getUTCFullYear();
        const formattedTimeT = `${thaiDateT.getUTCHours().toString().padStart(2, '0')}:${thaiDateT.getUTCMinutes().toString().padStart(2, '0')}`;
        const formattedDateT = `${thaiDateT.getUTCDate().toString().padStart(2, '0')}/${(thaiDateT.getUTCMonth() + 1).toString().padStart(2, '0')}/${buddhaYearT}`;

        formattedItem.completed_at = formattedDateT;
        formattedItem.completed_time = formattedTimeT;
      }

      // แปลง Reser_date
      if (item.Reser_date) {
        const reserDate = new Date(item.Reser_date);
        const thaiReserDate = new Date(reserDate.getTime() + (7 * 60 * 60 * 1000));
        const buddhaYearReser = thaiReserDate.getUTCFullYear();
        const formattedReserDate = `${thaiReserDate.getUTCDate().toString().padStart(2, '0')}/${(thaiReserDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${buddhaYearReser}`;

        formattedItem.Reser_date = formattedReserDate;
      }

      return formattedItem;
    });

    res.json({
      success: true,
      message: "User service history retrieved successfully",
      data: formattedResults
    });
  });
});

// API ดึงข้อมูลผู้ใช้ทั้งหมด (สำหรับ admin)
router.get("/member", (req, res) => {
  connection.query("SELECT User_id, User_name, User_tel, User_email, User_address FROM User", (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Users retrieved successfully",
      data: results
    });
  });
});

// API จองคิว
router.post("/book-appointment", (req, res) => {
  const { Reser_date, Reser_time, Car_detail, Car_color, Car_number, User_id, Package_id, Service_id, Promotion_id } = req.body;

  // สร้าง reservation code
  const reservationCode = `RS-${Date.now()}`;

  const query = `INSERT INTO reservation (Reser_code, Reser_date, Reser_time, Car_detail, Car_color, Car_number, User_id, Package_id, Service_id, Promotion_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  connection.query(query, [reservationCode, Reser_date, Reser_time, Car_detail, Car_color, Car_number, User_id, Package_id, Service_id, Promotion_id], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: {
        Reser_id: results.insertId,
        Reser_code: reservationCode,
        Reser_date,
        Reser_time,
        Car_detail,
        Car_color,
        Car_number,
        User_id,
        Package_id,
        Service_id,
        Promotion_id
      }
    });
  });
});

// API ดึงข้อมูลการจองของผู้ใช้
router.get("/:id/reservations", (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT r.*,
           p.Package_name,
           s.Service_name,
           pr.Promotion_name
    FROM reservation r
    LEFT JOIN Package p ON r.Package_id = p.Package_id
    LEFT JOIN Service s ON r.Service_id = s.Service_id
    LEFT JOIN Promotion pr ON r.Promotion_id = pr.Promotion_id
    WHERE r.User_id = ?
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "User reservations retrieved successfully",
      data: results
    });
  });
});

// API ดึงประวัติการให้บริการของผู้ใช้
router.get("/:id/service-history", (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT sh.*,
           r.Reser_code,
           p.Package_name,
           s.Service_name
    FROM Service_history sh
    LEFT JOIN reservation r ON sh.Reser_id = r.Reser_id
    LEFT JOIN Package p ON r.Package_id = p.Package_id
    LEFT JOIN Service s ON r.Service_id = s.Service_id
    WHERE r.User_id = ?
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "User service history retrieved successfully",
      data: results
    });
  });
});

module.exports = router;
