const express = require('express');
const router = express.Router();
const responsesController = require('../controllers/responses.controller');
const workflowController = require('../controllers/workflow.controller');

// Luồng nộp bài 1 cấp (không thay đổi)
router.post('/submit', responsesController.submitResponse.bind(responsesController));

// Workflow đa cấp
const authMiddleware = require('../middlewares/auth.middleware');
router.get('/:id/workflow', workflowController.getWorkflowStatus.bind(workflowController));
router.get('/:id/review-data', authMiddleware, workflowController.getResponseAnswersForReview.bind(workflowController));
router.post('/:id/review', authMiddleware, workflowController.submitReview.bind(workflowController));

module.exports = router;
