const express = require('express');
const router = express.Router();
const assignmentsController = require('../controllers/assignments.controller');

router.get('/my', assignmentsController.getMyAssignments.bind(assignmentsController));
router.get('/:id', assignmentsController.getAssignment.bind(assignmentsController));

module.exports = router;
