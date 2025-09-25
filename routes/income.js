const express = require('express');
const router = express.Router();
const { connection } = require('../config/passport-config');

// POST /income - สร้าง income record ใหม่
router.post('/', (req, res) => {
  const { Income_detail, Income_totalprice, Income_date, Income_time, Payment_id, completed_at } = req.body;

  // ตรวจสอบข้อมูลที่จำเป็น
  if (!Income_detail || !Income_totalprice || !Income_date || !Income_time || !Payment_id) {
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลไม่ครบถ้วน กรุณาระบุ Income_detail, Income_totalprice, Income_date, Income_time, Payment_id'
    });
  }

  const createIncomeQuery = `
    INSERT INTO income (Income_detail, Income_totalprice, Income_date, Income_time, Payment_id, completed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  connection.query(createIncomeQuery, [
    Income_detail,
    Income_totalprice,
    Income_date,
    Income_time,
    Payment_id,
    completed_at || null
  ], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        error: err.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'บันทึกข้อมูล income สำเร็จ',
      data: {
        Income_id: result.insertId,
        Income_detail,
        Income_totalprice,
        Income_date,
        Income_time,
        Payment_id,
        completed_at
      }
    });
  });
});

// GET /income - ดึงข้อมูล income ทั้งหมด
router.get('/', (req, res) => {
  const query = 'SELECT * FROM income ORDER BY Income_date DESC, Income_time DESC';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
        error: err.message
      });
    }

    res.json({
      success: true,
      message: 'ดึงข้อมูล income สำเร็จ',
      data: results
    });
  });
});

// GET /income/summary - สรุปข้อมูล income
router.get('/summary', (req, res) => {
  const queries = [
    "SELECT SUM(Income_totalprice) as total FROM income",
    "SELECT DATE_FORMAT(Income_date, '%Y-%m') as month, SUM(Income_totalprice) as total FROM income GROUP BY DATE_FORMAT(Income_date, '%Y-%m') ORDER BY month DESC LIMIT 12",
    "SELECT COUNT(*) as count FROM payment",
    "SELECT COUNT(*) as count FROM payment WHERE completed_at IS NOT NULL",
    "SELECT COUNT(*) as count FROM payment WHERE completed_at IS NULL"
  ];

  Promise.all(queries.map(query =>
    new Promise((resolve, reject) => {
      connection.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ))
  .then(results => {
    const financial = {
      totalIncome: results[0][0]?.total || 0,
      monthlyIncome: results[1],
      totalPayments: results[2][0]?.count || 0,
      successfulPayments: results[3][0]?.count || 0,
      pendingPayments: results[4][0]?.count || 0
    };
    res.json({ success: true, data: financial });
  })
  .catch(err => {
    console.error('Income summary error:', err);
    res.status(500).json({ success: false, message: "Database error", data: null });
  });
});

// GET /income/:id - ดึงข้อมูล income ตาม ID
router.get('/:id', (req, res) => {
  const incomeId = req.params.id;

  const query = 'SELECT * FROM income WHERE Income_id = ?';

  connection.query(query, [incomeId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล income ที่ระบุ'
      });
    }

    res.json({
      success: true,
      message: 'ดึงข้อมูล income สำเร็จ',
      data: results[0]
    });
  });
});

module.exports = router;
