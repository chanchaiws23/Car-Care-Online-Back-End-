const express = require("express");
const { connection } = require("../config/passport-config");
const router = express.Router();


function generateReservationCode(callback) {
  connection.query("SELECT MAX(CAST(SUBSTRING(Reser_code, 4) AS UNSIGNED)) AS maxCode FROM reservation", (err, results) => {
    if (err) return callback(err);

    const nextCode = results[0].maxCode ? results[0].maxCode + 1 : 1; // ถ้าไม่มีก็เริ่มที่ 1
    const reservationCode = `RS-${String(nextCode).padStart(7, '0')}`; // รูปแบบ RS-0000001
    callback(null, reservationCode);
  });
}

// Helper สำหรับรวมราคา
async function addTotalPriceToReservations(reservations, connection) {
  const getSum = (sql, ids) => new Promise((resolve) => {
    if (!ids.length) return resolve(0);
    connection.query(sql, [ids], (err, rows) => {
      if (err) return resolve(0);
      const sum = rows.reduce((acc, cur) => acc + Number(Object.values(cur)[0] || 0), 0);
      resolve(sum);
    });
  });
  return await Promise.all(reservations.map(async (reservation) => {
    const serviceIds = reservation.Service_id && typeof reservation.Service_id === 'string' ? reservation.Service_id.split(',').map(Number) : [];
    const packageIds = reservation.Package_id && typeof reservation.Package_id === 'string' ? reservation.Package_id.split(',').map(Number) : [];
    const promotionIds = reservation.Promotion_id && typeof reservation.Promotion_id === 'string' ? reservation.Promotion_id.split(',').map(Number) : [];
    const serviceSum = await getSum('SELECT SUM(Service_price) as price FROM Service WHERE Service_id IN (?)', serviceIds);
    const packageSum = await getSum('SELECT SUM(Package_price) as price FROM Package WHERE Package_id IN (?)', packageIds);
    const promotionSum = await getSum('SELECT SUM(Promotion_price) as price FROM Promotion WHERE Promotion_id IN (?)', promotionIds);
    const total_price = Number(serviceSum) + Number(packageSum) + Number(promotionSum);
    return { ...reservation, total_price: Number(total_price) };
  }));
}

router.get("/", async (req, res) => {
  const query = `
    SELECT r.*,
           u.User_name,
           p.Package_name,
           s.Service_name,
           m.Promotion_name
    FROM reservation r
    LEFT JOIN User u ON r.User_id = u.User_id
    LEFT JOIN Package p ON r.Package_id = p.Package_id
    LEFT JOIN Service s ON r.Service_id = s.Service_id
    LEFT JOIN Promotion m ON r.Promotion_id = m.Promotion_id;
  `;

  connection.query(query, async (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });

    // แปลง string เป็น array
    const formattedResults = results.map((reservation) => {
      reservation.Service_id = reservation.Service_id && typeof reservation.Service_id === 'string' ? reservation.Service_id.split(',').map(Number) : [];
      reservation.Package_id = reservation.Package_id && typeof reservation.Package_id === 'string' ? reservation.Package_id.split(',').map(Number) : [];
      reservation.Promotion_id = reservation.Promotion_id && typeof reservation.Promotion_id === 'string' ? reservation.Promotion_id.split(',').map(Number) : [];
      const date = new Date(reservation.Reser_date);
      const buddhaYear = date.getFullYear() + 543;
      const formattedDate = `${date.getDate()}/${
        date.getMonth() + 1
      }/${buddhaYear}`;
      const time = reservation.Reser_time.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      return {
        ...reservation,
        Reser_date: formattedDate,
        Reser_time: time,
        User_name: reservation.User_name,
        Package_name: reservation.Package_name,
        Service_name: reservation.Service_name,
        Promotion_name: reservation.Promotion_name,
        Customer_name: reservation.Customer_name,
        Customer_phone: reservation.Customer_phone
      };
    });
    const withPrice = await addTotalPriceToReservations(formattedResults, connection);
    res.json({
      success: true,
      message: "Reservations retrieved successfully",
      data: withPrice
    });
  });
});

// API ดึงข้อมูลการจองตาม ID (พร้อมชื่อแทน FK)
router.get("/:id", async (req, res) => {
  const reservationId = req.params.id;

  const query = `
    SELECT r.*,
           u.User_name,
           p.Package_name,
           s.Service_name,
           m.Promotion_name
    FROM reservation r
    LEFT JOIN User u ON r.User_id = u.User_id
    LEFT JOIN Package p ON r.Package_id = p.Package_id
    LEFT JOIN Service s ON r.Service_id = s.Service_id
    LEFT JOIN Promotion m ON r.Promotion_id = m.Promotion_id
    WHERE r.Reser_id = ?;
  `;

  connection.query(query, [reservationId], async (err, results) => {

    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
        data: null
      });
    }

    const reservation = results[0];
    // แปลง id เป็น array
    const serviceIds = reservation.Service_id && typeof reservation.Service_id === 'string' ? reservation.Service_id.split(',').map(Number) : [];
    const packageIds = reservation.Package_id && typeof reservation.Package_id === 'string' ? reservation.Package_id.split(',').map(Number) : [];
    const promotionIds = reservation.Promotion_id && typeof reservation.Promotion_id === 'string' ? reservation.Promotion_id.split(',').map(Number) : [];

    // ดึงราคาทั้งหมด
    const getSum = (sql, ids) => new Promise((resolve) => {
      if (!ids.length) return resolve(0);
      connection.query(sql, [ids], (err, rows) => {
        if (err) return resolve(0);
        const sum = rows.reduce((acc, cur) => acc + (Object.values(cur)[0] || 0), 0);
        resolve(sum);
      });
    });

    let total_price = 0;
    try {
      const serviceSum = await getSum('SELECT SUM(Service_price) as price FROM Service WHERE Service_id IN (?)', serviceIds);
      const packageSum = await getSum('SELECT SUM(Package_price) as price FROM Package WHERE Package_id IN (?)', packageIds);
      const promotionSum = await getSum('SELECT SUM(Promotion_price) as price FROM Promotion WHERE Promotion_id IN (?)', promotionIds);
      total_price = Number(serviceSum) + Number(packageSum) + Number(promotionSum);
    } catch (error) {
      total_price = 0;
    }

    const date = new Date(reservation.Reser_date);
    const buddhaYear = date.getFullYear() + 543;
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${buddhaYear}`;
    const time = reservation.Reser_time.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    res.json({
      success: true,
      message: "Reservation retrieved successfully",
      data: {
        ...reservation,
        Reser_date: formattedDate,
        Reser_time: time,
        User_name: reservation.User_name,
        Package_name: reservation.Package_name,
        Service_name: reservation.Service_name,
        Promotion_name: reservation.Promotion_name,
        Customer_name: reservation.Customer_name,
        Customer_phone: reservation.Customer_phone,
        total_price: Number(total_price)
      }
    });
  });
});

router.post("/", (req, res) => {
  const { Reser_date, Reser_time, Car_detail, Car_color, Car_number, User_id, Package_id, Service_id, Promotion_id, Customer_name, Customer_phone } = req.body;
  // แปลง array เป็น string
  const serviceIds = Array.isArray(Service_id) ? Service_id.join(',') : Service_id || '';
  const packageIds = Array.isArray(Package_id) ? Package_id.join(',') : Package_id || '';
  const promotionIds = Array.isArray(Promotion_id) ? Promotion_id.join(',') : Promotion_id || '';
  generateReservationCode((err, reservationCode) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    const insertQuery = `INSERT INTO reservation (Reser_code, Reser_date, Reser_time, Car_detail, Car_color, Car_number, User_id, Package_id, Service_id, Promotion_id, Customer_name, Customer_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    connection.query(insertQuery, [reservationCode, Reser_date, Reser_time, Car_detail, Car_color, Car_number, User_id, packageIds, serviceIds, promotionIds, Customer_name, Customer_phone], (err, result) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });
      res.status(201).json({
        success: true,
        message: "Reservation created successfully",
        data: {
          Reser_id: result.insertId,
          Reser_code: reservationCode,
          Reser_date,
          Reser_time,
          Car_detail,
          Car_color,
          Car_number,
          User_id,
          Package_id: packageIds,
          Service_id: serviceIds,
          Promotion_id: promotionIds,
          Customer_name,
          Customer_phone
        }
      });
    });
  });
});

router.put("/:id", (req, res) => {
  const reservationId = req.params.id;
  const {
    Reser_date,
    Reser_time,
    Car_detail,
    Car_color,
    Car_number,
    User_id,
    Package_id,
    Service_id,
    Promotion_id,
    Customer_name,
    Customer_phone,
    Reser_status
  } = req.body;

  // แปลง array เป็น string
  const serviceIds = Array.isArray(Service_id) ? Service_id.join(',') : Service_id || '';
  const packageIds = Array.isArray(Package_id) ? Package_id.join(',') : Package_id || '';
  const promotionIds = Array.isArray(Promotion_id) ? Promotion_id.join(',') : Promotion_id || '';

  // สร้าง update query ที่รวมฟิลด์ status ด้วย
  const updateQuery =
    "UPDATE reservation SET Reser_date = ?, Reser_time = ?, Car_detail = ?, Car_color = ?, Car_number = ?, User_id = ?, Package_id = ?, Service_id = ?, Promotion_id = ?, Customer_name = ?, Customer_phone = ?, status = ? WHERE Reser_id = ?";

  connection.query(
    updateQuery,
    [
      Reser_date,
      Reser_time,
      Car_detail,
      Car_color,
      Car_number,
      User_id,
      packageIds,
      serviceIds,
      promotionIds,
      Customer_name,
      Customer_phone,
      Reser_status,
      reservationId,
    ],
    (err, result) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Reservation not found",
          data: null
        });
      }
      res.json({
        success: true,
        message: "Reservation updated successfully",
        data: {
          Reser_id: parseInt(reservationId),
          Reser_date,
          Reser_time,
          Car_detail,
          Car_color,
          Car_number,
          User_id,
          Package_id: packageIds,
          Service_id: serviceIds,
          Promotion_id: promotionIds,
          Customer_name,
          Customer_phone,
          status: Reser_status
        }
      });
    }
  );
});


router.delete("/:id", (req, res) => {
  const reservationId = req.params.id;

  connection.query(
    "DELETE FROM reservation WHERE Reser_id = ?",
    [reservationId],
    (err, result) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Reservation not found",
          data: null
        });
      }

      res.json({
        success: true,
        message: "Reservation deleted successfully",
        data: null
      });
    }
  );
});

// API ดึงข้อมูลการจองทั้งหมด (สำหรับ admin)
router.get("/appointments", async (req, res) => {
  const query = `
    SELECT r.*,
           u.User_name,
           p.Package_name,
           s.Service_name,
           m.Promotion_name
    FROM reservation r
    LEFT JOIN User u ON r.User_id = u.User_id
    LEFT JOIN Package p ON r.Package_id = p.Package_id
    LEFT JOIN Service s ON r.Service_id = s.Service_id
    LEFT JOIN Promotion m ON r.Promotion_id = m.Promotion_id
    ORDER BY r.Reser_date DESC, r.Reser_time DESC
  `;

  connection.query(query, async (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    const formattedResults = results.map((reservation) => {
      const date = new Date(reservation.Reser_date);
      const buddhaYear = date.getFullYear() + 543;
      const formattedDate = `${date.getDate()}/${
        date.getMonth() + 1
      }/${buddhaYear}`;
      const time = reservation.Reser_time.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return {
        ...reservation,
        Reser_date: formattedDate,
        Reser_time: time,
        User_name: reservation.User_name,
        Package_name: reservation.Package_name,
        Service_name: reservation.Service_name,
        Promotion_name: reservation.Promotion_name,
        Customer_name: reservation.Customer_name,
        Customer_phone: reservation.Customer_phone
      };
    });
    const withPrice = await addTotalPriceToReservations(formattedResults, connection);
    res.json({
      success: true,
      message: "Appointments retrieved successfully",
      data: withPrice
    });
  });
});

// API อัปเดตสถานะการจอง
router.put("/:id/status", (req, res) => {
  const reservationId = req.params.id;
  const { status } = req.body;

  // ถ้าสถานะเป็น completed หรือ เสร็จสิ้น ให้บันทึก completed_at
  if (status === 'completed' || status === 'เสร็จสิ้น') {
    const updateQuery = "UPDATE reservation SET status = ?, completed_at = ? WHERE Reser_id = ?";
    connection.query(updateQuery, [status, new Date(), reservationId], (err, result) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Reservation not found",
          data: null
        });
      }

      res.json({
        success: true,
        message: "Reservation status updated successfully",
        data: { Reser_id: parseInt(reservationId), status, completed_at: new Date() }
      });
    });
  } else {
    const updateQuery = "UPDATE reservation SET status = ? WHERE Reser_id = ?";
    connection.query(updateQuery, [status, reservationId], (err, result) => {
      if (err) return res.status(500).json({
        success: false,
        message: "Database error",
        data: null
      });

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Reservation not found",
          data: null
        });
      }

      res.json({
        success: true,
        message: "Reservation status updated successfully",
        data: { Reser_id: parseInt(reservationId), status }
      });
    });
  }
});

// API ดึงข้อมูลการจองตามวันที่
router.get("/date/:date", async (req, res) => {
  const date = req.params.date;

  const query = `
    SELECT r.*,
           u.User_name,
           p.Package_name,
           s.Service_name,
           m.Promotion_name
    FROM reservation r
    LEFT JOIN User u ON r.User_id = u.User_id
    LEFT JOIN Package p ON r.Package_id = p.Package_id
    LEFT JOIN Service s ON r.Service_id = s.Service_id
    LEFT JOIN Promotion m ON r.Promotion_id = m.Promotion_id
    WHERE DATE(r.Reser_date) = ?
    ORDER BY r.Reser_time
  `;

  connection.query(query, [date], async (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    const formattedResults = results.map((reservation) => {
      // แปลงเวลาให้เป็นรูปแบบ HH:MM เท่านั้น
      let time = '';
      if (reservation.Reser_time) {
        if (typeof reservation.Reser_time === 'string') {
          // ถ้าเป็น string ให้ตัดเอาเฉพาะ HH:MM
          time = reservation.Reser_time.substring(0, 5);
        } else {
          // ถ้าเป็น Date object ให้แปลง
          time = reservation.Reser_time.toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        }
      }
      return {
        ...reservation,
        Reser_time: time,
        User_name: reservation.User_name,
        Package_name: reservation.Package_name,
        Service_name: reservation.Service_name,
        Promotion_name: reservation.Promotion_name,
        Customer_name: reservation.Customer_name,
        Customer_phone: reservation.Customer_phone
      };
    });
    const withPrice = await addTotalPriceToReservations(formattedResults, connection);
    res.json({
      success: true,
      message: "Reservations for date retrieved successfully",
      data: withPrice
    });
  });
});

// API ดึงข้อมูลการจองตามสถานะ
router.get("/status/:status", async (req, res) => {
  const status = req.params.status;

  const query = `
    SELECT r.*,
           u.User_name,
           p.Package_name,
           s.Service_name,
           m.Promotion_name
    FROM reservation r
    LEFT JOIN User u ON r.User_id = u.User_id
    LEFT JOIN Package p ON r.Package_id = p.Package_id
    LEFT JOIN Service s ON r.Service_id = s.Service_id
    LEFT JOIN Promotion m ON r.Promotion_id = m.Promotion_id
    WHERE r.status = ?
    ORDER BY r.Reser_date DESC, r.Reser_time DESC
  `;

  connection.query(query, [status], async (err, results) => {
    if (err) return res.status(500).json({
      success: false,
      message: "Database error",
      data: null
    });
    const formattedResults = results.map((reservation) => {
      const date = new Date(reservation.Reser_date);
      const buddhaYear = date.getFullYear() + 543;
      const formattedDate = `${date.getDate()}/${
        date.getMonth() + 1
      }/${buddhaYear}`;
      const time = reservation.Reser_time.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return {
        ...reservation,
        Reser_date: formattedDate,
        Reser_time: time,
        User_name: reservation.User_name,
        Package_name: reservation.Package_name,
        Service_name: reservation.Service_name,
        Promotion_name: reservation.Promotion_name,
        Customer_name: reservation.Customer_name,
        Customer_phone: reservation.Customer_phone
      };
    });
    const withPrice = await addTotalPriceToReservations(formattedResults, connection);
    res.json({
      success: true,
      message: `Reservations with status '${status}' retrieved successfully`,
      data: withPrice
    });
  });
});

module.exports = router;
