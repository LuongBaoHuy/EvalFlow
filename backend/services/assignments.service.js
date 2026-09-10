const pool = require('../config/db');

function formatLocalDate(d) {
  if (!d) return null;
  if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
    return d.substring(0, 10);
  }
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return null;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayString() {
  const dateObj = new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class AssignmentsService {
  async getMyAssignments(userId) {
    const parsedUserId = parseInt(userId, 10);
    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      const err = new Error('ID người dùng không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

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
      WHERE sa.user_id = $1 AND sc.deleted_at IS NULL AND s.deleted_at IS NULL
      ORDER BY sa.id DESC
    `;
    const result = await pool.query(query, [parsedUserId]);
    const todayStr = formatLocalDate(new Date());

    return result.rows.map((row) => {
      let themeConfig = {};
      try {
        if (typeof row.theme_config === 'string') themeConfig = JSON.parse(row.theme_config);
        else if (row.theme_config && typeof row.theme_config === 'object') themeConfig = row.theme_config;
      } catch {
        themeConfig = {};
      }

      const startDateStr = formatLocalDate(row.start_date);
      const endDateStr = formatLocalDate(row.end_date);

      let effectiveStatus = row.status;
      if (row.status !== 'Completed') {
        if (startDateStr && todayStr < startDateStr) {
          effectiveStatus = 'Upcoming';
        } else if (endDateStr && todayStr > endDateStr) {
          effectiveStatus = 'Expired';
        }
      }

      return {
        assignment_id: row.assignment_id,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        campaign_description: row.campaign_description,
        start_date: startDateStr,
        end_date: endDateStr,
        is_active: row.is_active,
        status: effectiveStatus,
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

  async getAssignmentById(assignmentId, userId) {
    let isPublicRequest = false;
    let targetCampaignId = null;

    if (typeof assignmentId === 'string' && assignmentId.startsWith('public_')) {
      isPublicRequest = true;
      targetCampaignId = parseInt(assignmentId.replace('public_', ''), 10);
    }

    const parsedAssignmentId = parseInt(assignmentId, 10);

    let assignment = null;

    if (Number.isFinite(parsedAssignmentId) && parsedAssignmentId > 0 && !isPublicRequest) {
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
          sc.is_public,
          sc.is_workflow_enabled,
          s.id AS survey_id,
          s.title AS survey_title,
          s.description AS survey_description,
          s.theme_config
        FROM survey_assignments sa
        JOIN survey_campaigns sc ON sa.campaign_id = sc.id
        JOIN surveys s ON sc.survey_id = s.id
        LEFT JOIN users u_targ ON sa.target_user_id = u_targ.id
        WHERE sa.id = $1 AND sc.deleted_at IS NULL AND s.deleted_at IS NULL
      `;
      const result = await pool.query(query, [parsedAssignmentId]);
      if (result.rows.length > 0) {
        assignment = result.rows[0];
      }
    }

    // Fallback: If not found in survey_assignments or public request
    if (!assignment && (isPublicRequest || targetCampaignId)) {
      const pubQuery = `
        SELECT
          $1::text AS assignment_id,
          sc.id AS campaign_id,
          $2::int AS user_id,
          'Pending' AS status,
          NULL::int AS target_user_id,
          NULL::text AS context_reference,
          NULL::text AS target_user_name,
          NULL::text AS target_user_email,
          NULL::text AS target_user_department,
          sc.name AS campaign_name,
          sc.description AS campaign_description,
          sc.start_date,
          sc.end_date,
          sc.is_active,
          sc.is_public,
          sc.is_workflow_enabled,
          s.id AS survey_id,
          s.title AS survey_title,
          s.description AS survey_description,
          s.theme_config
        FROM survey_campaigns sc
        JOIN surveys s ON sc.survey_id = s.id
        WHERE sc.id = $3 AND sc.deleted_at IS NULL AND s.deleted_at IS NULL
      `;
      const pubRes = await pool.query(pubQuery, [
        `public_${targetCampaignId}`,
        userId ? parseInt(userId, 10) : null,
        targetCampaignId,
      ]);

      if (pubRes.rows.length > 0) {
        assignment = pubRes.rows[0];
        if (!assignment.is_public) {
          const err = new Error('Bạn không có quyền tham gia chiến dịch này (Chiến dịch nội bộ)');
          err.statusCode = 403;
          throw err;
        }

        // Check if user has already submitted a response
        if (userId) {
          const respCheck = await pool.query(
            `SELECT id FROM responses WHERE campaign_id = $1 AND evaluator_id = $2 LIMIT 1`,
            [targetCampaignId, parseInt(userId, 10)]
          );
          if (respCheck.rows.length > 0) {
            assignment.status = 'Completed';
          }
        }
      }
    }

    if (!assignment) {
      const err = new Error('Chiến dịch khảo sát này không tồn tại hoặc đã bị gỡ bỏ');
      err.statusCode = 404;
      throw err;
    }

    // Optional user authorization check if userId provided and not a public campaign
    if (userId && !assignment.is_public && parseInt(userId, 10) !== assignment.user_id) {
      const err = new Error('Bạn không thuộc đối tượng tham gia khảo sát này nữa');
      err.statusCode = 403;
      throw err;
    }

    // Check campaign status if not completed
    if (assignment.status !== 'Completed') {
      const now = new Date();
      const startObj = assignment.start_date ? new Date(assignment.start_date) : null;
      const endObj = assignment.end_date ? new Date(assignment.end_date) : null;

      if (endObj && now > endObj) {
        const err = new Error('Chiến dịch đã kết thúc');
        err.statusCode = 403;
        throw err;
      }

      if (assignment.is_active === false || assignment.is_active === 0) {
        const err = new Error('Chiến dịch đang tạm dừng');
        err.statusCode = 403;
        throw err;
      }

      if (startObj && now < startObj) {
        const err = new Error('Chiến dịch chưa bắt đầu');
        err.statusCode = 403;
        throw err;
      }
    }

    let themeConfig = {};
    try {
      if (typeof assignment.theme_config === 'string') themeConfig = JSON.parse(assignment.theme_config);
      else if (assignment.theme_config && typeof assignment.theme_config === 'object') themeConfig = assignment.theme_config;
    } catch {
      themeConfig = {};
    }

    // Fetch questions for this survey
    const qQuery = `
      SELECT id, survey_id, question_text, type, is_required, order_index, options
      FROM questions
      WHERE survey_id = $1
      ORDER BY order_index ASC, id ASC
    `;
    const qResult = await pool.query(qQuery, [assignment.survey_id]);

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

    let existingAnswers = {};
    let reviewHistory = null;
    let workflowSteps = null;

    if (assignment.is_workflow_enabled) {
      try {
        const wfQuery = `
          SELECT id, step_order, reviewer_role, step_name, can_edit_answers
          FROM campaign_workflows
          WHERE campaign_id = $1
          ORDER BY step_order ASC
        `;
        const wfRes = await pool.query(wfQuery, [assignment.campaign_id]);
        workflowSteps = wfRes.rows;
      } catch (err) {
        console.warn('Lỗi khi lấy workflow steps:', err.message);
      }
    }

    if (assignment.status === 'Completed') {
      try {
        const respQuery = `
          SELECT r.id AS response_id, r.canvas_data
          FROM responses r
          WHERE r.campaign_id = $1 AND r.evaluator_id = $2
            AND ((r.target_user_id IS NULL AND $3::int IS NULL) OR r.target_user_id = $3)
          ORDER BY r.id DESC
          LIMIT 1
        `;
        const respRes = await pool.query(respQuery, [
          assignment.campaign_id,
          assignment.user_id,
          assignment.target_user_id || null,
        ]);

        if (respRes.rows.length > 0) {
          const responseId = respRes.rows[0].response_id;

          // Fetch review history if workflow enabled
          if (assignment.is_workflow_enabled) {
            const reviewsQuery = `
              SELECT rr.id, rr.step_order, rr.reviewer_id, rr.reviewed_data, rr.status, rr.note, rr.created_at, rr.updated_at,
                     u.full_name AS reviewer_name, r_role.role_name AS reviewer_role
              FROM response_reviews rr
              LEFT JOIN users u ON rr.reviewer_id = u.id
              LEFT JOIN roles r_role ON u.role_id = r_role.id
              WHERE rr.response_id = $1
              ORDER BY rr.step_order ASC
            `;
            const reviewsRes = await pool.query(reviewsQuery, [responseId]);
            reviewHistory = reviewsRes.rows.map(r => ({
              id: r.id,
              step_order: r.step_order,
              status: r.status,
              note: r.note,
              reviewer_id: r.reviewer_id,
              reviewer_name: r.reviewer_name || null,
              reviewer_role: r.reviewer_role || null,
              created_at: r.created_at,
              updated_at: r.updated_at,
              reviewed_data: r.reviewed_data,
            }));
          }

          const ansQuery = `
            SELECT question_id, answer_value
            FROM answers
            WHERE response_id = $1
          `;
          const ansRes = await pool.query(ansQuery, [responseId]);

          ansRes.rows.forEach((aRow) => {
            let val = aRow.answer_value;
            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
              try {
                val = JSON.parse(val);
              } catch (e) {
                // leave string as is
              }
            }
            existingAnswers[aRow.question_id] = val;
          });

          const canvasData = respRes.rows[0].canvas_data;
          if (canvasData && typeof canvasData === 'object') {
             Object.keys(canvasData).forEach((qId) => {
               existingAnswers[qId] = canvasData[qId];
             });
          }

          // Merge reviewer data into existingAnswers
          if (reviewHistory && reviewHistory.length > 0) {
            reviewHistory.forEach((rv) => {
              let data = rv.reviewed_data;
              if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { data = []; }
              }
              if (Array.isArray(data)) {
                data.forEach(item => {
                  let currentVal = existingAnswers[item.question_id];
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
                    existingAnswers[item.question_id] = merged;
                  } else if (revVal !== undefined) {
                    existingAnswers[item.question_id] = revVal;
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Lỗi khi lấy đáp án bài khảo sát đã hoàn thành:', err.message);
      }
    }

    return {
      assignment_id: assignment.assignment_id,
      campaign_id: assignment.campaign_id,
      campaign_name: assignment.campaign_name,
      campaign_description: assignment.campaign_description,
      status: assignment.status,
      survey_id: assignment.survey_id,
      survey_title: assignment.survey_title,
      survey_description: assignment.survey_description,
      theme_config: themeConfig,
      is_workflow_enabled: assignment.is_workflow_enabled,
      workflow_steps: workflowSteps,
      review_history: reviewHistory,
      questions,
      existing_answers: existingAnswers,
      target_user_id: assignment.target_user_id,
      target_user_name: assignment.target_user_name,
      target_user_email: assignment.target_user_email,
      target_user_department: assignment.target_user_department,
      context_reference: assignment.context_reference,
    };
  }
}

module.exports = new AssignmentsService();
