const pool = require('../config/db');

class SurveysService {
  async listSurveys({ page = 1, limit = 10, search = '', sort = 'newest', fromDate = '', toDate = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = ['s.deleted_at IS NULL'];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`s.title ILIKE $${params.length}`);
    }

    if (fromDate && fromDate.trim()) {
      params.push(`${fromDate.trim()} 00:00:00`);
      whereClauses.push(`s.created_at >= $${params.length}`);
    }

    if (toDate && toDate.trim()) {
      params.push(`${toDate.trim()} 23:59:59`);
      whereClauses.push(`s.created_at <= $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM surveys s
      ${whereSql}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total, 10) || 0;

    const sortOrder = sort === 'oldest' ? 'ASC' : 'DESC';

    const dataParams = [...params, limitNum, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const dataQuery = `
      SELECT
        s.id,
        s.title,
        s.description,
        s.theme_config,
        s.version,
        s.ai_goals,
        s.created_by,
        s.created_at,
        u.full_name AS created_by_name,
        u.email AS created_by_email
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      ${whereSql}
      ORDER BY s.created_at ${sortOrder}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;
    const dataResult = await pool.query(dataQuery, dataParams);
    const totalPages = Math.ceil(totalRecords / limitNum) || 1;

    return {
      data: dataResult.rows.map((row) => this._mapRow(row)),
      meta: {
        totalRecords,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
      },
    };
  }

  async getSurveyById(id) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID survey không hợp lệ');
      err.name = 'ValidationError';
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT
        s.id,
        s.title,
        s.description,
        s.theme_config,
        s.version,
        s.ai_goals,
        s.created_by,
        s.created_at,
        u.full_name AS created_by_name,
        u.email AS created_by_email,
        (
          SELECT COUNT(*)::int
          FROM responses r
          JOIN survey_campaigns sc ON r.campaign_id = sc.id
          WHERE sc.survey_id = s.id
        ) AS response_count
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `;
    const result = await pool.query(query, [parsedId]);
    if (result.rows.length === 0) {
      const err = new Error('Không tìm thấy survey');
      err.name = 'NotFoundError';
      err.statusCode = 404;
      throw err;
    }
    return this._mapRow(result.rows[0]);
  }

  async createSurvey(payload) {
    const { title, description, theme_config, created_by, ai_goals } = this._validateAndNormalize(payload, true);

    const query = `
      INSERT INTO surveys (title, description, theme_config, created_by, ai_goals)
      VALUES ($1, $2, $3::jsonb, $4, $5::jsonb)
      RETURNING id, title, description, theme_config, created_by, created_at, ai_goals
    `;
    const values = [title, description ?? null, theme_config ?? '{}', created_by, ai_goals ?? '[]'];
    const result = await pool.query(query, values);
    return this.getSurveyById(result.rows[0].id);
  }

  async updateSurvey(id, payload) {
    const existing = await this.getSurveyById(id);
    const parsed = this._validateAndNormalize(payload, false);

    const title = parsed.title !== undefined ? parsed.title : existing.title;
    const description =
      parsed.description !== undefined
        ? parsed.description
        : existing.description;
    const theme_config =
      parsed.theme_config !== undefined
        ? parsed.theme_config
        : JSON.stringify(existing.theme_config || {});
    const ai_goals =
      parsed.ai_goals !== undefined
        ? parsed.ai_goals
        : JSON.stringify(existing.ai_goals || []);

    const reqVersion = payload.version !== undefined && payload.version !== null
      ? parseInt(payload.version, 10)
      : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let updateQuery;
      let values;

      if (Number.isFinite(reqVersion)) {
        updateQuery = `
          UPDATE surveys
          SET title = $1,
              description = $2,
              theme_config = $3::jsonb,
              ai_goals = $4::jsonb,
              version = version + 1
          WHERE id = $5 AND version = $6
          RETURNING id, version
        `;
        values = [title, description, theme_config, ai_goals, existing.id, reqVersion];
      } else {
        updateQuery = `
          UPDATE surveys
          SET title = $1,
              description = $2,
              theme_config = $3::jsonb,
              ai_goals = $4::jsonb,
              version = version + 1
          WHERE id = $5
          RETURNING id, version
        `;
        values = [title, description, theme_config, ai_goals, existing.id];
      }

      const result = await client.query(updateQuery, values);

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        const err = new Error('Dữ liệu đã bị thay đổi bởi một Quản trị viên khác trong lúc bạn đang soạn thảo.');
        err.statusCode = 409;
        err.name = 'ConflictError';
        throw err;
      }

      await client.query('COMMIT');
      return this.getSurveyById(existing.id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listTrashSurveys({ page = 1, limit = 10, search = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = ['s.deleted_at IS NOT NULL'];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`s.title ILIKE $${params.length}`);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const countQuery = `SELECT COUNT(*) AS total FROM surveys s ${whereSql}`;
    const countResult = await pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total, 10) || 0;

    const dataParams = [...params, limitNum, offset];
    const dataQuery = `
      SELECT
        s.id,
        s.title,
        s.description,
        s.theme_config,
        s.created_by,
        s.created_at,
        s.deleted_at,
        u.full_name AS created_by_name,
        u.email AS created_by_email
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      ${whereSql}
      ORDER BY s.deleted_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataResult = await pool.query(dataQuery, dataParams);
    return {
      surveys: dataResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
      },
    };
  }

  async deleteSurvey(id) {
    const existing = await this.getSurveyById(id);
    await pool.query('UPDATE surveys SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [existing.id]);
    return { deleted: true, id: existing.id };
  }

  async restoreSurvey(id) {
    const checkRes = await pool.query('SELECT id FROM surveys WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Không tìm thấy Mẫu Form cần khôi phục');
      err.statusCode = 404;
      throw err;
    }
    await pool.query('UPDATE surveys SET deleted_at = NULL WHERE id = $1', [id]);
    return { restored: true, id };
  }

  async forceDeleteSurvey(id) {
    const checkRes = await pool.query('SELECT id FROM surveys WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Không tìm thấy Mẫu Form cần xóa vĩnh viễn');
      err.statusCode = 404;
      throw err;
    }

    const campaignCheck = await pool.query('SELECT id FROM survey_campaigns WHERE survey_id = $1 AND deleted_at IS NULL', [id]);
    if (campaignCheck.rows.length > 0) {
      const err = new Error('Không thể xóa vĩnh viễn Mẫu Form đang được sử dụng bởi các Form khảo sát đang hoạt động');
      err.statusCode = 400;
      throw err;
    }

    await pool.query('DELETE FROM surveys WHERE id = $1', [id]);
    return { force_deleted: true, id };
  }

  _validateAndNormalize(payload, isCreate) {
    const result = {};

    if (payload.title !== undefined) {
      if (typeof payload.title !== 'string' || payload.title.trim().length === 0) {
        const err = new Error('Trường tên Form (title) là bắt buộc');
        err.name = 'ValidationError';
        err.statusCode = 400;
        throw err;
      }
      if (payload.title.length > 255) {
        const err = new Error('Tên Form không được vượt quá 255 ký tự');
        err.name = 'ValidationError';
        err.statusCode = 400;
        throw err;
      }
      result.title = payload.title.trim();
    } else if (isCreate) {
      const err = new Error('Thiếu trường title (tên Form)');
      err.name = 'ValidationError';
      err.statusCode = 400;
      throw err;
    }

    if (payload.description !== undefined) {
      result.description =
        payload.description === null ? null : String(payload.description);
    }

    if (payload.theme_config !== undefined) {
      const tc = payload.theme_config;
      if (tc === null || tc === undefined || tc === '') {
        result.theme_config = '{}';
      } else if (typeof tc === 'string') {
        try {
          JSON.parse(tc);
          result.theme_config = tc;
        } catch {
          const err = new Error('theme_config phải là chuỗi JSON hợp lệ');
          err.name = 'ValidationError';
          err.statusCode = 400;
          throw err;
        }
      } else if (typeof tc === 'object') {
        result.theme_config = JSON.stringify(tc);
      } else {
        const err = new Error('theme_config phải là object hoặc chuỗi JSON');
        err.name = 'ValidationError';
        err.statusCode = 400;
        throw err;
      }
    }

    if (isCreate) {
      if (payload.created_by === undefined || payload.created_by === null) {
        const err = new Error('Thiếu trường created_by (người tạo)');
        err.name = 'ValidationError';
        err.statusCode = 400;
        throw err;
      }
      const cb = parseInt(payload.created_by, 10);
      if (!Number.isFinite(cb) || cb <= 0) {
        const err = new Error('created_by phải là số nguyên dương');
        err.name = 'ValidationError';
        err.statusCode = 400;
        throw err;
      }
      result.created_by = cb;
    }

    if (payload.ai_goals !== undefined) {
      if (Array.isArray(payload.ai_goals)) {
        result.ai_goals = JSON.stringify(payload.ai_goals.map((g) => String(g).trim()).filter(Boolean));
      } else if (typeof payload.ai_goals === 'string') {
        try {
          const parsed = JSON.parse(payload.ai_goals);
          result.ai_goals = JSON.stringify(Array.isArray(parsed) ? parsed.map((g) => String(g).trim()).filter(Boolean) : []);
        } catch {
          result.ai_goals = '[]';
        }
      } else {
        result.ai_goals = '[]';
      }
    }

    return result;
  }

  _mapRow(row) {
    let themeConfig = {};
    try {
      if (typeof row.theme_config === 'string') themeConfig = JSON.parse(row.theme_config);
      else if (row.theme_config && typeof row.theme_config === 'object') themeConfig = row.theme_config;
    } catch {
      themeConfig = {};
    }
    let aiGoals = [];
    try {
      if (Array.isArray(row.ai_goals)) aiGoals = row.ai_goals;
      else if (typeof row.ai_goals === 'string') aiGoals = JSON.parse(row.ai_goals);
    } catch {
      aiGoals = [];
    }
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      theme_config: themeConfig,
      ai_goals: aiGoals,
      version: parseInt(row.version, 10) || 1,
      response_count: parseInt(row.response_count || 0, 10),
      created_by: row.created_by,
      created_by_name: row.created_by_name ?? null,
      created_by_email: row.created_by_email ?? null,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    };
  }
}

module.exports = new SurveysService();
