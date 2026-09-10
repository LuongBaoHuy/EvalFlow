const assignmentsService = require('../services/assignments.service');

class AssignmentsController {
  async getMyAssignments(req, res) {
    try {
      const userId = req.user?.id || req.query.user_id || 2;
      const data = await assignmentsService.getMyAssignments(userId);
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài khảo sát thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách bài khảo sát thất bại');
    }
  }

  async getAssignment(req, res) {
    try {
      const userId = req.user?.id || req.query.user_id;
      const data = await assignmentsService.getAssignmentById(req.params.id, userId);
      return res.status(200).json({
        success: true,
        message: 'Lấy chi tiết bài khảo sát thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy chi tiết bài khảo sát thất bại');
    }
  }

  _sendError(res, err, fallbackMsg) {
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : fallbackMsg;
    return res.status(statusCode).json({
      success: false,
      message,
      data: null,
    });
  }
}

module.exports = new AssignmentsController();
