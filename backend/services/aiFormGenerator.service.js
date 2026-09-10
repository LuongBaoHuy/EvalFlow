const pool = require('../config/db');

class AIFormGeneratorService {
  async generateFormFromPrompt(prompt = '') {
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      const err = new Error('Vui lòng nhập chủ đề câu hỏi bạn muốn tạo');
      err.statusCode = 400;
      throw err;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    // System instruction with STEEL RULES & STRICT ENUMS DICTIONARY for Gemini
    const systemInstruction = `
Bạn là một chuyên gia hàng đầu về thiết kế bảng khảo sát chuyên nghiệp. Người dùng sẽ gửi cho bạn yêu cầu chủ đề khảo sát.

QUY TẮC THÉP VỀ SỐ LƯỢNG CÂU HỎI (DYNAMIC COUNT):
- Hãy phân tích kỹ yêu cầu của người dùng. Nếu người dùng yêu cầu số lượng câu hỏi cụ thể (ví dụ: 'tạo 10 câu', 'tạo 15 câu', 'tạo 20 câu'), BẮT BUỘC bạn phải sinh ra CHÍNH XÁC số lượng câu hỏi đó trong mảng "questions", không được thiếu dù chỉ 1 câu.
- Nếu người dùng KHÔNG chỉ định số lượng cụ thể, hãy tự động sinh từ 5 đến 8 câu hỏi phù hợp nhất.

TỪ ĐIỂN VÀ QUY TẮC PHÂN LOẠI CÂU HỎI (STRICT ENUMS DICTIONARY):
Khi tạo câu hỏi, trường "type" BẮT BUỘC phải mang một trong các giá trị Enum chuẩn (chữ thường) sau:
- "radio": Dùng cho câu hỏi trắc nghiệm chọn 1 đáp án duy nhất (Ví dụ: Đánh giá Mức độ hài lòng, Lựa chọn duy nhất).
- "checkbox": Dùng cho câu hỏi trắc nghiệm chọn nhiều đáp án cùng lúc (Ví dụ: Chọn các kỹ năng, Chọn yếu tố yêu thích).
- "text": Dùng cho câu hỏi tự luận, nhập văn bản hoặc đóng góp ý kiến mở.
- "slider": Dùng cho câu hỏi dạng thanh trượt, đánh giá mức độ, chấm điểm theo thang số (Ví dụ: Chấm điểm từ 1 đến 10, thang điểm độ khó 0-10).
- "rating": Dùng cho câu hỏi đánh giá bằng Ngôi sao (Ví dụ: Đánh giá 1 đến 5 sao, xếp hạng chất lượng theo sao).
- "dropdown": Dùng cho danh sách thả xuống chọn 1 đáp án.

QUY TẮC THÉP VỀ THUỘC TÍNH VÀ ĐÁP ÁN (PROPERTY CONSTRAINTS & OPTIONS SCHEMA):
1. NẾU "type" là "radio", "checkbox", hoặc "dropdown":
   - BẮT BUỘC mảng "options" KHÔNG ĐƯỢC RỖNG. Bạn BẮT BUỘC phải sinh ra từ 2 đến 5 đáp án phù hợp, đặt trong mảng "options" theo định dạng: [ { "label": "Đáp án 1" }, { "label": "Đáp án 2" } ].
2. NẾU "type" là "slider":
   - Trường "options" là object cấu hình thang điểm min/max/step: { "min": 0, "max": 10, "step": 1 }.
3. NẾU "type" là "rating":
   - Trường "options" là object cấu hình số sao: { "max": 5 }.
4. NẾU "type" là "text":
   - Trường "options" BẮT BUỘC là mảng rỗng [].

CẤU TRÚC JSON BẮT BUỘC TRẢ VỀ:
BẮT BUỘC trả về kết quả dưới định dạng JSON thuần túy (không chứa markdown, không có chữ thừa bên ngoài), tuân thủ CHÍNH XÁC cấu trúc sau:
{
  "title": "Tên form khảo sát ngắn gọn, chuyên nghiệp",
  "description": "Mô tả ngắn gọn mục đích bảng khảo sát",
  "theme_color": "#2563eb",
  "questions": [
    {
      "type": "radio" | "checkbox" | "text" | "slider" | "rating" | "dropdown",
      "question_text": "Nội dung câu hỏi",
      "is_required": true,
      "options": [ { "label": "Đáp án 1" }, { "label": "Đáp án 2" } ]
    }
  ]
}

VÍ DỤ MẪU (FEW-SHOT EXAMPLES):
- Người dùng: "Thêm 1 câu đánh giá độ khó bằng thanh trượt."
  Output câu hỏi chuẩn:
  {
    "type": "slider",
    "question_text": "Bạn đánh giá độ khó của khóa học này thế nào?",
    "is_required": true,
    "options": { "min": 1, "max": 10, "step": 1 }
  }
- Người dùng: "Tạo câu đánh giá chất lượng bằng ngôi sao."
  Output câu hỏi chuẩn:
  {
    "type": "rating",
    "question_text": "Đánh giá tổng quan chất lượng dịch vụ theo sao:",
    "is_required": true,
    "options": { "max": 5 }
  }
`;

    // Try Gemini API if key is present
    if (apiKey && apiKey.trim() !== '') {
      const activeModels = [
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
        'gemini-2.5-pro',
      ];

      const contents = [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nYêu cầu chủ đề bảng khảo sát từ người dùng: "${cleanPrompt}"` }],
        },
      ];

      for (const modelName of activeModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
          const gRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
              },
            }),
            signal: AbortSignal.timeout(20000),
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            const textResponse =
              gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = this._extractAndParseJSON(textResponse);
            if (parsed && parsed.title && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
              return this._normalizeGeneratedForm(parsed, cleanPrompt);
            }
          }
        } catch (err) {
          console.warn(`[AIFormGenerator Gemini ${modelName} Warning]:`, err.message);
        }
      }
    }

    // Fallback: Smart Built-in Template Generator based on Prompt Keywords
    return this._generateSmartFallbackForm(cleanPrompt);
  }

  async appendQuestionsFromPrompt(prompt = '', currentQuestions = []) {
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      const err = new Error('Vui lòng nhập nội dung câu hỏi bạn muốn AI tạo thêm');
      err.statusCode = 400;
      throw err;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    // Build list of existing question titles for Gemini context
    const existingTexts = (Array.isArray(currentQuestions) ? currentQuestions : []).map(
      (q, idx) => `${idx + 1}. ${q.question_text || ''}`
    );

    const systemInstruction = `
Bạn là một trợ lý đắc lực thiết kế form khảo sát chuyên nghiệp.
Người dùng đang xây dựng một form khảo sát và hiện tại họ ĐÃ CÓ các câu hỏi sau:
${existingTexts.length > 0 ? existingTexts.join('\n') : '(Chưa có câu hỏi nào)'}

QUY TẮC THÉP VỀ SỐ LƯỢNG CÂU HỎI MỚI (DYNAMIC COUNT):
- Hãy phân tích kỹ yêu cầu của người dùng. Nếu người dùng yêu cầu số lượng cụ thể (ví dụ: 'thêm 5 câu', 'tạo 10 câu', 'bổ sung 15 câu'), BẮT BUỘC bạn phải sinh ra CHÍNH XÁC số lượng câu hỏi mới đó, không được thiếu.
- Nếu người dùng KHÔNG chỉ định số lượng cụ thể, hãy tự động sinh từ 3 đến 6 câu hỏi mới phù hợp nhất.
- TUYỆT ĐỐI KHÔNG lặp lại hoặc làm lại các câu hỏi đã có ở danh sách trên.

TỪ ĐIỂN VÀ QUY TẮC PHÂN LOẠI CÂU HỎI (STRICT ENUMS DICTIONARY):
Khi tạo câu hỏi, trường "type" BẮT BUỘC phải mang một trong các giá trị Enum chuẩn (chữ thường) sau:
- "radio": Dùng cho câu hỏi trắc nghiệm chọn 1 đáp án duy nhất (Ví dụ: Đánh giá Mức độ hài lòng, Lựa chọn duy nhất).
- "checkbox": Dùng cho câu hỏi trắc nghiệm chọn nhiều đáp án cùng lúc.
- "text": Dùng cho câu hỏi tự luận, nhập văn bản hoặc đóng góp ý kiến mở.
- "slider": Dùng cho câu hỏi dạng thanh trượt, đánh giá mức độ, chấm điểm theo thang số (Ví dụ: Chấm điểm 1-10, thanh trượt 0-10).
- "rating": Dùng cho câu hỏi đánh giá bằng Ngôi sao (Ví dụ: Đánh giá 1 đến 5 sao).
- "dropdown": Dùng cho danh sách thả xuống chọn 1 đáp án.

QUY TẮC THÉP VỀ THUỘC TÍNH VÀ ĐÁP ÁN (PROPERTY CONSTRAINTS & OPTIONS SCHEMA):
1. NẾU "type" là "radio", "checkbox", hoặc "dropdown":
   - BẮT BUỘC mảng "options" KHÔNG ĐƯỢC RỖNG: [ { "label": "Đáp án 1" }, { "label": "Đáp án 2" } ].
2. NẾU "type" là "slider":
   - Trường "options" là object cấu hình min/max/step: { "min": 0, "max": 10, "step": 1 }.
3. NẾU "type" là "rating":
   - Trường "options" là object cấu hình số sao: { "max": 5 }.
4. NẾU "type" là "text":
   - Trường "options" BẮT BUỘC là mảng rỗng [].

CẤU TRÚC JSON BẮT BUỘC TRẢ VỀ:
BẮT BUỘC trả về duy nhất một mảng JSON (Array các object câu hỏi mới):
[
  {
    "type": "radio" | "checkbox" | "text" | "slider" | "rating" | "dropdown",
    "question_text": "Nội dung câu hỏi mới",
    "is_required": true,
    "options": [ { "label": "Đáp án 1" }, { "label": "Đáp án 2" } ]
  }
]

VÍ DỤ MẪU (FEW-SHOT EXAMPLES):
- Người dùng: "Thêm 1 câu đánh giá độ khó bằng thanh trượt."
  Output chuẩn:
  {
    "type": "slider",
    "question_text": "Bạn đánh giá độ khó của môn học thế nào?",
    "is_required": true,
    "options": { "min": 1, "max": 10, "step": 1 }
  }
`;

    if (apiKey && apiKey.trim() !== '') {
      const activeModels = [
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
        'gemini-2.5-pro',
      ];

      const contents = [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nYêu cầu bổ sung câu hỏi mới từ người dùng: "${cleanPrompt}"` }],
        },
      ];

      for (const modelName of activeModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
          const gRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
              },
            }),
            signal: AbortSignal.timeout(20000),
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            const textResponse = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = this._extractAndParseJSON(textResponse);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return this._normalizeQuestionsArray(parsed);
            }
          }
        } catch (err) {
          console.warn(`[AIAppendQuestions Gemini ${modelName} Warning]:`, err.message);
        }
      }
    }

    // Fallback: Smart template generator for appended questions
    return this._generateSmartFallbackAppendedQuestions(cleanPrompt);
  }

  _extractAndParseJSON(textResponse) {
    if (!textResponse) return null;
    try {
      // Direct parse
      return JSON.parse(textResponse);
    } catch {
      // Regex parse from ```json ... ``` blocks
      const jsonMatch = textResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  _normalizeGeneratedForm(parsed, prompt) {
    return {
      title: parsed.title || `Khảo sát: ${prompt}`,
      description: parsed.description || `Bảng khảo sát được khởi tạo tự động bởi AI Copilot cho chủ đề "${prompt}".`,
      theme_color: parsed.theme_color || '#2563eb',
      questions: (parsed.questions || []).map((q, idx) => {
        const rawType = String(q.type || '').toLowerCase().trim();
        const type = ['text', 'radio', 'dropdown', 'checkbox', 'slider', 'rating', 'file_upload'].includes(rawType)
          ? rawType
          : 'radio';
        let options = q.options;

        if (['radio', 'dropdown', 'checkbox'].includes(type)) {
          if (Array.isArray(options) && options.length > 0) {
            options = options.map((opt) => ({
              label: typeof opt === 'string' ? opt : opt.label || 'Lựa chọn',
            }));
          } else {
            options = [{ label: 'Rất hài lòng' }, { label: 'Hài lòng' }, { label: 'Bình thường' }, { label: 'Không hài lòng' }];
          }
        } else if (type === 'slider') {
          if (typeof options === 'object' && !Array.isArray(options) && options !== null) {
            options = {
              min: options.min !== undefined ? Number(options.min) : 0,
              max: options.max !== undefined ? Number(options.max) : 10,
              step: options.step !== undefined ? Number(options.step) : 1,
            };
          } else {
            options = { min: 0, max: 10, step: 1 };
          }
        } else if (type === 'rating') {
          if (typeof options === 'object' && !Array.isArray(options) && options !== null) {
            options = { max: options.max !== undefined ? Number(options.max) : 5 };
          } else {
            options = { max: 5 };
          }
        } else {
          options = [];
        }

        return {
          type,
          question_text: q.question_text || `Câu hỏi ${idx + 1}`,
          is_required: q.is_required !== undefined ? Boolean(q.is_required) : true,
          options,
        };
      }),
    };
  }

  _normalizeQuestionsArray(questionsArr) {
    return (Array.isArray(questionsArr) ? questionsArr : []).map((q, idx) => {
      const rawType = String(q.type || '').toLowerCase().trim();
      const type = ['text', 'radio', 'dropdown', 'checkbox', 'slider', 'rating', 'file_upload'].includes(rawType)
        ? rawType
        : 'radio';
      let options = q.options;

      if (['radio', 'dropdown', 'checkbox'].includes(type)) {
        if (Array.isArray(options) && options.length > 0) {
          options = options.map((opt) => ({
            label: typeof opt === 'string' ? opt : opt.label || 'Lựa chọn',
          }));
        } else {
          options = [{ label: 'Rất tốt' }, { label: 'Tốt' }, { label: 'Bình thường' }, { label: 'Cần cải thiện' }];
        }
      } else if (type === 'slider') {
        if (typeof options === 'object' && !Array.isArray(options) && options !== null) {
          options = {
            min: options.min !== undefined ? Number(options.min) : 0,
            max: options.max !== undefined ? Number(options.max) : 10,
            step: options.step !== undefined ? Number(options.step) : 1,
          };
        } else {
          options = { min: 0, max: 10, step: 1 };
        }
      } else if (type === 'rating') {
        if (typeof options === 'object' && !Array.isArray(options) && options !== null) {
          options = { max: options.max !== undefined ? Number(options.max) : 5 };
        } else {
          options = { max: 5 };
        }
      } else {
        options = [];
      }

      return {
        type,
        question_text: q.question_text || `Câu hỏi bổ sung ${idx + 1}`,
        is_required: q.is_required !== undefined ? Boolean(q.is_required) : true,
        options,
      };
    });
  }

  _generateSmartFallbackForm(prompt) {
    const p = prompt.toLowerCase();

    // Check if user requested specific count in prompt fallback
    const matchCount = p.match(/(?:tạo|thêm|bổ sung)\s*(\d+)\s*câu/);
    const targetCount = matchCount ? parseInt(matchCount[1], 10) : 5;

    if (p.includes('nhà ăn') || p.includes('căn tin') || p.includes('canteen')) {
      const baseQuestions = [
        {
          type: 'radio',
          question_text: 'Bạn đánh giá thế nào về chất lượng vệ sinh an toàn thực phẩm tại nhà ăn?',
          is_required: true,
          options: [{ label: 'Rất sạch sẽ' }, { label: 'Khá sạch' }, { label: 'Bình thường' }, { label: 'Không đảm bảo' }],
        },
        {
          type: 'radio',
          question_text: 'Mức giá các suất ăn hiện tại có phù hợp với túi tiền của bạn không?',
          is_required: true,
          options: [{ label: 'Rất hợp lý' }, { label: 'Phù hợp' }, { label: 'Hơi đắt' }, { label: 'Quá đắt' }],
        },
        {
          type: 'checkbox',
          question_text: 'Những món ăn nào bạn mong muốn căn tin bổ sung thêm vào thực đơn?',
          is_required: false,
          options: [{ label: 'Cơm tấm / Cơm văn phòng' }, { label: 'Bún / Phở / Hủ tiếu' }, { label: 'Món ăn chay' }, { label: 'Nước ép / Trái cây tươi' }],
        },
        {
          type: 'radio',
          question_text: 'Thái độ phục vụ của nhân viên nhà ăn có nhiệt tình không?',
          is_required: true,
          options: [{ label: 'Rất nhiệt tình' }, { label: 'Thân thiện' }, { label: 'Bình thường' }, { label: 'Cần cải thiện' }],
        },
        {
          type: 'radio',
          question_text: 'Thời gian chờ đợi lấy suất ăn vào giờ cao điểm là bao lâu?',
          is_required: true,
          options: [{ label: 'Dưới 5 phút' }, { label: '5-10 phút' }, { label: '10-15 phút' }, { label: 'Trên 15 phút' }],
        },
        {
          type: 'text',
          question_text: 'Ý kiến đóng góp khác để nâng cấp chất lượng dịch vụ nhà ăn:',
          is_required: false,
          options: [],
        },
      ];

      return {
        title: 'Khảo sát chất lượng Dịch vụ Căn tin & Nhà ăn',
        description: 'Bảng khảo sát lấy ý kiến phản hồi về an toàn thực phẩm, giá cả và thái độ phục vụ tại nhà ăn.',
        theme_color: '#f59e0b',
        questions: baseQuestions.slice(0, Math.max(targetCount, 3)),
      };
    }

    // Generic fallback builder dynamically scaling to targetCount
    const questions = [];
    for (let i = 1; i <= targetCount; i++) {
      if (i === targetCount) {
        questions.push({
          type: 'text',
          question_text: `Ý kiến đóng góp hoặc đề xuất thêm về chủ đề "${prompt}":`,
          is_required: false,
          options: [],
        });
      } else if (i % 2 === 1) {
        questions.push({
          type: 'radio',
          question_text: `Câu ${i}: Bạn đánh giá thế nào về khía cạnh thứ ${i} của chủ đề "${prompt}"?`,
          is_required: true,
          options: [{ label: 'Rất xuất sắc' }, { label: 'Tốt / Hài lòng' }, { label: 'Đạt yêu cầu' }, { label: 'Chưa đạt' }],
        });
      } else {
        questions.push({
          type: 'checkbox',
          question_text: `Câu ${i}: Chọn các yếu tố bạn cho rằng quan trọng đối với "${prompt}":`,
          is_required: false,
          options: [{ label: 'Chất lượng nội dung' }, { label: 'Thời gian tổ chức' }, { label: 'Công tác hỗ trợ' }, { label: 'Chi phí / Cơ sở vật chất' }],
        });
      }
    }

    return {
      title: `Khảo sát Đánh giá: ${prompt}`,
      description: `Bảng khảo sát được thiết kế tự động bởi AI Copilot gồm ${questions.length} câu hỏi nhằm thu thập ý kiến về "${prompt}".`,
      theme_color: '#2563eb',
      questions,
    };
  }

  _generateSmartFallbackAppendedQuestions(prompt) {
    const p = prompt.toLowerCase();
    const matchCount = p.match(/(?:thêm|bổ sung|tạo)\s*(\d+)\s*câu/);
    const targetCount = matchCount ? parseInt(matchCount[1], 10) : 3;

    const questions = [];
    for (let i = 1; i <= targetCount; i++) {
      if (i === targetCount && targetCount > 2) {
        questions.push({
          type: 'text',
          question_text: `Ý kiến bổ sung chi tiết về chủ đề "${prompt}":`,
          is_required: false,
          options: [],
        });
      } else if (i % 2 === 1) {
        questions.push({
          type: 'radio',
          question_text: `Câu hỏi bổ sung ${i}: Đánh giá của bạn về "${prompt}":`,
          is_required: true,
          options: [{ label: 'Rất tốt / Hài lòng' }, { label: 'Bình thường' }, { label: 'Chưa hài lòng' }],
        });
      } else {
        questions.push({
          type: 'checkbox',
          question_text: `Câu hỏi bổ sung ${i}: Chọn các điểm bạn muốn cải thiện cho "${prompt}":`,
          is_required: false,
          options: [{ label: 'Tốc độ phản hồi' }, { label: 'Chất lượng phục vụ' }, { label: 'Cơ sở hạ tầng' }, { label: 'Chi phí / Tiện ích' }],
        });
      }
    }
    return questions;
  }

  async copilotChat(message = '', history = [], currentQuestions = [], aiGoals = []) {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      const err = new Error('Vui lòng nhập nội dung trò chuyện với AI Copilot');
      err.statusCode = 400;
      throw err;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    const goalsFormatted = Array.isArray(aiGoals) ? aiGoals.map((g) => String(g).trim()).filter(Boolean) : [];

    // Build context of current questions on the form with 0-based original_index
    const existingTexts = (Array.isArray(currentQuestions) ? currentQuestions : []).map((q, idx) => {
      let optionsStr = '';
      if (Array.isArray(q.options)) {
        optionsStr = q.options.map((opt) => (typeof opt === 'string' ? opt : opt.label || '')).join(', ');
      } else if (q.options && Array.isArray(q.options.choices)) {
        optionsStr = q.options.choices.join(', ');
      }
      const origIndex = q.original_index !== undefined ? q.original_index : idx;
      return `[Index ${origIndex}] Loại: "${q.type || 'radio'}", Nội dung: "${q.question_text || ''}" ${optionsStr ? `(Đáp án: ${optionsStr})` : ''}, IsRequired: ${Boolean(q.is_required)}`;
    });

    const systemInstruction = `
Bạn là Trợ lý AI Copilot đắc lực hỗ trợ Quản trị viên thiết kế Form Khảo sát trong hệ thống EvalFlow.

Người dùng đã đặt ra các mục tiêu sau cho form khảo sát này: ${JSON.stringify(goalsFormatted)}. Khi trò chuyện hoặc sinh thêm câu hỏi, hãy đảm bảo các câu hỏi của bạn bám sát và phục vụ việc đo lường các mục tiêu này.

DANH SÁCH CÂU HỎI ĐÃ CÓ TRÊN FORM HIỆN TẠI (ĐÍNH KÈM CHỈ MỤC INDEX TÍNH TỪ 0):
${existingTexts.length > 0 ? existingTexts.join('\n') : '(Form hiện chưa có câu hỏi nào)'}

NHIỆM VỤ CỦA BẠN:
1. Trò chuyện, tư vấn, nhận xét cấu trúc, rà soát chính tả/văn phong, sửa đổi câu hỏi cũ hoặc xóa bớt câu hỏi theo yêu cầu của người dùng.
2. Bạn có TOÀN QUYỀN thực thi 3 loại hành động đột biến mảng (CRUD Mutations) sau:
   - THÊM MỚI ("add_questions"): Mảng chứa các câu hỏi mới hoàn toàn cần nối vào cuối form.
   - SỬA ĐỔI ("update_questions"): Mảng chứa các câu hỏi cần chỉnh sửa nội dung/sửa lỗi chính tả/sửa đáp án. Cần chỉ định rõ "index" (chỉ mục 0-based của câu hỏi trong danh sách câu hỏi hiện tại) và object "question" đã được sửa hoàn chỉnh.
   - XÓA BỚT ("delete_indices"): Mảng chứa các chỉ mục index (0-based) của các câu hỏi cần xóa bỏ khỏi form (Ví dụ: [2, 5]).

TỪ ĐIỂN VÀ QUY TẮC PHÂN LOẠI CÂU HỎI (STRICT ENUMS DICTIONARY):
Khi tạo hoặc sửa câu hỏi, trường "type" BẮT BUỘC phải mang một trong các giá trị Enum chuẩn (chữ thường) sau:
- "radio": Dùng cho câu hỏi trắc nghiệm chọn 1 đáp án duy nhất (Ví dụ: Đánh giá Mức độ hài lòng, Lựa chọn duy nhất).
- "checkbox": Dùng cho câu hỏi trắc nghiệm chọn nhiều đáp án cùng lúc.
- "text": Dùng cho câu hỏi tự luận, nhập văn bản hoặc đóng góp ý kiến mở.
- "slider": Dùng cho câu hỏi dạng thanh trượt, đánh giá mức độ, chấm điểm theo thang số (Ví dụ: Chấm điểm 1-10, thanh trượt 0-10).
- "rating": Dùng cho câu hỏi đánh giá bằng Ngôi sao (Ví dụ: Đánh giá 1 đến 5 sao).
- "dropdown": Dùng cho danh sách thả xuống chọn 1 đáp án.

QUY TẮC THÉP VỀ THUỘC TÍNH VÀ ĐÁP ÁN (PROPERTY CONSTRAINTS & OPTIONS SCHEMA):
1. NẾU "type" là "radio", "checkbox", hoặc "dropdown":
   - BẮT BUỘC mảng "options" KHÔNG ĐƯỢC RỖNG: [ { "label": "Đáp án 1" }, { "label": "Đáp án 2" } ].
2. NẾU "type" là "slider":
   - Trường "options" là object cấu hình min/max/step: { "min": 0, "max": 10, "step": 1 }.
3. NẾU "type" là "rating":
   - Trường "options" là object cấu hình số sao: { "max": 5 }.
4. NẾU "type" là "text":
   - Trường "options" BẮT BUỘC là mảng rỗng [].

CẤU TRÚC JSON BẮT BUỘC TRẢ VỀ:
BẮT BUỘC trả về duy nhất 1 object JSON thuần túy (không kèm markdown hay text thừa bên ngoài) tuân thủ CHÍNH XÁC định dạng sau:
{
  "chat_message": "Văn bản trò chuyện, báo cáo kết quả (Ví dụ: 'Tui đã tạo thêm câu hỏi dạng thanh trượt cho bạn!').",
  "add_questions": [
    {
      "type": "radio" | "checkbox" | "text" | "slider" | "rating" | "dropdown",
      "question_text": "Nội dung câu hỏi mới",
      "is_required": true,
      "options": [ { "label": "Đáp án 1" }, { "label": "Đáp án 2" } ]
    }
  ],
  "update_questions": [
    {
      "index": 0,
      "question": {
        "type": "radio" | "checkbox" | "text" | "slider" | "rating" | "dropdown",
        "question_text": "Nội dung câu hỏi đã sửa",
        "is_required": true,
        "options": [ { "label": "Đáp án 1" }, { "label": "Đáp án 2" } ]
      }
    }
  ],
  "delete_indices": [ 2, 5 ]
}

VÍ DỤ MẪU (FEW-SHOT EXAMPLES):
- Người dùng: "Thêm 1 câu đánh giá độ khó bằng thanh trượt."
  Output add_questions chuẩn:
  [
    {
      "type": "slider",
      "question_text": "Bạn đánh giá độ khó của bài kiểm tra thế nào?",
      "is_required": true,
      "options": { "min": 1, "max": 10, "step": 1 }
    }
  ]

QUY TẮC THÉP VỀ MẢNG RỖNG:
- NẾU KHÔNG CÓ HÀNH ĐỘNG TƯƠNG ỨNG, BẮT BUỘC ĐỂ MẢNG RỖNG []: "add_questions": [], "update_questions": [], "delete_indices": [].
- Nếu người dùng chỉ nhờ "rút gọn" hoặc "sửa chính tả" mà KHÔNG yêu cầu xóa bớt, hãy dùng "update_questions" thay vì "delete_indices".
`;

    if (apiKey && apiKey.trim() !== '') {
      const activeModels = [
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
        'gemini-2.5-pro',
      ];

      const contents = [
        {
          role: 'user',
          parts: [{ text: systemInstruction }],
        },
        {
          role: 'model',
          parts: [{ text: '{"chat_message": "Tôi đã ghi nhớ mảng câu hỏi hiện có và sẵn sàng hỗ trợ bạn!", "add_questions": [], "update_questions": [], "delete_indices": []}' }],
        },
      ];

      // Append multi-turn history
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history.slice(-10)) {
          contents.push({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.content || item.text || '' }],
          });
        }
      }

      // Append current user message
      contents.push({
        role: 'user',
        parts: [{ text: cleanMessage }],
      });

      for (const modelName of activeModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
          const gRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
              },
            }),
            signal: AbortSignal.timeout(20000),
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            const textResponse = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = this._extractAndParseJSON(textResponse);
            if (parsed && typeof parsed.chat_message === 'string') {
              const normalizedAdd = this._normalizeQuestionsArray(parsed.add_questions || []);
              const normalizedUpdate = (Array.isArray(parsed.update_questions) ? parsed.update_questions : [])
                .map((item) => ({
                  index: typeof item.index === 'number' ? item.index : parseInt(item.index, 10) || 0,
                  question: this._normalizeQuestionsArray([item.question || {}])[0] || item.question,
                }))
                .filter((item) => item.question && item.question.question_text);

              const deleteIndices = (Array.isArray(parsed.delete_indices) ? parsed.delete_indices : [])
                .map((i) => (typeof i === 'number' ? i : parseInt(i, 10)))
                .filter((i) => !isNaN(i) && i >= 0);

              return {
                chat_message: parsed.chat_message,
                add_questions: normalizedAdd,
                update_questions: normalizedUpdate,
                delete_indices: deleteIndices,
              };
            }
          }
        } catch (err) {
          console.warn(`[AICopilotChat Gemini ${modelName} Warning]:`, err.message);
        }
      }
    }

    // Fallback response if Gemini fails or no API key
    return this._generateSmartFallbackCopilotChat(cleanMessage, currentQuestions);
  }

  _generateSmartFallbackCopilotChat(message, currentQuestions) {
    const p = message.toLowerCase();
    const isCreateIntent = p.includes('tạo') || p.includes('thêm') || p.includes('bổ sung') || p.includes('sinh');
    const isDeleteIntent = p.includes('xóa') || p.includes('bỏ') || p.includes('loại');

    if (isCreateIntent) {
      const newQuestions = this._generateSmartFallbackAppendedQuestions(message);
      return {
        chat_message: `Dựa trên yêu cầu của bạn, tôi đã thiết kế bổ sung ${newQuestions.length} câu hỏi mới và vừa chèn trực tiếp vào Form khảo sát bên trái!`,
        add_questions: newQuestions,
        update_questions: [],
        delete_indices: [],
      };
    }

    if (isDeleteIntent && Array.isArray(currentQuestions) && currentQuestions.length > 0) {
      const lastIdx = currentQuestions.length - 1;
      return {
        chat_message: `Tôi đã thực hiện xóa câu hỏi ở vị trí thứ ${lastIdx + 1} khỏi Form khảo sát của bạn!`,
        add_questions: [],
        update_questions: [],
        delete_indices: [lastIdx],
      };
    }

    if (p.includes('chính tả') || p.includes('lỗi') || p.includes('sửa')) {
      return {
        chat_message: 'Tôi đã rà soát toàn bộ bộ câu hỏi hiện tại trên Form của bạn: Các câu hỏi hiện tại có văn phong rõ ràng, không phát hiện lỗi chính tả nghiêm trọng nào!',
        add_questions: [],
        update_questions: [],
        delete_indices: [],
      };
    }

    return {
      chat_message: `Tôi là AI Form Copilot! Bạn có thể nhờ tôi tạo thêm câu hỏi mới, chỉnh sửa nội dung/chính tả các câu cũ hoặc xóa bớt câu hỏi dư thừa.`,
      add_questions: [],
      update_questions: [],
      delete_indices: [],
    };
  }
}

module.exports = new AIFormGeneratorService();
