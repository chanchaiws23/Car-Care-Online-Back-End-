const express = require("express");
const router = express.Router();
const { connection } = require("../config/passport-config");

// API ดึงข้อมูลบริการทั้งหมด
router.get("/", (req, res) => {
  connection.query("SELECT * FROM Service", (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Services retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลบริการที่เปิดใช้งานเท่านั้น
router.get("/active", (req, res) => {
  connection.query("SELECT * FROM Service WHERE Is_active = TRUE", (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Active services retrieved successfully",
      data: results
    });
  });
});

// API ดึงบริการตาม ID
router.get("/:id", (req, res) => {
  const serviceId = req.params.id;

  connection.query("SELECT * FROM Service WHERE Service_id = ?", [serviceId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
        data: null
      });
    }
    res.json({
      success: true,
      message: "Service retrieved successfully",
      data: results[0]
    });
  });
});

// API เพิ่มบริการใหม่
router.post("/", (req, res) => {
  const { Service_name, Service_price, Is_active } = req.body;

  connection.query("INSERT INTO Service (Service_name, Service_price, Is_active) VALUES (?, ?, ?)", [Service_name, Service_price, Is_active], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Service added successfully",
      data: { Service_id: results.insertId, Service_name, Service_price, Is_active }
    });
  });
});

// API อัปเดตบริการ
router.put("/:id", (req, res) => {
  const serviceId = req.params.id;
  const { Service_name, Service_price, Is_active } = req.body;

  connection.query("UPDATE Service SET Service_name = ?, Service_price = ?, Is_active = ? WHERE Service_id = ?", [Service_name, Service_price, Is_active, serviceId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (results.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
        data: null
      });
    }
    res.json({
      success: true,
      message: "Service updated successfully",
      data: { Service_id: parseInt(serviceId), Service_name, Service_price, Is_active }
    });
  });
});

// API ลบบริการ
router.delete("/:id", (req, res) => {
  const serviceId = req.params.id;

  connection.query("DELETE FROM Service WHERE Service_id = ?", [serviceId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (results.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
        data: null
      });
    }

    res.json({
      success: true,
      message: "Service deleted successfully",
      data: null
    });
  });
});

// API ดึงข้อมูลบริการพร้อมจำนวนการจอง
router.get("/with-reservations", (req, res) => {
  const query = `
    SELECT s.*,
           COUNT(r.Reser_id) as reservation_count
    FROM Service s
    LEFT JOIN reservation r ON s.Service_id = r.Service_id
    GROUP BY s.Service_id
    ORDER BY reservation_count DESC
  `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    res.json({
      success: true,
      message: "Services with reservation count retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลบริการที่นิยม
router.get("/popular", (req, res) => {
  const query = `
    SELECT s.*,
           COUNT(r.Reser_id) as reservation_count
    FROM Service s
    LEFT JOIN reservation r ON s.Service_id = r.Service_id
    GROUP BY s.Service_id
    ORDER BY reservation_count DESC
    LIMIT 10
  `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    res.json({
      success: true,
      message: "Popular services retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลบริการตามช่วงราคา
router.get("/price-range/:min/:max", (req, res) => {
  const { min, max } = req.params;

  const query = "SELECT * FROM Service WHERE Service_price BETWEEN ? AND ? ORDER BY Service_price";
  connection.query(query, [min, max], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    res.json({
      success: true,
      message: "Services in price range retrieved successfully",
      data: results
    });
  });
});

// API ค้นหาบริการ
router.get("/search/:keyword", (req, res) => {
  const keyword = `%${req.params.keyword}%`;

  const query = "SELECT * FROM Service WHERE Service_name LIKE ? ORDER BY Service_name";
  connection.query(query, [keyword], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    res.json({
      success: true,
      message: "Services search results retrieved successfully",
      data: results
    });
  });
});

module.exports = router;
