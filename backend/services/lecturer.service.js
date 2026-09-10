const pool = require('../config/db');

class LecturerService {
  async getMyEvaluations(lecturerId) {
    const parsedLecturerId = parseInt(lecturerId, 10);
    if (!Number.isFinite(parsedLecturerId) || parsedLecturerId <= 0) {
      const err = new Error('ID Giảng viên không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    // SANITIZED SECURE QUERY: Absolutely zero evaluator identity fields (evaluator_id, guest_name, guest_email) are selected!
    const query = `
      SELECT
        r.id AS response_id,
        r.campaign_id,
        r.context_reference,
        r.submitted_at,
        c.name AS campaign_name,
        c.start_date AS campaign_start_date,
        c.end_date AS campaign_end_date,
        s.title AS survey_title,
        s.description AS survey_description,
        a.id AS answer_id,
        a.question_id,
        a.answer_value,
        q.question_text,
        q.type AS question_type,
        q.options AS question_options,
        q.order_index
      FROM responses r
      JOIN survey_campaigns c ON r.campaign_id = c.id
      LEFT JOIN surveys s ON c.survey_id = s.id
      JOIN answers a ON r.id = a.response_id
      JOIN questions q ON a.question_id = q.id
      WHERE r.target_user_id = $1
      ORDER BY r.campaign_id DESC, r.submitted_at DESC, q.order_index ASC, q.id ASC
    `;

    const result = await pool.query(query, [parsedLecturerId]);

    // Grouping by Campaign
    const campaignMap = {};
    const allRatingValues = [];
    const allSliderValues = [];
    const allResponseIdsSet = new Set();

    result.rows.forEach((row) => {
      allResponseIdsSet.add(row.response_id);
      const cid = row.campaign_id;

      if (!campaignMap[cid]) {
        campaignMap[cid] = {
          campaign_id: cid,
          campaign_name: row.campaign_name,
          survey_title: row.survey_title || row.campaign_name,
          survey_description: row.survey_description || '',
          context_reference: row.context_reference || null,
          start_date: row.campaign_start_date,
          end_date: row.campaign_end_date,
          response_ids: new Set(),
          questionsMap: {},
        };
      }

      const camp = campaignMap[cid];
      camp.response_ids.add(row.response_id);

      const qid = row.question_id;
      const qType = (row.question_type || '').toLowerCase();

      if (!camp.questionsMap[qid]) {
        camp.questionsMap[qid] = {
          question_id: qid,
          question_text: row.question_text,
          type: qType,
          options: row.question_options,
          order_index: row.order_index,
          answers: [],
        };
      }

      let parsedVal = row.answer_value;
      if (typeof parsedVal === 'string' && (parsedVal.startsWith('{') || parsedVal.startsWith('['))) {
        try {
          parsedVal = JSON.parse(parsedVal);
        } catch {
          // keep as string
        }
      }

      camp.questionsMap[qid].answers.push(parsedVal);

      // Collect scores separately by question type with safe parsing
      const numVal = parseFloat(row.answer_value);
      if (Number.isFinite(numVal)) {
        if (qType === 'rating') {
          allRatingValues.push(Math.min(Math.max(numVal, 0), 5));
        } else if (qType === 'slider') {
          allSliderValues.push(numVal);
        }
      }
    });

    // Transform campaignMap to clean response structure
    const campaignsList = Object.values(campaignMap).map((camp) => {
      const questionsList = Object.values(camp.questionsMap)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
        .map((q) => {
          const qResult = {
            question_id: q.question_id,
            question_text: q.question_text,
            type: q.type,
            answers_count: q.answers.length,
          };

          if (q.type === 'rating' || q.type === 'slider') {
            const numericAnswers = q.answers
              .map((v) => parseFloat(v))
              .filter((v) => Number.isFinite(v));

            const avg = numericAnswers.length > 0
              ? (numericAnswers.reduce((sum, n) => sum + n, 0) / numericAnswers.length)
              : 0;

            if (q.type === 'rating') {
              qResult.average_score = Math.min(Math.round(avg * 10) / 10, 5.0);
              qResult.max_score = 5;
            } else {
              qResult.average_score = Math.round(avg * 10) / 10;
              qResult.max_score = q.options?.max || 10;
            }
          } else if (['radio', 'dropdown', 'checkbox'].includes(q.type)) {
            const counts = {};
            q.answers.forEach((ans) => {
              if (Array.isArray(ans)) {
                ans.forEach((choice) => {
                  const label = String(choice).trim();
                  if (label) counts[label] = (counts[label] || 0) + 1;
                });
              } else if (ans !== null && ans !== undefined) {
                const label = String(ans).trim();
                if (label) counts[label] = (counts[label] || 0) + 1;
              }
            });
            qResult.choice_breakdown = counts;
          } else {
            // text or open-ended questions: Completely Anonymous string list
            qResult.comments = q.answers
              .map((a) => (typeof a === 'string' ? a.trim() : typeof a === 'object' ? JSON.stringify(a) : String(a).trim()))
              .filter(Boolean);
          }

          return qResult;
        });

      // Calculate campaign average rating (ONLY from rating questions)
      const campRatings = [];
      const campSliders = [];
      questionsList.forEach((q) => {
        if (q.type === 'rating' && q.average_score !== undefined) {
          campRatings.push(q.average_score);
        } else if (q.type === 'slider' && q.average_score !== undefined) {
          campSliders.push(q.average_score);
        }
      });

      const campaignAvgRating = campRatings.length > 0
        ? Math.min(Math.round((campRatings.reduce((a, b) => a + b, 0) / campRatings.length) * 10) / 10, 5.0)
        : null;

      const campaignAvgSlider = campSliders.length > 0
        ? Math.round((campSliders.reduce((a, b) => a + b, 0) / campSliders.length) * 10) / 10
        : null;

      return {
        campaign_id: camp.campaign_id,
        campaign_name: camp.campaign_name,
        survey_title: camp.survey_title,
        survey_description: camp.survey_description,
        context_reference: camp.context_reference,
        total_responses: camp.response_ids.size,
        average_rating: campaignAvgRating,
        average_slider_score: campaignAvgSlider,
        questions: questionsList,
      };
    });

    const overallAvgRating = allRatingValues.length > 0
      ? Math.min(Math.round((allRatingValues.reduce((sum, s) => sum + s, 0) / allRatingValues.length) * 10) / 10, 5.0)
      : null;

    const overallAvgSlider = allSliderValues.length > 0
      ? Math.round((allSliderValues.reduce((sum, s) => sum + s, 0) / allSliderValues.length) * 10) / 10
      : null;

    return {
      overview: {
        total_evaluations: allResponseIdsSet.size,
        overall_average_rating: overallAvgRating,
        overall_average_score: overallAvgSlider,
        campaigns_count: campaignsList.length,
      },
      campaigns: campaignsList,
    };
  }

  async getLecturersWithEvaluations() {
    const query = `
      SELECT
        u.id,
        u.full_name,
        u.email,
        r.role_name,
        u.department,
        COALESCE(eval_counts.evaluations_count, 0) AS evaluations_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN (
        SELECT target_user_id, COUNT(DISTINCT id) AS evaluations_count
        FROM responses
        WHERE target_user_id IS NOT NULL
        GROUP BY target_user_id
      ) eval_counts ON u.id = eval_counts.target_user_id
      WHERE (r.role_name ILIKE '%Giảng viên%' OR eval_counts.evaluations_count > 0)
      ORDER BY eval_counts.evaluations_count DESC, u.full_name ASC
    `;

    const result = await pool.query(query);
    return result.rows.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role_name: row.role_name,
      department: row.department,
      evaluations_count: parseInt(row.evaluations_count, 10) || 0,
    }));
  }
}

module.exports = new LecturerService();
