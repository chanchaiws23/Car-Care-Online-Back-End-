const express = require("express");
const router = express.Router();
const { connection } = require("../config/passport-config");

// นำเข้าอุปกรณ์
router.post("/import", (req, res) => {
    const { Tools_id, Import_price, Import_total, Import_date, Import_invoice_no } = req.body;

    const importQuery = "INSERT INTO import_tools (Tools_id, Import_price, Import_total, Import_date, Import_invoice_no) VALUES (?, ?, ?, ?, ?)";
    connection.query(importQuery, [Tools_id, Import_price, Import_total, Import_date, Import_invoice_no], (err, importResults) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send({
              success: false,
              message: "Database error",
              data: null
            });
        }

        // Insert into expence table
        // Exp_detail: 'นำเข้าอุปกรณ์', Exp_totalprice: Import_price * Import_total, Exp_date: Import_date, Exp_time: now, Import_id: importResults.insertId
        const expDetail = `นำเข้าอุปกรณ์ (Tools_id: ${Tools_id}, Invoice: ${Import_invoice_no})`;
        const expTotalPrice = Import_price * Import_total;
        const expDate = Import_date;
        const expTime = new Date();
        const importId = importResults.insertId;
        const expenceQuery = "INSERT INTO expence (Exp_detail, Exp_totalprice, Exp_date, Exp_time, Import_id) VALUES (?, ?, ?, ?, ?)";
        connection.query(
          expenceQuery,
          [expDetail, expTotalPrice, expDate, expTime, importId],
          (expErr, expResults) => {
            if (expErr) {
              console.error("Expence insert error:", expErr);
              // Still return success for import, but notify about expence error
              return res.status(201).send({
                success: true,
                message: "Tools imported, but failed to record expense.",
                data: { Import_id: importId, Tools_id, Import_price, Import_total, Import_date },
                expenceError: expErr.message
              });
            }

            res.status(201).send({
              success: true,
              message: "Tools imported and expense recorded successfully",
              data: { Import_id: importId, Tools_id, Import_price, Import_total, Import_date, Exp_id: expResults.insertId }
            });
          }
        );
    });
});

// เบิกอุปกรณ์
router.post("/draw", (req, res) => {
  const { Tools_id, Draw_total, Draw_date, Draw_employee_id } = req.body;

  const query = "INSERT INTO draw_tools (Tools_id, Draw_total, Draw_date, Draw_employee_id) VALUES (?, ?, ?, ?)";
  connection.query(query, [Tools_id, Draw_total, Draw_date, Draw_employee_id], (err, results) => {
      if (err) return res.status(500).send({
        success: false,
        message: "Database error",
        data: null
      });

      res.status(201).send({
        success: true,
        message: "Tools drawn successfully",
        data: { Draw_id: results.insertId, Tools_id, Draw_total }
      });
  });
});

// เพิ่มอุปกรณ์ใหม่
router.post("/", (req, res) => {
  const { Tools_name, Tools_price, Tools_status, Tools_min_stock } = req.body;

  const query = "INSERT INTO tools (Tools_name, Tools_price, Tools_status, Tools_min_stock) VALUES (?, ?, ?, ?)";
  connection.query(query, [Tools_name, Tools_price, Tools_status || 'active', Tools_min_stock], (err, results) => {
      if (err) return res.status(500).send({
        success: false,
        message: "Database error",
        data: null
      });

      res.status(201).send({
        success: true,
        message: "Tools added successfully",
        data: { Tools_id: results.insertId, Tools_name, Tools_price }
      });
  });
});

// ดึงข้อมูลอุปกรณ์ทั้งหมด
router.get("/", (req, res) => {
  const query = "SELECT * FROM tools ORDER BY Tools_name";

  connection.query(query, (err, results) => {
      if (err) return res.status(500).send({
        success: false,
        message: "Database error",
        data: null
      });

      res.status(200).json({
        success: true,
        message: "Tools retrieved successfully",
        data: results
      });
  });
});

// ดึงข้อมูลสต็อกคงเหลือ
router.get("/inventory", (req, res) => {
  const query = `
    SELECT t.*,
           COALESCE((SELECT SUM(Import_total) FROM import_tools WHERE Tools_id = t.Tools_id), 0) as total_imported,
           COALESCE((SELECT SUM(Draw_total) FROM draw_tools WHERE Tools_id = t.Tools_id), 0) as total_drawn,
           (COALESCE((SELECT SUM(Import_total) FROM import_tools WHERE Tools_id = t.Tools_id), 0) -
            COALESCE((SELECT SUM(Draw_total) FROM draw_tools WHERE Tools_id = t.Tools_id), 0)) as current_stock
    FROM tools t
    ORDER BY t.Tools_name
  `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    // คำนวณ stock_status
    const formattedResults = results.map(item => {
      let stock_status = 'In Stock';
      if (item.current_stock <= 0) {
        stock_status = 'Out of Stock';
      } else if (item.current_stock <= (item.Tools_min_stock || 0)) {
        stock_status = 'Low Stock';
      }

      return {
        ...item,
        stock_status,
        total_returned: 0 // ไม่มี return_tools ใน database
      };
    });

    res.json({
      success: true,
      message: "Tools inventory retrieved successfully",
      data: formattedResults
    });
  });
});

// ดึงข้อมูลอุปกรณ์ที่มีสต็อกต่ำ
router.get("/inventory/low-stock", (req, res) => {
  const query = `
    SELECT t.*,
           COALESCE((SELECT SUM(Import_total) FROM import_tools WHERE Tools_id = t.Tools_id), 0) as total_imported,
           COALESCE((SELECT SUM(Draw_total) FROM draw_tools WHERE Tools_id = t.Tools_id), 0) as total_drawn,
           (COALESCE((SELECT SUM(Import_total) FROM import_tools WHERE Tools_id = t.Tools_id), 0) -
            COALESCE((SELECT SUM(Draw_total) FROM draw_tools WHERE Tools_id = t.Tools_id), 0)) as current_stock
    FROM tools t
    HAVING current_stock <= (t.Tools_min_stock OR 0)
    ORDER BY current_stock ASC
  `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    const formattedResults = results.map(item => ({
      ...item,
      stock_status: 'Low Stock',
      total_returned: 0
    }));

    res.json({
      success: true,
      message: "Low stock tools retrieved successfully",
      data: formattedResults
    });
  });
});

// ดึงข้อมูลอุปกรณ์ตาม ID
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const query = "SELECT * FROM tools WHERE Tools_id = ?";

  connection.query(query, [id], (err, results) => {
      if (err) return res.status(500).send({
        success: false,
        message: "Database error",
        data: null
      });

      if (results.length === 0) {
        return res.status(404).send({
          success: false,
          message: "Tools not found",
          data: null
        });
      }

      res.status(200).json({
        success: true,
        message: "Tools retrieved successfully",
        data: results[0]
      });
  });
});

// อัปเดตอุปกรณ์
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { Tools_name, Tools_price, Tools_status, Tools_min_stock } = req.body;

  const query = "UPDATE tools SET Tools_name = ?, Tools_price = ?, Tools_status = ?, Tools_min_stock = ? WHERE Tools_id = ?";
  connection.query(query, [Tools_name, Tools_price, Tools_status, Tools_min_stock, id], (err, results) => {
      if (err) return res.status(500).send({
        success: false,
        message: "Database error",
        data: null
      });

      if (results.affectedRows === 0) {
        return res.status(404).send({
          success: false,
          message: "Tools not found",
          data: null
        });
      }

      res.status(200).send({
        success: true,
        message: "Tools updated successfully",
        data: { Tools_id: parseInt(id), Tools_name, Tools_price }
      });
  });
});

// ลบอุปกรณ์
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM tools WHERE Tools_id = ?";

  connection.query(query, [id], (err, results) => {
      if (err) return res.status(500).send({
        success: false,
        message: "Database error",
        data: null
      });

      if (results.affectedRows === 0) {
        return res.status(404).send({
          success: false,
          message: "Tools not found",
          data: null
        });
      }

      res.status(200).send({
        success: true,
        message: "Tools deleted successfully",
        data: null
      });
  });
});

// API ดึงข้อมูลการนำเข้าอุปกรณ์
router.get("/import/history", (req, res) => {
  const query = `
    SELECT it.*,
           t.Tools_name,
           t.Tools_price
    FROM import_tools it
    LEFT JOIN tools t ON it.Tools_id = t.Tools_id
    ORDER BY it.Import_date DESC
  `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    const formattedResults = results.map((importItem) => {
      const date = new Date(importItem.Import_date);
      const buddhaYear = date.getFullYear() + 543;
      const formattedDate = `${date.getDate()}/${
        date.getMonth() + 1
      }/${buddhaYear}`;

      return {
        ...importItem,
        Import_date: formattedDate
      };
    });

    res.json({
      success: true,
      message: "Import history retrieved successfully",
      data: formattedResults
    });
  });
});

// API ดึงข้อมูลการเบิกอุปกรณ์
router.get("/draw/history", (req, res) => {
  const query = `
    SELECT dt.*,
           t.Tools_name,
           t.Tools_price
    FROM draw_tools dt
    LEFT JOIN tools t ON dt.Tools_id = t.Tools_id
    ORDER BY dt.Draw_date DESC
  `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    const formattedResults = results.map((drawItem) => {
      const date = new Date(drawItem.Draw_date);
      const buddhaYear = date.getFullYear() + 543;
      const formattedDate = `${date.getDate()}/${
        date.getMonth() + 1
      }/${buddhaYear}`;

      return {
        ...drawItem,
        Draw_date: formattedDate
      };
    });

    res.json({
      success: true,
      message: "Draw history retrieved successfully",
      data: formattedResults
    });
  });
});

// API ดึงข้อมูลอุปกรณ์พร้อมจำนวนคงเหลือ
router.get("/:id/history", (req, res) => {
  const toolsId = req.params.id;

  const query = `
    SELECT t.*,
           COALESCE((SELECT SUM(Import_total) FROM import_tools WHERE Tools_id = t.Tools_id), 0) as total_imported,
           COALESCE((SELECT SUM(Draw_total) FROM draw_tools WHERE Tools_id = t.Tools_id), 0) as total_drawn,
           (COALESCE((SELECT SUM(Import_total) FROM import_tools WHERE Tools_id = t.Tools_id), 0) -
            COALESCE((SELECT SUM(Draw_total) FROM draw_tools WHERE Tools_id = t.Tools_id), 0)) as current_stock
    FROM tools t
    WHERE t.Tools_id = ?
  `;

  connection.query(query, [toolsId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tools not found",
        data: null
      });
    }

    res.json({
      success: true,
      message: "Tools history retrieved successfully",
      data: results[0]
    });
  });
});

// API ดึงข้อมูลการนำเข้าอุปกรณ์ตาม ID
router.get("/:id/imports", (req, res) => {
  const toolsId = req.params.id;

  const query = `
    SELECT it.*,
           t.Tools_name
    FROM import_tools it
    LEFT JOIN tools t ON it.Tools_id = t.Tools_id
    WHERE it.Tools_id = ?
    ORDER BY it.Import_date DESC
  `;

  connection.query(query, [toolsId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    const formattedResults = results.map((importItem) => {
      const date = new Date(importItem.Import_date);
      const buddhaYear = date.getFullYear() + 543;
      const formattedDate = `${date.getDate()}/${
        date.getMonth() + 1
      }/${buddhaYear}`;

      return {
        ...importItem,
        Import_date: formattedDate
      };
    });

    res.json({
      success: true,
      message: "Tools imports retrieved successfully",
      data: formattedResults
    });
  });
});

// API ดึงข้อมูลการเบิกอุปกรณ์ตาม ID
router.get("/:id/draws", (req, res) => {
  const toolsId = req.params.id;

  const query = `
    SELECT dt.*,
           t.Tools_name
    FROM draw_tools dt
    LEFT JOIN tools t ON dt.Tools_id = t.Tools_id
    WHERE dt.Tools_id = ?
    ORDER BY dt.Draw_date DESC
  `;

  connection.query(query, [toolsId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    const formattedResults = results.map((drawItem) => {
      const date = new Date(drawItem.Draw_date);
      const buddhaYear = date.getFullYear() + 543;
      const formattedDate = `${date.getDate()}/${
        date.getMonth() + 1
      }/${buddhaYear}`;

      return {
        ...drawItem,
        Draw_date: formattedDate
      };
    });

    res.json({
      success: true,
      message: "Tools draw history retrieved successfully",
      data: formattedResults
    });
  });
});

module.exports = router;
