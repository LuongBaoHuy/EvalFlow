const workflowService = require('../services/workflow.service');

class WorkflowController {
  // GET /api/campaigns/:id/workflow-config
  async getWorkflowConfig(req, res) {
    try {
      const data = await workflowService.getWorkflowConfig(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Lấy cấu hình workflow thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy cấu hình workflow thất bại');
    }
  }

  // GET /api/responses/:id/workflow
  async getWorkflowStatus(req, res) {
    try {
      const data = await workflowService.getWorkflowStatus(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Lấy trạng thái workflow thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy trạng thái workflow thất bại');
    }
  }

  // GET /api/responses/:id/review-data
  async getResponseAnswersForReview(req, res) {
    try {
      const data = await workflowService.getResponseAnswersForReview(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Lấy dữ liệu phiếu để chấm điểm thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy dữ liệu phiếu để chấm điểm thất bại');
    }
  }

  // POST /api/responses/:id/review
  async submitReview(req, res) {
    try {
      const reviewerId = req.user?.id || req.body.reviewer_id;
      if (!reviewerId) {
        return res.status(401).json({
          success: false,
          message: 'Cần đăng nhập để thực hiện chấm điểm',
          data: null,
        });
      }

      const data = await workflowService.submitReview(req.params.id, reviewerId, req.body);
      return res.status(200).json({
        success: true,
        message: data.action === 'APPROVED'
          ? `✅ Đã duyệt và chuyển sang bước tiếp theo`
          : `❌ Đã từ chối phiếu này`,
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Chấm điểm thất bại');
    }
  }

  // GET /api/workflow/pending
  async getMyPendingReviews(req, res) {
    try {
      const userId = req.user?.id || req.query.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Cần đăng nhập để xem danh sách chờ duyệt',
          data: null,
        });
      }

      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;

      const result = await workflowService.getMyPendingReviews(userId, { page, limit });
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách phiếu chờ duyệt thành công',
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách phiếu chờ duyệt thất bại');
    }
  }

  // GET /api/workflow/pending/count
  async countMyPendingReviews(req, res) {
    try {
      const userId = req.user?.id || req.query.user_id;
      if (!userId) {
        return res.status(200).json({ success: true, data: { count: 0 } });
      }

      const count = await workflowService.countMyPendingReviews(userId);
      return res.status(200).json({
        success: true,
        message: 'Đếm phiếu chờ duyệt thành công',
        data: { count },
      });
    } catch (err) {
      return this._sendError(res, err, 'Đếm phiếu chờ duyệt thất bại');
    }
  }

  // GET /api/workflow/reviewed-campaigns
  async getMyReviewedCampaigns(req, res) {
    try {
      const userId = req.user?.id || req.query.user_id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Cần đăng nhập', data: null });
      }
      const data = await workflowService.getMyReviewedCampaigns(userId);
      return res.status(200).json({ success: true, message: 'Lấy danh sách chiến dịch đã duyệt thành công', data });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách chiến dịch đã duyệt thất bại');
    }
  }

  // GET /api/workflow/reviewed-campaigns/:campaignId/responses
  async getReviewedResponsesInCampaign(req, res) {
    try {
      const userId = req.user?.id || req.query.user_id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Cần đăng nhập', data: null });
      }
      const { campaignId } = req.params;
      const { page, limit } = req.query;
      const result = await workflowService.getReviewedResponsesInCampaign(userId, campaignId, { page, limit });
      return res.status(200).json({ success: true, message: 'Lấy danh sách phiếu đã duyệt thành công', data: result.data, meta: result.meta });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách phiếu đã duyệt thất bại');
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

module.exports = new WorkflowController();
