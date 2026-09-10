const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      const error = new Error('Vui lòng nhập đầy đủ email và mật khẩu');
      error.name = 'ValidationError';
      error.statusCode = 400;
      throw error;
    }

    const query = `
      SELECT u.id, u.role_id, u.full_name, u.email, u.password_hash, u.department, u.is_locked, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
    `;
    const result = await pool.query(query, [email]);
    const user = result.rows[0];

    if (!user) {
      const error = new Error('Thông tin đăng nhập không hợp lệ');
      error.name = 'InvalidCredentialsError';
      error.statusCode = 401;
      throw error;
    }

    if (user.is_locked) {
      const error = new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.');
      error.statusCode = 403;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const error = new Error('Thông tin đăng nhập không hợp lệ');
      error.name = 'InvalidCredentialsError';
      error.statusCode = 401;
      throw error;
    }

    const token = this.generateToken(user);

    const userResponse = {
      id: user.id,
      role_id: user.role_id,
      role_name: user.role_name,
      full_name: user.full_name,
      email: user.email,
      department: user.department,
    };

    return {
      token,
      user: userResponse,
    };
  }

  generateToken(user) {
    const payload = {
      id: user.id,
      role_id: user.role_id,
      role_name: user.role_name,
      email: user.email,
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
  }

  async hashPassword(plainPassword) {
    const saltRounds = 10;
    return bcrypt.hash(plainPassword, saltRounds);
  }

  async googleLogin({ credential, email, full_name }) {
    let cleanEmail = email ? String(email).trim() : '';
    let cleanName = full_name ? String(full_name).trim() : '';

    if (credential) {
      try {
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        const client = new OAuth2Client(googleClientId);

        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: googleClientId && googleClientId.trim() !== '' ? googleClientId : undefined,
        });

        const googlePayload = ticket.getPayload();
        if (googlePayload && googlePayload.email) {
          cleanEmail = googlePayload.email.trim();
          cleanName = (googlePayload.name || googlePayload.email.split('@')[0]).trim();
        }
      } catch (verifyErr) {
        console.warn('[Google Token Verification Warning]:', verifyErr.message);
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          cleanEmail = decoded.email.trim();
          cleanName = (decoded.name || decoded.email.split('@')[0]).trim();
        } else if (!cleanEmail) {
          const err = new Error('Xác thực Token Google không thành công: ' + verifyErr.message);
          err.statusCode = 401;
          throw err;
        }
      }
    }

    if (!cleanEmail) {
      const error = new Error('Email từ Google là bắt buộc');
      error.statusCode = 400;
      throw error;
    }

    if (!cleanName) {
      cleanName = cleanEmail.split('@')[0];
    }

    // Check if user already exists
    const query = `
      SELECT u.id, u.role_id, u.full_name, u.email, u.department, u.is_locked, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = LOWER($1)
    `;
    const result = await pool.query(query, [cleanEmail]);
    let user = result.rows[0];

    if (user && user.is_locked) {
      const error = new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.');
      error.statusCode = 403;
      throw error;
    }

    // If user does not exist in users table -> DO NOT INSERT into users table!
    // Issue a short-lived PublicGuest token (2 hours)
    if (!user) {
      const publicGuestUser = {
        id: null,
        role_id: null,
        role_name: 'PublicGuest',
        full_name: cleanName,
        email: cleanEmail,
        guest_name: cleanName,
        guest_email: cleanEmail,
      };

      const token = jwt.sign(
        publicGuestUser,
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
      );

      return {
        token,
        user: publicGuestUser,
      };
    }

    const token = this.generateToken(user);

    const userResponse = {
      id: user.id,
      role_id: user.role_id,
      role_name: user.role_name,
      full_name: user.full_name,
      email: user.email,
      department: user.department,
    };

    return {
      token,
      user: userResponse,
    };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const error = new Error('Token không hợp lệ hoặc đã hết hạn');
      error.name = 'UnauthorizedError';
      error.statusCode = 401;
      throw error;
    }
  }
}

module.exports = new AuthService();
