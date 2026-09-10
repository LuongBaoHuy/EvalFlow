const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
    } else {
      this.transporter = null;
    }
  }

  /**
   * Send a confirmation email to student upon successful survey submission (non-blocking)
   */
  async sendConfirmationEmail(userEmail, fullName, campaignName, submitTime) {
    try {
      if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
        return;
      }

      // Re-initialize transporter in case env variables were added dynamically
      if (!this.transporter && process.env.SMTP_USER && process.env.SMTP_PASS) {
        this.initTransporter();
      }

      const displayTime = submitTime || new Date().toLocaleString('vi-VN');
      const displayName = fullName || 'Sinh viên / Người tham gia';
      const displayCampaign = campaignName || 'Khảo sát Đánh giá';

      const fromAddress =
        process.env.SMTP_FROM ||
        `"Hệ thống Khảo sát EvalFlow" <${process.env.SMTP_USER || 'noreply@evalflow.edu.vn'}>`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 800; tracking-tight: true; }
            .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
            .content { padding: 32px 28px; line-height: 1.6; }
            .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
            .message { font-size: 14px; color: #334155; margin-bottom: 24px; }
            .card { background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
            .card-item { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
            .card-item:last-child { margin-bottom: 0; }
            .label { font-weight: 600; color: #64748b; }
            .value { font-weight: 700; color: #0f172a; text-align: right; }
            .badge { display: inline-block; background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; font-weight: 700; font-size: 12px; padding: 4px 12px; rounded-full: 9999px; border-radius: 12px; }
            .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>EvalFlow</h1>
              <p>Hệ thống Quản lý & Đánh giá Khảo sát Động</p>
            </div>
            <div class="content">
              <div class="greeting">Chào ${displayName},</div>
              <div class="message">
                Hệ thống <b>EvalFlow</b> xin xác nhận đã ghi nhận bài nộp bài khảo sát của bạn thành công. Cảm ơn bạn đã dành thời gian quý báu tham gia đóng góp ý kiến!
              </div>

              <div class="card">
                <div class="card-item" style="margin-bottom: 12px;">
                  <span class="label">Trạng thái:</span>
                  <span class="value"><span class="badge">✓ Đã ghi nhận thành công</span></span>
                </div>
                <div class="card-item" style="margin-bottom: 12px;">
                  <span class="label">Đợt khảo sát:</span>
                  <span class="value">${displayCampaign}</span>
                </div>
                <div class="card-item">
                  <span class="label">Thời gian nộp bài:</span>
                  <span class="value">${displayTime}</span>
                </div>
              </div>

              <div style="font-size: 13px; color: #475569; text-align: center;">
                Ý kiến của bạn là cơ sở quan trọng giúp nhà trường nâng cao chất lượng dạy và học.
              </div>
            </div>
            <div class="footer">
              Đây là email tự động từ Hệ thống Khảo sát EvalFlow.<br>Vui lòng không phản hồi trực tiếp vào email này.
            </div>
          </div>
        </body>
        </html>
      `;

      if (this.transporter) {
        const mailOptions = {
          from: fromAddress,
          to: userEmail,
          subject: `[EvalFlow] Xác Nhận Nộp Bài Khảo Sát: ${displayCampaign}`,
          html: htmlContent,
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Confirmation email sent to ${userEmail}. MessageId: ${info.messageId}`);
      } else {
        console.log(
          `[EmailService Simulation] (SMTP credentials missing in .env) Confirmation email constructed for ${userEmail} (${displayCampaign}).`
        );
      }
    } catch (err) {
      console.error(`[EmailService Error] Failed sending confirmation email to ${userEmail}:`, err.message);
    }
  }
}

module.exports = new EmailService();
