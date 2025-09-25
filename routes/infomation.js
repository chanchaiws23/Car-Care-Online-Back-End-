const express = require("express");
const router = express.Router();
const { connection } = require("../config/passport-config");

// API ดึงข้อมูลทั้งหมด
router.get("/", (req, res) => {
  connection.query("SELECT * FROM Information", (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Information retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลตาม ID
router.get("/:id", (req, res) => {
  const infomationId = req.params.id; // ดึงค่าของ id จาก URL
  connection.query(
    "SELECT * FROM Information WHERE Info_id = ?",
    [infomationId],
    (err, results) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });
      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Information not found",
          data: null
        });
      }
      res.json({
        success: true,
        message: "Information retrieved successfully",
        data: results[0]
      });
    }
  );
});

// API เพิ่มข้อมูล
router.post("/", (req, res) => {
  const { Info_header, Info_date_s, Info_date_e, Info_detail, Info_remark } = req.body;
  connection.query(
    "INSERT INTO Information (Info_header, Info_date_s, Info_date_e, Info_detail, Info_remark) VALUES (?, ?, ?, ?, ?)",
    [Info_header, Info_date_s, Info_date_e, Info_detail, Info_remark],
    (err, results) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });
      res.json({
        success: true,
        message: "Information added successfully",
        data: {
          Info_id: results.insertId,
          Info_header,
          Info_date_s,
          Info_date_e,
          Info_detail,
          Info_remark
        }
      });
    }
  );
});

// API อัปเดตข้อมูลตาม ID
router.put("/:id", (req, res) => {
  const { Info_header, Info_date_s, Info_date_e, Info_detail, Info_remark } = req.body;
  const infomationId = req.params.id;
  connection.query(
    "UPDATE Information SET Info_header = ?, Info_date_s = ?, Info_date_e = ?, Info_detail = ?, Info_remark = ? WHERE Info_id = ?",
    [Info_header, Info_date_s, Info_date_e, Info_detail, Info_remark, infomationId],
    (err, results) => {
      if (err) {
        console.error(err); // ตรวจสอบข้อผิดพลาดใน console
        return res.status(500).json({
          success: false,
          message: "Database error",
          data: null
        });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Information not found",
          data: null
        });
      }
      res.json({
        success: true,
        message: "Information updated successfully",
        data: {
          Info_id: parseInt(infomationId),
          Info_header,
          Info_date_s,
          Info_date_e,
          Info_detail,
          Info_remark
        }
      });
    }
  );
});

// API ลบข้อมูลตาม ID
router.delete("/:id", (req, res) => {
  connection.query(
    "DELETE FROM Information WHERE Info_id = ?",
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });

      if (results.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Information not found",
          data: null
        });
      }

      res.json({
        success: true,
        message: "Information deleted successfully",
        data: null
      });
    }
  );
});

module.exports = router;
