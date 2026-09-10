const bcrypt = require('bcrypt');
const authService = require('../services/auth.service');
const auditLogsService = require('../services/auditLogs.service');
const pool = require('../config/db');

const ADMIN_ROLES = ['admin', 'quản trị viên', 'quản trị viên hệ thống'];

function getClientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
}

class AuthController {
  /**
   * Restructured Login Handler following strict 5-step security & anti-log-spam rules:
   * Step 1: Query user by email.
   * Step 2: If user not found -> Return 401 (NO LOG).
   * Step 3: Check user role.
   * Step 4: If Non-Admin -> Compare password & return result/401 (NO LOG IN ANY CASE).
   * Step 5: If Admin -> Compare password:
   *   - Valid -> Return Token & log SUCCESS.
   *   - Invalid -> Log FAILED (note: 'Sai mật khẩu') & return 401.
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const ipAddress = getClientIp(req);

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ email và mật khẩu',
          data: null,
        });
      }

      const cleanEmail = String(email).trim().toLowerCase();

      // BƯỚC 1: Tìm User trong DB dựa theo req.body.email
      const query = `
        SELECT u.id, u.role_id, u.full_name, u.email, u.password_hash, u.department, u.is_locked, r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE LOWER(u.email) = $1
      `;
      const result = await pool.query(query, [cleanEmail]);
      const user = result.rows[0];

      // BƯỚC 2: NẾU không tìm thấy User -> Trả về lỗi 401 ngay lập tức. TUYỆT ĐỐI KHÔNG GHI LOG.
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Thông tin đăng nhập không hợp lệ',
          data: null,
        });
      }

      if (user.is_locked) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.',
          data: null,
        });
      }

      // BƯỚC 3: Kiểm tra Role của User
      const userRole = user.role_name || '';
      const isAdmin = ADMIN_ROLES.includes(String(userRole).toLowerCase().trim());

      // BƯỚC 4: NẾU Role KHÔNG PHẢI là Admin (Sinh viên, Giảng viên...) -> So sánh mật khẩu. TUYỆT ĐỐI KHÔNG GHI LOG trong mọi trường hợp.
      if (!isAdmin) {
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: 'Thông tin đăng nhập không hợp lệ',
            data: null,
          });
        }

        const token = authService.generateToken(user);
        return res.status(200).json({
          success: true,
          message: 'Đăng nhập thành công',
          data: {
            token,
            user: {
              id: user.id,
              role_id: user.role_id,
              role_name: user.role_name,
              full_name: user.full_name,
              email: user.email,
              department: user.department,
            },
          },
        });
      }

      // BƯỚC 5: NẾU Role LÀ ADMIN -> So sánh mật khẩu
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (isPasswordValid) {
        // Đúng mật khẩu: Trả về Token và GHI LOG THÀNH CÔNG
        auditLogsService.createAuditLog({
          user_id: user.id,
          action: 'LOGIN',
          entity_type: 'SYSTEM',
          entity_id: null,
          details: { login_email: user.email, status: 'SUCCESS' },
          ip_address: ipAddress,
        });

        const token = authService.generateToken(user);
        return res.status(200).json({
          success: true,
          message: 'Đăng nhập thành công',
          data: {
            token,
            user: {
              id: user.id,
              role_id: user.role_id,
              role_name: user.role_name,
              full_name: user.full_name,
              email: user.email,
              department: user.department,
            },
          },
        });
      } else {
        // Sai mật khẩu: Trả về 401 và GHI LOG THẤT BẠI (Chỉ áp dụng cho tài khoản Admin)
        auditLogsService.createAuditLog({
          user_id: user.id,
          action: 'LOGIN',
          entity_type: 'SYSTEM',
          entity_id: null,
          details: { login_email: user.email, status: 'FAILED', note: 'Sai mật khẩu' },
          ip_address: ipAddress,
        });

        return res.status(401).json({
          success: false,
          message: 'Thông tin đăng nhập không hợp lệ',
          data: null,
        });
      }
    } catch (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Lỗi hệ thống khi xử lý đăng nhập',
        data: null,
      });
    }
  }

  async googleLogin(req, res) {
    const { credential, email, full_name } = req.body;
    const ipAddress = getClientIp(req);

    try {
      const result = await authService.googleLogin({ credential, email, full_name });

      const userRole = result?.user?.role_name || '';
      const isAdmin = ADMIN_ROLES.includes(String(userRole).toLowerCase().trim());

      if (isAdmin) {
        auditLogsService.createAuditLog({
          user_id: result.user.id,
          action: 'LOGIN',
          entity_type: 'SYSTEM',
          entity_id: null,
          details: { login_email: result.user.email, method: 'GOOGLE', status: 'SUCCESS' },
          ip_address: ipAddress,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Đăng nhập bằng Google thành công',
        data: result,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || 'Đăng nhập Google thất bại',
        data: null,
      });
    }
  }
}

module.exports = new AuthController();
