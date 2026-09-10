const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Danh sách phiếu đang chờ user duyệt
router.get('/pending', authMiddleware, workflowController.getMyPendingReviews.bind(workflowController));
router.get('/pending/count', authMiddleware, workflowController.countMyPendingReviews.bind(workflowController));

// Danh sách chiến dịch + phiếu đã duyệt
router.get('/reviewed-campaigns', authMiddleware, workflowController.getMyReviewedCampaigns.bind(workflowController));
router.get('/reviewed-campaigns/:campaignId/responses', authMiddleware, workflowController.getReviewedResponsesInCampaign.bind(workflowController));

module.exports = router;
