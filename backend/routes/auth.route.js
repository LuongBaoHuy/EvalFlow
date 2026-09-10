const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const loginRateLimiter = require('../middleware/loginLimiter.middleware');

/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: Xử lý Xác thực, Đăng nhập, Đăng ký và Phân quyền người dùng
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập vào hệ thống
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@evalflow.edu.vn
 *                 description: Email cá nhân/quản trị viên
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "123123"
 *                 description: Mật khẩu đăng nhập
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về JWT Token và thông tin người dùng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Đăng nhập thành công
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     full_name:
 *                       type: string
 *                       example: Quản trị viên Hệ thống
 *                     email:
 *                       type: string
 *                       example: admin@evalflow.edu.vn
 *                     role:
 *                       type: string
 *                       example: Admin
 *       400:
 *         description: Sai thông tin tài khoản hoặc mật khẩu
 *       500:
 *         description: Lỗi hệ thống server
 */
router.post('/login', loginRateLimiter, authController.login);

/**
 * @openapi
 * /api/auth/google-login:
 *   post:
 *     summary: Đăng nhập qua tài khoản Google OAuth
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Google OAuth ID Token
 *     responses:
 *       200:
 *         description: Đăng nhập Google thành công
 *       401:
 *         description: Token Google không hợp lệ
 */
router.post('/google', authController.googleLogin);
router.post('/google-login', authController.googleLogin);

module.exports = router;
