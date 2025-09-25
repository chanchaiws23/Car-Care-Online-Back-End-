const express = require("express");
const router = express.Router();
const { connection } = require("../config/passport-config");

// ดึงคะแนนรีวิวทั้งหมดและคะแนนเฉลี่ย
router.get("/", (req, res) => {
  const query = "SELECT * FROM review ORDER BY Review_date DESC";
  const avgQuery = "SELECT AVG(CAST(Review_point AS DECIMAL(10,2))) as avg_point, COUNT(*) as total_reviews FROM review";

  connection.query(query, (err, reviews) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error", data: null });
    }
    connection.query(avgQuery, (err2, avgResult) => {
      if (err2) {
        return res.status(500).json({ success: false, message: "Database error", data: null });
      }
      res.json({
        success: true,
        data: {
          reviews,
          avg_point: avgResult[0].avg_point,
          total_reviews: avgResult[0].total_reviews
        }
      });
    });
  });
});

module.exports = router;
