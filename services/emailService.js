const axios = require('axios');
require('dotenv').config();

class EmailService {
  constructor() {
    // URLs for ThaiBulkSMS API
    this.urlSendEmail = process.env.URL_SENDER_EMAIL;
    this.urlOtp = process.env.URL_OTP_EMAIL;
    this.urlVerify = process.env.URL_VERIFY_EMAIL;

    // Get credentials from environment variables
    this.authorization = process.env.EMAIL_AUTHORIZATION;
    this.fromEmail = process.env.EMAIL_FROM;
    this.fromName = process.env.EMAIL_FROM_NAME;
    this.templateUuid = process.env.EMAIL_TEMPLATE_SEND;
    this.otpTemplateUuid = process.env.EMAIL_TEMPLATE_OTP;
  }

  // Send email using template
  async sendEmail(toEmail, subject) {
    try {
      const requestData = {
        mail_from: { email: this.fromEmail, name: this.fromName },
        mail_to: { email: toEmail },
        template_uuid: this.templateUuid,
        subject: subject,
      };

      const response = await axios.post(this.urlSendEmail, requestData, {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: this.authorization
        }
      });

      const result = response.data;

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          messageId: result.message_id || result.messageId || 'email-sent',
          data: result
        };
      } else {
        throw new Error(result.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('EmailService - Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      throw error;
    }
  }

  // Send notification email
  async sendNotificationEmail(toEmail= '') {
    return await this.sendEmail(toEmail);
  }

  // Send OTP email
  async sendOTP({ email}) {
    try {
      const options = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: this.authorization
        },
        body: JSON.stringify({
          template_uuid: this.otpTemplateUuid,
          recipient_email: email
        })
      };

      const response = await axios.post(this.urlOtp, {
        template_uuid: this.otpTemplateUuid,
        recipient_email: email
      }, {
        headers: options.headers
      });
      const result = response.data;

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          messageId: result.message_id || result.messageId || 'otp-sent',
          data: result
        };
      } else {
        throw new Error(result.message || 'Failed to send OTP email');
      }
    } catch (error) {
      console.error('OTP email send error:', error);
      throw error;
    }
  }

  // Verify OTP
  async verifyOTP(token, otpCode) {
    try {
      const options = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: this.authorization
        },
        body: JSON.stringify({
          token: token,
          otp_code: otpCode
        })
      };

      const response = await axios.post(this.urlVerify, {
        token: token,
        otp_code: otpCode
      }, {
        headers: options.headers
      });
      const result = response.data;

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          valid: result.valid || false,
          data: result
        };
      } else {
        throw new Error(result.message || 'Failed to verify OTP');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      throw error;
    }
  }

  // Test email service
  async testEmail(toEmail) {
    return await this.sendEmail(toEmail, 'Test User');
  }
}

module.exports = new EmailService();
