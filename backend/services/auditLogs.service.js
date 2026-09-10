const pool = require('../config/db');

class AuditLogsService {
  /**
   * Log an audit event into audit_logs table
   */
  async createAuditLog({ user_id = null, action, entity_type, entity_id = null, details = {}, ip_address = '' }) {
    try {
      const cleanAction = String(action || 'UNKNOWN').toUpperCase().trim();
      const cleanEntityType = String(entity_type || 'SYSTEM').toUpperCase().trim();
      const cleanEntityId = entity_id !== null && entity_id !== undefined ? String(entity_id) : null;
      const parsedUserId = user_id ? parseInt(user_id, 10) || null : null;
      const jsonDetails = typeof details === 'object' ? JSON.stringify(details) : JSON.stringify({ summary: String(details) });

      const query = `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, user_id, action, entity_type, entity_id, details, ip_address, created_at
      `;
      const res = await pool.query(query, [
        parsedUserId,
        cleanAction,
        cleanEntityType,
        cleanEntityId,
        jsonDetails,
        ip_address || '',
      ]);
      return res.rows[0];
    } catch (err) {
      console.error('[AuditLogsService.createAuditLog Error]:', err.message);
      // Non-blocking: Do not crash application if logging fails
      return null;
    }
  }

  /**
   * Fetch paginated audit logs with JOIN to users
   */
  async getAuditLogs({ page = 1, limit = 20, action = '', user_id = '', entity_type = '', search = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = [];
    const queryParams = [];

    if (action && action.trim() !== '' && action.toUpperCase() !== 'ALL') {
      queryParams.push(action.trim().toUpperCase());
      whereClauses.push(`a.action = $${queryParams.length}`);
    }

    if (entity_type && entity_type.trim() !== '' && entity_type.toUpperCase() !== 'ALL') {
      queryParams.push(entity_type.trim().toUpperCase());
      whereClauses.push(`a.entity_type = $${queryParams.length}`);
    }

    if (user_id && user_id !== 'ALL') {
      const parsedUid = parseInt(user_id, 10);
      if (Number.isFinite(parsedUid)) {
        queryParams.push(parsedUid);
        whereClauses.push(`a.user_id = $${queryParams.length}`);
      }
    }

    if (search && search.trim() !== '') {
      queryParams.push(`%${search.trim()}%`);
      const pIdx = queryParams.length;
      whereClauses.push(`(u.full_name ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR a.entity_id ILIKE $${pIdx} OR a.details::text ILIKE $${pIdx})`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*)
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereSQL}
    `;
    const countRes = await pool.query(countQuery, queryParams);
    const total = parseInt(countRes.rows[0].count, 10) || 0;

    // Data query JOINing users and roles
    const dataParams = [...queryParams, limitNum, offset];
    const dataQuery = `
      SELECT
        a.id,
        a.user_id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.ip_address,
        a.created_at,
        u.full_name AS user_name,
        u.email AS user_email,
        r.role_name AS user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereSQL}
      ORDER BY a.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const dataRes = await pool.query(dataQuery, dataParams);

    return {
      logs: dataRes.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        user_name: row.user_name || 'Hệ thống / Guest',
        user_email: row.user_email || 'n/a',
        user_role: row.user_role || 'Visitor',
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        details: row.details,
        ip_address: row.ip_address,
        created_at: row.created_at,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }
}

module.exports = new AuditLogsService();
