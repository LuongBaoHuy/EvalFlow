const campaignsService = require('../services/campaigns.service');
const campaignCopilotService = require('../services/campaignCopilot.service');
const aiGoalAnalyzerService = require('../services/aiGoalAnalyzer.service');
const path = require('path');
const fs = require('fs');

class CampaignsController {
  async listCampaigns(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = (req.query.search || '').trim();
      const status = (req.query.status || 'all').trim();
      const fromDate = (req.query.fromDate || '').trim();
      const toDate = (req.query.toDate || '').trim();

      const { data, meta } = await campaignsService.listCampaigns({ page, limit, search, status, fromDate, toDate });
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách chiến dịch thành công',
        data,
        meta,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách chiến dịch thất bại');
    }
  }

  async getCampaign(req, res) {
    try {
      const data = await campaignsService.getCampaignById(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Lấy chi tiết chiến dịch thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy chi tiết chiến dịch thất bại');
    }
  }

  async createCampaign(req, res) {
    try {
      let payload;
      let excelFilePath = null;

      if (req.is('multipart/form-data')) {
        payload = {
          survey_id: req.body.survey_id,
          name: req.body.name,
          description: req.body.description || '',
          start_date: req.body.start_date,
          end_date: req.body.end_date,
          is_anonymous: req.body.is_anonymous === 'true' || Boolean(req.body.is_anonymous),
          target_role: req.body.target_role,
          user_ids: req.body.user_ids,
        };

        if (req.body.target_role && typeof req.body.target_role === 'string') {
          try {
            payload.target_role = JSON.parse(req.body.target_role);
          } catch (e) { }
        }
        if (req.body.user_ids && typeof req.body.user_ids === 'string') {
          try {
            payload.user_ids = JSON.parse(req.body.user_ids);
          } catch (e) { }
        }
        if (req.body.ai_goals) {
          if (typeof req.body.ai_goals === 'string') {
            try {
              payload.ai_goals = JSON.parse(req.body.ai_goals);
            } catch (e) {
              payload.ai_goals = [];
            }
          } else {
            payload.ai_goals = req.body.ai_goals;
          }
        }

        // Parse workflow params
        payload.is_workflow_enabled = req.body.is_workflow_enabled === 'true' || req.body.is_workflow_enabled === true;
        if (req.body.workflow_steps && typeof req.body.workflow_steps === 'string') {
          try {
            payload.workflow_steps = JSON.parse(req.body.workflow_steps);
          } catch (e) {
            payload.workflow_steps = [];
          }
        } else if (Array.isArray(req.body.workflow_steps)) {
          payload.workflow_steps = req.body.workflow_steps;
        }

        if (req.file) {
          excelFilePath = req.file.path;
        }
      } else {
        payload = req.body;
      }

      let data;
      if (excelFilePath) {
        let assignmentFileUrl = null;
        try {
          const assignmentsDir = path.join(__dirname, '../uploads/assignments');
          if (!fs.existsSync(assignmentsDir)) {
            fs.mkdirSync(assignmentsDir, { recursive: true });
          }
          const fileExt = path.extname(req.file.originalname) || '.xlsx';
          const rawName = req.file.originalname ? req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_') : 'PhanCong.xlsx';
          const savedFileName = `Assignment_${Date.now()}_${rawName}`;
          const permanentPath = path.join(assignmentsDir, savedFileName);
          fs.copyFileSync(excelFilePath, permanentPath);
          assignmentFileUrl = `/uploads/assignments/${savedFileName}`;

          data = await campaignsService.createCampaignWithExcel(payload, excelFilePath, assignmentFileUrl);
        } finally {
          try {
            if (excelFilePath && fs.existsSync(excelFilePath)) {
              fs.unlinkSync(excelFilePath);
            }
          } catch (cleanupErr) {
            console.error('Lỗi khi xóa file Excel tạm:', cleanupErr.message);
          }
        }
      } else {
        data = await campaignsService.createCampaign(payload);
      }

      return res.status(201).json({
        success: true,
        message: 'Tạo chiến dịch và giao bài thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Tạo chiến dịch thất bại');
    }
  }

  async getMyAssignmentsInCampaign(req, res) {
    try {
      const userId = req.user?.id || req.query.user_id || req.body.user_id;
      const data = await campaignsService.getMyAssignmentsInCampaign(req.params.id, userId);
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách nhiệm vụ đánh giá trong chiến dịch thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách nhiệm vụ thất bại');
    }
  }

  async skipRemainingAssignments(req, res) {
    try {
      const userId = req.user?.id || req.body.user_id || req.query.user_id;
      if (!userId) {
        return this._sendError(
          res,
          { message: 'Thiếu thông tin người dùng', statusCode: 401 },
          'Bỏ qua các nhiệm vụ còn lại thất bại'
        );
      }
      const data = await campaignsService.skipRemainingAssignments(req.params.id, userId);
      return res.status(200).json({
        success: true,
        message: 'Đã bỏ qua các nhiệm vụ còn lại trong chiến dịch',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Bỏ qua các nhiệm vụ còn lại thất bại');
    }
  }

  async chatWithCampaignCopilot(req, res) {
    try {
      const { message, history } = req.body;
      const data = await campaignCopilotService.chatWithCampaignCopilot(
        req.params.id,
        message,
        history
      );
      return res.status(200).json({
        success: true,
        message: 'Trợ lý AI Copilot phản hồi thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Phản hồi từ Trợ lý AI Copilot thất bại');
    }
  }

  async toggleCampaignStatus(req, res) {
    try {
      const { is_active } = req.body;
      const data = await campaignsService.toggleCampaignStatus(req.params.id, is_active, req.user);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái chiến dịch thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Cập nhật trạng thái chiến dịch thất bại');
    }
  }

  async updateCampaign(req, res) {
    try {
      const data = await campaignsService.updateCampaign(req.params.id, req.body, req.user);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật chiến dịch thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Cập nhật chiến dịch thất bại');
    }
  }

  async downloadTemplateExcel(req, res) {
    try {
      const workbook = await campaignsService.generateTemplateExcel();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Mau_Giao_Viec_Khao_Sat.xlsx"'
      );
      await workbook.xlsx.write(res);
      return res.end();
    } catch (err) {
      return this._sendError(res, err, 'Không thể tải file mẫu Excel');
    }
  }

  async listTrashCampaigns(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = (req.query.search || '').trim();
      const result = await campaignsService.listTrashCampaigns({ page, limit, search });
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách Thùng rác chiến dịch thành công',
        data: result.campaigns,
        meta: result.pagination,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách Thùng rác thất bại');
    }
  }

  async deleteCampaign(req, res) {
    try {
      const data = await campaignsService.deleteCampaign(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Đã chuyển chiến dịch vào Thùng rác thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Xóa chiến dịch thất bại');
    }
  }

  async restoreCampaign(req, res) {
    try {
      const data = await campaignsService.restoreCampaign(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Khôi phục chiến dịch thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Khôi phục chiến dịch thất bại');
    }
  }

  async forceDeleteCampaign(req, res) {
    try {
      const data = await campaignsService.forceDeleteCampaign(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Xóa vĩnh viễn chiến dịch thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Xóa vĩnh viễn chiến dịch thất bại');
    }
  }

  async getCampaignAnalytics(req, res) {
    try {
      const { stepOrder } = req.query;
      const data = await campaignsService.getCampaignAnalytics(req.params.id, stepOrder);
      return res.status(200).json({
        success: true,
        message: 'Lấy báo cáo thống kê chiến dịch thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy báo cáo thống kê chiến dịch thất bại');
    }
  }

  async getCampaignTracking(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = (req.query.search || '').trim();
      const data = await campaignsService.getCampaignTracking(req.params.id, { page, limit, search });
      return res.status(200).json({
        success: true,
        message: 'Lấy tiến độ nộp bài thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy tiến độ nộp bài thất bại');
    }
  }

  async getCampaignResponses(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = (req.query.search || '').trim();
      const anomalyOnly = req.query.anomalyOnly === 'true' || req.query.anomalyOnly === true;
      const data = await campaignsService.getCampaignResponses(req.params.id, { page, limit, search, anomalyOnly });
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách phiếu nộp thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách phiếu nộp thất bại');
    }
  }

  async exportExcel(req, res) {
    try {
      const { workbook, fileName } = await campaignsService.exportCampaignExcel(req.params.id);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileName)}"`
      );
      await workbook.xlsx.write(res);
      return res.end();
    } catch (err) {
      return this._sendError(res, err, 'Xuất báo cáo Excel thất bại');
    }
  }

  async downloadAssignmentFile(req, res) {
    try {
      const { id } = req.params;
      const pool = require('../config/db');
      const campaignRes = await pool.query(
        'SELECT id, name, assignment_file_url FROM survey_campaigns WHERE id = $1',
        [parseInt(id, 10)]
      );

      if (campaignRes.rows.length === 0 || !campaignRes.rows[0].assignment_file_url) {
        return res.status(404).json({
          success: false,
          message: 'Chiến dịch không có file phân công đính kèm',
        });
      }

      const campaign = campaignRes.rows[0];
      const relPath = campaign.assignment_file_url.startsWith('/')
        ? campaign.assignment_file_url.slice(1)
        : campaign.assignment_file_url;
      const fullPath = path.join(__dirname, '../', relPath);

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          success: false,
          message: 'File phân công gốc không tồn tại trên hệ thống server',
        });
      }

      const safeName = campaign.name
        ? campaign.name.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'PhanCong';

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="PhanCongGoc_${id}_${safeName}.xlsx"`);
      return res.sendFile(fullPath);
    } catch (err) {
      return this._sendError(res, err, 'Tải file phân công gốc thất bại');
    }
  }

  async getAiGoalsResult(req, res) {
    try {
      const data = await aiGoalAnalyzerService.getSavedGoalResults(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Lấy kết quả đánh giá mục tiêu thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy kết quả đánh giá mục tiêu thất bại');
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

module.exports = new CampaignsController();
