const express = require('express');
const router = express.Router();
const { connection } = require('../config/passport-config');

// GET /expense - ดึงข้อมูล expense ทั้งหมด
router.get('/', (req, res) => {
  const query = 'SELECT * FROM expence ORDER BY Exp_date DESC, Exp_time DESC';

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
      message: 'ดึงข้อมูล expense สำเร็จ',
      data: results
    });
  });
});

// GET /expense/summary - สรุปข้อมูล expense
router.get('/summary', (req, res) => {
  const queries = [
    "SELECT SUM(Exp_totalprice) as total FROM expence",
    "SELECT DATE_FORMAT(Exp_date, '%Y-%m') as month, SUM(Exp_totalprice) as total FROM expence GROUP BY DATE_FORMAT(Exp_date, '%Y-%m') ORDER BY month DESC LIMIT 12"
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
    const expense = {
      totalExpense: results[0][0]?.total || 0,
      monthlyExpense: results[1]
    };
    res.json({ success: true, data: expense });
  })
  .catch(err => {
    console.error('Expense summary error:', err);
    res.status(500).json({ success: false, message: "Database error", data: null });
  });
});

// GET /expense/:id - ดึงข้อมูล expense ตาม ID
router.get('/:id', (req, res) => {
  const expenseId = req.params.id;

  const query = 'SELECT * FROM expence WHERE Exp_id = ?';

  connection.query(query, [expenseId], (err, results) => {
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
        message: 'ไม่พบข้อมูล expense ที่ระบุ'
      });
    }

    res.json({
      success: true,
      message: 'ดึงข้อมูล expense สำเร็จ',
      data: results[0]
    });
  });
});

module.exports = router;
