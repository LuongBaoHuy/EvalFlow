const pool = require('../config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AnomalyDetectorService {
  /**
   * Directly analyze response sentiment & rating conflict with Google Gemini API SDK.
   * Enforces strict JSON response: { is_anomaly: boolean, reason: string }
   */
  async analyzeResponseWithGemini(ratingScore, textFeedback) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return null;
    }

    const activeModels = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
    const genAI = new GoogleGenerativeAI(apiKey.trim());

    const prompt = `Bạn là hệ thống kiểm duyệt dữ liệu. Nhiệm vụ của bạn là đối chiếu Điểm số (Từ 1-10) và Nội dung Tự luận của cùng một bài khảo sát xem có bị xung đột không (Ví dụ: Điểm rất cao nhưng chê bai, hoặc điểm rất thấp nhưng khen ngợi).
Dữ liệu đầu vào: Điểm số: ${ratingScore}, Tự luận: "${textFeedback}".
Yêu cầu BẮT BUỘC: Chỉ trả về duy nhất 1 chuỗi JSON, tuyệt đối không có markdown hay văn bản thừa, theo đúng format sau:
{ "is_anomaly": true/false, "reason": "Giải thích ngắn gọn lý do nếu có xung đột, nếu không thì để chuỗi rỗng" }`;

    for (const modelName of activeModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text();

        if (rawText) {
          const cleanJson = rawText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
          const parsed = JSON.parse(cleanJson);

          if (typeof parsed === 'object' && parsed !== null && 'is_anomaly' in parsed) {
            return {
              is_anomaly: Boolean(parsed.is_anomaly),
              reason: parsed.reason || '',
              model_used: modelName,
            };
          }
        }
      } catch (err) {
        console.warn(`[AnomalyDetector Gemini SDK ${modelName} Warning]:`, err.message);
      }
    }

    return null;
  }

  /**
   * Asynchronously inspect a response for potential sentiment/rating anomalies.
   * Runs in background post-submission (non-blocking).
   */
  async checkResponseAnomaly(responseId) {
    try {
      const parsedId = parseInt(responseId, 10);
      if (!Number.isFinite(parsedId) || parsedId <= 0) return;

      // 1. Fetch response answers joined with question details
      const query = `
        SELECT 
          a.id AS answer_id,
          a.question_id,
          a.answer_value,
          q.type AS question_type,
          q.question_text,
          q.options
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        WHERE a.response_id = $1
      `;
      const res = await pool.query(query, [parsedId]);
      if (res.rows.length === 0) return;

      const rows = res.rows;

      let maxRatingVal = null;
      let minRatingVal = null;
      let textAnswers = [];

      for (const row of rows) {
        let val = row.answer_value;

        // Handle attachment objects { value, attachment }
        if (val && typeof val === 'object' && !Array.isArray(val) && 'value' in val) {
          val = val.value;
        }

        if (val === null || val === undefined) continue;

        // Collect numerical ratings / sliders
        if (row.question_type === 'rating' || row.question_type === 'slider') {
          const num = Number(val);
          if (!isNaN(num)) {
            if (maxRatingVal === null || num > maxRatingVal) maxRatingVal = num;
            if (minRatingVal === null || num < minRatingVal) minRatingVal = num;
          }
        } else if (row.question_type === 'radio') {
          const strVal = String(val).toLowerCase();
          if (strVal.includes('rất hài lòng') || strVal.includes('hài lòng')) {
            if (maxRatingVal === null || 5 > maxRatingVal) maxRatingVal = 5;
          } else if (strVal.includes('không hài lòng') || strVal.includes('rất không hài lòng')) {
            if (minRatingVal === null || 1 < minRatingVal) minRatingVal = 1;
          }
        }

        // Collect text inputs
        if (typeof val === 'string' && val.trim().length > 0) {
          textAnswers.push(val.trim());
        }
      }

      const fullTextFeedback = textAnswers.join('; ');
      const ratingScore = maxRatingVal !== null ? maxRatingVal : (minRatingVal !== null ? minRatingVal : 5);

      let isAnomaly = false;
      let anomalyReason = null;

      // 2. Call Google Gemini API SDK for Anomaly Analysis
      if (fullTextFeedback.length > 0) {
        const geminiResult = await this.analyzeResponseWithGemini(ratingScore, fullTextFeedback);
        if (geminiResult && geminiResult.is_anomaly) {
          isAnomaly = true;
          anomalyReason = `[Gemini AI] ${geminiResult.reason}`;
        }
      }

      // 3. Fallback Built-in Heuristics (if Gemini didn't mark or was unavailable)
      if (!isAnomaly && fullTextFeedback.length > 0) {
        const negativeKeywords = [
          'tệ', 'kém', 'thất vọng', 'tồi', 'dở', 'chán', 'không hài lòng',
          'quá tệ', 'kém chất lượng', 'không tốt', 'phàn nàn', 'yếu', 'hỏng',
          'ồn', 'nóng', 'chậm', 'bất tiện', 'tệ hại', 'chán nản', 'xấu'
        ];
        const positiveKeywords = [
          'tuyệt vời', 'xuất sắc', 'rất tốt', 'hài lòng', 'tuyệt', 'quá tốt',
          'chuyên nghiệp', 'nhiệt tình', 'tận tâm'
        ];

        const lower = fullTextFeedback.toLowerCase();
        if (maxRatingVal !== null && maxRatingVal >= 4) {
          const foundNeg = negativeKeywords.find((kw) => lower.includes(kw));
          if (foundNeg) {
            isAnomaly = true;
            anomalyReason = `[Hệ thống] Điểm số đánh giá cao (${maxRatingVal}/5) nhưng ý kiến đóng góp lại chứa nội dung phàn nàn/tiêu cực: "${fullTextFeedback}"`;
          }
        } else if (minRatingVal !== null && minRatingVal <= 2) {
          const foundPos = positiveKeywords.find((kw) => lower.includes(kw));
          if (foundPos) {
            isAnomaly = true;
            anomalyReason = `[Hệ thống] Điểm đánh giá rất thấp (${minRatingVal}/5) nhưng ý kiến nhận xét lại khen ngợi tích cực: "${fullTextFeedback}"`;
          }
        }
      }

      // 4. Update responses table with anomaly findings
      if (isAnomaly && anomalyReason) {
        await pool.query(
          'UPDATE responses SET is_anomaly = TRUE, anomaly_reason = $1 WHERE id = $2',
          [anomalyReason, parsedId]
        );
        console.log(`[AnomalyDetector] Response #${parsedId} flagged as ANOMALY: ${anomalyReason}`);
      } else {
        await pool.query(
          'UPDATE responses SET is_anomaly = FALSE, anomaly_reason = NULL WHERE id = $1',
          [parsedId]
        );
      }
    } catch (err) {
      console.error('[AnomalyDetector Error]:', err.message);
    }
  }

  /**
   * Scan existing campaign responses and flag anomalies
   */
  async scanCampaignAnomalies(campaignId) {
    try {
      const res = await pool.query('SELECT id FROM responses WHERE campaign_id = $1', [campaignId]);
      for (const row of res.rows) {
        await this.checkResponseAnomaly(row.id);
      }
    } catch (err) {
      console.error('[AnomalyDetector] Error scanning campaign anomalies:', err.message);
    }
  }
}

module.exports = new AnomalyDetectorService();
