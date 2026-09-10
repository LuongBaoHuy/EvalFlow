const analyticsService = require('../services/analytics.service');

class AnalyticsController {
  async getOverview(req, res) {
    try {
      const timeRange = (req.query.timeRange || 'all').trim();
      const data = await analyticsService.getOverview({ timeRange });
      return res.status(200).json({
        success: true,
        message: 'Lấy dữ liệu thống kê tổng quan thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy dữ liệu thống kê thất bại');
    }
  }

  async getSurveyAnalytics(req, res) {
    try {
      const data = await analyticsService.getSurveyAnalytics(req.params.surveyId);
      return res.status(200).json({
        success: true,
        message: 'Lấy báo cáo chi tiết Form khảo sát thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy báo cáo Form khảo sát thất bại');
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

module.exports = new AnalyticsController();
