const pool = require('../config/db');
const anomalyDetectorService = require('./anomalyDetector.service');
const emailService = require('./emailService');
const workflowService = require('./workflow.service');

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

class ResponsesService {
  async submitResponse(payload) {
    const { assignment_id, evaluator_id, target_user_id, context_reference, answers, campaign_id, guest_name, guest_email } = payload;

    if (!Array.isArray(answers) || answers.length === 0) {
      const err = new Error('Danh sách câu trả lời không được để trống');
      err.statusCode = 400;
      throw err;
    }

    let isPublicSubmit = false;
    let targetCampaignId = campaign_id ? parseInt(campaign_id, 10) : null;

    if (typeof assignment_id === 'string' && assignment_id.startsWith('public_')) {
      isPublicSubmit = true;
      targetCampaignId = parseInt(assignment_id.replace('public_', ''), 10);
    }

    const parsedAssignmentId = parseInt(assignment_id, 10);

    let assignment = null;

    if (Number.isFinite(parsedAssignmentId) && parsedAssignmentId > 0 && !isPublicSubmit) {
      const assignRes = await pool.query(
        `SELECT sa.id, sa.campaign_id, sa.user_id, sa.status, sa.target_user_id, sa.context_reference,
                sc.name AS campaign_name, sc.is_anonymous, sc.is_public, sc.start_date, sc.end_date, sc.is_active,
                u.email AS evaluator_email, u.full_name AS evaluator_name
         FROM survey_assignments sa
         JOIN survey_campaigns sc ON sa.campaign_id = sc.id
         JOIN surveys s ON sc.survey_id = s.id
         LEFT JOIN users u ON sa.user_id = u.id
         WHERE sa.id = $1 AND sc.deleted_at IS NULL AND s.deleted_at IS NULL`,
        [parsedAssignmentId]
      );
      if (assignRes.rows.length > 0) {
        assignment = assignRes.rows[0];
      }
    }

    // Fallback: Check public campaign
    if (!assignment && targetCampaignId) {
      const pubRes = await pool.query(
        `SELECT sc.id AS campaign_id, sc.name AS campaign_name, sc.is_anonymous, sc.is_public, sc.start_date, sc.end_date, sc.is_active,
                u.email AS evaluator_email, u.full_name AS evaluator_name
         FROM survey_campaigns sc
         JOIN surveys s ON sc.survey_id = s.id
         LEFT JOIN users u ON u.id = $1
         WHERE sc.id = $2 AND sc.deleted_at IS NULL AND s.deleted_at IS NULL`,
        [evaluator_id ? parseInt(evaluator_id, 10) : null, targetCampaignId]
      );

      if (pubRes.rows.length > 0) {
        const pubCamp = pubRes.rows[0];
        if (!pubCamp.is_public) {
          const err = new Error('Bạn không có quyền nộp bài cho chiến dịch nội bộ này');
          err.statusCode = 403;
          throw err;
        }

        assignment = {
          id: null, // No assignment row in survey_assignments
          campaign_id: pubCamp.campaign_id,
          user_id: evaluator_id ? parseInt(evaluator_id, 10) : null,
          status: 'Pending',
          target_user_id: target_user_id ? parseInt(target_user_id, 10) : null,
          context_reference: context_reference || null,
          campaign_name: pubCamp.campaign_name,
          is_anonymous: pubCamp.is_anonymous,
          is_public: true,
          start_date: pubCamp.start_date,
          end_date: pubCamp.end_date,
          is_active: pubCamp.is_active,
          evaluator_email: pubCamp.evaluator_email || guest_email || null,
          evaluator_name: pubCamp.evaluator_name || guest_name || null,
        };
      }
    }

    if (!assignment) {
      const err = new Error('Chiến dịch khảo sát này không tồn tại hoặc đã bị gỡ bỏ');
      err.statusCode = 404;
      throw err;
    }

    if (assignment.status === 'Completed') {
      const err = new Error('Bài khảo sát này đã được hoàn thành trước đó');
      err.statusCode = 400;
      throw err;
    }

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

    const isAnon = Boolean(assignment.is_anonymous);
    const rawEvalId = evaluator_id ? parseInt(evaluator_id, 10) : assignment.user_id;

    // Evaluator ID is null if anonymous or not a valid registered user
    const evalId = (isAnon || !Number.isFinite(rawEvalId) || rawEvalId <= 0) ? null : rawEvalId;
    const finalGuestName = evalId ? null : (guest_name || assignment.evaluator_name || null);
    const finalGuestEmail = evalId ? null : (guest_email || assignment.evaluator_email || null);

    const targId = target_user_id !== undefined ? target_user_id : assignment.target_user_id;
    const ctxRef = context_reference !== undefined ? context_reference : assignment.context_reference;

    const canvasDataObj = {};
    if (answers && Array.isArray(answers)) {
      for (const ans of answers) {
        if (typeof ans.question_id === 'string' && isNaN(Number(ans.question_id))) {
          canvasDataObj[ans.question_id] = ans.answer_value;
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const respQuery = `
        INSERT INTO responses (campaign_id, evaluator_id, target_user_id, context_reference, guest_name, guest_email, canvas_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING id
      `;
      const respRes = await client.query(respQuery, [
        assignment.campaign_id,
        evalId,
        targId,
        ctxRef,
        finalGuestName,
        finalGuestEmail,
        JSON.stringify(canvasDataObj)
      ]);
      const responseId = respRes.rows[0].id;

      for (const ans of answers) {
        const qId = parseInt(ans.question_id, 10);
        if (!Number.isFinite(qId)) continue;

        let jsonbVal = '{}';
        if (ans.answer_value !== undefined && ans.answer_value !== null) {
          if (typeof ans.answer_value === 'string') {
            jsonbVal = JSON.stringify(ans.answer_value);
          } else {
            jsonbVal = JSON.stringify(ans.answer_value);
          }
        }

        const ansQuery = `
          INSERT INTO answers (response_id, question_id, answer_value)
          VALUES ($1, $2, $3::jsonb)
        `;
        await client.query(ansQuery, [responseId, qId, jsonbVal]);
      }

      if (assignment.id) {
        await client.query(`UPDATE survey_assignments SET status = 'Completed' WHERE id = $1`, [
          assignment.id,
        ]);
      }

      await client.query('COMMIT');

      // 1. Trigger background anomaly detection asynchronously (non-blocking)
      anomalyDetectorService.checkResponseAnomaly(responseId).catch((err) => {
        console.error('[Background Anomaly Check Error]:', err.message);
      });

      // 2. Trigger background confirmation email sending asynchronously (fire-and-forget, non-blocking)
      if (assignment.evaluator_email) {
        const submitTimeStr = new Date().toLocaleString('vi-VN');
        emailService
          .sendConfirmationEmail(
            assignment.evaluator_email,
            assignment.evaluator_name,
            assignment.campaign_name,
            submitTimeStr
          )
          .catch((err) => {
            console.error('[Background Email Confirmation Error]:', err.message);
          });
      }

      // 3. Nếu campaign có workflow đa cấp, tạo review bước 1 (non-blocking)
      workflowService
        .initializeFirstStepReview(responseId, assignment.campaign_id, evalId, answers)
        .catch((err) => {
          console.error('[Background Workflow Init Error]:', err.message);
        });

      // 4. Trigger 100% completion check (non-blocking)
      this.checkCampaignCompletion(assignment.campaign_id, assignment.campaign_name).catch((err) => {
        console.error('[Background Completion Check Error]:', err.message);
      });

      return {
        response_id: responseId,
        assignment_id: assignment.id,
        target_user_id: targId,
        context_reference: ctxRef,
        status: 'Completed',
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async checkCampaignCompletion(campaignId, campaignName) {
    try {
      const statsRes = await pool.query(`
        SELECT 
          COUNT(*) AS total_assigned,
          COUNT(CASE WHEN status = 'Completed' THEN 1 END) AS completed_count
        FROM survey_assignments
        WHERE campaign_id = $1
      `, [campaignId]);

      if (statsRes.rows.length === 0) return;
      
      const total = parseInt(statsRes.rows[0].total_assigned, 10);
      const completed = parseInt(statsRes.rows[0].completed_count, 10);

      if (total > 0 && total === completed) {
        // Find admins
        const adminRes = await pool.query(`SELECT id FROM users WHERE role_id = 1`);
        if (adminRes.rows.length === 0) return;
        
        const message = `Form khảo sát "${campaignName}" đã đạt tiến độ nộp bài 100%.`;
        const actionLink = `/admin/surveys/${campaignId}`;
        
        for (const r of adminRes.rows) {
          const checkQuery = `
            SELECT id FROM notifications 
            WHERE user_id = $1 AND message = $2 AND action_link = $3
            LIMIT 1
          `;
          const existing = await pool.query(checkQuery, [r.id, message, actionLink]);
          
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO notifications (user_id, message, action_link, is_read) VALUES ($1, $2, $3, FALSE)`,
              [r.id, message, actionLink]
            );
          }
        }
      }
    } catch (err) {
      console.error('[Completion Check Error]', err);
    }
  }
}

module.exports = new ResponsesService();
