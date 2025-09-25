const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Send Email
router.post('/sender-email-status', async (req, res) => {
  try {
    const { email, subject } = req.body;

    if (!email || !subject) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุอีเมล และหัวข้อ'
      });
    }

    const result = await emailService.sendEmail(email, subject);

    res.json({
      success: true,
      message: 'ส่งอีเมลทดสอบเรียบร้อยแล้ว',
      data: result
    });

  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการส่งอีเมลทดสอบ',
      error: error.message
    });
  }
});

// Send password reset email
router.post('/password-reset-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุอีเมล'
      });
    }
    const result = await emailService.sendOTP({ email: email });

    res.json({
      success: true,
      message: 'ส่งอีเมลรีเซ็ตรหัสผ่านเรียบร้อยแล้ว',
      data: {
        token: result.data.token
      }
    });

  } catch (error) {
    console.error('Password reset email error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการส่งอีเมล'
    });
  }
});


// Send Email OTP
router.post('/email/otp', async (req, res) => {
  try {
    const { token, otpCode } = req.body;

    if (!token || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ OTP'
      });
    }

    const result = await emailService.verifyOTP(token, otpCode);

    res.json({
      success: true,
      message: 'ตรวจสอบ OTP เรียบร้อยแล้ว',
      data: result
    });
  } catch (error) {
    console.error('Email OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการส่ง Email OTP'
    });
  }
});

module.exports = router;
