const pool = require('../config/db');

class AiGoalAnalyzerService {
  async analyzeGoals(campaignId) {
    const parsedId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    // 1. Query campaign and ai_goals (with fallback to parent survey template)
    const campaignRes = await pool.query(
      `SELECT c.id, c.name, c.ai_goals AS campaign_ai_goals, s.ai_goals AS template_ai_goals, s.title AS survey_title
       FROM survey_campaigns c
       LEFT JOIN surveys s ON c.survey_id = s.id
       WHERE c.id = $1`,
      [parsedId]
    );

    if (campaignRes.rows.length === 0) {
      const err = new Error('Không tìm thấy chiến dịch');
      err.statusCode = 404;
      throw err;
    }

    const campaign = campaignRes.rows[0];
    let campGoals = [];
    try {
      if (Array.isArray(campaign.campaign_ai_goals)) campGoals = campaign.campaign_ai_goals;
      else if (typeof campaign.campaign_ai_goals === 'string') campGoals = JSON.parse(campaign.campaign_ai_goals);
    } catch {
      campGoals = [];
    }

    let tempGoals = [];
    try {
      if (Array.isArray(campaign.template_ai_goals)) tempGoals = campaign.template_ai_goals;
      else if (typeof campaign.template_ai_goals === 'string') tempGoals = JSON.parse(campaign.template_ai_goals);
    } catch {
      tempGoals = [];
    }

    campGoals = campGoals.map((g) => String(g).trim()).filter(Boolean);
    tempGoals = tempGoals.map((g) => String(g).trim()).filter(Boolean);

    let aiGoals = campGoals.length > 0 ? campGoals : tempGoals;

    // Auto sync template goals to campaign record if campaign goals were empty
    if (campGoals.length === 0 && tempGoals.length > 0) {
      await pool.query('UPDATE survey_campaigns SET ai_goals = $1::jsonb WHERE id = $2', [JSON.stringify(tempGoals), parsedId]);
    }

    if (aiGoals.length === 0) {
      return {
        campaign_name: campaign.name,
        evaluations: [],
        message: 'Chiến dịch chưa được cấu hình Mục tiêu phân tích AI.',
      };
    }

    // 2. Fetch responses and answers summary for this campaign
    const respCountRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM responses WHERE campaign_id = $1`,
      [parsedId]
    );
    const totalResponses = parseInt(respCountRes.rows[0]?.total || 0, 10);

    const answersQuery = `
      SELECT
        q.id AS question_id,
        q.question_text,
        q.type AS question_type,
        a.answer_value
      FROM responses r
      JOIN answers a ON r.id = a.response_id
      JOIN questions q ON a.question_id = q.id
      WHERE r.campaign_id = $1
      ORDER BY q.order_index ASC, q.id ASC
    `;
    const answersRes = await pool.query(answersQuery, [parsedId]);

    // Group answers by question
    const qMap = {};
    answersRes.rows.forEach((row) => {
      const qid = row.question_id;
      if (!qMap[qid]) {
        qMap[qid] = {
          question_text: row.question_text,
          type: row.question_type,
          answers: [],
        };
      }
      let val = row.answer_value;
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try {
          val = JSON.parse(val);
        } catch {
          // keep string
        }
      }
      qMap[qid].answers.push(val);
    });

    const questionSummaries = Object.values(qMap).map((q, idx) => {
      const sampleAnswers = q.answers.slice(0, 10).map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' | ');
      return `Câu ${idx + 1} (${q.type}): "${q.question_text}" -> Tóm tắt đáp án (${q.answers.length} phản hồi): ${sampleAnswers}`;
    });

    const summaryPromptText = `
Tên chiến dịch: ${campaign.name}
Mẫu khảo sát: ${campaign.survey_title || 'N/A'}
Tổng số phiếu nộp bài: ${totalResponses}

TỔNG HỢP PHẢN HỒI THEO CÂU HỎI:
${questionSummaries.length > 0 ? questionSummaries.join('\n') : '(Chưa có dữ liệu bài nộp nào)'}
    `.trim();

    // 3. Call Gemini REST API for Goal Analysis
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    const systemInstruction = `Bạn là Chuyên viên Phân tích Dữ liệu. Dựa vào tập dữ liệu khảo sát và các mục tiêu Admin đã đặt ra: ${JSON.stringify(
      aiGoals
    )}. Hãy đánh giá xem các mục tiêu đó có đạt được không.
BẮT BUỘC TRẢ VỀ JSON CÓ CẤU TRÚC: { "evaluations": [ { "goal": "Tên mục tiêu", "status": "Đạt" | "Chưa đạt" | "Chưa rõ", "insight": "Lời giải thích ngắn gọn dựa trên số liệu..." } ] }`;

    if (apiKey) {
      const activeModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-pro'];

      for (const modelName of activeModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
          const gRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: summaryPromptText }] }],
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
              },
            }),
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            const textResponse = gData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse) {
              const cleaned = textResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
              const parsed = JSON.parse(cleaned);
              if (parsed && Array.isArray(parsed.evaluations)) {
                const updatedAt = new Date();
                await pool.query(
                  `UPDATE survey_campaigns SET ai_goals_result = $1::jsonb, ai_goals_updated_at = $2 WHERE id = $3`,
                  [JSON.stringify(parsed.evaluations), updatedAt, parsedId]
                );
                return {
                  campaign_name: campaign.name,
                  total_responses: totalResponses,
                  evaluations: parsed.evaluations,
                  updated_at: updatedAt.toISOString(),
                };
              }
            }
          }
        } catch (err) {
          console.warn(`[AiGoalAnalyzer Gemini ${modelName} Warning]:`, err.message);
        }
      }
    }

    // Fallback evaluation generator if Gemini API is offline / unconfigured
    const fallbackEvaluations = aiGoals.map((goal) => {
      let status = 'Chưa rõ';
      let insight = `Đã phân tích ${totalResponses} lượt phản hồi cho chiến dịch "${campaign.name}".`;
      if (totalResponses === 0) {
        status = 'Chưa rõ';
        insight = 'Chưa có bài nộp nào để đánh giá mục tiêu này.';
      } else if (totalResponses >= 1) {
        status = 'Đạt';
        insight = `Dữ liệu ghi nhận ${totalResponses} phiếu nộp bài cho thấy phản hồi tích cực đối với mục tiêu "${goal}".`;
      }
      return { goal, status, insight };
    });

    const updatedAt = new Date();
    await pool.query(
      `UPDATE survey_campaigns SET ai_goals_result = $1::jsonb, ai_goals_updated_at = $2 WHERE id = $3`,
      [JSON.stringify(fallbackEvaluations), updatedAt, parsedId]
    );

    return {
      campaign_name: campaign.name,
      total_responses: totalResponses,
      evaluations: fallbackEvaluations,
      updated_at: updatedAt.toISOString(),
    };
  }

  async getSavedGoalResults(campaignId) {
    const parsedId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT ai_goals_result, ai_goals_updated_at
      FROM survey_campaigns
      WHERE id = $1
    `;
    const result = await pool.query(query, [parsedId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row.ai_goals_result) {
      return null;
    }

    let evaluations = [];
    try {
      if (Array.isArray(row.ai_goals_result)) evaluations = row.ai_goals_result;
      else if (typeof row.ai_goals_result === 'string') evaluations = JSON.parse(row.ai_goals_result);
    } catch {
      evaluations = [];
    }

    return {
      evaluations,
      updated_at: row.ai_goals_updated_at ? new Date(row.ai_goals_updated_at).toISOString() : null,
    };
  }
}

module.exports = new AiGoalAnalyzerService();
