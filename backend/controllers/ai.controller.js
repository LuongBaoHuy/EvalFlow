const aiFormGeneratorService = require('../services/aiFormGenerator.service');
const aiGoalAnalyzerService = require('../services/aiGoalAnalyzer.service');

class AIController {
  async generateForm(req, res) {
    try {
      const { prompt } = req.body;
      const data = await aiFormGeneratorService.generateFormFromPrompt(prompt);
      return res.status(200).json({
        success: true,
        message: 'Tạo cấu trúc Form khảo sát tự động bằng AI thành công',
        data,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      const message = err.statusCode ? err.message : 'Tạo Form khảo sát bằng AI thất bại';
      return res.status(statusCode).json({
        success: false,
        message,
        data: null,
      });
    }
  }

  async appendQuestions(req, res) {
    try {
      const { prompt, current_questions } = req.body;
      const data = await aiFormGeneratorService.appendQuestionsFromPrompt(prompt, current_questions);
      return res.status(200).json({
        success: true,
        message: 'Sinh thêm câu hỏi bằng AI thành công',
        data,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      const message = err.statusCode ? err.message : 'Sinh thêm câu hỏi bằng AI thất bại';
      return res.status(statusCode).json({
        success: false,
        message,
        data: null,
      });
    }
  }

  async copilot(req, res) {
    try {
      const { message, history, current_questions, ai_goals } = req.body;
      const data = await aiFormGeneratorService.copilotChat(message, history, current_questions, ai_goals);
      return res.status(200).json({
        success: true,
        message: 'AI Copilot phản hồi thành công',
        data,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      const message = err.statusCode ? err.message : 'AI Copilot phản hồi thất bại';
      return res.status(statusCode).json({
        success: false,
        message,
        data: null,
      });
    }
  }

  async analyzeGoals(req, res) {
    try {
      const { campaign_id, campaignId } = req.body;
      const targetId = campaign_id || campaignId;
      const data = await aiGoalAnalyzerService.analyzeGoals(targetId);
      return res.status(200).json({
        success: true,
        message: 'Đánh giá mục tiêu bằng AI thành công',
        data,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      const message = err.statusCode ? err.message : 'Đánh giá mục tiêu bằng AI thất bại';
      return res.status(statusCode).json({
        success: false,
        message,
        data: null,
      });
    }
  }
}

module.exports = new AIController();
