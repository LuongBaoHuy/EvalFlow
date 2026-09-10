const lecturerService = require('../services/lecturer.service');

class AdminLecturerController {
  async getLecturersWithEvaluations(req, res) {
    try {
      const data = await lecturerService.getLecturersWithEvaluations();
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách giảng viên kèm số lượng đánh giá thành công',
        data,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi khi tải danh sách giảng viên',
        data: null,
      });
    }
  }

  async getEvaluationsByTarget(req, res) {
    try {
      const targetId = req.params.target_id;
      if (!targetId) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp ID của Giảng viên',
          data: null,
        });
      }

      const data = await lecturerService.getMyEvaluations(targetId);
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách đánh giá giảng viên thành công',
        data,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || 'Lỗi khi lấy danh sách đánh giá giảng viên',
        data: null,
      });
    }
  }
}

module.exports = new AdminLecturerController();
