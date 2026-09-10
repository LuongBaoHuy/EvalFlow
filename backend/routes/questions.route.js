const express = require('express');
const router = express.Router();
const questionsController = require('../controllers/questions.controller');

// Standalone routes for questions by question id
router.get('/:id', questionsController.getQuestion.bind(questionsController));
router.put('/:id', questionsController.updateQuestion.bind(questionsController));
router.delete('/:id', questionsController.deleteQuestion.bind(questionsController));

module.exports = router;
