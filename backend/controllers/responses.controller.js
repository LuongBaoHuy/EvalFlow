const responsesService = require('../services/responses.service');

class ResponsesController {
  async submitResponse(req, res) {
    try {
      const evaluatorId = req.user?.id || req.body.evaluator_id;
      const payload = { ...req.body, evaluator_id: evaluatorId };
      const data = await responsesService.submitResponse(payload);
      return res.status(201).json({
        success: true,
        message: 'Nộp bài khảo sát thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Nộp bài khảo sát thất bại');
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

module.exports = new ResponsesController();
