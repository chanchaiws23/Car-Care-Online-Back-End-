const express = require("express");
const router = express.Router();
const { connection } = require("../config/passport-config");

// API ดึงข้อมูลแพ็คเกจทั้งหมด
router.get("/", (req, res) => {
  const query = `
        SELECT p.Package_id,
               p.Package_name,
               p.Package_detail,
               p.Package_price,
               p.Is_active,
               GROUP_CONCAT(DISTINCT s.Service_name) AS Service_names
        FROM Package p
        LEFT JOIN Package_Service ps ON p.Package_id = ps.Package_id
        LEFT JOIN Service s ON ps.Service_id = s.Service_id
        GROUP BY p.Package_id;
    `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Packages retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลแพ็คเกจที่เปิดใช้งานเท่านั้น
router.get("/active", (req, res) => {
  const query = `
        SELECT p.Package_id,
               p.Package_name,
               p.Package_detail,
               p.Package_price,
               p.Is_active,
               GROUP_CONCAT(DISTINCT s.Service_name) AS Service_names
        FROM Package p
        LEFT JOIN Package_Service ps ON p.Package_id = ps.Package_id
        LEFT JOIN Service s ON ps.Service_id = s.Service_id
        WHERE p.Is_active = TRUE
        GROUP BY p.Package_id;
    `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    res.json({
      success: true,
      message: "Active packages retrieved successfully",
      data: results
    });
  });
});

// API เพิ่มแพ็คเกจใหม่
router.post("/", (req, res) => {
  const { Package_name, Package_detail, Package_price, Service_ids, Is_active } = req.body;

  if (
    !Package_name ||
    !Package_price ||
    !Service_ids ||
    Service_ids.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid input",
      data: null
    });
  }

  const insertPackage = `INSERT INTO Package (Package_name, Package_detail, Package_price, Is_active) VALUES (?, ?, ?, ?)`;
  connection.query(
    insertPackage,
    [Package_name, Package_detail, Package_price, Is_active],
    (err, packageResult) => {
      if (err) {
        console.error("Error inserting package:", err);
        return res.status(500).json({
          success: false,
          message: "Database error",
          data: null
        });
      }

      const packageId = packageResult.insertId; // Get the newly created ID

      // เพิ่ม Service_ids ลงในตารางกลาง (Package_Service)
      if (Service_ids && Service_ids.length) {
        const serviceValues = Service_ids.map((serviceId) => [
          packageId,
          serviceId,
        ]);
        const insertServiceQuery = `INSERT INTO Package_Service (Package_id, Service_id) VALUES ?`;
        connection.query(insertServiceQuery, [serviceValues], (err) => {
          if (err) {
            console.error("Error inserting services:", err);
            return res.status(500).json({
              success: false,
              message: "Database error",
              data: null
            });
          }

          res.json({
            success: true,
            message: "Package created successfully",
            data: { Package_id: packageId, Package_name, Package_detail, Package_price, Is_active }
          });
        });
      } else {
        res.status(201).json({
          success: true,
          message: "Package created successfully",
          data: { Package_id: packageId, Package_name, Package_detail, Package_price, Is_active }
        });
      }
    }
  );
});

// API อัปเดตแพ็คเกจ
router.put("/:id", (req, res) => {
  const packageId = req.params.id;
  const { Package_name, Package_detail, Package_price, Service_ids, Is_active } = req.body;

  if (
    !Package_name ||
    Package_price == null ||
    !Array.isArray(Service_ids) ||
    Service_ids.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid input data",
      data: null
    });
  }

  const updatePackage = `UPDATE Package SET Package_name = ?, Package_detail = ?, Package_price = ?, Is_active = ? WHERE Package_id = ?`;
  connection.query(
    updatePackage,
    [Package_name, Package_detail, Package_price, Is_active, packageId],
    (err) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });

      // ลบ Service เดิม
      const deleteOldServices = `DELETE FROM Package_Service WHERE Package_id = ?`;
      connection.query(deleteOldServices, [packageId], (err) => {
        if (err) return res.status(500).json({
          success: false,
          message: "Database error",
          data: null
        });

        // เพิ่ม Service ใหม่
        const serviceValues = Service_ids.map((serviceId) => [
          packageId,
          serviceId,
        ]);
        const insertPackageService = `INSERT INTO Package_Service (Package_id, Service_id) VALUES ?`;
        connection.query(insertPackageService, [serviceValues], (err) => {
          if (err) return res.status(500).json({
            success: false,
            message: "Database error",
            data: null
          });

          res.json({
            success: true,
            message: "Package updated successfully",
            data: { Package_id: parseInt(packageId), Package_name, Package_detail, Package_price, Is_active }
          });
        });
      });
    }
  );
});

// API ลบแพ็คเกจ
router.delete("/:id", (req, res) => {
  const packageId = req.params.id;

  connection.query(
    "DELETE FROM Package_Service WHERE Package_id = ?",
    [packageId],
    (err) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });

      connection.query(
        "DELETE FROM Package WHERE Package_id = ?",
        [packageId],
        (err, result) => {
          if (err) return res.status(500).json({
            success: false,
            message: "Database error",
            data: null
          });

          if (result.affectedRows === 0) {
            return res.status(404).json({
              success: false,
              message: "Package not found",
              data: null
            });
          }

          res.json({
            success: true,
            message: "Package deleted successfully",
            data: null
          });
        }
      );
    }
  );
});

// API ดึงข้อมูลแพ็คเกจพร้อมจำนวนการจอง
router.get("/with-reservations", (req, res) => {
  const query = `
    SELECT p.*,
           COUNT(r.Reser_id) as reservation_count
    FROM Package p
    LEFT JOIN reservation r ON p.Package_id = r.Package_id
    GROUP BY p.Package_id
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
      message: "Packages with reservation count retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลแพ็คเกจที่นิยม
router.get("/popular", (req, res) => {
  const query = `
    SELECT p.*,
           COUNT(r.Reser_id) as reservation_count
    FROM Package p
    LEFT JOIN reservation r ON p.Package_id = r.Package_id
    GROUP BY p.Package_id
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
      message: "Popular packages retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลแพ็คเกจตามช่วงราคา
router.get("/price-range/:min/:max", (req, res) => {
  const { min, max } = req.params;

  const query = "SELECT * FROM Package WHERE Package_price BETWEEN ? AND ? ORDER BY Package_price";
  connection.query(query, [min, max], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    res.json({
      success: true,
      message: "Packages in price range retrieved successfully",
      data: results
    });
  });
});

// API ค้นหาแพ็คเกจ
router.get("/search/:keyword", (req, res) => {
  const keyword = `%${req.params.keyword}%`;

  const query = "SELECT * FROM Package WHERE Package_name LIKE ? OR Package_detail LIKE ? ORDER BY Package_name";
  connection.query(query, [keyword, keyword], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    res.json({
      success: true,
      message: "Packages search results retrieved successfully",
      data: results
    });
  });
});

// API ดึงข้อมูลแพ็คเกจตาม ID
router.get("/:id", (req, res) => {
  const packageId = req.params.id;

  // ดึงข้อมูลแพ็คเกจ
  const packageQuery = "SELECT * FROM Package WHERE Package_id = ?";
  connection.query(packageQuery, [packageId], (err, packageResults) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    if (packageResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
        data: null
      });
    }

    const packageData = packageResults[0];

    // ดึงข้อมูล Service IDs ที่เกี่ยวข้อง
    const serviceQuery = "SELECT Service_id FROM Package_Service WHERE Package_id = ?";
    connection.query(serviceQuery, [packageId], (err, serviceResults) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });

      const serviceIds = serviceResults.map(row => row.Service_id);

      res.json({
        success: true,
        message: "Package retrieved successfully",
        data: {
          ...packageData,
          Service_ids: serviceIds
        }
      });
    });
  });
});

// API ดึงข้อมูลแพ็คเกจพร้อมรายการบริการ
router.get("/:id/services", (req, res) => {
  const packageId = req.params.id;

  const query = `
    SELECT s.*
    FROM Service s
    INNER JOIN Package_Service ps ON s.Service_id = ps.Service_id
    WHERE ps.Package_id = ?
  `;

  connection.query(query, [packageId], (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    res.json({
      success: true,
      message: "Package services retrieved successfully",
      data: results
    });
  });
});

module.exports = router;
