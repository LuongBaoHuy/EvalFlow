const express = require('express');
const router = express.Router();
const campaignsController = require('../controllers/campaigns.controller');
const workflowController = require('../controllers/workflow.controller');
const upload = require('../middlewares/upload.middleware');

router.get('/', campaignsController.listCampaigns.bind(campaignsController));
router.get('/trash', campaignsController.listTrashCampaigns.bind(campaignsController));
router.get('/template-excel', campaignsController.downloadTemplateExcel.bind(campaignsController));
router.get('/:id/analytics', campaignsController.getCampaignAnalytics.bind(campaignsController));
router.get('/:id/tracking', campaignsController.getCampaignTracking.bind(campaignsController));
router.get('/:id/responses', campaignsController.getCampaignResponses.bind(campaignsController));
router.get('/:id/export-excel', campaignsController.exportExcel.bind(campaignsController));
router.get('/:id/assignment-file', campaignsController.downloadAssignmentFile.bind(campaignsController));
router.get('/:id/ai-goals-result', campaignsController.getAiGoalsResult.bind(campaignsController));
router.get('/:id/my-assignments', campaignsController.getMyAssignmentsInCampaign.bind(campaignsController));
router.get('/:id/workflow-config', workflowController.getWorkflowConfig.bind(workflowController));
router.put('/:id/skip-remaining', campaignsController.skipRemainingAssignments.bind(campaignsController));
router.post('/:id/skip-remaining', campaignsController.skipRemainingAssignments.bind(campaignsController));
router.post('/:id/chat', campaignsController.chatWithCampaignCopilot.bind(campaignsController));
router.get('/:id', campaignsController.getCampaign.bind(campaignsController));
router.post('/', upload.single('assignments_file'), campaignsController.createCampaign.bind(campaignsController));
router.put('/:id', campaignsController.updateCampaign.bind(campaignsController));
router.put('/:id/restore', campaignsController.restoreCampaign.bind(campaignsController));
router.patch('/:id/status', campaignsController.toggleCampaignStatus.bind(campaignsController));
router.delete('/:id', campaignsController.deleteCampaign.bind(campaignsController));
router.delete('/:id/force', campaignsController.forceDeleteCampaign.bind(campaignsController));

module.exports = router;
