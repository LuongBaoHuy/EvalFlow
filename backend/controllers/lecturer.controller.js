const lecturerService = require('../services/lecturer.service');

class LecturerController {
  async getMyEvaluations(req, res) {
    try {
      // STRICT SECURITY: Extract lecturer ID directly from token payload req.user.id.
      // NEVER accept lecturer_id from req.query or req.body to prevent IDOR attacks!
      const lecturerId = req.user?.id;
      if (!lecturerId) {
        return res.status(401).json({
          success: false,
          message: 'Không tìm thấy thông tin Giảng viên từ Token đăng nhập',
          data: null,
        });
      }

      const data = await lecturerService.getMyEvaluations(lecturerId);
      return res.status(200).json({
        success: true,
        message: 'Lấy kết quả đánh giá giảng viên thành công',
        data,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      const message = err.statusCode ? err.message : 'Lấy kết quả đánh giá giảng viên thất bại';
      return res.status(statusCode).json({
        success: false,
        message,
        data: null,
      });
    }
  }
}

module.exports = new LecturerController();
