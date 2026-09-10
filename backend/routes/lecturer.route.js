const express = require('express');
const router = express.Router();
const lecturerController = require('../controllers/lecturer.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Protect route with authMiddleware to inject req.user
router.get('/my-evaluations', authMiddleware, lecturerController.getMyEvaluations.bind(lecturerController));

module.exports = router;
