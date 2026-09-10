const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

router.post('/generate-form', aiController.generateForm.bind(aiController));
router.post('/append-questions', aiController.appendQuestions.bind(aiController));
router.post('/copilot', aiController.copilot.bind(aiController));
router.post('/analyze-goals', aiController.analyzeGoals.bind(aiController));

module.exports = router;
