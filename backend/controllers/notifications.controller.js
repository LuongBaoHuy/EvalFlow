const notificationsService = require('../services/notifications.service');

class NotificationsController {
  async getNotifications(req, res) {
    try {
      const userId = req.user?.id || req.query.user_id || 1;
      const data = await notificationsService.getUserNotifications(userId);
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách thông báo thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách thông báo thất bại');
    }
  }

  async markAllAsRead(req, res) {
    try {
      const userId = req.user?.id || req.body?.user_id || req.query?.user_id || 1;
      const data = await notificationsService.markAllAsRead(userId);
      return res.status(200).json({
        success: true,
        message: 'Đã đánh dấu tất cả là đã đọc',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Cập nhật trạng thái thông báo thất bại');
    }
  }

  async markAsRead(req, res) {
    try {
      const userId = req.user?.id || req.body?.user_id || req.query?.user_id || 1;
      const data = await notificationsService.markAsRead(req.params.id, userId);
      return res.status(200).json({
        success: true,
        message: 'Đã đánh dấu thông báo là đã đọc',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Cập nhật trạng thái thông báo thất bại');
    }
  }

  async deleteNotification(req, res) {
    try {
      const userId = req.user?.id || req.query?.user_id || req.body?.user_id || 1;
      const data = await notificationsService.deleteNotification(req.params.id, userId);
      return res.status(200).json({
        success: true,
        message: 'Đã xóa thông báo thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Xóa thông báo thất bại');
    }
  }

  async clearReadNotifications(req, res) {
    try {
      const userId = req.user?.id || req.body?.user_id || req.query?.user_id || 1;
      const data = await notificationsService.clearReadNotifications(userId);
      return res.status(200).json({
        success: true,
        message: 'Đã xóa tất cả thông báo đã đọc',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Xóa thông báo đã đọc thất bại');
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

module.exports = new NotificationsController();
