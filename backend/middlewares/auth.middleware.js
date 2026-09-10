const authService = require('../services/auth.service');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để truy cập tài nguyên này',
        data: null,
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.message || 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      data: null,
    });
  }
};

module.exports = authMiddleware;
