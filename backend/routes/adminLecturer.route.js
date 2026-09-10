const express = require('express');
const router = express.Router();
const adminLecturerController = require('../controllers/adminLecturer.controller');
const adminMiddleware = require('../middlewares/admin.middleware');

// All endpoints in this router require Admin role
router.use(adminMiddleware);

router.get('/lecturers-with-evaluations', adminLecturerController.getLecturersWithEvaluations.bind(adminLecturerController));
router.get('/evaluations-by-target/:target_id', adminLecturerController.getEvaluationsByTarget.bind(adminLecturerController));

module.exports = router;
