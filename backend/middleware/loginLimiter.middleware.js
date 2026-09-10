const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter Middleware for Auth Login (/api/auth/login)
 * Restricts requests to a maximum of 5 attempts per 1 minute per IP address.
 */
const loginRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 5, // Limit each IP to 5 login requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  statusCode: 429,
  message: {
    success: false,
    message: 'Bạn đã thử đăng nhập quá 5 lần trong 1 phút. Vui lòng thử lại sau 1 phút!',
    data: null,
  },
});

module.exports = loginRateLimiter;
