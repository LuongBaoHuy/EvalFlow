const pool = require('../config/db');
const ExcelJS = require('exceljs');

function formatLocalDateTime(d) {
  if (!d) return null;
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return null;
  return dateObj.toISOString();
}

class CampaignsService {
  async listCampaigns({ page = 1, limit = 10, search = '', status = 'all', fromDate = '', toDate = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = ['c.deleted_at IS NULL'];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`c.name ILIKE $${params.length}`);
    }

    if (status === 'active') {
      whereClauses.push(`c.is_active = true AND NOW() >= c.start_date AND NOW() <= c.end_date`);
    } else if (status === 'upcoming') {
      whereClauses.push(`c.is_active = true AND NOW() < c.start_date`);
    } else if (status === 'ended') {
      whereClauses.push(`NOW() > c.end_date`);
    } else if (status === 'paused' || status === 'disabled') {
      whereClauses.push(`c.is_active = false AND (c.end_date IS NULL OR NOW() <= c.end_date)`);
    }

    if (fromDate && fromDate.trim()) {
      params.push(`${fromDate.trim()} 00:00:00`);
      whereClauses.push(`c.end_date >= $${params.length}`);
    }

    if (toDate && toDate.trim()) {
      params.push(`${toDate.trim()} 23:59:59`);
      whereClauses.push(`c.start_date <= $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM survey_campaigns c
      LEFT JOIN surveys s ON c.survey_id = s.id
      ${whereSql}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total, 10) || 0;

    const dataParams = [...params, limitNum, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const dataQuery = `
      SELECT
        c.id,
        c.survey_id,
        c.name,
        c.start_date,
        c.end_date,
        c.is_active,
        c.is_public,
        c.version,
        c.ai_goals,
        s.title AS survey_title,
        s.title AS template_name,
        (SELECT COUNT(*) FROM survey_assignments sa WHERE sa.campaign_id = c.id) AS total_assigned,
        (SELECT COUNT(*) FROM survey_assignments sa WHERE sa.campaign_id = c.id AND sa.status = 'Completed') AS total_completed
      FROM survey_campaigns c
      LEFT JOIN surveys s ON c.survey_id = s.id
      ${whereSql}
      ORDER BY c.id DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;
    const dataResult = await pool.query(dataQuery, dataParams);
    const totalPages = Math.ceil(totalRecords / limitNum) || 1;

    const data = dataResult.rows.map((row) => ({
      id: row.id,
      survey_id: row.survey_id,
      survey_title: row.survey_title || row.template_name,
      template_name: row.template_name || row.survey_title,
      name: row.name,
      start_date: formatLocalDateTime(row.start_date),
      end_date: formatLocalDateTime(row.end_date),
      is_active: row.is_active,
      is_public: Boolean(row.is_public),
      version: parseInt(row.version, 10) || 1,
      ai_goals: Array.isArray(row.ai_goals) ? row.ai_goals : typeof row.ai_goals === 'string' ? (JSON.parse(row.ai_goals || '[]')) : [],
      total_assigned: parseInt(row.total_assigned, 10) || 0,
      total_completed: parseInt(row.total_completed, 10) || 0,
    }));

    return {
      data,
      meta: {
        totalRecords,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
      },
    };
  }

  async getCampaignById(id) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT
        c.id,
        c.survey_id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.is_active,
        c.is_public,
        c.version,
        c.ai_goals,
        s.title AS survey_title,
        s.title AS template_name,
        s.description AS survey_description
      FROM survey_campaigns c
      LEFT JOIN surveys s ON c.survey_id = s.id
      WHERE c.id = $1
    `;
    const result = await pool.query(query, [parsedId]);
    if (result.rows.length === 0) {
      const err = new Error('Không tìm thấy chiến dịch');
      err.statusCode = 404;
      throw err;
    }

    const campaign = result.rows[0];

    const respCountQuery = await pool.query(
      `SELECT COUNT(*) AS total FROM responses WHERE campaign_id = $1`,
      [parsedId]
    );
    const responseCount = parseInt(respCountQuery.rows[0].total, 10) || 0;

    const assignmentsQuery = `
      SELECT
        sa.id AS assignment_id,
        sa.user_id,
        sa.status,
        u.full_name,
        u.email,
        u.department
      FROM survey_assignments sa
      JOIN users u ON sa.user_id = u.id
      WHERE sa.campaign_id = $1
      ORDER BY sa.id ASC
    `;
    const assignRes = await pool.query(assignmentsQuery, [parsedId]);

    return {
      id: campaign.id,
      survey_id: campaign.survey_id,
      survey_title: campaign.survey_title || campaign.template_name,
      template_name: campaign.template_name || campaign.survey_title,
      survey_description: campaign.survey_description,
      name: campaign.name,
      description: campaign.description || '',
      start_date: formatLocalDateTime(campaign.start_date),
      end_date: formatLocalDateTime(campaign.end_date),
      is_active: campaign.is_active,
      is_public: Boolean(campaign.is_public),
      version: parseInt(campaign.version, 10) || 1,
      ai_goals: Array.isArray(campaign.ai_goals) ? campaign.ai_goals : typeof campaign.ai_goals === 'string' ? (JSON.parse(campaign.ai_goals || '[]')) : [],
      response_count: responseCount,
      assignments: assignRes.rows,
    };
  }

  async updateCampaign(id, payload, reqUser = null) {
    const existing = await this.getCampaignById(id);

    const { name, survey_id, start_date, end_date, description, is_public, is_active } = payload;

    const parsedSurveyId = survey_id !== undefined ? parseInt(survey_id, 10) : existing.survey_id;
    if (!Number.isFinite(parsedSurveyId) || parsedSurveyId <= 0) {
      const err = new Error('ID Form khảo sát không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    // Safety constraint: If responses already submitted, forbid changing survey_id
    if (existing.response_count > 0 && parsedSurveyId !== existing.survey_id) {
      const err = new Error('Chiến dịch này đã có bài nộp, không được phép thay đổi Form khảo sát!');
      err.statusCode = 400;
      throw err;
    }

    const campaignName = name !== undefined ? String(name).trim() : existing.name;
    if (!campaignName) {
      const err = new Error('Tên chiến dịch không được để trống');
      err.statusCode = 400;
      throw err;
    }

    const startDate = start_date !== undefined ? formatLocalDateTime(start_date) : existing.start_date;
    const endDate = end_date !== undefined ? formatLocalDateTime(end_date) : existing.end_date;
    const campaignDesc = description !== undefined ? description : existing.description;
    const isPub = is_public !== undefined ? Boolean(is_public) : existing.is_public;
    const isActive = is_active !== undefined ? Boolean(is_active) : existing.is_active;

    // Requirement 4: Resume validation check
    const now = new Date();
    const endDateObj = endDate ? new Date(endDate) : null;
    if (isActive && endDateObj && endDateObj < now) {
      const err = new Error('Thời gian kết thúc đã qua. Vui lòng gia hạn Thời gian kết thúc mới trước khi kích hoạt lại chiến dịch.');
      err.statusCode = 400;
      throw err;
    }

    const aiGoalsStr = payload.ai_goals !== undefined
      ? (Array.isArray(payload.ai_goals) ? JSON.stringify(payload.ai_goals.map(g => String(g).trim()).filter(Boolean)) : typeof payload.ai_goals === 'string' ? payload.ai_goals : '[]')
      : JSON.stringify(existing.ai_goals || []);

    const reqVersion = payload.version !== undefined && payload.version !== null
      ? parseInt(payload.version, 10)
      : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let query;
      let values;

      if (Number.isFinite(reqVersion)) {
        query = `
          UPDATE survey_campaigns
          SET name = $1,
              survey_id = $2,
              start_date = $3,
              end_date = $4,
              description = $5,
              is_public = $6,
              is_active = $7,
              ai_goals = $8::jsonb,
              version = version + 1
          WHERE id = $9 AND version = $10
          RETURNING id, version
        `;
        values = [campaignName, parsedSurveyId, startDate, endDate, campaignDesc, isPub, isActive, aiGoalsStr, existing.id, reqVersion];
      } else {
        query = `
          UPDATE survey_campaigns
          SET name = $1,
              survey_id = $2,
              start_date = $3,
              end_date = $4,
              description = $5,
              is_public = $6,
              is_active = $7,
              ai_goals = $8::jsonb,
              version = version + 1
          WHERE id = $9
          RETURNING id, version
        `;
        values = [campaignName, parsedSurveyId, startDate, endDate, campaignDesc, isPub, isActive, aiGoalsStr, existing.id];
      }

      const updateRes = await client.query(query, values);

      if (updateRes.rowCount === 0) {
        await client.query('ROLLBACK');
        const err = new Error('Dữ liệu đã bị thay đổi bởi một Quản trị viên khác trong lúc bạn đang soạn thảo.');
        err.statusCode = 409;
        err.name = 'ConflictError';
        throw err;
      }

      // Target Audience Synchronization if target_role or target_roles is provided
      const targetRoleInput = payload.target_role !== undefined ? payload.target_role : payload.target_roles;
      if (targetRoleInput !== undefined && targetRoleInput !== null) {
        const targetRoles = Array.isArray(targetRoleInput)
          ? targetRoleInput
          : typeof targetRoleInput === 'string'
            ? [targetRoleInput]
            : [];

        if (targetRoles.length > 0) {
          // 1. Fetch user IDs who have already completed submission for this campaign (PROTECTED USER DATA)
          const completedRes = await client.query(
            `SELECT DISTINCT user_id FROM survey_assignments WHERE campaign_id = $1 AND status = 'Completed'`,
            [existing.id]
          );
          const completedUserIds = new Set(completedRes.rows.map((r) => r.user_id));

          // 2. Query target user IDs based on new targetRoles
          let roleQuery = `
            SELECT DISTINCT u.id 
            FROM users u
            JOIN roles r ON u.role_id = r.id
          `;
          let params = [];

          let initialAssigneeRoles = targetRoles;
          let finalIsAllSelected = targetRoles.includes('Tất cả người dùng') || targetRoles.includes('ALL');

          if (existing.is_workflow_enabled) {
            const step1Res = await client.query(
              `SELECT reviewer_role FROM campaign_workflows WHERE campaign_id = $1 AND step_order = 1`,
              [existing.id]
            );
            if (step1Res.rows.length > 0) {
              initialAssigneeRoles = [step1Res.rows[0].reviewer_role];
              finalIsAllSelected = false;
            }
          }

          if (!finalIsAllSelected) {
            const numericRoleIds = initialAssigneeRoles
              .map((r) => parseInt(r, 10))
              .filter((id) => Number.isFinite(id) && id > 0);

            roleQuery += ` WHERE r.role_name = ANY($1) OR r.id = ANY($2::int[])`;
            params = [initialAssigneeRoles, numericRoleIds];
          } else {
            roleQuery += ` WHERE r.role_name != 'Admin'`;
          }

          const userRes = await client.query(roleQuery, params);
          const newTargetUserIds = new Set(userRes.rows.map((r) => r.id));

          // Combine new target user IDs with completed user IDs (never unassign a completed user)
          const finalTargetUserIds = new Set([...newTargetUserIds, ...completedUserIds]);
          const finalTargetUserArray = Array.from(finalTargetUserIds);

          // 3. Remove PENDING assignments for users no longer in finalTargetUserIds
          if (finalTargetUserArray.length > 0) {
            await client.query(
              `DELETE FROM survey_assignments 
               WHERE campaign_id = $1 AND status = 'Pending' AND user_id != ALL($2::int[])`,
              [existing.id, finalTargetUserArray]
            );
          } else {
            await client.query(
              `DELETE FROM survey_assignments WHERE campaign_id = $1 AND status = 'Pending'`,
              [existing.id]
            );
          }

          // 4. Query current assignment user IDs
          const currentRes = await client.query(
            `SELECT user_id FROM survey_assignments WHERE campaign_id = $1`,
            [existing.id]
          );
          const currentAssignedUserIds = new Set(currentRes.rows.map((r) => r.user_id));

          // 5. Add PENDING assignments for new target users not yet assigned
          for (const uid of finalTargetUserArray) {
            if (!currentAssignedUserIds.has(uid)) {
              await client.query(
                `INSERT INTO survey_assignments (campaign_id, user_id, status) VALUES ($1, $2, 'Pending')`,
                [existing.id, uid]
              );
            }
          }
        }
      }

      // Notification for Admin if changed from Paused to Active by non-Admin
      if (isActive && !existing.is_active && (!reqUser || reqUser.role_id !== 1)) {
        try {
          const adminRes = await client.query(`SELECT id FROM users WHERE role_id = 1`);
          const message = `Form khảo sát "${campaignName}" đã được chuyển từ Tạm dừng sang Đang hoạt động.`;
          const actionLink = `/admin/surveys/${existing.id}`;
          
          for (const r of adminRes.rows) {
            await client.query(
              `INSERT INTO notifications (user_id, message, action_link, is_read) VALUES ($1, $2, $3, FALSE)`,
              [r.id, message, actionLink]
            );
          }
        } catch (err) {
          console.error('[Notification Error] Error creating Paused to Active notification:', err);
        }
      }

      await client.query('COMMIT');
      return this.getCampaignById(existing.id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async createCampaign(payload) {
    const { survey_id, name, description, start_date, end_date, is_anonymous, is_public, target_role, user_ids, ai_goals } = payload;
    const isAnon = Boolean(is_anonymous);
    const isPub = Boolean(is_public);
    const campaignDesc = description ? String(description).trim() : null;
    const aiGoalsStr = Array.isArray(ai_goals) ? JSON.stringify(ai_goals.map(g => String(g).trim()).filter(Boolean)) : typeof ai_goals === 'string' ? ai_goals : '[]';

    const parsedSurveyId = parseInt(survey_id, 10);
    if (!Number.isFinite(parsedSurveyId) || parsedSurveyId <= 0) {
      const err = new Error('ID survey không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      const err = new Error('Tên chiến dịch là bắt buộc');
      err.statusCode = 400;
      throw err;
    }

    if (!start_date || !end_date) {
      const err = new Error('Ngày bắt đầu và ngày kết thúc là bắt buộc');
      err.statusCode = 400;
      throw err;
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err = new Error('Định dạng ngày bắt đầu hoặc ngày kết thúc không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (start > end) {
      const err = new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
      err.statusCode = 400;
      throw err;
    }

    const surveyCheck = await pool.query('SELECT id, title FROM surveys WHERE id = $1', [parsedSurveyId]);
    if (surveyCheck.rows.length === 0) {
      const err = new Error('Survey không tồn tại');
      err.statusCode = 404;
      throw err;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const campaignQuery = `
        INSERT INTO survey_campaigns (survey_id, name, description, start_date, end_date, is_anonymous, is_public, is_active, is_workflow_enabled, ai_goals)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9::jsonb)
        RETURNING id, survey_id, name, description, start_date, end_date, is_anonymous, is_public, is_active, is_workflow_enabled, ai_goals
      `;
      const campaignRes = await client.query(campaignQuery, [
        parsedSurveyId,
        name.trim(),
        campaignDesc,
        start_date,
        end_date,
        isAnon,
        isPub,
        Boolean(payload.is_workflow_enabled),
        aiGoalsStr,
      ]);
      const newCampaign = campaignRes.rows[0];

      // Nếu bật workflow, insert các bước
      const workflowSteps = Array.isArray(payload.workflow_steps) ? payload.workflow_steps : [];
      if (newCampaign.is_workflow_enabled && workflowSteps.length > 0) {
        for (const step of workflowSteps) {
          const stepOrder = parseInt(step.step_order, 10);
          const stepName = String(step.step_name || '').trim();
          const reviewerRole = String(step.reviewer_role || '').trim();
          const canEdit = step.can_edit_answers !== false; // default true
          if (!Number.isFinite(stepOrder) || !stepName || !reviewerRole) continue;
          await client.query(
            `INSERT INTO campaign_workflows (campaign_id, step_order, step_name, reviewer_role, can_edit_answers)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (campaign_id, step_order) DO UPDATE
             SET step_name = EXCLUDED.step_name, reviewer_role = EXCLUDED.reviewer_role, can_edit_answers = EXCLUDED.can_edit_answers`,
            [newCampaign.id, stepOrder, stepName, reviewerRole, canEdit]
          );
        }
      }

      let targetUserIds = [];

      if (Array.isArray(user_ids) && user_ids.length > 0) {
        targetUserIds = user_ids.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id));
      } else {
        let roleList = [];
        if (Array.isArray(target_role)) {
          roleList = target_role.map((r) => String(r).trim()).filter(Boolean);
        } else if (typeof target_role === 'string' && target_role.trim()) {
          if (target_role.includes(',')) {
            roleList = target_role.split(',').map((r) => r.trim()).filter(Boolean);
          } else {
            roleList = [target_role.trim()];
          }
        }

        let roleQuery = `
          SELECT DISTINCT u.id
          FROM users u
          JOIN roles r ON u.role_id = r.id
        `;
        let params = [];

        const isAllSelected =
          roleList.length === 0 ||
          roleList.some(
            (r) =>
              r.toLowerCase() === 'all' ||
              r.toLowerCase() === 'tất cả' ||
              r.toLowerCase().includes('tất cả người dùng')
          );

        let initialAssigneeRoles = roleList;
        let finalIsAllSelected = isAllSelected;

        // Nếu bật workflow, chỉ giao phiếu Khởi tạo (survey_assignments) cho Role thuộc Bước 1
        if (newCampaign.is_workflow_enabled && workflowSteps.length > 0) {
          const firstStep = workflowSteps.find(s => parseInt(s.step_order, 10) === 1);
          if (firstStep && firstStep.reviewer_role) {
            initialAssigneeRoles = [firstStep.reviewer_role];
            finalIsAllSelected = false; // Không bao giờ giao cho tất cả nếu có workflow
          }
        }

        if (!finalIsAllSelected && initialAssigneeRoles.length > 0) {
          const numericRoleIds = initialAssigneeRoles
            .map((r) => parseInt(r, 10))
            .filter((id) => Number.isFinite(id) && id > 0);

          roleQuery += ` WHERE r.role_name = ANY($1) OR r.id = ANY($2::int[])`;
          params = [initialAssigneeRoles, numericRoleIds];
        } else {
          roleQuery += ` WHERE r.role_name != 'Admin'`;
        }

        const userRes = await client.query(roleQuery, params);
        targetUserIds = userRes.rows.map((row) => row.id);
      }

      const assignedCount = targetUserIds.length;
      for (const uid of targetUserIds) {
        await client.query(
          `INSERT INTO survey_assignments (campaign_id, user_id, status) VALUES ($1, $2, 'Pending')`,
          [newCampaign.id, uid]
        );

        const notifMsg = `Bạn có bài khảo sát mới: "${name.trim()}"`;
        const actionLink = `/my-surveys`;
        await client.query(
          `INSERT INTO notifications (user_id, message, action_link, is_read) VALUES ($1, $2, $3, FALSE)`,
          [uid, notifMsg, actionLink]
        );
      }

      await client.query('COMMIT');

      return {
        id: newCampaign.id,
        survey_id: newCampaign.survey_id,
        name: newCampaign.name,
        start_date: newCampaign.start_date,
        end_date: newCampaign.end_date,
        is_active: newCampaign.is_active,
        assigned_users_count: assignedCount,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async generateTemplateExcel() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EvalFlow System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Mau_Giao_Viec');

    worksheet.columns = [
      { header: 'Email Sinh Viên', key: 'student_email', width: 30 },
      { header: 'Email Giảng Viên', key: 'teacher_email', width: 30 },
      { header: 'Môn Học', key: 'subject_name', width: 35 },
    ];

    // Style Header (Dòng 1)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Dark Indigo #1e3a8a
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 32;

    // Sample Rows (Dòng 2 trở đi)
    worksheet.addRow({
      student_email: 'sinh1@evalflow.edu',
      teacher_email: 'giang1@evalflow.edu',
      subject_name: 'Lập trình Web Advanced',
    });
    worksheet.addRow({
      student_email: 'sinh2@evalflow.edu',
      teacher_email: 'giang1@evalflow.edu',
      subject_name: 'Cơ sở dữ liệu PostgreSQL',
    });

    // Borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    return workbook;
  }

  async createCampaignWithExcel(payload, filePath, assignmentFileUrl = null) {
    const { survey_id, name, description, start_date, end_date, is_anonymous } = payload;
    const fileUrl = assignmentFileUrl || payload.assignment_file_url || null;

    const parsedSurveyId = parseInt(survey_id, 10);
    if (!Number.isFinite(parsedSurveyId) || parsedSurveyId <= 0) {
      const err = new Error('ID survey không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      const err = new Error('Tên chiến dịch là bắt buộc');
      err.statusCode = 400;
      throw err;
    }

    if (!start_date || !end_date) {
      const err = new Error('Ngày bắt đầu và ngày kết thúc là bắt buộc');
      err.statusCode = 400;
      throw err;
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err = new Error('Định dạng ngày không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (start > end) {
      const err = new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
      err.statusCode = 400;
      throw err;
    }

    const surveyCheck = await pool.query('SELECT id, title FROM surveys WHERE id = $1', [parsedSurveyId]);
    if (surveyCheck.rows.length === 0) {
      const err = new Error('Survey không tồn tại');
      err.statusCode = 404;
      throw err;
    }

    // 1. Read Excel file using ExcelJS
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch (e) {
      const err = new Error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file .xlsx');
      err.statusCode = 400;
      throw err;
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      const err = new Error('File Excel không có chứa sheet dữ liệu nào');
      err.statusCode = 400;
      throw err;
    }

    // 2. Validate Header (Dòng 1) - Strict Column Check
    const headerRow = worksheet.getRow(1);
    const h1 = String(headerRow.getCell(1).value || '').trim().toLowerCase();
    const h2 = String(headerRow.getCell(2).value || '').trim().toLowerCase();
    const h3 = String(headerRow.getCell(3).value || '').trim().toLowerCase();

    const isValidH1 = h1.includes('sinh viên') || h1.includes('student');
    const isValidH2 = h2.includes('giảng viên') || h2.includes('teacher');
    const isValidH3 = h3.includes('môn') || h3.includes('subject');

    if (!isValidH1 || !isValidH2 || !isValidH3) {
      const err = new Error('File không đúng định dạng mẫu. Cần có 3 cột theo thứ tự: Email Sinh Viên | Email Giảng Viên | Môn Học');
      err.statusCode = 400;
      throw err;
    }

    // 3. Read & Validate Rows (Dòng 2 trở đi)
    const rowsToProcess = [];
    const emailsToLookup = new Set();
    const validationErrors = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const studentEmail = String(row.getCell(1).value || '').trim();
      const teacherEmail = String(row.getCell(2).value || '').trim();
      const subjectName = String(row.getCell(3).value || '').trim();

      // Skip empty lines
      if (!studentEmail && !teacherEmail && !subjectName) return;

      if (!studentEmail) {
        validationErrors.push(`Lỗi dòng ${rowNumber}: Email Sinh Viên không được để trống.`);
      } else {
        emailsToLookup.add(studentEmail.toLowerCase());
      }

      if (!teacherEmail) {
        validationErrors.push(`Lỗi dòng ${rowNumber}: Email Giảng Viên không được để trống.`);
      } else {
        emailsToLookup.add(teacherEmail.toLowerCase());
      }

      if (!subjectName) {
        validationErrors.push(`Lỗi dòng ${rowNumber}: Tên Môn Học không được để trống.`);
      }

      rowsToProcess.push({
        rowNumber,
        studentEmail,
        teacherEmail,
        subjectName,
      });
    });

    if (rowsToProcess.length === 0) {
      const err = new Error('File Excel không có dòng dữ liệu nào để phân công');
      err.statusCode = 400;
      throw err;
    }

    // 4. Batch Lookup Users in DB
    const emailList = Array.from(emailsToLookup);
    const usersRes = await pool.query(
      `SELECT u.id, u.email, u.full_name, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.email) = ANY($1::text[])`,
      [emailList]
    );

    const userMap = {};
    usersRes.rows.forEach((u) => {
      userMap[u.email.toLowerCase()] = u;
    });

    // 5. Strict User Existence Validation
    rowsToProcess.forEach(({ rowNumber, studentEmail, teacherEmail }) => {
      if (studentEmail) {
        const sUser = userMap[studentEmail.toLowerCase()];
        if (!sUser) {
          validationErrors.push(`Lỗi dòng ${rowNumber}: Không tìm thấy sinh viên với email "${studentEmail}".`);
        }
      }

      if (teacherEmail) {
        const tUser = userMap[teacherEmail.toLowerCase()];
        if (!tUser) {
          validationErrors.push(`Lỗi dòng ${rowNumber}: Không tìm thấy giảng viên với email "${teacherEmail}".`);
        }
      }
    });

    if (validationErrors.length > 0) {
      const err = new Error(`Phát hiện lỗi trong file Excel:\n${validationErrors.join('\n')}`);
      err.statusCode = 400;
      throw err;
    }

    // 6. DB Transaction - Create Campaign & Assignments
    const isAnon = Boolean(is_anonymous);
    const campaignDesc = description ? description.trim() : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const campaignQuery = `
        INSERT INTO survey_campaigns (survey_id, name, description, start_date, end_date, is_anonymous, is_active, assignment_file_url)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
        RETURNING id, survey_id, name, description, start_date, end_date, is_anonymous, is_active, assignment_file_url
      `;
      const campaignRes = await client.query(campaignQuery, [
        parsedSurveyId,
        name.trim(),
        campaignDesc,
        start_date,
        end_date,
        isAnon,
        fileUrl,
      ]);
      const newCampaign = campaignRes.rows[0];

      let assignedCount = 0;
      for (const item of rowsToProcess) {
        const studentUser = userMap[item.studentEmail.toLowerCase()];
        const teacherUser = userMap[item.teacherEmail.toLowerCase()];

        await client.query(
          `INSERT INTO survey_assignments (campaign_id, user_id, target_user_id, context_reference, status)
           VALUES ($1, $2, $3, $4, 'Pending')`,
          [newCampaign.id, studentUser.id, teacherUser.id, item.subjectName]
        );

        const notifMsg = `Bạn có bài đánh giá mới: "${item.subjectName}" (Thầy/Cô ${teacherUser.full_name})`;
        const actionLink = `/my-surveys`;
        await client.query(
          `INSERT INTO notifications (user_id, message, action_link, is_read) VALUES ($1, $2, $3, FALSE)`,
          [studentUser.id, notifMsg, actionLink]
        );
        assignedCount++;
      }

      await client.query('COMMIT');

      return {
        id: newCampaign.id,
        survey_id: newCampaign.survey_id,
        name: newCampaign.name,
        start_date: newCampaign.start_date,
        end_date: newCampaign.end_date,
        is_active: newCampaign.is_active,
        assigned_users_count: assignedCount,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async toggleCampaignStatus(id, is_active, reqUser = null) {
    const existing = await this.getCampaignById(id);
    const activeBool = Boolean(is_active);

    const now = new Date();
    const endDateObj = existing.end_date ? new Date(existing.end_date) : null;
    if (activeBool && endDateObj && endDateObj < now) {
      const err = new Error('Thời gian kết thúc đã qua. Form khảo sát đã kết thúc nên không thể thay đổi trạng thái.');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      UPDATE survey_campaigns
      SET is_active = $1
      WHERE id = $2
      RETURNING id, is_active
    `;
    await pool.query(query, [activeBool, existing.id]);
    
    // Notification for Admin if changed from Paused to Active by non-Admin
    if (activeBool && !existing.is_active && (!reqUser || reqUser.role_id !== 1)) {
      try {
        const adminRes = await pool.query(`SELECT id FROM users WHERE role_id = 1`);
        const message = `Form khảo sát "${existing.name}" đã được chuyển từ Tạm dừng sang Đang hoạt động.`;
        const actionLink = `/admin/surveys/${existing.id}`;
        
        for (const r of adminRes.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, message, action_link, is_read) VALUES ($1, $2, $3, FALSE)`,
            [r.id, message, actionLink]
          );
        }
      } catch (err) {
        console.error('[Notification Error] Error creating Paused to Active notification:', err);
      }
    }

    return { ...existing, is_active: activeBool };
  }

  async deleteCampaign(id) {
    const existing = await this.getCampaignById(id);
    await pool.query('DELETE FROM survey_campaigns WHERE id = $1', [existing.id]);
    return { deleted: true, id: existing.id };
  }

  async getCampaignAnalytics(campaignId, stepOrder = null) {
    const parsedId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const campaignQuery = `
      SELECT
        c.id,
        c.survey_id,
        c.name,
        c.description AS campaign_description,
        c.start_date,
        c.end_date,
        c.is_anonymous,
        c.is_active,
        c.assignment_file_url,
        c.is_workflow_enabled,
        c.ai_goals AS campaign_ai_goals,
        s.ai_goals AS template_ai_goals,
        s.title AS survey_title,
        s.description AS survey_description,
        s.theme_config,
        (SELECT COUNT(*) FROM survey_assignments sa WHERE sa.campaign_id = c.id) AS total_assigned,
        (SELECT COUNT(*) FROM survey_assignments sa WHERE sa.campaign_id = c.id AND sa.status = 'Completed') AS total_completed
      FROM survey_campaigns c
      JOIN surveys s ON c.survey_id = s.id
      WHERE c.id = $1
    `;
    const campaignRes = await pool.query(campaignQuery, [parsedId]);
    if (campaignRes.rows.length === 0) {
      const err = new Error('Không tìm thấy chiến dịch');
      err.statusCode = 404;
      throw err;
    }
    const campaign = campaignRes.rows[0];

    const totalResponsesRes = await pool.query(
      'SELECT COUNT(*) FROM responses WHERE campaign_id = $1',
      [parsedId]
    );
    const totalResponses = parseInt(totalResponsesRes.rows[0].count, 10) || 0;

    const questionsRes = await pool.query(
      'SELECT id, question_text, type, is_required, order_index, options FROM questions WHERE survey_id = $1 ORDER BY order_index ASC',
      [campaign.survey_id]
    );

    const answersByQ = {};

    if (stepOrder !== null && stepOrder !== undefined && String(stepOrder).toLowerCase() !== 'original') {
      const reviewsRes = await pool.query(
        `SELECT rr.reviewed_data
         FROM response_reviews rr
         JOIN responses r ON rr.response_id = r.id
         WHERE r.campaign_id = $1 AND rr.step_order = $2`,
        [parsedId, parseInt(stepOrder, 10)]
      );
      reviewsRes.rows.forEach(r => {
        let data = r.reviewed_data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { data = []; }
        }
        if (Array.isArray(data)) {
          data.forEach(item => {
            const qId = item.question_id;
            if (!answersByQ[qId]) answersByQ[qId] = [];
            answersByQ[qId].push(item.answer_value);
          });
        }
      });
    } else {
      const answersRes = await pool.query(
        `SELECT a.response_id, a.question_id, a.answer_value
         FROM answers a
         JOIN responses r ON a.response_id = r.id
         WHERE r.campaign_id = $1`,
        [parsedId]
      );

      const respQuestionAnswers = {};
      answersRes.rows.forEach((r) => {
        if (!respQuestionAnswers[r.response_id]) respQuestionAnswers[r.response_id] = {};
        let val = r.answer_value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch (e) { }
        }
        respQuestionAnswers[r.response_id][r.question_id] = val;
      });

      if (campaign.is_workflow_enabled) {
        const revRes = await pool.query(
          `SELECT rr.response_id, rr.step_order, rr.reviewed_data
           FROM response_reviews rr
           JOIN responses r ON rr.response_id = r.id
           WHERE r.campaign_id = $1
           ORDER BY rr.step_order ASC`,
          [parsedId]
        );

        revRes.rows.forEach(r => {
          let d = r.reviewed_data;
          if (typeof d === 'string') {
            try { d = JSON.parse(d); } catch (e) { d = []; }
          }
          if (Array.isArray(d)) {
            if (!respQuestionAnswers[r.response_id]) respQuestionAnswers[r.response_id] = {};
            d.forEach(item => {
              const qId = item.question_id;
              const currentVal = respQuestionAnswers[r.response_id][qId];
              let revVal = item.answer_value;
              if (typeof revVal === 'string') {
                try { revVal = JSON.parse(revVal); } catch (e) { }
              }

              if (currentVal && typeof currentVal === 'object' && !Array.isArray(currentVal) &&
                  revVal && typeof revVal === 'object' && !Array.isArray(revVal)) {
                const mergedComments = {
                  ...(currentVal._comments || {}),
                  ...(revVal._comments || {}),
                };
                const mergedStepComments = {
                  ...(currentVal._stepComments || {}),
                  ...(revVal._stepComments || {}),
                };
                const mergedObj = { ...currentVal, ...revVal };
                Object.keys(revVal).forEach(k => {
                  if (k.startsWith('_')) return;
                  if (typeof revVal[k] === 'object' && revVal[k] !== null && typeof currentVal[k] === 'object' && currentVal[k] !== null) {
                    mergedObj[k] = { ...currentVal[k], ...revVal[k] };
                  }
                });
                if (Object.keys(mergedComments).length > 0) mergedObj._comments = mergedComments;
                if (Object.keys(mergedStepComments).length > 0) mergedObj._stepComments = mergedStepComments;
                respQuestionAnswers[r.response_id][qId] = mergedObj;
              } else if (revVal !== undefined) {
                respQuestionAnswers[r.response_id][qId] = revVal;
              }
            });
          }
        });
      }

      Object.values(respQuestionAnswers).forEach(qMap => {
        Object.entries(qMap).forEach(([qId, val]) => {
          if (!answersByQ[qId]) answersByQ[qId] = [];
          answersByQ[qId].push(val);
        });
      });
    }

    const questionsAnalytics = [];

    for (const q of questionsRes.rows) {
      let options = {};
      try {
        if (typeof q.options === 'string') options = JSON.parse(q.options);
        else if (q.options && typeof q.options === 'object') options = q.options;
      } catch (e) {
        options = {};
      }

      const rawAnswers = (answersByQ[q.id] || []).map((ans) =>
        ans && typeof ans === 'object' && !Array.isArray(ans) && 'value' in ans ? ans.value : ans
      );
      const totalAns = rawAnswers.length;

      const allQAnswers = answersByQ[q.id] || [];
      const attachedFiles = [];

      allQAnswers.forEach((ans) => {
        if (ans && typeof ans === 'object' && !Array.isArray(ans) && 'attachment' in ans) {
          const att = ans.attachment;
          if (Array.isArray(att)) {
            att.forEach((u) => u && attachedFiles.push(String(u).trim()));
          } else if (typeof att === 'string' && att.trim()) {
            const trimmed = att.trim();
            if (trimmed.startsWith('[')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                  parsed.forEach((u) => u && attachedFiles.push(String(u).trim()));
                } else {
                  attachedFiles.push(trimmed);
                }
              } catch (e) {
                attachedFiles.push(trimmed);
              }
            } else if (trimmed.includes(',')) {
              trimmed.split(',').forEach((u) => u.trim() && attachedFiles.push(u.trim()));
            } else {
              attachedFiles.push(trimmed);
            }
          }
        }
      });

      const item = {
        question_id: q.id,
        question_text: q.question_text,
        type: q.type,
        is_required: q.is_required,
        order_index: q.order_index,
        options,
        total_answers: totalAns,
        attached_files: attachedFiles,
      };

      if (q.type === 'radio') {
        const breakdown = {};
        (options.choices || []).forEach((c) => {
          breakdown[c] = 0;
        });
        rawAnswers.forEach((ans) => {
          if (ans !== null && ans !== undefined) {
            const strVal = String(ans).trim();
            if (strVal) {
              breakdown[strVal] = (breakdown[strVal] || 0) + 1;
            }
          }
        });
        item.breakdown = breakdown;
      } else if (q.type === 'checkbox') {
        const breakdown = {};
        (options.choices || []).forEach((c) => {
          breakdown[c] = 0;
        });
        rawAnswers.forEach((ans) => {
          let list = [];
          if (Array.isArray(ans)) list = ans;
          else if (typeof ans === 'string') {
            try {
              const p = JSON.parse(ans);
              if (Array.isArray(p)) list = p;
              else list = [ans];
            } catch (e) {
              list = ans.split(',').map((s) => s.trim());
            }
          }
          list.forEach((val) => {
            const strVal = String(val).trim();
            if (strVal) {
              breakdown[strVal] = (breakdown[strVal] || 0) + 1;
            }
          });
        });
        item.breakdown = breakdown;
      } else if (q.type === 'slider') {
        const nums = rawAnswers
          .map((a) => Number(a))
          .filter((n) => !isNaN(n) && Number.isFinite(n));

        if (nums.length > 0) {
          const sum = nums.reduce((acc, curr) => acc + curr, 0);
          item.average_score = Math.round((sum / nums.length) * 100) / 100;
          item.min_score = Math.min(...nums);
          item.max_score = Math.max(...nums);
        } else {
          item.average_score = 0;
          item.min_score = 0;
          item.max_score = 0;
        }
      } else if (q.type === 'rating') {
        const maxStars = Number(options.max) || 5;
        item.max_stars = maxStars;
        const ratingBreakdown = {};
        for (let i = 1; i <= maxStars; i++) {
          ratingBreakdown[String(i)] = 0;
        }

        const nums = [];
        rawAnswers.forEach((ans) => {
          const num = Number(ans);
          if (!isNaN(num) && Number.isFinite(num) && num > 0) {
            nums.push(num);
            const intKey = String(Math.round(num));
            ratingBreakdown[intKey] = (ratingBreakdown[intKey] || 0) + 1;
          }
        });

        if (nums.length > 0) {
          const sum = nums.reduce((acc, curr) => acc + curr, 0);
          item.average_rating = Math.round((sum / nums.length) * 10) / 10;
        } else {
          item.average_rating = 0;
        }
        item.rating_breakdown = ratingBreakdown;
      } else if (q.type === 'text') {
        const textList = rawAnswers
          .map((a) => (a !== null && a !== undefined ? String(a).trim() : ''))
          .filter(Boolean);
        item.text_responses = textList;
      } else if (q.type === 'file_upload') {
        const fileList = [];
        rawAnswers.forEach((ans) => {
          if (!ans) return;
          if (Array.isArray(ans)) {
            ans.forEach((url) => {
              if (url && typeof url === 'string') fileList.push(url.trim());
            });
          } else if (typeof ans === 'string') {
            const str = ans.trim();
            if (str.startsWith('[')) {
              try {
                const parsed = JSON.parse(str);
                if (Array.isArray(parsed)) {
                  parsed.forEach((u) => u && fileList.push(String(u).trim()));
                } else {
                  fileList.push(str);
                }
              } catch (e) {
                fileList.push(str);
              }
            } else if (str.includes(',')) {
              str.split(',').forEach((u) => u && fileList.push(u.trim()));
            } else {
              fileList.push(str);
            }
          }
        });
        item.file_responses = fileList.filter(Boolean);
      } else if (q.type === 'matrix') {
        const matrixConfig = options.matrix || {};
        const groups = matrixConfig.groups || [];
        const columns = matrixConfig.columns || [];
        const evalColumns = columns.filter((c) => c.isInputColumn !== false && !c.isMaxScoreColumn);

        const itemScores = {};
        const groupScores = {};
        const columnTotals = {};
        const matrixComments = [];

        evalColumns.forEach((c) => {
          columnTotals[c.id] = [];
        });

        rawAnswers.forEach((ans) => {
          let ansObj = ans;
          if (typeof ansObj === 'string') {
            try { ansObj = JSON.parse(ansObj); } catch { ansObj = {}; }
          }
          if (!ansObj || typeof ansObj !== 'object') return;

          // Extract step comments
          const stepComments = ansObj._stepComments || {};
          Object.entries(stepComments).forEach(([stepOrder, cInfo]) => {
            if (cInfo && (cInfo.text || typeof cInfo === 'string')) {
              matrixComments.push({
                stepOrder: Number(stepOrder),
                text: typeof cInfo === 'string' ? cInfo : cInfo.text,
                authorName: cInfo.authorName || '',
                authorRole: cInfo.authorRole || '',
                updatedAt: cInfo.updatedAt || null,
              });
            }
          });
          const legacyComments = ansObj._comments || ansObj.comments || {};
          Object.entries(legacyComments).forEach(([colId, cInfo]) => {
            if (cInfo && (cInfo.text || typeof cInfo === 'string')) {
              const matchedCol = columns.find((c) => c.id === colId);
              matrixComments.push({
                colId,
                role: matchedCol?.role || '',
                colName: matchedCol?.name || colId,
                text: typeof cInfo === 'string' ? cInfo : cInfo.text,
                authorName: cInfo.authorName || '',
                authorRole: cInfo.authorRole || matchedCol?.role || '',
                updatedAt: cInfo.updatedAt || null,
              });
            }
          });

          // Aggregate scores
          evalColumns.forEach((col) => {
            let totalSum = 0;
            groups.forEach((g) => {
              let gSum = 0;
              (g.items || []).forEach((it) => {
                if (!itemScores[it.id]) itemScores[it.id] = {};
                if (!itemScores[it.id][col.id]) itemScores[it.id][col.id] = [];

                const cellVal = ansObj[it.id]?.[col.id];
                if (cellVal !== undefined && cellVal !== '' && cellVal !== null) {
                  const numVal = Number(cellVal);
                  if (!isNaN(numVal)) {
                    itemScores[it.id][col.id].push(numVal);
                    gSum += numVal;
                  }
                }
              });

              if (!groupScores[g.id]) groupScores[g.id] = {};
              if (!groupScores[g.id][col.id]) groupScores[g.id][col.id] = [];

              const cappedGSum = g.maxScore > 0 ? Math.min(gSum, Number(g.maxScore)) : gSum;
              groupScores[g.id][col.id].push(cappedGSum);
              totalSum += cappedGSum;
            });

            const grandMax = matrixConfig.grandTotalMaxScore ? Number(matrixConfig.grandTotalMaxScore) : 0;
            const finalTotal = grandMax > 0 ? Math.min(totalSum, grandMax) : totalSum;
            columnTotals[col.id].push(finalTotal);
          });
        });

        const avgByItem = {};
        Object.entries(itemScores).forEach(([itemId, colMap]) => {
          avgByItem[itemId] = {};
          Object.entries(colMap).forEach(([colId, scoreList]) => {
            if (scoreList.length > 0) {
              const avg = scoreList.reduce((a, b) => a + b, 0) / scoreList.length;
              avgByItem[itemId][colId] = Math.round(avg * 100) / 100;
            }
          });
        });

        const avgByGroup = {};
        Object.entries(groupScores).forEach(([groupId, colMap]) => {
          avgByGroup[groupId] = {};
          Object.entries(colMap).forEach(([colId, scoreList]) => {
            if (scoreList.length > 0) {
              const avg = scoreList.reduce((a, b) => a + b, 0) / scoreList.length;
              avgByGroup[groupId][colId] = Math.round(avg * 100) / 100;
            }
          });
        });

        const avgByColumn = {};
        Object.entries(columnTotals).forEach(([colId, scoreList]) => {
          if (scoreList.length > 0) {
            const avg = scoreList.reduce((a, b) => a + b, 0) / scoreList.length;
            avgByColumn[colId] = Math.round(avg * 100) / 100;
          } else {
            avgByColumn[colId] = 0;
          }
        });

        item.matrix_analytics = {
          matrix: matrixConfig,
          avgByItem,
          avgByGroup,
          avgByColumn,
          comments: matrixComments,
          totalResponses: rawAnswers.length,
        };
      }

      questionsAnalytics.push(item);
    }

    let campGoals = [];
    try {
      if (Array.isArray(campaign.campaign_ai_goals)) campGoals = campaign.campaign_ai_goals;
      else if (typeof campaign.campaign_ai_goals === 'string') campGoals = JSON.parse(campaign.campaign_ai_goals || '[]');
    } catch {
      campGoals = [];
    }

    let tempGoals = [];
    try {
      if (Array.isArray(campaign.template_ai_goals)) tempGoals = campaign.template_ai_goals;
      else if (typeof campaign.template_ai_goals === 'string') tempGoals = JSON.parse(campaign.template_ai_goals || '[]');
    } catch {
      tempGoals = [];
    }

    campGoals = campGoals.map((g) => String(g).trim()).filter(Boolean);
    tempGoals = tempGoals.map((g) => String(g).trim()).filter(Boolean);
    const effectiveAiGoals = campGoals.length > 0 ? campGoals : tempGoals;

    const targetUsersRes = await pool.query(
      `SELECT
         sa.target_user_id,
         COALESCE(sa.context_reference, '') AS context_reference,
         u.full_name AS target_user_name,
         u.email AS target_user_email,
         u.department AS target_user_department,
         COUNT(sa.id) AS total_assigned,
         COUNT(CASE WHEN sa.status = 'Completed' THEN 1 END) AS total_completed
       FROM survey_assignments sa
       JOIN users u ON sa.target_user_id = u.id
       WHERE sa.campaign_id = $1 AND sa.target_user_id IS NOT NULL
       GROUP BY sa.target_user_id, COALESCE(sa.context_reference, ''), u.full_name, u.email, u.department
       ORDER BY u.full_name ASC, context_reference ASC`,
      [parsedId]
    );

    const targetUsersList = targetUsersRes.rows.map((r) => ({
      target_user_id: r.target_user_id,
      target_user_name: r.target_user_name,
      target_user_email: r.target_user_email,
      target_user_department: r.target_user_department || '',
      context_reference: r.context_reference || '',
      total_assigned: parseInt(r.total_assigned, 10) || 0,
      total_completed: parseInt(r.total_completed, 10) || 0,
    }));

    let workflows = [];
    if (campaign.is_workflow_enabled) {
      const wfRes = await pool.query(
        'SELECT step_order, step_name, reviewer_role FROM campaign_workflows WHERE campaign_id = $1 ORDER BY step_order ASC',
        [parsedId]
      );
      workflows = wfRes.rows;
    }

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      campaign_description: campaign.campaign_description || campaign.survey_description,
      start_date: formatLocalDateTime(campaign.start_date),
      end_date: formatLocalDateTime(campaign.end_date),
      is_anonymous: Boolean(campaign.is_anonymous),
      is_active: campaign.is_active,
      assignment_file_url: campaign.assignment_file_url || null,
      is_targeted: targetUsersList.length > 0,
      target_users: targetUsersList,
      ai_goals: effectiveAiGoals,
      ...(campaign.is_workflow_enabled ? { workflow_steps: workflows } : {}),
      survey_id: campaign.survey_id,
      survey_title: campaign.survey_title,
      survey_description: campaign.survey_description,
      total_assigned: parseInt(campaign.total_assigned, 10) || 0,
      total_completed: parseInt(campaign.total_completed, 10) || 0,
      total_responses: totalResponses,
      questions: questionsAnalytics,
      theme_config: campaign.theme_config,
    };
  }

  async getCampaignTracking(campaignId, { page = 1, limit = 10, search = '' } = {}) {
    const parsedId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const campaignRes = await pool.query(
      `SELECT c.id, c.name, s.title AS survey_title
       FROM survey_campaigns c
       JOIN surveys s ON c.survey_id = s.id
       WHERE c.id = $1`,
      [parsedId]
    );

    if (campaignRes.rows.length === 0) {
      const err = new Error('Không tìm thấy chiến dịch');
      err.statusCode = 404;
      throw err;
    }
    const campaign = campaignRes.rows[0];

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = (search || '').trim();

    // Query overall campaign progress summary counts
    const statsQuery = `
      SELECT
        COUNT(*) AS total_assigned,
        COUNT(CASE WHEN sa.status = 'Completed' THEN 1 END) AS completed_count,
        COUNT(CASE WHEN sa.status != 'Completed' THEN 1 END) AS pending_count
      FROM survey_assignments sa
      WHERE sa.campaign_id = $1
    `;
    const statsRes = await pool.query(statsQuery, [parsedId]);
    const overallStats = statsRes.rows[0];

    // Filtered query for pagination
    let whereClause = 'WHERE sa.campaign_id = $1';
    const queryParams = [parsedId];

    if (searchTerm) {
      queryParams.push(`%${searchTerm}%`);
      const paramIdx = queryParams.length;
      whereClause += ` AND (u.full_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR tu.full_name ILIKE $${paramIdx} OR sa.context_reference ILIKE $${paramIdx})`;
    }

    const countQuery = `
      SELECT COUNT(*)
      FROM survey_assignments sa
      JOIN users u ON sa.user_id = u.id
      LEFT JOIN users tu ON sa.target_user_id = tu.id
      ${whereClause}
    `;
    const countRes = await pool.query(countQuery, queryParams);
    const filteredTotal = parseInt(countRes.rows[0].count, 10) || 0;

    const dataParams = [...queryParams, limitNum, offset];
    const usersQuery = `
      SELECT
        sa.id AS assignment_id,
        sa.user_id,
        sa.status,
        sa.target_user_id,
        sa.context_reference,
        u.full_name,
        u.email,
        u.department,
        tu.full_name AS target_name
      FROM survey_assignments sa
      JOIN users u ON sa.user_id = u.id
      LEFT JOIN users tu ON sa.target_user_id = tu.id
      ${whereClause}
      ORDER BY u.full_name ASC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;
    const usersRes = await pool.query(usersQuery, dataParams);

    const usersList = usersRes.rows.map((r) => ({
      assignment_id: r.assignment_id,
      user_id: r.user_id,
      target_user_id: r.target_user_id,
      target_name: r.target_name || null,
      context_reference: r.context_reference || null,
      full_name: r.full_name,
      email: r.email,
      department: r.department || 'Chưa cập nhật',
      status: r.status || 'Pending',
    }));

    const totalPages = Math.ceil(filteredTotal / limitNum) || 1;

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      survey_title: campaign.survey_title,
      total: parseInt(overallStats.total_assigned, 10) || 0,
      completed_count: parseInt(overallStats.completed_count, 10) || 0,
      pending_count: parseInt(overallStats.pending_count, 10) || 0,
      users: usersList,
      pagination: {
        total: filteredTotal,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  async getCampaignResponses(campaignId, { page = 1, limit = 10, search = '', anomalyOnly = false } = {}) {
    const parsedId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const campaignRes = await pool.query(
      `SELECT c.id, c.name, c.is_workflow_enabled, s.title AS survey_title, s.id AS survey_id, s.theme_config
       FROM survey_campaigns c
       JOIN surveys s ON c.survey_id = s.id
       WHERE c.id = $1`,
      [parsedId]
    );

    if (campaignRes.rows.length === 0) {
      const err = new Error('Không tìm thấy chiến dịch');
      err.statusCode = 404;
      throw err;
    }
    const campaign = campaignRes.rows[0];

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(1000, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = (search || '').trim();

    // Query total overall response count
    const totalCountRes = await pool.query(
      'SELECT COUNT(*) FROM responses WHERE campaign_id = $1',
      [parsedId]
    );
    const overallTotal = parseInt(totalCountRes.rows[0].count, 10) || 0;

    // Query overall anomaly count
    const anomalyCountRes = await pool.query(
      'SELECT COUNT(*) FROM responses WHERE campaign_id = $1 AND is_anomaly = TRUE',
      [parsedId]
    );
    const overallAnomalyCount = parseInt(anomalyCountRes.rows[0].count, 10) || 0;

    let whereClause = 'WHERE r.campaign_id = $1';
    const queryParams = [parsedId];

    if (anomalyOnly) {
      whereClause += ' AND r.is_anomaly = TRUE';
    }

    if (searchTerm) {
      queryParams.push(`%${searchTerm}%`);
      const paramIdx = queryParams.length;
      whereClause += ` AND (u_eval.full_name ILIKE $${paramIdx} OR u_eval.email ILIKE $${paramIdx} OR u_by_email.full_name ILIKE $${paramIdx} OR u_by_email.email ILIKE $${paramIdx} OR r.guest_name ILIKE $${paramIdx} OR r.guest_email ILIKE $${paramIdx} OR (r.evaluator_id IS NULL AND r.guest_name IS NULL AND 'Người dùng ẩn danh' ILIKE $${paramIdx}))`;
    }

    const countQuery = `
      SELECT COUNT(*)
      FROM responses r
      LEFT JOIN users u_eval ON r.evaluator_id = u_eval.id
      LEFT JOIN users u_by_email ON (r.evaluator_id IS NULL AND r.guest_email IS NOT NULL AND LOWER(u_by_email.email) = LOWER(r.guest_email))
      ${whereClause}
    `;
    const filteredCountRes = await pool.query(countQuery, queryParams);
    const filteredTotal = parseInt(filteredCountRes.rows[0].count, 10) || 0;

    const dataParams = [...queryParams, limitNum, offset];
    const responsesQuery = `
      SELECT
        r.id AS response_id,
        r.campaign_id,
        r.evaluator_id,
        r.guest_name,
        r.guest_email,
        r.target_user_id,
        r.context_reference,
        r.submitted_at,
        r.is_anomaly,
        r.anomaly_reason,
        r.canvas_data,
        COALESCE(u_eval.full_name, u_by_email.full_name) AS evaluator_name_raw,
        COALESCE(u_eval.email, u_by_email.email) AS evaluator_email,
        COALESCE(role_eval.role_name, role_by_email.role_name) AS evaluator_role_name,
        u_targ.full_name AS target_user_name,
        CASE WHEN u_eval.id IS NOT NULL OR u_by_email.id IS NOT NULL THEN FALSE ELSE TRUE END AS is_guest
      FROM responses r
      LEFT JOIN users u_eval ON r.evaluator_id = u_eval.id
      LEFT JOIN roles role_eval ON u_eval.role_id = role_eval.id
      LEFT JOIN users u_by_email ON (r.evaluator_id IS NULL AND r.guest_email IS NOT NULL AND LOWER(u_by_email.email) = LOWER(r.guest_email))
      LEFT JOIN roles role_by_email ON u_by_email.role_id = role_by_email.id
      LEFT JOIN users u_targ ON r.target_user_id = u_targ.id
      ${whereClause}
      ORDER BY r.submitted_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;
    const responsesRes = await pool.query(responsesQuery, dataParams);

    const responseIds = responsesRes.rows.map((r) => r.response_id);

    let answersByResponse = {};
    
    responsesRes.rows.forEach(r => {
      if (r.canvas_data && typeof r.canvas_data === 'object' && Object.keys(r.canvas_data).length > 0) {
        if (!answersByResponse[r.response_id]) answersByResponse[r.response_id] = [];
        Object.keys(r.canvas_data).forEach((qId, idx) => {
           answersByResponse[r.response_id].push({
             answer_id: null,
             response_id: r.response_id,
             question_id: qId,
             answer_value: r.canvas_data[qId],
             question_text: `Canvas Input ${qId}`,
             question_type: 'text',
             order_index: idx,
             options: {}
           });
        });
      }
    });

    if (responseIds.length > 0) {
      const answersQuery = `
        SELECT
          a.id AS answer_id,
          a.response_id,
          a.question_id,
          a.answer_value,
          q.question_text,
          q.type AS question_type,
          q.order_index,
          q.options
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        WHERE a.response_id = ANY($1)
        ORDER BY q.order_index ASC
      `;
      const answersRes = await pool.query(answersQuery, [responseIds]);

      answersRes.rows.forEach((ans) => {
        const respId = ans.response_id;
        if (!answersByResponse[respId]) answersByResponse[respId] = [];

        let val = ans.answer_value;
        if (typeof val === 'string') {
          try {
            val = JSON.parse(val);
          } catch (e) { }
        }

        let options = {};
        try {
          if (typeof ans.options === 'string') options = JSON.parse(ans.options);
          else if (ans.options && typeof ans.options === 'object') options = ans.options;
        } catch (e) { }

        answersByResponse[respId].push({
          answer_id: ans.answer_id,
          question_id: ans.question_id,
          question_text: ans.question_text,
          question_type: ans.question_type,
          order_index: ans.order_index,
          options,
          answer_value: val,
        });
      });
    }

    let workflows = [];
    let reviewsByResponse = {};
    let reviewHistoryByResponse = {};
    if (campaign.is_workflow_enabled && responseIds.length > 0) {
      const wfRes = await pool.query(
        'SELECT step_order, step_name, reviewer_role, can_edit_answers FROM campaign_workflows WHERE campaign_id = $1 ORDER BY step_order ASC',
        [parsedId]
      );
      workflows = wfRes.rows;

      const reviewsRes = await pool.query(
        `SELECT rr.id, rr.response_id, rr.step_order, rr.reviewer_id, rr.reviewed_data, rr.status, rr.note, rr.created_at, rr.updated_at,
                u.full_name AS reviewer_name, r_role.role_name AS reviewer_role
         FROM response_reviews rr
         LEFT JOIN users u ON rr.reviewer_id = u.id
         LEFT JOIN roles r_role ON u.role_id = r_role.id
         WHERE rr.response_id = ANY($1)
         ORDER BY rr.step_order ASC`,
        [responseIds]
      );

      reviewsRes.rows.forEach(r => {
        if (!reviewsByResponse[r.response_id]) reviewsByResponse[r.response_id] = {};
        if (!reviewHistoryByResponse[r.response_id]) reviewHistoryByResponse[r.response_id] = [];

        let data = r.reviewed_data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { data = []; }
        }

        const reviewRecord = {
          id: r.id,
          step_order: r.step_order,
          status: r.status,
          note: r.note,
          reviewer_id: r.reviewer_id,
          reviewer_name: r.reviewer_name || null,
          reviewer_role: r.reviewer_role || null,
          created_at: r.created_at,
          updated_at: r.updated_at,
          reviewed_data: data,
        };

        reviewsByResponse[r.response_id][r.step_order] = reviewRecord;
        reviewHistoryByResponse[r.response_id].push(reviewRecord);

        // Overlay reviewed data onto answersByResponse
        if (Array.isArray(data) && answersByResponse[r.response_id]) {
          data.forEach(item => {
            const ansObj = answersByResponse[r.response_id].find(a => a.question_id === item.question_id);
            if (ansObj) {
              let currentVal = ansObj.answer_value;
              let revVal = item.answer_value;
              if (typeof revVal === 'string') {
                try { revVal = JSON.parse(revVal); } catch (e) {}
              }

              if (currentVal && typeof currentVal === 'object' && !Array.isArray(currentVal) &&
                  revVal && typeof revVal === 'object' && !Array.isArray(revVal)) {
                const mergedComments = {
                  ...(currentVal._comments || {}),
                  ...(revVal._comments || {}),
                };
                const mergedStepComments = {
                  ...(currentVal._stepComments || {}),
                  ...(revVal._stepComments || {}),
                };
                const merged = { ...currentVal, ...revVal };
                Object.keys(revVal).forEach(k => {
                  if (k.startsWith('_')) return;
                  if (typeof revVal[k] === 'object' && revVal[k] !== null && typeof currentVal[k] === 'object' && currentVal[k] !== null) {
                    merged[k] = { ...currentVal[k], ...revVal[k] };
                  }
                });
                if (Object.keys(mergedComments).length > 0) merged._comments = mergedComments;
                if (Object.keys(mergedStepComments).length > 0) merged._stepComments = mergedStepComments;
                ansObj.answer_value = merged;
              } else if (revVal !== undefined) {
                ansObj.answer_value = revVal;
              }
            }
          });
        }
      });
    }

    const responsesList = responsesRes.rows.map((r) => {
      const isGuest = Boolean(r.is_guest);
      const displayName = r.evaluator_name_raw || r.guest_name || 'Người dùng ẩn danh';
      const displayEmail = r.evaluator_email || r.guest_email || 'N/A';

      let workflowStatus = null;
      if (campaign.is_workflow_enabled && workflows.length > 0) {
        const respHistory = reviewHistoryByResponse[r.response_id] || [];
        const rejected = respHistory.find((rv) => rv.status === 'REJECTED');
        const approvedOrders = new Set(
          respHistory.filter((rv) => rv.status === 'APPROVED').map((rv) => rv.step_order)
        );

        if (rejected) {
          const rejStep = workflows.find((w) => w.step_order === rejected.step_order);
          workflowStatus = {
            overall_status: 'REJECTED',
            label: 'Đã từ chối',
            step_order: rejected.step_order,
            step_name: rejStep?.step_name || `Bước ${rejected.step_order}`,
            reviewer_role: rejected.reviewer_role || rejStep?.reviewer_role || null,
            reviewer_name: rejected.reviewer_name || null,
            note: rejected.note || null,
            total_steps: workflows.length,
            completed_steps: approvedOrders.size,
          };
        } else {
          const nextStep = workflows.find((w) => !approvedOrders.has(w.step_order));
          if (nextStep) {
            workflowStatus = {
              overall_status: 'IN_PROGRESS',
              label: `Chờ ${nextStep.reviewer_role || nextStep.step_name} duyệt`,
              step_order: nextStep.step_order,
              step_name: nextStep.step_name,
              reviewer_role: nextStep.reviewer_role,
              total_steps: workflows.length,
              completed_steps: approvedOrders.size,
            };
          } else {
            workflowStatus = {
              overall_status: 'COMPLETED',
              label: 'Đã hoàn tất',
              total_steps: workflows.length,
              completed_steps: approvedOrders.size,
            };
          }
        }
      }

      return {
        response_id: r.response_id,
        evaluator_id: r.evaluator_id,
        evaluator_role_name: r.evaluator_role_name || null,
        target_user_id: r.target_user_id ? parseInt(r.target_user_id, 10) : null,
        guest_name: r.guest_name,
        guest_email: r.guest_email,
        is_guest: isGuest,
        evaluator_name: displayName,
        evaluator_email: displayEmail,
        target_user_name: r.target_user_name || null,
        context_reference: r.context_reference || null,
        is_anomaly: Boolean(r.is_anomaly),
        anomaly_reason: r.anomaly_reason || null,
        submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
        answers: answersByResponse[r.response_id] || [],
        workflow_status: workflowStatus,
        ...(campaign.is_workflow_enabled ? {
          workflow_steps: workflows,
          review_history: reviewHistoryByResponse[r.response_id] || [],
          reviews: reviewsByResponse[r.response_id] || {},
        } : {}),
      };
    });

    const totalPages = Math.ceil(filteredTotal / limitNum) || 1;

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      survey_title: campaign.survey_title,
      is_workflow_enabled: Boolean(campaign.is_workflow_enabled),
      survey_type: campaign.theme_config?.surveyType || 'STANDARD',
      total_responses: overallTotal,
      anomaly_count: overallAnomalyCount,
      ...(campaign.is_workflow_enabled ? { workflow_steps: workflows } : {}),
      responses: responsesList,
      pagination: {
        total: filteredTotal,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  async exportCampaignExcel(campaignId) {
    const parsedId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const campaignRes = await pool.query(
      `SELECT c.id, c.name, c.is_workflow_enabled, s.title AS survey_title, s.id AS survey_id
       FROM survey_campaigns c
       JOIN surveys s ON c.survey_id = s.id
       WHERE c.id = $1`,
      [parsedId]
    );

    if (campaignRes.rows.length === 0) {
      const err = new Error('Không tìm thấy chiến dịch');
      err.statusCode = 404;
      throw err;
    }
    const campaign = campaignRes.rows[0];

    // Fetch all questions for this survey including options
    const questionsRes = await pool.query(
      'SELECT id, question_text, type, order_index, options FROM questions WHERE survey_id = $1 ORDER BY order_index ASC',
      [campaign.survey_id]
    );
    const questions = questionsRes.rows.map(q => {
      let parsedOptions = {};
      if (typeof q.options === 'string') {
        try { parsedOptions = JSON.parse(q.options); } catch (e) { parsedOptions = {}; }
      } else if (q.options && typeof q.options === 'object') {
        parsedOptions = q.options;
      }
      return { ...q, parsedOptions };
    });

    // Fetch all responses for this campaign
    const responsesRes = await pool.query(
      `SELECT
        r.id AS response_id,
        r.submitted_at,
        COALESCE(u_eval.full_name, u_by_email.full_name, r.guest_name, 'Người dùng ẩn danh') AS evaluator_name,
        COALESCE(u_eval.email, u_by_email.email, r.guest_email, 'N/A') AS evaluator_email,
        u_targ.full_name AS target_user_name,
        r.context_reference
       FROM responses r
       LEFT JOIN users u_eval ON r.evaluator_id = u_eval.id
       LEFT JOIN users u_by_email ON (r.evaluator_id IS NULL AND r.guest_email IS NOT NULL AND LOWER(u_by_email.email) = LOWER(r.guest_email))
       LEFT JOIN users u_targ ON r.target_user_id = u_targ.id
       WHERE r.campaign_id = $1
       ORDER BY r.submitted_at DESC`,
      [parsedId]
    );
    const responses = responsesRes.rows;

    // Fetch all answers for this campaign
    const answersRes = await pool.query(
      `SELECT a.response_id, a.question_id, a.answer_value
       FROM answers a
       JOIN responses r ON a.response_id = r.id
       WHERE r.campaign_id = $1`,
      [parsedId]
    );

    const answersMap = {};
    answersRes.rows.forEach((row) => {
      if (!answersMap[row.response_id]) answersMap[row.response_id] = {};
      let val = row.answer_value;
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch (e) { }
      }
      answersMap[row.response_id][row.question_id] = val;
    });

    let workflows = [];
    let reviewsMap = {}; // { response_id: { step_order: reviewed_data } }
    let reviewHistoryMap = {}; // { response_id: [review records] }

    if (campaign.is_workflow_enabled) {
      // Fetch workflow steps
      const wfRes = await pool.query(
        'SELECT step_order, step_name, reviewer_role FROM campaign_workflows WHERE campaign_id = $1 ORDER BY step_order ASC',
        [parsedId]
      );
      workflows = wfRes.rows;

      // Fetch response reviews with reviewer info
      const reviewsRes = await pool.query(
        `SELECT rr.id, rr.response_id, rr.step_order, rr.reviewer_id, rr.reviewed_data, rr.status, rr.note, rr.created_at, rr.updated_at,
                u.full_name AS reviewer_name, r_role.role_name AS reviewer_role
         FROM response_reviews rr
         JOIN responses r ON rr.response_id = r.id
         LEFT JOIN users u ON rr.reviewer_id = u.id
         LEFT JOIN roles r_role ON u.role_id = r_role.id
         WHERE r.campaign_id = $1
         ORDER BY rr.step_order ASC`,
        [parsedId]
      );

      reviewsRes.rows.forEach(row => {
        if (!reviewsMap[row.response_id]) reviewsMap[row.response_id] = {};
        if (!reviewHistoryMap[row.response_id]) reviewHistoryMap[row.response_id] = [];

        let data = row.reviewed_data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { data = []; }
        }
        reviewsMap[row.response_id][row.step_order] = data;
        reviewHistoryMap[row.response_id].push({
          ...row,
          reviewed_data: data,
        });
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EvalFlow System';
    workbook.created = new Date();

    // ─────────────────────────────────────────────────────────────
    // HELPER: Format Matrix value cleanly into readable text
    // ─────────────────────────────────────────────────────────────
    const formatMatrixValue = (matrixVal, matrixConfig, reviewSteps = []) => {
      if (!matrixVal || typeof matrixVal !== 'object') return '';
      const groups = matrixConfig?.groups || [];
      const columns = matrixConfig?.columns || [];
      const evalCols = columns.filter(c => c.isInputColumn !== false && !c.isMaxScoreColumn);

      const lines = [];

      // 1. Grand totals summary line
      const totals = [];
      evalCols.forEach(col => {
        let sum = 0;
        groups.forEach(g => {
          let gSum = 0;
          (g.items || []).forEach(it => {
            const cell = matrixVal[it.id]?.[col.id];
            if (cell !== undefined && cell !== '' && cell !== null && !isNaN(Number(cell))) {
              gSum += Number(cell);
            }
          });
          const cappedG = g.maxScore > 0 ? Math.min(gSum, Number(g.maxScore)) : gSum;
          sum += cappedG;
        });
        const grandMax = matrixConfig?.grandTotalMaxScore || groups.reduce((acc, g) => acc + (Number(g.maxScore) || 0), 0);
        const finalSum = grandMax > 0 ? Math.min(sum, grandMax) : sum;
        totals.push(`${col.name}: ${finalSum}${grandMax > 0 ? `/${grandMax}` : ''} điểm`);
      });

      if (totals.length > 0) {
        lines.push(`📊 TỔNG ĐIỂM CÁC CẤP: [ ${totals.join('  |  ')} ]`);
        lines.push('');
      }

      // 2. Groups & items breakdown
      groups.forEach(g => {
        lines.push(`▶ ${g.name} (Tối đa: ${g.maxScore || 0}đ):`);
        (g.items || []).forEach(it => {
          const itemScores = evalCols.map(col => {
            const cell = matrixVal[it.id]?.[col.id];
            const valStr = cell !== undefined && cell !== '' && cell !== null ? `${cell}đ` : '-';
            return `${col.name}: ${valStr}`;
          });
          lines.push(`  • ${it.name} (Tối đa ${it.maxScore || 0}đ): ${itemScores.join(' | ')}`);
        });
      });

      // 3. Level Comments / Reviewer notes
      const stepComments = matrixVal._stepComments || {};
      const commentLines = [];

      Object.entries(stepComments).forEach(([stepOrder, cInfo]) => {
        if (cInfo && (cInfo.text || typeof cInfo === 'string')) {
          const txt = typeof cInfo === 'string' ? cInfo : cInfo.text;
          const author = cInfo.authorName || cInfo.authorRole || `Cấp ${stepOrder}`;
          const roleStr = cInfo.authorRole ? ` (${cInfo.authorRole})` : '';
          commentLines.push(`  💬 ${author}${roleStr}: "${txt}"`);
        }
      });

      reviewSteps.forEach(rev => {
        if (rev.note && !commentLines.some(l => l.includes(rev.note))) {
          const author = rev.reviewer_name || rev.reviewer_role || `Cấp ${rev.step_order}`;
          const roleStr = rev.reviewer_role ? ` (${rev.reviewer_role})` : '';
          commentLines.push(`  💬 ${author}${roleStr} [Ghi chú duyệt]: "${rev.note}"`);
        }
      });

      if (commentLines.length > 0) {
        lines.push('');
        lines.push('📝 Ý KIẾN NHẬN XÉT / GHI CHÚ THEO CẤP:');
        lines.push(...commentLines);
      }

      return lines.join('\n');
    };

    // Helper to format answers
    const formatValue = (rawVal, question, reviewSteps = []) => {
      if (rawVal === undefined || rawVal === null || rawVal === '') return '';
      let val = rawVal;
      let attachmentStr = '';

      if (val && typeof val === 'object' && !Array.isArray(val) && 'value' in val) {
        if (val.attachment) {
          if (Array.isArray(val.attachment)) {
            attachmentStr = '\n[Tệp đính kèm]: ' + val.attachment.filter(Boolean).join(', ');
          } else {
            attachmentStr = '\n[Tệp đính kèm]: ' + String(val.attachment);
          }
        }
        val = val.value;
      }

      // If matrix question, format visually
      if (question?.type === 'matrix') {
        const matrixConfig = question.parsedOptions?.matrix || question.parsedOptions || {};
        return formatMatrixValue(val, matrixConfig, reviewSteps) + attachmentStr;
      }

      let mainStr = '';
      if (Array.isArray(val)) {
        mainStr = val.filter(Boolean).join(', ');
      } else if (typeof val === 'object') {
        mainStr = JSON.stringify(val);
      } else {
        mainStr = String(val);
      }

      return mainStr + attachmentStr;
    };

    // ─────────────────────────────────────────────────────────────
    // SHEET 1: Báo Cáo Tổng Hợp Khảo Sát
    // ─────────────────────────────────────────────────────────────
    const sheetName = 'Tổng Hợp Kết Quả'.substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    const columns = [
      { header: 'Mã Phiếu', key: 'response_id', width: 12 },
      { header: 'Người Nộp Bài', key: 'evaluator_name', width: 26 },
      { header: 'Email', key: 'evaluator_email', width: 28 },
      { header: 'Ngày Giờ Nộp', key: 'submitted_at', width: 22 },
    ];

    questions.forEach((q, idx) => {
      if (workflows.length > 0) {
        const qTitleBase = `Câu ${idx + 1}: ${q.question_text}`;
        
        columns.push({
          header: `${qTitleBase} (Gốc)`,
          key: `q_${q.id}_orig`,
          width: Math.max(28, Math.min(75, qTitleBase.length + 10)),
        });
        
        workflows.forEach(wf => {
          columns.push({
            header: `${qTitleBase} (${wf.step_name})`,
            key: `q_${q.id}_wf_${wf.step_order}`,
            width: Math.max(28, Math.min(75, qTitleBase.length + wf.step_name.length + 5)),
          });
        });
      } else {
        const qTitle = `Câu ${idx + 1}: ${q.question_text}`;
        columns.push({
          header: qTitle,
          key: `q_${q.id}`,
          width: Math.max(28, Math.min(75, qTitle.length + 5)),
        });
      }
    });

    worksheet.columns = columns;

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Dark Indigo
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 36;

    // Add Data Rows for Sheet 1
    responses.forEach((resp) => {
      const rowData = {
        response_id: `#${resp.response_id}`,
        evaluator_name: resp.evaluator_name || 'Người dùng ẩn danh',
        evaluator_email: resp.evaluator_email || 'N/A',
        submitted_at: resp.submitted_at
          ? new Date(resp.submitted_at).toLocaleString('vi-VN')
          : 'N/A',
      };

      const respReviewSteps = reviewHistoryMap[resp.response_id] || [];

      questions.forEach((q) => {
        let rawAns = answersMap[resp.response_id]?.[q.id];

        // For matrix, merge all review steps to have complete scores
        if (q.type === 'matrix' && respReviewSteps.length > 0) {
          let mergedMatrix = typeof rawAns === 'object' && rawAns !== null ? { ...rawAns } : {};
          respReviewSteps.forEach(rev => {
            if (Array.isArray(rev.reviewed_data)) {
              const found = rev.reviewed_data.find(item => String(item.question_id) === String(q.id));
              if (found && found.answer_value && typeof found.answer_value === 'object') {
                const revVal = found.answer_value;
                const mergedComments = { ...(mergedMatrix._comments || {}), ...(revVal._comments || {}) };
                const mergedStepComments = { ...(mergedMatrix._stepComments || {}), ...(revVal._stepComments || {}) };
                mergedMatrix = { ...mergedMatrix, ...revVal };
                Object.keys(revVal).forEach(k => {
                  if (k.startsWith('_')) return;
                  if (typeof revVal[k] === 'object' && revVal[k] !== null && typeof mergedMatrix[k] === 'object' && mergedMatrix[k] !== null) {
                    mergedMatrix[k] = { ...mergedMatrix[k], ...revVal[k] };
                  }
                });
                if (Object.keys(mergedComments).length > 0) mergedMatrix._comments = mergedComments;
                if (Object.keys(mergedStepComments).length > 0) mergedMatrix._stepComments = mergedStepComments;
              }
            }
          });
          rawAns = mergedMatrix;
        }

        if (workflows.length > 0) {
          rowData[`q_${q.id}_orig`] = formatValue(rawAns, q, respReviewSteps);
          
          workflows.forEach(wf => {
            const stepData = reviewsMap[resp.response_id]?.[wf.step_order];
            let stepAns = undefined;
            if (Array.isArray(stepData)) {
              const found = stepData.find(item => String(item.question_id) === String(q.id));
              if (found) stepAns = found.answer_value;
            }
            rowData[`q_${q.id}_wf_${wf.step_order}`] = formatValue(stepAns || rawAns, q, respReviewSteps);
          });
        } else {
          rowData[`q_${q.id}`] = formatValue(rawAns, q, respReviewSteps);
        }
      });

      const row = worksheet.addRow(rowData);
      row.alignment = { vertical: 'top', wrapText: true };
    });

    // Add borders to Sheet 1
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    // ─────────────────────────────────────────────────────────────
    // SHEET 2: Dedicated Matrix Rubric Breakdown (If Matrix questions exist)
    // ─────────────────────────────────────────────────────────────
    const matrixQuestions = questions.filter(q => q.type === 'matrix');
    if (matrixQuestions.length > 0) {
      matrixQuestions.forEach((mq, mIdx) => {
        const matrixConfig = mq.parsedOptions?.matrix || mq.parsedOptions || {};
        const groups = matrixConfig.groups || [];
        const matrixCols = matrixConfig.columns || [];
        const evalCols = matrixCols.filter(c => c.isInputColumn !== false && !c.isMaxScoreColumn);
        const grandTotalMax = Number(matrixConfig.grandTotalMaxScore) || groups.reduce((acc, g) => acc + (Number(g.maxScore) || 0), 0);

        const sheetTitle = (`Ma Trận - Câu ${mq.order_index || mIdx + 1}`).substring(0, 31);
        const matrixWs = workbook.addWorksheet(sheetTitle);

        const mColumns = [
          { header: 'Mã Phiếu', key: 'response_id', width: 12 },
          { header: 'Người Nộp', key: 'evaluator_name', width: 24 },
          { header: 'Email', key: 'evaluator_email', width: 26 },
          { header: 'Ngày Nộp', key: 'submitted_at', width: 20 },
        ];

        // Add each Item x EvalCol
        groups.forEach((g) => {
          (g.items || []).forEach((it) => {
            evalCols.forEach((col) => {
              mColumns.push({
                header: `[${g.name}] ${it.name} (Max ${it.maxScore || 0}đ)\n[${col.name}]`,
                key: `item_${it.id}_col_${col.id}`,
                width: 20,
              });
            });
          });
        });

        // Add Grand Totals for each column
        evalCols.forEach((col) => {
          mColumns.push({
            header: `★ TỔNG ĐIỂM - ${col.name}\n(Tối đa ${grandTotalMax}đ)`,
            key: `total_col_${col.id}`,
            width: 24,
          });
        });

        // Add Level Comments & Review Notes
        evalCols.forEach((col, idx) => {
          mColumns.push({
            header: `💬 Ý Kiến Nhận Xét\n[${col.name}]`,
            key: `comment_col_${col.id}`,
            width: 32,
          });
        });

        workflows.forEach((wf) => {
          mColumns.push({
            header: `📋 Ghi Chú Phê Duyệt\n[${wf.step_name}]`,
            key: `review_note_step_${wf.step_order}`,
            width: 32,
          });
        });

        matrixWs.columns = mColumns;

        // Style Sheet 2 Header
        const mHeaderRow = matrixWs.getRow(1);
        mHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        mHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF065F46' }, // Emerald Teal #065f46
        };
        mHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        mHeaderRow.height = 42;

        // Populate Rows for Sheet 2
        responses.forEach((resp) => {
          let baseAns = answersMap[resp.response_id]?.[mq.id] || {};
          const respReviewSteps = reviewHistoryMap[resp.response_id] || [];

          // Overlay review steps
          let mergedVal = typeof baseAns === 'object' && baseAns !== null ? { ...baseAns } : {};
          respReviewSteps.forEach(rev => {
            if (Array.isArray(rev.reviewed_data)) {
              const found = rev.reviewed_data.find(item => String(item.question_id) === String(mq.id));
              if (found && found.answer_value && typeof found.answer_value === 'object') {
                const revVal = found.answer_value;
                const mergedComments = { ...(mergedVal._comments || {}), ...(revVal._comments || {}) };
                const mergedStepComments = { ...(mergedVal._stepComments || {}), ...(revVal._stepComments || {}) };
                mergedVal = { ...mergedVal, ...revVal };
                Object.keys(revVal).forEach(k => {
                  if (k.startsWith('_')) return;
                  if (typeof revVal[k] === 'object' && revVal[k] !== null && typeof mergedVal[k] === 'object' && mergedVal[k] !== null) {
                    mergedVal[k] = { ...mergedVal[k], ...revVal[k] };
                  }
                });
                if (Object.keys(mergedComments).length > 0) mergedVal._comments = mergedComments;
                if (Object.keys(mergedStepComments).length > 0) mergedVal._stepComments = mergedStepComments;
              }
            }
          });

          const mRowData = {
            response_id: `#${resp.response_id}`,
            evaluator_name: resp.evaluator_name || 'Người dùng ẩn danh',
            evaluator_email: resp.evaluator_email || 'N/A',
            submitted_at: resp.submitted_at
              ? new Date(resp.submitted_at).toLocaleString('vi-VN')
              : 'N/A',
          };

          // Fill Item Scores
          evalCols.forEach((col) => {
            let colTotal = 0;
            groups.forEach((g) => {
              let gSum = 0;
              (g.items || []).forEach((it) => {
                const cell = mergedVal[it.id]?.[col.id];
                if (cell !== undefined && cell !== '' && cell !== null && !isNaN(Number(cell))) {
                  const num = Number(cell);
                  mRowData[`item_${it.id}_col_${col.id}`] = num;
                  gSum += num;
                } else {
                  mRowData[`item_${it.id}_col_${col.id}`] = '';
                }
              });
              const cappedG = g.maxScore > 0 ? Math.min(gSum, Number(g.maxScore)) : gSum;
              colTotal += cappedG;
            });
            const finalColTotal = grandTotalMax > 0 ? Math.min(colTotal, grandTotalMax) : colTotal;
            mRowData[`total_col_${col.id}`] = finalColTotal;
          });

          // Fill Level Comments
          const stepComments = mergedVal._stepComments || {};
          evalCols.forEach((col, idx) => {
            const stepOrder = idx + 1;
            const cInfo = stepComments[stepOrder] || mergedVal._comments?.[col.id];
            if (cInfo) {
              const text = typeof cInfo === 'string' ? cInfo : cInfo.text || '';
              const author = cInfo.authorName ? `${cInfo.authorName} (${cInfo.authorRole || col.role || ''})` : '';
              mRowData[`comment_col_${col.id}`] = text ? (author ? `${author}:\n"${text}"` : `"${text}"`) : '';
            } else {
              mRowData[`comment_col_${col.id}`] = '';
            }
          });

          // Fill Workflow Notes
          workflows.forEach((wf) => {
            const rev = respReviewSteps.find(r => r.step_order === wf.step_order);
            if (rev && rev.note) {
              const reviewer = rev.reviewer_name || rev.reviewer_role || `Cấp ${wf.step_order}`;
              const timeStr = rev.updated_at ? ` [${new Date(rev.updated_at).toLocaleString('vi-VN')}]` : '';
              mRowData[`review_note_step_${wf.step_order}`] = `${reviewer}${timeStr}:\n"${rev.note}"`;
            } else {
              mRowData[`review_note_step_${wf.step_order}`] = '';
            }
          });

          const mRow = matrixWs.addRow(mRowData);
          mRow.alignment = { vertical: 'middle', wrapText: true };
        });

        // Add borders to Sheet 2
        matrixWs.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            };
          });
        });
      });
    }

    const safeName = campaign.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `BaoCao_ChienDich_${campaign.id}_${safeName}.xlsx`;

    return { workbook, fileName };
  }

  async getMyAssignmentsInCampaign(campaignId, userId) {
    const parsedCampaignId = parseInt(campaignId, 10);
    const parsedUserId = userId ? parseInt(userId, 10) : null;

    if (!Number.isFinite(parsedCampaignId) || parsedCampaignId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (parsedUserId && Number.isFinite(parsedUserId) && parsedUserId > 0) {
      const query = `
        SELECT
          sa.id AS assignment_id,
          sa.campaign_id,
          sa.user_id,
          sa.status,
          sa.target_user_id,
          sa.context_reference,
          u_targ.full_name AS target_user_name,
          u_targ.email AS target_user_email,
          u_targ.department AS target_user_department,
          sc.name AS campaign_name,
          sc.description AS campaign_description,
          sc.start_date,
          sc.end_date,
          sc.is_active,
          s.id AS survey_id,
          s.title AS survey_title,
          s.description AS survey_description,
          s.theme_config
        FROM survey_assignments sa
        JOIN survey_campaigns sc ON sa.campaign_id = sc.id
        JOIN surveys s ON sc.survey_id = s.id
        LEFT JOIN users u_targ ON sa.target_user_id = u_targ.id
        WHERE sa.campaign_id = $1 AND sa.user_id = $2 AND sc.deleted_at IS NULL AND s.deleted_at IS NULL
        ORDER BY sa.id ASC
      `;
      const result = await pool.query(query, [parsedCampaignId, parsedUserId]);

      if (result.rows.length > 0) {
        const campRow = result.rows[0];
        const now = new Date();
        const startObj = campRow.start_date ? new Date(campRow.start_date) : null;
        const endObj = campRow.end_date ? new Date(campRow.end_date) : null;

        if (endObj && now > endObj) {
          const err = new Error('Chiến dịch đã kết thúc');
          err.statusCode = 403;
          throw err;
        }

        if (campRow.is_active === false || campRow.is_active === 0) {
          const err = new Error('Chiến dịch đang tạm dừng');
          err.statusCode = 403;
          throw err;
        }

        if (startObj && now < startObj) {
          const err = new Error('Chiến dịch chưa bắt đầu');
          err.statusCode = 403;
          throw err;
        }

        return result.rows.map((row) => {
          let themeConfig = {};
          try {
            if (typeof row.theme_config === 'string') themeConfig = JSON.parse(row.theme_config);
            else if (row.theme_config && typeof row.theme_config === 'object') themeConfig = row.theme_config;
          } catch {
            themeConfig = {};
          }

          return {
            assignment_id: row.assignment_id,
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            campaign_description: row.campaign_description,
            start_date: formatLocalDateTime(row.start_date),
            end_date: formatLocalDateTime(row.end_date),
            is_active: row.is_active,
            status: row.status,
            survey_id: row.survey_id,
            survey_title: row.survey_title,
            survey_description: row.survey_description,
            theme_config: themeConfig,
            target_user_id: row.target_user_id,
            target_user_name: row.target_user_name,
            target_user_email: row.target_user_email,
            target_user_department: row.target_user_department,
            context_reference: row.context_reference,
          };
        });
      }
    }

    // Fallback: Check if campaign is public (For PublicGuest or unregistered users)
    const campaignCheck = await pool.query(
      `SELECT sc.id AS campaign_id, sc.name AS campaign_name, sc.description AS campaign_description,
              sc.start_date, sc.end_date, sc.is_active, sc.is_public,
              s.id AS survey_id, s.title AS survey_title, s.description AS survey_description, s.theme_config
       FROM survey_campaigns sc
       JOIN surveys s ON sc.survey_id = s.id
       WHERE sc.id = $1 AND sc.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [parsedCampaignId]
    );

    if (campaignCheck.rows.length === 0) {
      const err = new Error('Chiến dịch khảo sát này không tồn tại hoặc đã bị gỡ bỏ');
      err.statusCode = 404;
      throw err;
    }

    const campaign = campaignCheck.rows[0];

    const now = new Date();
    const startObj = campaign.start_date ? new Date(campaign.start_date) : null;
    const endObj = campaign.end_date ? new Date(campaign.end_date) : null;

    if (endObj && now > endObj) {
      const err = new Error('Chiến dịch đã kết thúc');
      err.statusCode = 403;
      throw err;
    }

    if (campaign.is_active === false || campaign.is_active === 0) {
      const err = new Error('Chiến dịch đang tạm dừng');
      err.statusCode = 403;
      throw err;
    }

    if (startObj && now < startObj) {
      const err = new Error('Chiến dịch chưa bắt đầu');
      err.statusCode = 403;
      throw err;
    }

    if (!campaign.is_public) {
      const err = new Error('Bạn không có quyền tham gia chiến dịch này (Chiến dịch nội bộ)');
      err.statusCode = 403;
      throw err;
    }

    // Check if user has already submitted a response for this public campaign
    const responseCheck = await pool.query(
      `SELECT id FROM responses WHERE campaign_id = $1 AND evaluator_id = $2 LIMIT 1`,
      [parsedCampaignId, parsedUserId]
    );

    let themeConfig = {};
    try {
      if (typeof campaign.theme_config === 'string') themeConfig = JSON.parse(campaign.theme_config);
      else if (campaign.theme_config && typeof campaign.theme_config === 'object') themeConfig = campaign.theme_config;
    } catch {
      themeConfig = {};
    }

    // Fetch questions for public survey
    const qQuery = `
      SELECT id, survey_id, question_text, type, is_required, order_index, options
      FROM questions
      WHERE survey_id = $1
      ORDER BY order_index ASC, id ASC
    `;
    const qResult = await pool.query(qQuery, [campaign.survey_id]);

    const questions = qResult.rows.map((qRow) => {
      let options = {};
      try {
        if (typeof qRow.options === 'string') options = JSON.parse(qRow.options);
        else if (qRow.options && typeof qRow.options === 'object') options = qRow.options;
      } catch {
        options = {};
      }
      return {
        id: qRow.id,
        survey_id: qRow.survey_id,
        question_text: qRow.question_text,
        type: qRow.type,
        is_required: qRow.is_required,
        order_index: qRow.order_index,
        options,
      };
    });

    return [
      {
        assignment_id: `public_${parsedCampaignId}`,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        campaign_description: campaign.campaign_description,
        start_date: formatLocalDateTime(campaign.start_date),
        end_date: formatLocalDateTime(campaign.end_date),
        is_active: campaign.is_active,
        is_public: true,
        status: responseCheck.rows.length > 0 ? 'Completed' : 'Pending',
        survey_id: campaign.survey_id,
        survey_title: campaign.survey_title,
        survey_description: campaign.survey_description,
        theme_config: themeConfig,
        questions: questions,
        target_user_id: null,
        target_user_name: null,
        target_user_email: null,
        target_user_department: null,
        context_reference: null,
      },
    ];
  }

  async skipRemainingAssignments(campaignId, userId) {
    const parsedCampaignId = parseInt(campaignId, 10);
    const parsedUserId = parseInt(userId, 10);

    if (!Number.isFinite(parsedCampaignId) || parsedCampaignId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      const err = new Error('ID người dùng không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const result = await pool.query(
      `UPDATE survey_assignments
       SET status = 'Skipped'
       WHERE campaign_id = $1
         AND user_id = $2
         AND status = 'Pending'
       RETURNING id, campaign_id, user_id, status`,
      [parsedCampaignId, parsedUserId]
    );

    return {
      campaign_id: parsedCampaignId,
      user_id: parsedUserId,
      skipped_count: result.rowCount,
      skipped_assignments: result.rows,
    };
  }

  async listTrashCampaigns({ page = 1, limit = 10, search = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = ['c.deleted_at IS NOT NULL'];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`c.name ILIKE $${params.length}`);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM survey_campaigns c
      JOIN surveys s ON c.survey_id = s.id
      ${whereSql}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total, 10) || 0;

    const dataParams = [...params, limitNum, offset];
    const dataQuery = `
      SELECT
        c.id,
        c.survey_id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.is_anonymous,
        c.is_public,
        c.is_active,
        c.deleted_at,
        s.title AS survey_title,
        s.description AS survey_description
      FROM survey_campaigns c
      JOIN surveys s ON c.survey_id = s.id
      ${whereSql}
      ORDER BY c.deleted_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataResult = await pool.query(dataQuery, dataParams);
    return {
      campaigns: dataResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
      },
    };
  }

  async deleteCampaign(id) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const checkRes = await pool.query('SELECT id FROM survey_campaigns WHERE id = $1', [parsedId]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Không tìm thấy đợt khảo sát cần xóa');
      err.statusCode = 404;
      throw err;
    }

    await pool.query('UPDATE survey_campaigns SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [parsedId]);
    return { deleted: true, id: parsedId };
  }

  async restoreCampaign(id) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const checkRes = await pool.query('SELECT id FROM survey_campaigns WHERE id = $1', [parsedId]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Không tìm thấy đợt khảo sát cần khôi phục');
      err.statusCode = 404;
      throw err;
    }

    await pool.query('UPDATE survey_campaigns SET deleted_at = NULL WHERE id = $1', [parsedId]);
    return { restored: true, id: parsedId };
  }

  async forceDeleteCampaign(id) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const checkRes = await pool.query('SELECT id FROM survey_campaigns WHERE id = $1', [parsedId]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Không tìm thấy đợt khảo sát cần xóa vĩnh viễn');
      err.statusCode = 404;
      throw err;
    }

    // REQUIREMENT 4: Check if campaign has any responses in responses table
    const responseCheck = await pool.query('SELECT COUNT(*) AS total FROM responses WHERE campaign_id = $1', [parsedId]);
    const responseCount = parseInt(responseCheck.rows[0]?.total || '0', 10);

    if (responseCount > 0) {
      const err = new Error('Không thể xóa vĩnh viễn chiến dịch đã có dữ liệu khảo sát');
      err.statusCode = 400;
      throw err;
    }

    await pool.query('DELETE FROM survey_campaigns WHERE id = $1', [parsedId]);
    return { force_deleted: true, id: parsedId };
  }
}

module.exports = new CampaignsService();
