const pool = require('../config/db');

class QuestionsService {
  async getQuestionsBySurveyId(surveyId) {
    const parsedId = parseInt(surveyId, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID survey không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT id, survey_id, question_text, type, is_required, order_index, options
      FROM questions
      WHERE survey_id = $1
      ORDER BY order_index ASC, id ASC
    `;
    const result = await pool.query(query, [parsedId]);
    return result.rows.map((row) => this._mapRow(row));
  }

  async getQuestionById(id) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID câu hỏi không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT id, survey_id, question_text, type, is_required, order_index, options
      FROM questions
      WHERE id = $1
    `;
    const result = await pool.query(query, [parsedId]);
    if (result.rows.length === 0) {
      const err = new Error('Không tìm thấy câu hỏi');
      err.statusCode = 404;
      throw err;
    }
    return this._mapRow(result.rows[0]);
  }



  async createQuestion(surveyId, payload) {
    const parsedSurveyId = parseInt(surveyId, 10);
    if (!Number.isFinite(parsedSurveyId) || parsedSurveyId <= 0) {
      const err = new Error('ID survey không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const surveyCheck = await pool.query('SELECT id FROM surveys WHERE id = $1', [parsedSurveyId]);
    if (surveyCheck.rows.length === 0) {
      const err = new Error('Survey không tồn tại');
      err.statusCode = 404;
      throw err;
    }

    // POST create question: responses count check is skipped for create
    const norm = this._validateAndNormalize(payload, true);

    const query = `
      INSERT INTO questions (survey_id, question_text, type, is_required, order_index, options)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id, survey_id, question_text, type, is_required, order_index, options
    `;
    const values = [
      parsedSurveyId,
      norm.question_text,
      norm.type,
      norm.is_required,
      norm.order_index,
      norm.options,
    ];
    const result = await pool.query(query, values);
    return this._mapRow(result.rows[0]);
  }

  async updateQuestion(id, payload) {
    const existing = await this.getQuestionById(id);

    const norm = this._validateAndNormalize(payload, false);

    const question_text = norm.question_text !== undefined ? norm.question_text : existing.question_text;
    const type = norm.type !== undefined ? norm.type : existing.type;
    const is_required = norm.is_required !== undefined ? norm.is_required : existing.is_required;
    const order_index = norm.order_index !== undefined ? norm.order_index : existing.order_index;
    const options = norm.options !== undefined ? norm.options : JSON.stringify(existing.options);

    const query = `
      UPDATE questions
      SET question_text = $1,
          type = $2,
          is_required = $3,
          order_index = $4,
          options = $5::jsonb
      WHERE id = $6
      RETURNING id, survey_id, question_text, type, is_required, order_index, options
    `;
    const result = await pool.query(query, [
      question_text,
      type,
      is_required,
      order_index,
      options,
      existing.id,
    ]);
    return this._mapRow(result.rows[0]);
  }

  async deleteQuestion(id) {
    const existing = await this.getQuestionById(id);

    await pool.query('DELETE FROM questions WHERE id = $1', [existing.id]);
    return { deleted: true, id: existing.id };
  }

  async replaceQuestionsBatch(surveyId, questionsArray) {
    const parsedSurveyId = parseInt(surveyId, 10);
    if (!Number.isFinite(parsedSurveyId) || parsedSurveyId <= 0) {
      const err = new Error('ID survey không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (!Array.isArray(questionsArray)) {
      const err = new Error('Danh sách câu hỏi phải là một mảng');
      err.statusCode = 400;
      throw err;
    }

    const surveyCheck = await pool.query('SELECT id FROM surveys WHERE id = $1', [parsedSurveyId]);
    if (surveyCheck.rows.length === 0) {
      const err = new Error('Survey không tồn tại');
      err.statusCode = 404;
      throw err;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM questions WHERE survey_id = $1', [parsedSurveyId]);

      const inserted = [];
      for (let i = 0; i < questionsArray.length; i++) {
        const item = questionsArray[i];
        const norm = this._validateAndNormalize({ ...item, order_index: item.order_index ?? i + 1 }, true);

        const insertQuery = `
          INSERT INTO questions (survey_id, question_text, type, is_required, order_index, options)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          RETURNING id, survey_id, question_text, type, is_required, order_index, options
        `;
        const res = await client.query(insertQuery, [
          parsedSurveyId,
          norm.question_text,
          norm.type,
          norm.is_required,
          norm.order_index,
          norm.options,
        ]);
        inserted.push(this._mapRow(res.rows[0]));
      }

      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  _validateAndNormalize(payload, isCreate) {
    const result = {};

    if (payload.question_text !== undefined) {
      if (typeof payload.question_text !== 'string' || payload.question_text.trim() === '') {
        const err = new Error('Nội dung câu hỏi (question_text) không được để trống');
        err.statusCode = 400;
        throw err;
      }
      result.question_text = payload.question_text.trim();
    } else if (isCreate) {
      const err = new Error('Thiếu nội dung câu hỏi (question_text)');
      err.statusCode = 400;
      throw err;
    }

    const validTypes = [
      'text', 'radio', 'checkbox', 'dropdown', 'slider', 'rating', 'file_upload', 'matrix',
      'short_answer', 'paragraph', 'multiple_choice_grid', 'checkbox_grid', 'date', 'time', 'datetime', 'section_header'
    ];
    if (payload.type !== undefined) {
      if (!validTypes.includes(payload.type)) {
        const err = new Error(`Kiểu câu hỏi không hợp lệ (${validTypes.join(', ')})`);
        err.statusCode = 400;
        throw err;
      }
      result.type = payload.type;
    } else if (isCreate) {
      result.type = 'text';
    }

    if (payload.is_required !== undefined) {
      result.is_required = Boolean(payload.is_required);
    } else if (isCreate) {
      result.is_required = true;
    }

    if (payload.order_index !== undefined) {
      const ord = parseInt(payload.order_index, 10);
      if (!Number.isFinite(ord)) {
        const err = new Error('order_index phải là số nguyên');
        err.statusCode = 400;
        throw err;
      }
      result.order_index = ord;
    } else if (isCreate) {
      result.order_index = 1;
    }

    if (payload.options !== undefined) {
      const opt = payload.options;
      if (opt === null || opt === undefined || opt === '') {
        result.options = '{}';
      } else if (typeof opt === 'string') {
        try {
          JSON.parse(opt);
          result.options = opt;
        } catch {
          const err = new Error('options phải là chuỗi JSON hợp lệ');
          err.statusCode = 400;
          throw err;
        }
      } else if (typeof opt === 'object') {
        result.options = JSON.stringify(opt);
      } else {
        const err = new Error('options phải là object hoặc chuỗi JSON');
        err.statusCode = 400;
        throw err;
      }
    } else if (isCreate) {
      result.options = '{}';
    }

    return result;
  }

  _mapRow(row) {
    let options = {};
    try {
      if (typeof row.options === 'string') options = JSON.parse(row.options);
      else if (row.options && typeof row.options === 'object') options = row.options;
    } catch {
      options = {};
    }
    return {
      id: row.id,
      survey_id: row.survey_id,
      question_text: row.question_text,
      type: row.type,
      is_required: row.is_required,
      order_index: row.order_index,
      options,
    };
  }
}

module.exports = new QuestionsService();
