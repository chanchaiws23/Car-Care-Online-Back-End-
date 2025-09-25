const express = require("express");
const router = express.Router();
const { connection } = require("../config/passport-config");

// Check and create UseSer table if it doesn't exist
function ensureUseSerTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS UseSer (
      Use_id INT AUTO_INCREMENT PRIMARY KEY,
      Use_code VARCHAR(20) UNIQUE NOT NULL,
      Use_detail TEXT NOT NULL,
      Use_price DECIMAL(10,2) NOT NULL,
      Payment_id INT,
      Service_id INT,
      Package_id INT,
      Promo_id INT,
      Reser_id INT NOT NULL,
      Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      Updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reser_id (Reser_id),
      INDEX idx_payment_id (Payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  connection.query(createTableQuery, (err) => {
    if (err) {
      console.error('Error creating UseSer table:', err);
    } else {
    }
  });
}

// Call this function when the module loads
ensureUseSerTable();

// ฟังก์ชันสร้าง Use_code อัตโนมัติ
function generateUseCode(callback) {
  connection.query("SELECT MAX(CAST(SUBSTRING(Use_code, 4) AS UNSIGNED)) AS maxCode FROM UseSer", (err, results) => {
    if (err) return callback(err);

    const nextCode = results[0].maxCode ? results[0].maxCode + 1 : 1; // ถ้าไม่มีก็เริ่มที่ 1
    const useCode = `US-${String(nextCode).padStart(7, '0')}`; // รูปแบบ US-0000001
    callback(null, useCode);
  });
}

router.get('/', (req, res) => {
  // First check if table exists
  connection.query("SHOW TABLES LIKE 'UseSer'", (err, results) => {
    if (err) {
      console.error('Error checking table:', err);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('UseSer table does not exist, creating it...');
      ensureUseSerTable();
      return res.status(404).json({
        message: 'UseSer table not found, creating it...',
        error: 'Table does not exist'
      });
    }

    // Table exists, proceed with normal query
    connection.query('SELECT * FROM UseSer', (err, results) => {
      if (err) {
        console.error('Error querying UseSer:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(results);
    });
  });
});

// Manual table creation route
router.post('/create-table', (req, res) => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS UseSer (
      Use_id INT AUTO_INCREMENT PRIMARY KEY,
      Use_code VARCHAR(20) UNIQUE NOT NULL,
      Use_detail TEXT NOT NULL,
      Use_price DECIMAL(10,2) NOT NULL,
      Payment_id INT,
      Service_id INT,
      Package_id INT,
      Promo_id INT,
      Reser_id INT NOT NULL,
      Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      Updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reser_id (Reser_id),
      INDEX idx_payment_id (Payment_id),
      INDEX idx_service_id (Service_id),
      INDEX idx_package_id (Package_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  connection.query(createTableQuery, (err, result) => {
    if (err) {
      console.error('Error creating table:', err);
      return res.status(500).json({
        success: false,
        message: "Failed to create table",
        error: err.message
      });
    }

    console.log('Table created/verified successfully');
    res.json({
      success: true,
      message: 'UseSer table is ready',
      data: result
    });
  });
});

// Check table structure
router.get('/structure', (req, res) => {
  connection.query("DESCRIBE UseSer", (err, results) => {
    if (err) {
      console.error('Error describing table:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({
      success: true,
      message: 'Table structure retrieved',
      data: results
    });
  });
});

// GET a specific UseSer record
router.get('/:id', (req, res) => {
  connection.query('SELECT * FROM UseSer WHERE Use_id = ?', [req.params.id], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ message: 'UseSer not found' });
      return;
    }
    res.json(results[0]);
  });
});

// POST a new UseSer record
router.post('/', (req, res) => {
  console.log('Received UseSer POST request:', req.body);

  const { Use_detail, Use_price, Payment_id, Service_id, Package_id, Promo_id, Reser_id } = req.body;

  // Validate required fields
  if (!Use_detail || !Use_price || !Payment_id || !Reser_id) {
    console.error('Missing required fields:', { Use_detail, Use_price, Payment_id, Reser_id });
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
      data: null
    });
  }

  // Validate data types
  if (typeof Use_price !== 'number' || Use_price <= 0) {
    console.error('Invalid Use_price:', Use_price);
    return res.status(400).json({
      success: false,
      message: "Invalid price value",
      data: null
    });
  }

  if (typeof Payment_id !== 'number' || Payment_id <= 0) {
    console.error('Invalid Payment_id:', Payment_id);
    return res.status(400).json({
      success: false,
      message: "Invalid payment ID",
      data: null
    });
  }

  if (typeof Reser_id !== 'number' || Reser_id <= 0) {
    console.error('Invalid Reser_id:', Reser_id);
    return res.status(400).json({
      success: false,
      message: "Invalid reservation ID",
      data: null
    });
  }

  // Convert optional fields to null if they are arrays or invalid
  const serviceId = (Service_id && !Array.isArray(Service_id) && typeof Service_id === 'number') ? Service_id : null;
  const packageId = (Package_id && !Array.isArray(Package_id) && typeof Package_id === 'number') ? Package_id : null;
  const promoId = (Promo_id && !Array.isArray(Promo_id) && typeof Promo_id === 'number') ? Promo_id : null;

  generateUseCode((err, useCode) => {
    if (err) {
      console.error('Error generating Use_code:', err);
      return res.status(500).json({
        success: false,
        message: "Database error generating code",
        data: null
      });
    }

    console.log('Generated Use_code:', useCode);
    console.log('Inserting data:', { useCode, Use_detail, Use_price, Payment_id, serviceId, packageId, promoId, Reser_id });

    const insertQuery = `INSERT INTO UseSer (Use_code, Use_detail, Use_price, Payment_id, Service_id, Package_id, Promo_id, Reser_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    connection.query(insertQuery, [useCode, Use_detail, Use_price, Payment_id, serviceId, packageId, promoId, Reser_id], (err, result) => {
              if (err) {
          console.error('Database insert error:', err);
          console.error('SQL Query:', insertQuery);
          console.error('Parameters:', [useCode, Use_detail, Use_price, Payment_id, serviceId, packageId, promoId, Reser_id]);
          console.error('Error details:', {
            code: err.code,
            errno: err.errno,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage
          });

          res.status(500).json({
            success: false,
            message: "Database error",
            error: err.message,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage,
            code: err.code,
            errno: err.errno
          });
          return;
        }

      console.log('UseSer created successfully:', result);
              res.status(201).json({
          success: true,
          message: 'UseSer created',
          data: {
            Use_id: result.insertId,
            Use_code: useCode,
            Use_detail,
            Use_price,
            Payment_id,
            Service_id: serviceId,
            Package_id: packageId,
            Promo_id: promoId,
            Reser_id
          }
        });
    });
  });
});

// PUT (update) a UseSer record
router.put('/:id', (req, res) => {
  const { Use_detail, Use_price, Payment_id, Service_id, Package_id, Promo_id, Reser_id } = req.body;
  connection.query('UPDATE UseSer SET Use_detail = ?, Use_price = ?, Payment_id = ?, Service_id = ?, Package_id = ?, Promo_id = ?, Reser_id = ? WHERE Use_id = ?',
    [Use_detail, Use_price, Payment_id, Service_id, Package_id, Promo_id, Reser_id, req.params.id],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (result.affectedRows === 0) {
        res.status(404).json({ message: 'UseSer not found' });
        return;
      }
      res.json({ message: 'UseSer updated' });
    });
});

router.delete('/:id', (req, res) => {
  connection.query('DELETE FROM UseSer WHERE Use_id = ?', [req.params.id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'UseSer not found' });
      return;
    }
    res.json({ message: 'UseSer deleted' });
  });
});

module.exports = router;
