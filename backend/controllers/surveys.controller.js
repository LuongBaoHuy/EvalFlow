const surveysService = require('../services/surveys.service');

class SurveysController {
  async listSurveys(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = (req.query.search || '').trim();
      const sort = (req.query.sort || 'newest').trim();
      const fromDate = (req.query.fromDate || '').trim();
      const toDate = (req.query.toDate || '').trim();

      const { data, meta } = await surveysService.listSurveys({ page, limit, search, sort, fromDate, toDate });
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách Form khảo sát thành công',
        data,
        meta,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách Form khảo sát thất bại');
    }
  }

  async getSurvey(req, res) {
    try {
      const data = await surveysService.getSurveyById(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Lấy chi tiết Form khảo sát thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy chi tiết Form khảo sát thất bại');
    }
  }

  async createSurvey(req, res) {
    try {
      const payload = { ...req.body };
      const data = await surveysService.createSurvey(payload);
      return res.status(201).json({
        success: true,
        message: 'Tạo Form khảo sát thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Tạo Form khảo sát thất bại');
    }
  }

  async updateSurvey(req, res) {
    try {
      const data = await surveysService.updateSurvey(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật Form khảo sát thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Cập nhật Form khảo sát thất bại');
    }
  }

  async listTrashSurveys(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = (req.query.search || '').trim();
      const result = await surveysService.listTrashSurveys({ page, limit, search });
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách Thùng rác Mẫu Form thành công',
        data: result.surveys,
        meta: result.pagination,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách Thùng rác thất bại');
    }
  }

  async deleteSurvey(req, res) {
    try {
      const data = await surveysService.deleteSurvey(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Đã chuyển Mẫu Form vào Thùng rác thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Xóa Mẫu Form thất bại');
    }
  }

  async restoreSurvey(req, res) {
    try {
      const data = await surveysService.restoreSurvey(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Khôi phục Mẫu Form thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Khôi phục Mẫu Form thất bại');
    }
  }

  async forceDeleteSurvey(req, res) {
    try {
      const data = await surveysService.forceDeleteSurvey(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Xóa vĩnh viễn Mẫu Form thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Xóa vĩnh viễn Mẫu Form thất bại');
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

module.exports = new SurveysController();
