const pool = require('../config/db');

class WorkflowService {
  // ─────────────────────────────────────────────
  // 1. Lấy cấu hình workflow của một campaign
  // ─────────────────────────────────────────────
  async getWorkflowConfig(campaignId) {
    const parsedId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('Campaign ID không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const campaignRes = await pool.query(
      `SELECT id, name, is_workflow_enabled FROM survey_campaigns WHERE id = $1 AND deleted_at IS NULL`,
      [parsedId]
    );
    if (campaignRes.rows.length === 0) {
      const err = new Error('Không tìm thấy chiến dịch');
      err.statusCode = 404;
      throw err;
    }

    const campaign = campaignRes.rows[0];
    if (!campaign.is_workflow_enabled) {
      return { campaign_id: parsedId, is_workflow_enabled: false, steps: [] };
    }

    const stepsRes = await pool.query(
      `SELECT id, step_order, step_name, reviewer_role, can_edit_answers
       FROM campaign_workflows
       WHERE campaign_id = $1
       ORDER BY step_order ASC`,
      [parsedId]
    );

    return {
      campaign_id: parsedId,
      campaign_name: campaign.name,
      is_workflow_enabled: true,
      steps: stepsRes.rows,
    };
  }

  // ─────────────────────────────────────────────
  // 2. Lấy trạng thái workflow của một response
  // ─────────────────────────────────────────────
  async getWorkflowStatus(responseId) {
    const parsedId = parseInt(responseId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('Response ID không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    // Lấy thông tin response + campaign
    const responseRes = await pool.query(
      `SELECT r.id, r.campaign_id, r.evaluator_id, r.submitted_at, r.canvas_data,
              sc.is_workflow_enabled, sc.name AS campaign_name,
              s.theme_config->>'surveyType' AS survey_type, s.theme_config,
              u.full_name AS submitter_name, u.email AS submitter_email
       FROM responses r
       JOIN survey_campaigns sc ON r.campaign_id = sc.id
       LEFT JOIN surveys s ON sc.survey_id = s.id
       LEFT JOIN users u ON r.evaluator_id = u.id
       WHERE r.id = $1`,
      [parsedId]
    );

    if (responseRes.rows.length === 0) {
      const err = new Error('Không tìm thấy phiếu nộp');
      err.statusCode = 404;
      throw err;
    }

    const response = responseRes.rows[0];

    if (!response.is_workflow_enabled) {
      return {
        response_id: parsedId,
        is_workflow_enabled: false,
        message: 'Chiến dịch này không sử dụng workflow đa cấp',
      };
    }

    // Lấy tất cả steps của campaign
    const stepsRes = await pool.query(
      `SELECT step_order, step_name, reviewer_role, can_edit_answers
       FROM campaign_workflows
       WHERE campaign_id = $1
       ORDER BY step_order ASC`,
      [response.campaign_id]
    );

    // Lấy tất cả reviews đã có cho response này
    const reviewsRes = await pool.query(
      `SELECT rr.id, rr.step_order, rr.reviewer_id, rr.reviewed_data,
              rr.status, rr.note, rr.created_at, rr.updated_at,
              u.full_name AS reviewer_name, u.email AS reviewer_email
       FROM response_reviews rr
       LEFT JOIN users u ON rr.reviewer_id = u.id
       WHERE rr.response_id = $1
       ORDER BY rr.step_order ASC`,
      [parsedId]
    );

    const steps = stepsRes.rows;
    const reviews = reviewsRes.rows;

    // Xác định bước hiện tại đang chờ
    const reviewedStepOrders = new Set(
      reviews.filter(r => r.status !== 'PENDING').map(r => r.step_order)
    );
    const pendingReview = reviews.find(r => r.status === 'PENDING');
    const rejectedReview = reviews.find(r => r.status === 'REJECTED');

    let currentStepOrder = null;
    let overallStatus = 'COMPLETED';

    if (rejectedReview) {
      overallStatus = 'REJECTED';
      currentStepOrder = rejectedReview.step_order;
    } else if (pendingReview) {
      overallStatus = 'IN_PROGRESS';
      currentStepOrder = pendingReview.step_order;
    } else {
      // Tìm bước tiếp theo chưa có review
      const nextStep = steps.find(s => !reviewedStepOrders.has(s.step_order));
      if (nextStep) {
        overallStatus = 'IN_PROGRESS';
        currentStepOrder = nextStep.step_order;
      }
    }

    // Gộp steps với reviews để tạo timeline
    const timeline = steps.map(step => {
      const review = reviews.find(r => r.step_order === step.step_order);
      let stepStatus = 'WAITING';
      if (review) {
        stepStatus = review.status;
      } else if (step.step_order === currentStepOrder) {
        stepStatus = 'CURRENT';
      }

      return {
        step_order: step.step_order,
        step_name: step.step_name,
        reviewer_role: step.reviewer_role,
        can_edit_answers: step.can_edit_answers,
        status: stepStatus,
        review: review
          ? {
              id: review.id,
              reviewer_id: review.reviewer_id,
              reviewer_name: review.reviewer_name,
              reviewer_email: review.reviewer_email,
              reviewed_data: review.reviewed_data,
              note: review.note,
              status: review.status,
              created_at: review.created_at,
            }
          : null,
      };
    });

    return {
      response_id: parsedId,
      campaign_id: response.campaign_id,
      campaign_name: response.campaign_name,
      submitter_name: response.submitter_name,
      submitter_email: response.submitter_email,
      submitted_at: response.submitted_at,
      canvas_data: response.canvas_data,
      survey_type: response.survey_type,
      theme_config: response.theme_config,
      is_workflow_enabled: true,
      overall_status: overallStatus,
      current_step_order: currentStepOrder,
      total_steps: steps.length,
      timeline,
    };
  }

  // ─────────────────────────────────────────────
  // 3. Nộp review (chấm điểm tại một bước)
  // ─────────────────────────────────────────────
  async submitReview(responseId, reviewerId, payload) {
    const { reviewed_data, note, action } = payload;
    // action: 'APPROVED' | 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      const err = new Error("Hành động không hợp lệ. Chỉ chấp nhận 'APPROVED' hoặc 'REJECTED'");
      err.statusCode = 400;
      throw err;
    }

    const parsedResponseId = parseInt(responseId, 10);
    const parsedReviewerId = parseInt(reviewerId, 10);

    if (!Number.isFinite(parsedResponseId) || !Number.isFinite(parsedReviewerId)) {
      const err = new Error('ID không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    // Lấy thông tin response + campaign workflow
    const responseRes = await pool.query(
      `SELECT r.id, r.campaign_id, sc.is_workflow_enabled
       FROM responses r
       JOIN survey_campaigns sc ON r.campaign_id = sc.id
       WHERE r.id = $1`,
      [parsedResponseId]
    );

    if (responseRes.rows.length === 0) {
      const err = new Error('Không tìm thấy phiếu nộp');
      err.statusCode = 404;
      throw err;
    }

    const responseRow = responseRes.rows[0];

    if (!responseRow.is_workflow_enabled) {
      const err = new Error('Chiến dịch này không sử dụng workflow đa cấp');
      err.statusCode = 400;
      throw err;
    }

    // Lấy role của reviewer
    const reviewerRes = await pool.query(
      `SELECT u.id, u.full_name, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [parsedReviewerId]
    );

    if (reviewerRes.rows.length === 0) {
      const err = new Error('Người dùng không tồn tại');
      err.statusCode = 404;
      throw err;
    }

    const reviewer = reviewerRes.rows[0];

    // Lấy bước PENDING hiện tại
    const pendingRes = await pool.query(
      `SELECT rr.id, rr.step_order, cw.reviewer_role, cw.can_edit_answers
       FROM response_reviews rr
       JOIN campaign_workflows cw ON cw.campaign_id = $1 AND cw.step_order = rr.step_order
       WHERE rr.response_id = $2 AND rr.status = 'PENDING'
       ORDER BY rr.step_order ASC
       LIMIT 1`,
      [responseRow.campaign_id, parsedResponseId]
    );

    if (pendingRes.rows.length === 0) {
      // Không có pending review → tìm bước tiếp theo chưa có review
      const nextStepRes = await pool.query(
        `SELECT cw.step_order, cw.reviewer_role, cw.can_edit_answers
         FROM campaign_workflows cw
         WHERE cw.campaign_id = $1
           AND cw.step_order NOT IN (
             SELECT step_order FROM response_reviews WHERE response_id = $2
           )
         ORDER BY cw.step_order ASC
         LIMIT 1`,
        [responseRow.campaign_id, parsedResponseId]
      );

      if (nextStepRes.rows.length === 0) {
        const err = new Error('Tất cả các bước đã được hoàn thành hoặc bị từ chối');
        err.statusCode = 400;
        throw err;
      }

      const nextStep = nextStepRes.rows[0];

      // Validate role
      if (nextStep.reviewer_role !== reviewer.role_name && reviewer.role_name !== 'Admin') {
        const err = new Error(
          `Bạn không có quyền chấm ở bước này. Bước này yêu cầu role: ${nextStep.reviewer_role}`
        );
        err.statusCode = 403;
        throw err;
      }

      // Tạo review mới
      const reviewDataStr = Array.isArray(reviewed_data)
        ? JSON.stringify(reviewed_data)
        : JSON.stringify([]);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO response_reviews (response_id, step_order, reviewer_id, reviewed_data, status, note)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
          [parsedResponseId, nextStep.step_order, parsedReviewerId, reviewDataStr, action, note || null]
        );

        // Nếu APPROVED và còn bước tiếp theo, tạo PENDING cho bước sau
        if (action === 'APPROVED') {
          const afterStepRes = await client.query(
            `SELECT step_order, reviewer_role FROM campaign_workflows
             WHERE campaign_id = $1 AND step_order > $2
             ORDER BY step_order ASC LIMIT 1`,
            [responseRow.campaign_id, nextStep.step_order]
          );

          if (afterStepRes.rows.length > 0) {
            // Bước tiếp theo sẽ ở PENDING — không cần tạo row vì sẽ được check khi reviewer vào
            // (lazy loading pattern — chỉ tạo row khi cần để tránh orphan rows)
          }
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      return {
        success: true,
        step_order: nextStep.step_order,
        action,
        reviewer_name: reviewer.full_name,
      };
    }

    const currentPending = pendingRes.rows[0];

    // Validate role
    if (currentPending.reviewer_role !== reviewer.role_name && reviewer.role_name !== 'Admin') {
      const err = new Error(
        `Bạn không có quyền chấm ở bước này. Bước này yêu cầu role: ${currentPending.reviewer_role}`
      );
      err.statusCode = 403;
      throw err;
    }

    const reviewDataStr = Array.isArray(reviewed_data)
      ? JSON.stringify(reviewed_data)
      : JSON.stringify([]);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE response_reviews
         SET reviewed_data = $1::jsonb, status = $2, note = $3, reviewer_id = $4, updated_at = NOW()
         WHERE id = $5`,
        [reviewDataStr, action, note || null, parsedReviewerId, currentPending.id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      success: true,
      step_order: currentPending.step_order,
      action,
      reviewer_name: reviewer.full_name,
    };
  }

  // ─────────────────────────────────────────────
  // 4. Lấy danh sách phiếu đang chờ user duyệt
  // ─────────────────────────────────────────────
  async getMyPendingReviews(userId, { page = 1, limit = 10 } = {}) {
    const parsedUserId = parseInt(userId, 10);
    if (!Number.isFinite(parsedUserId)) {
      const err = new Error('User ID không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    // Lấy role của user
    const userRes = await pool.query(
      `SELECT u.id, u.full_name, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [parsedUserId]
    );

    if (userRes.rows.length === 0) {
      const err = new Error('Người dùng không tồn tại');
      err.statusCode = 404;
      throw err;
    }

    const user = userRes.rows[0];
    const isAdmin = user.role_name === 'Admin';

    // Tìm tất cả responses mà:
    // 1. Campaign có is_workflow_enabled = true
    // 2. Bước tiếp theo cần role của user hiện tại (hoặc Admin thấy tất cả)
    // 3. Chưa bị REJECTED
    // 4. Bước hiện tại chưa có review hoặc đang PENDING
    const baseQuery = `
      WITH ranked_reviews AS (
        SELECT response_id, MAX(step_order) AS max_approved_step
        FROM response_reviews
        WHERE status = 'APPROVED'
        GROUP BY response_id
      ),
      rejected_responses AS (
        SELECT DISTINCT response_id FROM response_reviews WHERE status = 'REJECTED'
      )
      SELECT
        r.id AS response_id,
        r.campaign_id,
        r.submitted_at,
        sc.name AS campaign_name,
        cw.step_order AS pending_step_order,
        cw.step_name AS pending_step_name,
        cw.reviewer_role,
        u_sub.full_name AS submitter_name,
        u_sub.email AS submitter_email,
        COALESCE(rr.max_approved_step, 0) AS last_approved_step
      FROM responses r
      JOIN survey_campaigns sc ON r.campaign_id = sc.id
      JOIN campaign_workflows cw ON cw.campaign_id = sc.id
      LEFT JOIN users u_sub ON r.evaluator_id = u_sub.id
      LEFT JOIN ranked_reviews rr ON rr.response_id = r.id
      WHERE sc.is_workflow_enabled = true
        AND sc.deleted_at IS NULL
        AND r.id NOT IN (SELECT response_id FROM rejected_responses)
        AND cw.step_order = COALESCE(rr.max_approved_step, 0) + 1
        ${isAdmin ? '' : `AND cw.reviewer_role = $1`}
    `;

    const params = isAdmin ? [] : [user.role_name];

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM (${baseQuery}) sub`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    const dataParams = isAdmin
      ? [limitNum, offset]
      : [user.role_name, limitNum, offset];

    const dataRes = await pool.query(
      `${baseQuery} ORDER BY r.submitted_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    return {
      data: dataRes.rows,
      meta: {
        totalRecords: total,
        totalPages: Math.ceil(total / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum,
      },
    };
  }

  // ─────────────────────────────────────────────
  // 5. Đếm số phiếu đang chờ user duyệt (cho badge)
  // ─────────────────────────────────────────────
  async countMyPendingReviews(userId) {
    try {
      const result = await this.getMyPendingReviews(userId, { page: 1, limit: 1 });
      return result.meta.totalRecords;
    } catch {
      return 0;
    }
  }

  // ─────────────────────────────────────────────
  // 6. Lấy dữ liệu đã nộp tại bước 1 để reviewer đối chiếu
  // ─────────────────────────────────────────────
  async getResponseAnswersForReview(responseId) {
    const parsedId = parseInt(responseId, 10);

    // Lấy answers gốc từ bảng answers
    const answersRes = await pool.query(
      `SELECT a.question_id, a.answer_value,
              q.question_text, q.type, q.options, q.order_index
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.response_id = $1
       ORDER BY q.order_index ASC`,
      [parsedId]
    );

    let originalAnswers = answersRes.rows;

    // Lấy canvas_data từ responses để tương thích với Canvas Template
    const responseRes = await pool.query(
      `SELECT canvas_data FROM responses WHERE id = $1`,
      [parsedId]
    );
    if (responseRes.rows.length > 0 && responseRes.rows[0].canvas_data) {
      const canvasData = responseRes.rows[0].canvas_data;
      if (typeof canvasData === 'object' && canvasData !== null) {
        const canvasEntries = Object.keys(canvasData).map(k => ({
          question_id: k,
          answer_value: canvasData[k],
          type: 'text',
          question_text: `Canvas Input ${k}`,
          options: {},
          order_index: 999
        }));
        originalAnswers = [...originalAnswers, ...canvasEntries];
      }
    }

    // Lấy lịch sử review đã có
    const reviewsRes = await pool.query(
      `SELECT rr.step_order, rr.reviewed_data, rr.status, rr.note,
              cw.step_name, cw.reviewer_role, cw.can_edit_answers,
              u.full_name AS reviewer_name
       FROM response_reviews rr
       JOIN responses r ON r.id = rr.response_id
       JOIN campaign_workflows cw ON cw.campaign_id = r.campaign_id AND cw.step_order = rr.step_order
       LEFT JOIN users u ON rr.reviewer_id = u.id
       WHERE rr.response_id = $1
       ORDER BY rr.step_order ASC`,
      [parsedId]
    );

    return {
      original_answers: originalAnswers,
      review_history: reviewsRes.rows,
    };
  }

  // ─────────────────────────────────────────────
  // 7. Khởi tạo review bước 1 ngay sau khi submit (internal)
  // Gọi từ responses.service.js sau khi INSERT responses thành công
  // ─────────────────────────────────────────────
  async initializeFirstStepReview(responseId, campaignId, evaluatorId, answers) {
    try {
      // Kiểm tra campaign có workflow không
      const campRes = await pool.query(
        `SELECT is_workflow_enabled FROM survey_campaigns WHERE id = $1`,
        [parseInt(campaignId, 10)]
      );

      if (!campRes.rows.length || !campRes.rows[0].is_workflow_enabled) {
        return; // Không làm gì nếu không có workflow
      }

      // Lấy bước 1 của workflow
      const step1Res = await pool.query(
        `SELECT step_order, step_name, reviewer_role FROM campaign_workflows
         WHERE campaign_id = $1 AND step_order = 1`,
        [parseInt(campaignId, 10)]
      );

      if (!step1Res.rows.length) return;

      // Tạo review bước 1 với status APPROVED (người tự nộp)
      const answersJson = JSON.stringify(Array.isArray(answers) ? answers : []);
      await pool.query(
        `INSERT INTO response_reviews (response_id, step_order, reviewer_id, reviewed_data, status, note)
         VALUES ($1, 1, $2, $3::jsonb, 'APPROVED', 'Tự động xác nhận khi nộp bài')`,
        [parseInt(responseId, 10), evaluatorId || null, answersJson]
      );
    } catch (err) {
      // Non-blocking: không throw để không ảnh hưởng luồng submit chính
      console.error('[WorkflowService] initializeFirstStepReview error:', err.message);
    }
  }

  // ─────────────────────────────────────────────
  // 8. Lấy danh sách chiến dịch mà user đã từng review (đã duyệt)
  // ─────────────────────────────────────────────
  async getMyReviewedCampaigns(userId) {
    const parsedUserId = parseInt(userId, 10);
    if (!Number.isFinite(parsedUserId)) {
      const err = new Error('User ID không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const userRes = await pool.query(
      `SELECT u.id, u.full_name, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [parsedUserId]
    );
    if (userRes.rows.length === 0) {
      const err = new Error('Người dùng không tồn tại');
      err.statusCode = 404;
      throw err;
    }
    const user = userRes.rows[0];
    const isAdmin = user.role_name === 'Admin';

    // Lấy các campaigns mà user đã có review (approved hoặc rejected)
    const query = `
      SELECT DISTINCT
        sc.id AS campaign_id,
        sc.name AS campaign_name,
        sc.deleted_at,
        COUNT(DISTINCT rr.response_id) AS reviewed_count,
        MAX(rr.updated_at) AS last_reviewed_at
      FROM response_reviews rr
      JOIN responses r ON r.id = rr.response_id
      JOIN survey_campaigns sc ON sc.id = r.campaign_id
      WHERE rr.status IN ('APPROVED', 'REJECTED')
        AND rr.step_order > 1
        ${isAdmin ? '' : 'AND rr.reviewer_id = $1'}
      GROUP BY sc.id, sc.name, sc.deleted_at
      ORDER BY last_reviewed_at DESC
    `;
    const params = isAdmin ? [] : [parsedUserId];
    const res = await pool.query(query, params);
    return res.rows;
  }

  // ─────────────────────────────────────────────
  // 9. Lấy danh sách phiếu đã duyệt trong một chiến dịch
  // ─────────────────────────────────────────────
  async getReviewedResponsesInCampaign(userId, campaignId, { page = 1, limit = 20 } = {}) {
    const parsedUserId = parseInt(userId, 10);
    const parsedCampaignId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedUserId) || !Number.isFinite(parsedCampaignId)) {
      const err = new Error('ID không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const userRes = await pool.query(
      `SELECT u.id, u.full_name, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [parsedUserId]
    );
    if (userRes.rows.length === 0) {
      const err = new Error('Người dùng không tồn tại');
      err.statusCode = 404;
      throw err;
    }
    const user = userRes.rows[0];
    const isAdmin = user.role_name === 'Admin';

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const baseWhere = isAdmin
      ? `WHERE r.campaign_id = $1 AND rr.status IN ('APPROVED', 'REJECTED') AND rr.step_order > 1`
      : `WHERE r.campaign_id = $1 AND rr.reviewer_id = $2 AND rr.status IN ('APPROVED', 'REJECTED') AND rr.step_order > 1`;
    const baseParams = isAdmin ? [parsedCampaignId] : [parsedCampaignId, parsedUserId];

    const totalRes = await pool.query(
      `SELECT COUNT(DISTINCT rr.response_id) AS total
       FROM response_reviews rr
       JOIN responses r ON r.id = rr.response_id
       ${baseWhere}`,
      baseParams
    );
    const total = parseInt(totalRes.rows[0]?.total || 0, 10);

    const query = `
      SELECT
        rr.response_id,
        r.submitted_at,
        r.evaluator_id,
        u_sub.full_name AS submitter_name,
        u_sub.email AS submitter_email,
        -- Lấy tất cả bước review của response này
        json_agg(
          json_build_object(
            'step_order', rr.step_order,
            'step_name', cw.step_name,
            'reviewer_role', cw.reviewer_role,
            'reviewer_name', u_rev.full_name,
            'status', rr.status,
            'note', rr.note,
            'reviewed_at', rr.updated_at
          ) ORDER BY rr.step_order
        ) AS review_steps,
        MAX(CASE WHEN rr2.status = 'APPROVED' THEN rr2.step_order ELSE 0 END) AS max_approved_step,
        COUNT(DISTINCT cw2.step_order) AS total_steps,
        sc.name AS campaign_name
      FROM response_reviews rr
      JOIN responses r ON r.id = rr.response_id
      JOIN survey_campaigns sc ON sc.id = r.campaign_id
      JOIN campaign_workflows cw ON cw.campaign_id = r.campaign_id AND cw.step_order = rr.step_order
      LEFT JOIN users u_sub ON u_sub.id = r.evaluator_id
      LEFT JOIN users u_rev ON u_rev.id = rr.reviewer_id
      LEFT JOIN response_reviews rr2 ON rr2.response_id = rr.response_id
      LEFT JOIN campaign_workflows cw2 ON cw2.campaign_id = r.campaign_id
      ${baseWhere}
      GROUP BY rr.response_id, r.submitted_at, r.evaluator_id, u_sub.full_name, u_sub.email, sc.name
      ORDER BY MAX(rr.updated_at) DESC
      LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}
    `;

    const dataRes = await pool.query(query, [...baseParams, limitNum, offset]);

    return {
      data: dataRes.rows,
      meta: {
        totalRecords: total,
        totalPages: Math.ceil(total / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum,
      },
    };
  }
}

module.exports = new WorkflowService();
