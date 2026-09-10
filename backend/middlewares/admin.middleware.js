const jwt = require('jsonwebtoken');

const adminMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'evalflow_jwt_secret_key_2026';
      try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
      } catch (err) {
        // Token invalid or expired
      }
    }

    const roleName = req.user?.role_name || req.headers['x-user-role'] || req.query.user_role;

    if (roleName === 'Admin') {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền truy cập tính năng quản trị này (Chỉ dành cho Admin)',
      data: null,
    });
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền truy cập tính năng quản trị này',
      data: null,
    });
  }
};

module.exports = adminMiddleware;
