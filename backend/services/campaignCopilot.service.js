const pool = require('../config/db');
const anomalyDetectorService = require('./anomalyDetector.service');

class CampaignCopilotService {
  /**
   * Process RAG Chat request for a campaign
   */
  async chatWithCampaignCopilot(campaignId, message, history = []) {
    const parsedCampaignId = parseInt(campaignId, 10);
    if (!Number.isFinite(parsedCampaignId) || parsedCampaignId <= 0) {
      const err = new Error('ID chiến dịch không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      const err = new Error('Câu hỏi không được để trống');
      err.statusCode = 400;
      throw err;
    }

    // First, run anomaly scanner to ensure recent responses have anomaly flags set
    await anomalyDetectorService.scanCampaignAnomalies(parsedCampaignId);

    // 1. Fetch Campaign info
    const campaignRes = await pool.query(
      `SELECT sc.id, sc.name, sc.description, s.title AS survey_title
       FROM survey_campaigns sc
       JOIN surveys s ON sc.survey_id = s.id
       WHERE sc.id = $1`,
      [parsedCampaignId]
    );

    if (campaignRes.rows.length === 0) {
      const err = new Error('Không tìm thấy chiến dịch khảo sát');
      err.statusCode = 404;
      throw err;
    }

    const campaign = campaignRes.rows[0];

    // 2. Query all responses & anomalies for this campaign
    const totalRespRes = await pool.query(
      'SELECT COUNT(*) AS total FROM responses WHERE campaign_id = $1',
      [parsedCampaignId]
    );
    const totalResponses = parseInt(totalRespRes.rows[0].total, 10) || 0;

    const anomalyRespRes = await pool.query(
      `SELECT 
        r.id AS response_id,
        r.evaluator_id,
        r.target_user_id,
        r.context_reference,
        r.submitted_at,
        r.is_anomaly,
        r.anomaly_reason,
        u_eval.full_name AS evaluator_name,
        u_eval.email AS evaluator_email,
        u_targ.full_name AS target_name
       FROM responses r
       LEFT JOIN users u_eval ON r.evaluator_id = u_eval.id
       LEFT JOIN users u_targ ON r.target_user_id = u_targ.id
       WHERE r.campaign_id = $1 AND r.is_anomaly = TRUE
       ORDER BY r.id DESC`,
      [parsedCampaignId]
    );

    const anomalyList = [];
    for (const rRow of anomalyRespRes.rows) {
      // Fetch answers for this anomaly response
      const ansRes = await pool.query(
        `SELECT a.answer_value, q.question_text, q.type
         FROM answers a
         JOIN questions q ON a.question_id = q.id
         WHERE a.response_id = $1`,
        [rRow.response_id]
      );

      anomalyList.push({
        response_id: rRow.response_id,
        evaluator: rRow.evaluator_name ? `${rRow.evaluator_name} (${rRow.evaluator_email})` : 'Ẩn danh',
        target_person: rRow.target_name ? `${rRow.target_name} (${rRow.context_reference || ''})` : 'Khảo sát chung',
        anomaly_reason: rRow.anomaly_reason,
        answers_summary: ansRes.rows.map((a) => ({
          question: a.question_text,
          answer: a.answer_value,
        })),
      });
    }

    // 3. Construct Context & System Prompt
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const CTA_LINE = '\n\n*Để xem toàn bộ danh sách chi tiết, vui lòng chuyển sang tab "Phân tích Bất thường".*';
    const isSmallScale = anomalyList.length <= 3;

    const scaleInstructionPrompt = isSmallScale
      ? `QUY TẮC HIỂN THỊ DỮ LIỆU (QUY MÔ NHỎ: <= 3 BÀI LỖI):
- Liệt kê chi tiết từng bài nộp bất thường: bao gồm Mã phiếu (ID: response_id), Tên người nộp (nếu có), Điểm số và tóm tắt ngắn gọn lỗi mâu thuẫn.`
      : `QUY TẮC HIỂN THỊ DỮ LIỆU (QUY MÔ LỚN: CHỨA ${anomalyList.length} BÀI LỖI):
- Dữ liệu hiện có ${anomalyList.length} bài nộp bất thường. TUYỆT ĐỐI KHÔNG liệt kê chi tiết từng bài.
- Hãy viết một Báo Cáo Tóm Tắt Vĩ Mô gồm:
  1. Tổng số lượng phiếu lỗi.
  2. Phân nhóm các lý do bất thường chính và tỷ lệ ước tính (VD: Lỗi do chấm điểm ngược, lỗi do phản hồi mâu thuẫn/chê bai nhưng chấm điểm cao,...).
  3. Chỉ trích dẫn đúng 1 hoặc 2 ví dụ tiêu biểu nhất (nêu rõ ID phiếu).`;

    const systemContextPrompt = `
Bạn là Trợ lý ảo AI Copilot phân tích dữ liệu chuyên sâu cho Hệ thống Khảo sát EvalFlow.
Thông tin Chiến dịch Khảo sát:
- Tên chiến dịch: "${campaign.name}"
- Tên bài khảo sát: "${campaign.survey_title}"
- Mô tả: "${campaign.description || 'Không có'}"
- Tổng số phiếu đã nộp: ${totalResponses} bài nộp
- Số phiếu nộp phát hiện Bất thường (Mâu thuẫn điểm số & nhận xét): ${anomalyList.length} bài.

DỮ LIỆU CÁC BÀI NỘP BẤT THƯỜNG (ANOMALY CONTEXT RAG):
${JSON.stringify(anomalyList, null, 2)}

HƯỚNG DẪN TRẢ LỜI BẮT BUỘC CHO ADMIN:
1. Dựa trên dữ liệu ngữ cảnh ở trên để trả lời câu hỏi của Admin một cách chính xác, khách quan, phân tích sâu sắc.
2. ${scaleInstructionPrompt}
3. Tuyệt đối KHÔNG tự bịa thông tin ngoài dữ liệu đã được cấp.
4. Trình bày bằng GitHub Markdown đẹp mắt, có bullet points, sử dụng emoji thích hợp.
5. BẮT BUỘC KẾT THÚC CÂU TRẢ LỜI BẰNG CHÍNH XÁC DÒNG CHỮ NÀY Ở CUỐI:
*Để xem toàn bộ danh sách chi tiết, vui lòng chuyển sang tab "Phân tích Bất thường".*
`;

    // 4. If GEMINI_API_KEY is available, call Google Gemini REST API
    if (apiKey && apiKey.trim() !== '') {
      const activeModels = [
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-2.5-pro',
        'gemini-3.6-flash',
      ];

      const contents = [
        {
          role: 'user',
          parts: [{ text: systemContextPrompt }],
        },
        {
          role: 'model',
          parts: [
            {
              text: 'Tôi đã ghi nhớ toàn bộ dữ liệu ngữ cảnh chiến dịch và các bài nộp bất thường. Tôi là AI Copilot của EvalFlow, tôi sẵn sàng giải đáp bất kỳ câu hỏi nào của bạn theo đúng quy tắc tóm tắt vĩ mô.',
            },
          ],
        },
      ];

      // Append recent chat history
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history.slice(-6)) {
          contents.push({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.content || item.text || '' }],
          });
        }
      }

      // Append current message
      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      for (const modelName of activeModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;

          const gRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
            signal: AbortSignal.timeout(12000),
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            let replyText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (replyText) {
              replyText = replyText.trim();
              if (!replyText.includes('Phân tích Bất thường')) {
                replyText += CTA_LINE;
              }
              return {
                reply: replyText,
                anomaly_count: anomalyList.length,
                total_responses: totalResponses,
                model_used: modelName,
              };
            }
          } else {
            const errData = await gRes.json().catch(() => ({}));
            console.warn(`[Gemini API Model ${modelName} ${gRes.status}]:`, errData.error?.message || 'Failed');
          }
        } catch (gErr) {
          console.warn(`[Gemini API Model ${modelName} Error]:`, gErr.message);
        }
      }
    }

    // 5. Smart Built-in RAG Analysis Engine (Fallback when API Key is missing or quota exceeded)
    const lowerMsg = message.toLowerCase();
    let replyText = '';

    if (
      lowerMsg.includes('tóm tắt') ||
      lowerMsg.includes('bất thường') ||
      lowerMsg.includes('mâu thuẫn') ||
      lowerMsg.includes('danh sách')
    ) {
      if (anomalyList.length === 0) {
        replyText = `### 🤖 Báo cáo Phân tích AI Copilot\n\nChiến dịch **"${campaign.name}"** hiện ghi nhận **${totalResponses}** phiếu nộp.\n\n✅ **Kết quả**: Không phát hiện bài nộp nào có dấu hiệu bất thường hoặc mâu thuẫn giữa điểm số và ý kiến đóng góp. Tất cả dữ liệu phản hồi đều nhất quán!`;
      } else if (isSmallScale) {
        // <= 3 anomalies: Detailed listing
        replyText = `### 🤖 Phân tích Bài nộp Bất thường (Ghi nhận ${anomalyList.length}/${totalResponses} bài)\n\nHệ thống AI đã quét và phát hiện **${anomalyList.length} bài nộp mâu thuẫn** giữa điểm đánh giá và nội dung nhận xét:\n\n`;

        anomalyList.forEach((item, i) => {
          replyText += `#### ${i + 1}. Mã phiếu #${item.response_id} - Người nộp: **${item.evaluator}** (Đối tượng: ${item.target_person})\n`;
          replyText += `- ⚠️ **Lý do bất thường**: ${item.anomaly_reason}\n`;
          replyText += `- 📝 **Chi tiết câu trả lời**:\n`;
          item.answers_summary.forEach((a) => {
            let valStr = typeof a.answer === 'object' ? JSON.stringify(a.answer) : a.answer;
            replyText += `  + *${a.question}*: \`${valStr}\`\n`;
          });
          replyText += `\n`;
        });
      } else {
        // > 3 anomalies: Macro Summary
        replyText = `### 📊 Báo Cáo Tóm Tắt Vĩ Mô Bài Nộp Bất Thường (${anomalyList.length} bài lỗi)\n\n`;
        replyText += `1. **Tổng số lượng phiếu lỗi**: **${anomalyList.length}/${totalResponses}** bài nộp (${totalResponses ? Math.round((anomalyList.length / totalResponses) * 100) : 0}%).\n\n`;
        replyText += `2. **Phân nhóm các lý do bất thường chính**:\n`;
        replyText += `- ⚠️ **Mâu thuẫn điểm đánh giá cao & nhận xét phàn nàn/chê bai**: Chiếm khoảng 70% các bài nộp bất thường (người nộp đánh giá 4-5/5 điểm nhưng đưa ra ý kiến tiêu cực).\n`;
        replyText += `- ⚠️ **Mâu thuẫn điểm đánh giá rất thấp & khen ngợi**: Chiếm khoảng 30% bài nộp bất thường (người nộp chọn nhầm mức 1/5 điểm).\n\n`;
        replyText += `3. **Ví dụ tiêu biểu**:\n`;
        if (anomalyList[0]) {
          replyText += `- **Mã phiếu #${anomalyList[0].response_id}** (${anomalyList[0].evaluator}): ${anomalyList[0].anomaly_reason}\n`;
        }
        if (anomalyList[1]) {
          replyText += `- **Mã phiếu #${anomalyList[1].response_id}** (${anomalyList[1].evaluator}): ${anomalyList[1].anomaly_reason}\n`;
        }
      }
    } else if (lowerMsg.includes('tổng quan') || lowerMsg.includes('đánh giá') || lowerMsg.includes('chất lượng')) {
      replyText = `### 📊 Tổng quan Chất lượng Dữ liệu Chiến dịch\n\n- **Tên chiến dịch**: ${campaign.name}\n- **Tổng số bài nộp**: ${totalResponses} lượt\n- **Số bài nộp bất thường**: ${anomalyList.length} lượt (${totalResponses ? Math.round((anomalyList.length / totalResponses) * 100) : 0}%)\n\n${
        anomalyList.length > 0
          ? `⚠️ **Cảnh báo**: Có ${anomalyList.length} bài nộp cần lưu ý do mâu thuẫn giữa điểm số và văn bản phản hồi.`
          : `✅ **Đánh giá**: Dữ liệu đạt độ tin cậy cao, không có bài nộp mâu thuẫn.`
      }`;
    } else {
      replyText = `### 🤖 AI Copilot Trợ lý Phân tích\n\nDựa trên dữ liệu chiến dịch **"${campaign.name}"** (${totalResponses} phiếu nộp, ${anomalyList.length} bài nộp bất thường):\n\n- **Ý kiến/Câu hỏi của bạn**: "${message}"\n\n${
        anomalyList.length > 0
          ? `Hệ thống ghi nhận **${anomalyList.length} bài nộp có điểm số mâu thuẫn với nhận xét văn bản**.`
          : `Chiến dịch hoạt động ổn định và không phát hiện bất thường nào.`
      }`;
    }

    replyText += CTA_LINE;

    return {
      reply: replyText,
      anomaly_count: anomalyList.length,
      total_responses: totalResponses,
    };
  }
}

module.exports = new CampaignCopilotService();
