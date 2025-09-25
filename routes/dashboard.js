const express = require("express");
const router = express.Router();
const { connection } = require("../config/passport-config");

// Dashboard Stats
router.get("/stats", (req, res) => {
  const queries = [
    "SELECT COUNT(*) as totalUsers FROM user",
    "SELECT COUNT(*) as totalEmployees FROM employee",
    "SELECT COUNT(*) as totalServices FROM service WHERE Is_active = 1",
    "SELECT COUNT(*) as totalPackages FROM package WHERE Is_active = 1",
    "SELECT COUNT(*) as totalPromotions FROM promotion",
    "SELECT COUNT(*) as totalReservations FROM reservation",
    "SELECT COUNT(*) as totalPayments FROM payment",
    "SELECT COUNT(*) as totalIncome FROM income",
    "SELECT COUNT(*) as totalUseser FROM useser",
    "SELECT COUNT(*) as totalTools FROM tools WHERE Tools_status = 'active'"
  ];

  Promise.all(queries.map(query =>
    new Promise((resolve, reject) => {
      connection.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    })
  ))
  .then(results => {
    const stats = {
      totalUsers: results[0].totalUsers,
      totalEmployees: results[1].totalEmployees,
      totalServices: results[2].totalServices,
      totalPackages: results[3].totalPackages,
      totalPromotions: results[4].totalPromotions,
      totalReservations: results[5].totalReservations,
      totalPayments: results[6].totalPayments,
      totalIncome: results[7].totalIncome,
      totalUseser: results[8].totalUseser,
      totalTools: results[9].totalTools
    };
    res.json({ success: true, data: stats });
  })
  .catch(err => {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: "Database error", data: null });
  });
});

// Financial Summary - ใช้ข้อมูลจาก income และ expense โดยตรง
router.get("/financial-summary", async (req, res) => {
  try {
    // ดึงยอดรวมรายได้ทั้งหมด
    const totalIncomeQuery = "SELECT SUM(Income_totalprice) as totalIncome FROM income";

    // ดึงข้อมูลรายได้รายเดือน
    const monthlyIncomeQuery = `
      SELECT
        DATE_FORMAT(Income_date, '%Y-%m') as month,
        SUM(Income_totalprice) as total
      FROM income
      GROUP BY DATE_FORMAT(Income_date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `;

    // ดึงข้อมูลรายได้รายวัน (30 วันล่าสุด)
    const dailyIncomeQuery = `
      SELECT
        DATE_FORMAT(Income_date, '%Y-%m-%d') as date,
        SUM(Income_totalprice) as total
      FROM income
      WHERE Income_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE_FORMAT(Income_date, '%Y-%m-%d')
      ORDER BY date DESC
      LIMIT 30
    `;

    // ดึงยอดรวมรายจ่ายทั้งหมด
    const totalExpenseQuery = "SELECT SUM(Exp_totalprice) as totalExpense FROM expence";

    // ดึงข้อมูลรายจ่ายรายเดือน
    const monthlyExpenseQuery = `
      SELECT
        DATE_FORMAT(Exp_date, '%Y-%m') as month,
        SUM(Exp_totalprice) as total
      FROM expence
      GROUP BY DATE_FORMAT(Exp_date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `;

    // ดึงข้อมูลรายจ่ายรายวัน (30 วันล่าสุด)
    const dailyExpenseQuery = `
      SELECT
        DATE_FORMAT(Exp_date, '%Y-%m-%d') as date,
        SUM(Exp_totalprice) as total
      FROM expence
      WHERE Exp_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE_FORMAT(Exp_date, '%Y-%m-%d')
      ORDER BY date DESC
      LIMIT 30
    `;

    // ดึงข้อมูลการชำระเงิน
    const paymentQueries = [
      "SELECT COUNT(*) as count FROM payment",
      "SELECT COUNT(*) as count FROM payment WHERE completed_at IS NOT NULL",
      "SELECT COUNT(*) as count FROM payment WHERE completed_at IS NULL"
    ];

    const [totalIncomeResult, monthlyIncomeResults, dailyIncomeResults, totalExpenseResult, monthlyExpenseResults, dailyExpenseResults, ...paymentResults] = await Promise.all([
      new Promise((resolve, reject) => {
        connection.query(totalIncomeQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results[0]);
        });
      }),
      new Promise((resolve, reject) => {
        connection.query(monthlyIncomeQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        connection.query(dailyIncomeQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        connection.query(totalExpenseQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results[0]);
        });
      }),
      new Promise((resolve, reject) => {
        connection.query(monthlyExpenseQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        connection.query(dailyExpenseQuery, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      ...paymentQueries.map(query =>
        new Promise((resolve, reject) => {
          connection.query(query, (err, results) => {
            if (err) reject(err);
            else resolve(results[0]);
          });
        })
      )
    ]);

    // Debug: แสดงข้อมูลที่ได้จากฐานข้อมูล
    console.log('=== Financial Summary Debug ===');
    console.log('Total Income Result:', totalIncomeResult);
    console.log('Monthly Income Results:', monthlyIncomeResults);
    console.log('Daily Income Results:', dailyIncomeResults);
    console.log('Total Expense Result:', totalExpenseResult);
    console.log('Monthly Expense Results:', monthlyExpenseResults);
    console.log('Daily Expense Results:', dailyExpenseResults);
    console.log('Payment Results:', paymentResults);

    const financial = {
      totalIncome: totalIncomeResult?.totalIncome || 0,
      monthlyIncome: monthlyIncomeResults,
      dailyIncome: dailyIncomeResults,
      totalExpense: totalExpenseResult?.totalExpense || 0,
      monthlyExpense: monthlyExpenseResults,
      dailyExpense: dailyExpenseResults,
      totalPayments: paymentResults[0]?.count || 0,
      successfulPayments: paymentResults[1]?.count || 0,
      pendingPayments: paymentResults[2]?.count || 0
    };

    console.log('Final Financial Data:', financial);
    res.json({ success: true, data: financial });
  } catch (err) {
    console.error('Financial summary error:', err);
    res.status(500).json({ success: false, message: "Database error", data: null });
  }
});

// Service History
router.get("/service-history", (req, res) => {
  const query = `
    SELECT us.*, p.Payment_bankname, p.Payment_accname, r.Reser_date
    FROM useser us
    LEFT JOIN payment p ON us.Payment_id = p.Payment_id
    LEFT JOIN reservation r ON us.Reser_id = r.Reser_id
    ORDER BY us.Use_id DESC
    LIMIT 50
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Service history error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

// Usage by Month
router.get("/usage-by-month", (req, res) => {
  const query = `
    SELECT DATE_FORMAT(r.Reser_date, '%Y-%m') as month, COUNT(*) as count
    FROM useser us
    JOIN reservation r ON us.Reser_id = r.Reser_id
    GROUP BY DATE_FORMAT(r.Reser_date, '%Y-%m')
    ORDER BY month DESC
    LIMIT 12
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Usage by month error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

// Top Customers
router.get("/top-customers", (req, res) => {
  const query = `
    SELECT u.User_id, u.User_name, u.User_email, COUNT(us.Use_id) as visit_count,
           MAX(r.Reser_date) as last_visit
    FROM user u
    LEFT JOIN reservation r ON u.User_id = r.User_id
    LEFT JOIN useser us ON r.Reser_id = us.Reser_id
    GROUP BY u.User_id, u.User_name, u.User_email
    ORDER BY visit_count DESC
    LIMIT 20
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Top customers error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }

    // แปลงข้อมูลให้ถูกต้อง
    const formattedResults = results.map(item => ({
      ...item,
      visit_count: parseInt(item.visit_count) || 0,
      last_visit: item.last_visit || null
    }));

    res.json({ success: true, data: formattedResults });
  });
});

// Recent Reservations
router.get("/recent-reservations", (req, res) => {
  const query = `
    SELECT r.*, u.User_name
    FROM reservation r
    LEFT JOIN user u ON r.User_id = u.User_id
    ORDER BY r.Reser_id DESC
    LIMIT 10
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Recent reservations error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

// Reservations by Month
router.get("/reservations-by-month", (req, res) => {
  const query = `
    SELECT DATE_FORMAT(Reser_date, '%Y-%m') as month, COUNT(*) as count
    FROM reservation
    GROUP BY DATE_FORMAT(Reser_date, '%Y-%m')
    ORDER BY month DESC
    LIMIT 12
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Reservations by month error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

// Reservations by Status
router.get("/reservations-by-status", (req, res) => {
  const query = `
    SELECT status, COUNT(*) as count
    FROM reservation
    GROUP BY status
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Reservations by status error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

// Today's Reservations
router.get("/today-reservations", (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const query = `
    SELECT r.*, u.User_name
    FROM reservation r
    LEFT JOIN user u ON r.User_id = u.User_id
    WHERE DATE(r.Reser_date) = ?
    ORDER BY r.Reser_id DESC
  `;

  connection.query(query, [today], (err, results) => {
    if (err) {
      console.error('Today reservations error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

// Reservations by Package
router.get("/reservations-by-package", (req, res) => {
  const query = `
    SELECT p.Package_name, COUNT(r.Reser_id) as count
    FROM reservation r
    LEFT JOIN package p ON r.Package_id = p.Package_id
    WHERE r.Package_id IS NOT NULL
    GROUP BY r.Package_id, p.Package_name
    ORDER BY count DESC
    LIMIT 10
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Reservations by package error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

// Reservations by Service
router.get("/reservations-by-service", (req, res) => {
  const query = `
    SELECT s.Service_name, COUNT(r.Reser_id) as count
    FROM reservation r
    LEFT JOIN service s ON r.Service_id = s.Service_id
    WHERE r.Service_id IS NOT NULL
    GROUP BY r.Service_id, s.Service_name
    ORDER BY count DESC
    LIMIT 10
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Reservations by service error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

// Tools Stats
router.get("/tools-stats", (req, res) => {
  const query = `
    SELECT t.Tools_id, t.Tools_name,
           COALESCE((SELECT SUM(Import_total) FROM import_tools WHERE Tools_id = t.Tools_id), 0) as total_imported,
           COALESCE((SELECT SUM(Draw_total) FROM draw_tools WHERE Tools_id = t.Tools_id), 0) as total_drawn,
           (COALESCE((SELECT SUM(Import_total) FROM import_tools WHERE Tools_id = t.Tools_id), 0) -
            COALESCE((SELECT SUM(Draw_total) FROM draw_tools WHERE Tools_id = t.Tools_id), 0)) as remaining_quantity
    FROM tools t
    ORDER BY remaining_quantity ASC
    LIMIT 10
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Tools stats error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }

    // แปลงข้อมูลให้ถูกต้อง
    const formattedResults = results.map(item => ({
      ...item,
      total_imported: parseInt(item.total_imported) || 0,
      total_drawn: parseInt(item.total_drawn) || 0,
      remaining_quantity: parseInt(item.remaining_quantity) || 0
    }));

    res.json({ success: true, data: formattedResults });
  });
});

// New Report Endpoints
router.get("/customer-report", (req, res) => {
  const query = `
    SELECT u.*, COUNT(us.Use_id) as service_count,
           SUM(us.Use_price) as total_spent,
           MAX(r.Reser_date) as last_service
    FROM user u
    LEFT JOIN reservation r ON u.User_id = r.User_id
    LEFT JOIN useser us ON r.Reser_id = us.Reser_id
    GROUP BY u.User_id, u.User_name, u.User_tel, u.User_email, u.User_address, u.User_password, u.reset_token, u.reset_token_expiry, u.verification_code, u.verification_code_expiry
    ORDER BY service_count DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Customer report error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

router.get("/customer-history-report", (req, res) => {
  const query = `
    SELECT u.User_name, us.Use_detail, us.Use_price, r.Reser_date as Use_date,
           p.Payment_bankname, p.Payment_accname
    FROM useser us
    JOIN reservation r ON us.Reser_id = r.Reser_id
    JOIN user u ON r.User_id = u.User_id
    LEFT JOIN payment p ON us.Payment_id = p.Payment_id
    ORDER BY r.Reser_date DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Customer history report error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

router.get("/review-report", (req, res) => {
  const query = `
    SELECT r.*, u.User_name
    FROM review r
    LEFT JOIN user u ON r.User_id = u.User_id
    ORDER BY r.Review_date DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Review report error:', err);
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    res.json({ success: true, data: results });
  });
});

router.get("/overall-report", (req, res) => {
  const queries = [
    "SELECT SUM(Income_totalprice) as total_revenue FROM income",
    "SELECT COUNT(*) as total_customers FROM user",
    "SELECT COUNT(*) as total_services FROM service WHERE Is_active = 1",
    "SELECT AVG(Review_point) as avg_rating FROM review"
  ];

  Promise.all(queries.map(query =>
    new Promise((resolve, reject) => {
      connection.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    })
  ))
  .then(results => {
    const overall = {
      total_revenue: results[0].total_revenue || 0,
      total_customers: results[1].total_customers || 0,
      total_services: results[2].total_services || 0,
      avg_rating: results[3].avg_rating || 0
    };
    res.json({ success: true, data: overall });
  })
  .catch(err => {
    console.error('Overall report error:', err);
    res.status(500).json({ success: false, message: "Database error", data: null });
  });
});


// สรุปคะแนนรีวิว
router.get('/review-summary', (req, res) => {
  const avgQuery = 'SELECT AVG(CAST(Review_point AS DECIMAL(10,2))) as avg_point, COUNT(*) as total_reviews, MAX(CAST(Review_point AS DECIMAL(10,2))) as max_point FROM review';
  connection.query(avgQuery, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', data: null });
    }
    res.json({
      success: true,
      data: {
        avg_point: results[0].avg_point,
        total_reviews: results[0].total_reviews,
        max_point: results[0].max_point
      }
    });
  });
});

module.exports = router;
