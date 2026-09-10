const auditLogsService = require('../services/auditLogs.service');

class AuditLogsController {
  async getAuditLogs(req, res) {
    try {
      const { page, limit, action, user_id, entity_type, search } = req.query;
      const data = await auditLogsService.getAuditLogs({
        page,
        limit,
        action,
        user_id,
        entity_type,
        search,
      });

      res.status(200).json({
        success: true,
        message: 'Tải nhật ký hoạt động thành công',
        data,
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Lỗi khi tải nhật ký hoạt động',
      });
    }
  }
}

module.exports = new AuditLogsController();
