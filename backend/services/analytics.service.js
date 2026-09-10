const pool = require('../config/db');

class AnalyticsService {
  async getOverview({ timeRange = 'all' } = {}) {
    let respDateFilter = '';
    if (timeRange === 'today') {
      respDateFilter = `WHERE submitted_at >= CURRENT_DATE`;
    } else if (timeRange === '7days') {
      respDateFilter = `WHERE submitted_at >= NOW() - INTERVAL '7 days'`;
    } else if (timeRange === '30days') {
      respDateFilter = `WHERE submitted_at >= NOW() - INTERVAL '30 days'`;
    }

    // 1. Stat Cards Queries
    const totalSurveysRes = await pool.query(`SELECT COUNT(*) FROM surveys WHERE deleted_at IS NULL`);
    const totalCampaignsRes = await pool.query(`SELECT COUNT(*) FROM survey_campaigns WHERE deleted_at IS NULL`);
    const totalResponsesRes = await pool.query(`SELECT COUNT(*) FROM responses ${respDateFilter}`);
    const totalAssignmentsRes = await pool.query(`SELECT COUNT(*) FROM survey_assignments`);
    const completedAssignmentsRes = await pool.query(
      `SELECT COUNT(*) FROM survey_assignments WHERE status = 'Completed'`
    );

    const totalSurveys = parseInt(totalSurveysRes.rows[0].count, 10) || 0;
    const totalCampaigns = parseInt(totalCampaignsRes.rows[0].count, 10) || 0;
    const totalResponses = parseInt(totalResponsesRes.rows[0].count, 10) || 0;
    const totalAssignments = parseInt(totalAssignmentsRes.rows[0].count, 10) || 0;
    const completedAssignments = parseInt(completedAssignmentsRes.rows[0].count, 10) || 0;

    const completionRate =
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    // 2. Anomaly Alert Count
    const anomalyQuery = `SELECT COUNT(*) FROM responses WHERE is_anomaly = true`;
    const anomalyRes = await pool.query(anomalyQuery);
    const anomalyCount = parseInt(anomalyRes.rows[0]?.count || '0', 10);

    // 3. Daily Submissions Trend (Line Chart)
    const dailyQuery = `
      SELECT
        TO_CHAR(DATE(submitted_at), 'DD/MM') AS date_label,
        DATE(submitted_at) AS raw_date,
        COUNT(*) AS count
      FROM responses
      WHERE submitted_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(submitted_at)
      ORDER BY raw_date ASC
    `;
    const dailyRes = await pool.query(dailyQuery);
    const dailySubmissions = dailyRes.rows.map((row) => ({
      date: row.date_label,
      submissions: parseInt(row.count, 10),
    }));

    // 4. Campaign Status Breakdown (Pie Chart)
    const statusQuery = `
      SELECT
        SUM(CASE WHEN is_active = true AND NOW() >= start_date AND NOW() <= end_date THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN is_active = false AND (end_date IS NULL OR NOW() <= end_date) THEN 1 ELSE 0 END) AS paused_count,
        SUM(CASE WHEN NOW() > end_date THEN 1 ELSE 0 END) AS ended_count
      FROM survey_campaigns
      WHERE deleted_at IS NULL
    `;
    const statusRes = await pool.query(statusQuery);
    const sRow = statusRes.rows[0] || {};
    const campaignStatusBreakdown = [
      { name: 'Đang hoạt động', value: parseInt(sRow.active_count || '0', 10), color: '#10B981' },
      { name: 'Tạm dừng', value: parseInt(sRow.paused_count || '0', 10), color: '#F59E0B' },
      { name: 'Đã kết thúc', value: parseInt(sRow.ended_count || '0', 10), color: '#EF4444' },
    ];

    // 5. Recent Responses (10 items for Full Width Table)
    const recentQuery = `
      SELECT
        r.id AS response_id,
        r.submitted_at,
        COALESCE(r.is_anomaly, false) AS is_anomaly,
        r.anomaly_reason,
        u.full_name AS evaluator_name,
        u.email AS evaluator_email,
        sc.id AS campaign_id,
        sc.name AS campaign_name,
        s.title AS survey_title
      FROM responses r
      JOIN users u ON r.evaluator_id = u.id
      JOIN survey_campaigns sc ON r.campaign_id = sc.id
      JOIN surveys s ON sc.survey_id = s.id
      ORDER BY r.submitted_at DESC
      LIMIT 10
    `;
    const recentRes = await pool.query(recentQuery);

    return {
      total_surveys: totalSurveys,
      total_campaigns: totalCampaigns,
      total_responses: totalResponses,
      total_assignments: totalAssignments,
      completed_assignments: completedAssignments,
      completion_rate: completionRate,
      anomaly_count: anomalyCount,
      daily_submissions: dailySubmissions,
      campaign_status_breakdown: campaignStatusBreakdown,
      recent_responses: recentRes.rows,
    };
  }

  async getSurveyAnalytics(surveyId) {
    const parsedSurveyId = parseInt(surveyId, 10);
    if (!Number.isFinite(parsedSurveyId) || parsedSurveyId <= 0) {
      const err = new Error('ID survey không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const surveyRes = await pool.query(
      'SELECT id, title, description, theme_config, created_at FROM surveys WHERE id = $1',
      [parsedSurveyId]
    );
    if (surveyRes.rows.length === 0) {
      const err = new Error('Survey không tồn tại');
      err.statusCode = 404;
      throw err;
    }
    const survey = surveyRes.rows[0];

    // Get total responses for campaigns using this survey
    const respCountRes = await pool.query(
      `SELECT COUNT(*) FROM responses r JOIN survey_campaigns sc ON r.campaign_id = sc.id WHERE sc.survey_id = $1`,
      [parsedSurveyId]
    );
    const totalResponsesCount = parseInt(respCountRes.rows[0].count, 10) || 0;

    // Get questions
    const qRes = await pool.query(
      'SELECT id, question_text, type, is_required, order_index, options FROM questions WHERE survey_id = $1 ORDER BY order_index ASC',
      [parsedSurveyId]
    );

    const questionsAnalytics = [];

    for (const q of qRes.rows) {
      let options = {};
      try {
        if (typeof q.options === 'string') options = JSON.parse(q.options);
        else if (q.options && typeof q.options === 'object') options = q.options;
      } catch {
        options = {};
      }

      // Fetch all answers for this question
      const ansQuery = `
        SELECT a.answer_value
        FROM answers a
        JOIN responses r ON a.response_id = r.id
        JOIN survey_campaigns sc ON r.campaign_id = sc.id
        WHERE a.question_id = $1 AND sc.survey_id = $2
      `;
      const ansRes = await pool.query(ansQuery, [q.id, parsedSurveyId]);

      const rawValues = ansRes.rows.map((r) => {
        let val = r.answer_value;
        try {
          if (typeof val === 'string') val = JSON.parse(val);
        } catch {}
        return val;
      });

      const item = {
        question_id: q.id,
        question_text: q.question_text,
        type: q.type,
        total_answers: rawValues.length,
        options,
      };

      if (q.type === 'radio' || q.type === 'checkbox') {
        const choiceCounts = {};
        const choicesList = options.choices || [];
        choicesList.forEach((c) => (choiceCounts[c] = 0));

        rawValues.forEach((val) => {
          if (Array.isArray(val)) {
            val.forEach((subVal) => {
              const str = String(subVal);
              choiceCounts[str] = (choiceCounts[str] || 0) + 1;
            });
          } else if (val !== null && val !== undefined) {
            const str = String(val);
            choiceCounts[str] = (choiceCounts[str] || 0) + 1;
          }
        });

        item.breakdown = choiceCounts;
      } else if (q.type === 'rating' || q.type === 'slider') {
        const numValues = rawValues
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v));

        if (numValues.length > 0) {
          const sum = numValues.reduce((a, b) => a + b, 0);
          item.average_score = Math.round((sum / numValues.length) * 10) / 10;
          item.min_score = Math.min(...numValues);
          item.max_score = Math.max(...numValues);
        } else {
          item.average_score = 0;
          item.min_score = 0;
          item.max_score = 0;
        }
      } else if (q.type === 'text') {
        item.text_responses = rawValues
          .map((v) => (v !== null && v !== undefined ? String(v).trim() : ''))
          .filter((v) => v.length > 0);
      }

      questionsAnalytics.push(item);
    }

    return {
      survey_id: survey.id,
      survey_title: survey.title,
      survey_description: survey.description,
      total_responses: totalResponsesCount,
      questions: questionsAnalytics,
    };
  }
}

module.exports = new AnalyticsService();
