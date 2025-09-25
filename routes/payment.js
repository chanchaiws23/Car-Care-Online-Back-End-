const express = require("express");
const { connection } = require("../config/passport-config");
const router = express.Router();
// เปลี่ยนชื่อ import เป็น promptpayQr
let promptpayQr = require('promptpay-qr');
if (promptpayQr.default) promptpayQr = promptpayQr.default;
const QRCode = require('qrcode');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const upload = multer({ dest: 'uploads/' });
require('dotenv').config(); // สำหรับอ่าน .env


// ฟังก์ชันสร้าง Payment_code (เลขที่ใบเสร็จ)
function generatePaymentCode() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // เอา 2 หลักท้ายของปี
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // เดือน 2 หลัก
  const day = now.getDate().toString().padStart(2, '0'); // วัน 2 หลัก
  const timestamp = Date.now().toString().slice(-6); // 6 หลักท้ายของ timestamp

  return `P${year}${month}${day}${timestamp}`;
}

// API อัปเดตสถานะ payment
router.put("/:id/status", (req, res) => {
  const paymentId = req.params.id;
  const { status } = req.body;
  if (status === 'completed' || status === 'เสร็จสิ้น') {
    const completedAt = new Date();
    const thaiCompletedAt = new Date(completedAt.getTime() + (7 * 60 * 60 * 1000)); // แปลงเป็นเวลาไทย (UTC+7)

    const updateQuery = 'UPDATE payment SET status = ?, completed_at = ? WHERE Payment_id = ?';
    connection.query(updateQuery, [status, thaiCompletedAt, paymentId], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Payment not found', data: null });
      }
      res.json({ success: true, message: 'Payment status updated successfully', data: { Payment_id: parseInt(paymentId), status, completed_at: thaiCompletedAt } });
    });
  } else {
    const updateQuery = 'UPDATE payment SET status = ? WHERE Payment_id = ?';
    connection.query(updateQuery, [status, paymentId], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Payment not found', data: null });
      }
      res.json({ success: true, message: 'Payment status updated successfully', data: { Payment_id: parseInt(paymentId), status } });
    });
  }
});

// API ดึงข้อมูลใบเสร็จ (payment) ตาม id
router.get('/:id', (req, res) => {
  const paymentId = req.params.id;
  connection.query(
    'SELECT * FROM payment WHERE Payment_id = ?',
    [paymentId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });
      if (results.length === 0) return res.status(404).json({ success: false, message: 'Payment not found', data: null });
      res.json({ success: true, message: 'Payment retrieved successfully', data: results[0] });
    }
  );
});

// API สร้าง PromptPay QR Code
router.post('/qr', async (req, res) => {
  const { amount } = req.body;
  if (!amount) {
    return res.status(400).json({ success: false, message: 'amount is required' });
  }
  try {
    const payload = promptpayQr(process.env.PROMPTPAY_ACCOUNT, { amount: Number(amount) });
    QRCode.toDataURL(payload, { width: 300 }, (err, qr_base64) => {
      if (err) return res.status(500).json({ success: false, message: 'QR generation failed', error: err.message });
      res.json({ success: true, qr_base64 });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'QR generation failed', error: err && err.message ? err.message : String(err) });
  }
});

// API manual confirm การชำระเงิน (อัปเดตสถานะเป็น paid)
router.post('/', (req, res) => {
  const reservation = req.body;
  // ถ้ามี completed_at ที่ส่งมา ให้แปลงเป็น Date ก่อน
  let completedAt = reservation.completed_at ? new Date(reservation.completed_at) : new Date();
  // แปลง completedAt เป็นเวลาไทย (UTC+7)
  const thaiCompletedAt = new Date(completedAt.getTime());
  const paymentCode = generatePaymentCode(); // สร้าง Payment_code

  // สร้าง payment record ใหม่ตามโครงสร้างตารางจริง
  const createPaymentQuery = 'INSERT INTO payment (Payment_code, Payment_bankname, Payment_accname, Payment_accno, Payment_price, completed_at) VALUES (?, ?, ?, ?, ?, ?)';
  connection.query(createPaymentQuery, [
    paymentCode,
    reservation.type,
    reservation.displayName || '',
    reservation.value || '',
    reservation.amount,
    thaiCompletedAt
  ], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });

    const paymentId = result.insertId;

    // เพิ่มแต้มให้ผู้ใช้ (ถ้ามี User_id)
    if (reservation.User_id) {
      const scoreData = {
        User_id: reservation.User_id,
        Payment_id: paymentId,
        Reser_id: reservation.Reser_id,
        amount: reservation.amount,
        type: reservation.type === 'package' ? 'package' : 'service',
        source: 'payment'
      };

      // เรียก API เพิ่มแต้ม
      const scoreUrl = `${req.protocol}://${req.get(process.env.API_BACK_URL)}/api/score/earn`;
      axios.post(scoreUrl, scoreData).catch(err => {
        console.error('Error adding score:', err);
      });
    }

    res.json({
      success: true,
      message: 'Payment confirmed',
      data: {
        Payment_id: paymentId,
        Payment_code: paymentCode,
        completed_at: thaiCompletedAt // ส่งค่าที่บันทึกจริง
      }
    });
  });
});

// API อัปโหลดและตรวจสอบสลิป
router.post('/verify-slip-image', upload.single('file'), async (req, res) => {
  const { amount, paymentId } = req.body;
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'file is required' });
  }

  try {
    const urlSlipOK = process.env.SLIPOK_URL;
    const secretKey = process.env.SLIPOK_SECRET_KEY;
    const formData = new FormData();
    formData.append('files', fs.createReadStream(req.file.path));
    formData.append('log', 'true');
    formData.append('amount', amount);

    const response = await axios.post(
      urlSlipOK,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'x-authorization': secretKey,
        },
        maxBodyLength: Infinity,
      }
    );

    // ถ้า slip verification สำเร็จ ให้เก็บรูปไว้
    if (response.data && response.data.success) {
      // สร้างชื่อไฟล์ใหม่
      const timestamp = Date.now();
      const originalName = req.file.originalname;
      const extension = originalName.split('.').pop();
      const newFileName = `slip_${paymentId}_${timestamp}.${extension}`;
      const newFilePath = `uploads/slips/${newFileName}`;

      // สร้างโฟลเดอร์ถ้ายังไม่มี
      const slipDir = 'uploads/slips';
      if (!fs.existsSync(slipDir)) {
        fs.mkdirSync(slipDir, { recursive: true });
      }

      // ย้ายไฟล์ไปยังโฟลเดอร์ slips
      fs.renameSync(req.file.path, newFilePath);

      // อัปเดต payment table เพื่อเก็บ path ของรูป
      if (paymentId) {
        const updatePaymentQuery = 'UPDATE payment SET slip_image_path = ? WHERE Payment_id = ?';
        connection.query(updatePaymentQuery, [newFilePath, paymentId], (err, result) => {
          if (err) {
            console.error('Error updating payment with slip path:', err);
          }
        });
      }

      res.json({
        success: true,
        data: response.data,
        slipPath: newFilePath
      });
    } else {
      // ถ้า verification ไม่สำเร็จ ให้ลบไฟล์
      fs.unlinkSync(req.file.path);
      res.json({ success: false, message: 'Slip verification failed', data: response.data });
    }
  } catch (err) {
    console.error('Slip error:', err?.response?.data || err.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Slip verification failed',
      error: err.message,
      details: err?.response?.data
    });
  }
});

// API ดึงรูปสลิป
router.get('/slip/:paymentId', (req, res) => {
  const paymentId = req.params.paymentId;

  const query = 'SELECT slip_image_path FROM payment WHERE Payment_id = ?';
  connection.query(query, [paymentId], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0 || !results[0].slip_image_path) {
      return res.status(404).json({ success: false, message: 'Slip image not found' });
    }

    const imagePath = results[0].slip_image_path;

    // ตรวจสอบว่าไฟล์มีอยู่จริง
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, message: 'Image file not found' });
    }

    // ส่งไฟล์รูปภาพ
    res.sendFile(imagePath, { root: '.' });
  });
});

// API แสดงรูปภาพจาก path โดยตรง
router.get('/image/:filename(*)', (req, res) => {
  const filename = req.params.filename;
  const imagePath = `uploads/slips/${filename}`;

  // ตรวจสอบว่าไฟล์มีอยู่จริง
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ success: false, message: 'Image file not found' });
  }

  // ส่งไฟล์รูปภาพ
  res.sendFile(imagePath, { root: '.' });
});

// POST /review - บันทึกรีวิว
router.post('/review', (req, res) => {
  const { Reser_id, User_id, score, comment } = req.body;
  if (!Reser_id || !User_id || !score) {
    return res.status(400).json({ success: false, message: 'Reser_id, User_id, score are required' });
  }

  // แปลงข้อมูลให้ตรงกับโครงสร้างตาราง review
  const reviewDetail = comment ? `คะแนน: ${score} ดาว - ${comment}` : `คะแนน: ${score} ดาว`;

  const sql = 'INSERT INTO review (Reser_id, User_id, Review_detail, Review_point, Review_date) VALUES (?, ?, ?, ?, CURDATE())';
  connection.query(sql, [Reser_id, User_id, reviewDetail, score], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });

    // เพิ่มแต้มจากรีวิว
    const scoreData = {
      User_id: User_id,
      Reser_id: Reser_id,
      review_point: score,
      review_comment: comment
    };

    // เรียก API เพิ่มแต้มจากรีวิว
    const scoreUrl = `${req.protocol}://${req.get(process.env.API_BACK_URL)}/api/score/earn-review`;
    axios.post(scoreUrl, scoreData).catch(err => {
      console.error('Error adding review score:', err);
    });

    res.status(201).json({ success: true, message: 'Review saved', id: result.insertId });
  });
});


module.exports = router;
