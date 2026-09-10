const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

router.get('/overview', analyticsController.getOverview.bind(analyticsController));
router.get('/surveys/:surveyId', analyticsController.getSurveyAnalytics.bind(analyticsController));

module.exports = router;
