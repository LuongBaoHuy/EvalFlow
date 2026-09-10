const questionsService = require('../services/questions.service');

class QuestionsController {
  async getSurveyQuestions(req, res) {
    try {
      const data = await questionsService.getQuestionsBySurveyId(req.params.surveyId);
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách câu hỏi thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách câu hỏi thất bại');
    }
  }

  async getQuestion(req, res) {
    try {
      const data = await questionsService.getQuestionById(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Lấy chi tiết câu hỏi thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy chi tiết câu hỏi thất bại');
    }
  }

  async createQuestion(req, res) {
    try {
      const data = await questionsService.createQuestion(req.params.surveyId, req.body);
      return res.status(201).json({
        success: true,
        message: 'Tạo câu hỏi thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Tạo câu hỏi thất bại');
    }
  }

  async updateQuestion(req, res) {
    try {
      const data = await questionsService.updateQuestion(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật câu hỏi thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Cập nhật câu hỏi thất bại');
    }
  }

  async deleteQuestion(req, res) {
    try {
      const data = await questionsService.deleteQuestion(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Xóa câu hỏi thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Xóa câu hỏi thất bại');
    }
  }

  async replaceQuestionsBatch(req, res) {
    try {
      const questions = Array.isArray(req.body) ? req.body : req.body.questions;
      const isPut = req.method === 'PUT';
      const data = await questionsService.replaceQuestionsBatch(req.params.surveyId, questions, { isPut });
      return res.status(200).json({
        success: true,
        message: 'Cập nhật danh sách câu hỏi thành công',
        data,
      });
    } catch (err) {
      console.error("DEBUG replaceQuestionsBatch:", err);
      return this._sendError(res, err, 'Cập nhật danh sách câu hỏi thất bại');
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

module.exports = new QuestionsController();
