const bcrypt = require('bcrypt');
const pool = require('../config/db');

class UsersService {
  async getRolesList() {
    const query = `
      SELECT id, role_name
      FROM roles
      WHERE LOWER(role_name) != 'guest'
      ORDER BY id ASC
    `;
    const res = await pool.query(query);
    return res.rows.map((row) => row.role_name);
  }

  // Get or create role_id by role_name
  async _getOrCreateRoleId(roleName = 'Sinh viên') {
    const cleanRole = (roleName || 'Sinh viên').trim();
    const selectQuery = 'SELECT id FROM roles WHERE LOWER(role_name) = LOWER($1)';
    const selectRes = await pool.query(selectQuery, [cleanRole]);
    if (selectRes.rows.length > 0) {
      return selectRes.rows[0].id;
    }

    const insertQuery = 'INSERT INTO roles (role_name) VALUES ($1) RETURNING id';
    const insertRes = await pool.query(insertQuery, [cleanRole]);
    return insertRes.rows[0].id;
  }

  async getUsersList({ page = 1, limit = 10, search = '', role = '' }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.department ILIKE $${params.length})`);
    }

    if (role && role.trim() !== '') {
      params.push(role.trim());
      conditions.push(`r.role_name ILIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
    `;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const dataParams = [...params, limitNum, offset];
    const dataQuery = `
      SELECT u.id, u.role_id, u.full_name, u.email, u.department, COALESCE(u.is_locked, false) AS is_locked, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY u.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataRes = await pool.query(dataQuery, dataParams);

    return {
      users: dataRes.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  async createUser({ full_name, email, role_name, department, password }) {
    if (!full_name || !email) {
      const err = new Error('Họ tên và Email là bắt buộc');
      err.statusCode = 400;
      throw err;
    }

    const checkRes = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (checkRes.rows.length > 0) {
      const err = new Error('Email này đã được sử dụng trong hệ thống');
      err.statusCode = 400;
      throw err;
    }

    const roleId = await this._getOrCreateRoleId(role_name);
    const plainPassword = password || '123123';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const insertQuery = `
      INSERT INTO users (role_id, full_name, email, password_hash, department)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, role_id, full_name, email, department
    `;
    const insertRes = await pool.query(insertQuery, [
      roleId,
      full_name.trim(),
      email.trim(),
      passwordHash,
      department ? department.trim() : null,
    ]);

    return {
      ...insertRes.rows[0],
      role_name: role_name || 'Sinh viên',
    };
  }

  async updateUser(id, { full_name, email, role_name, department }) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID người dùng không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const checkRes = await pool.query('SELECT id FROM users WHERE id = $1', [parsedId]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng cần cập nhật');
      err.statusCode = 404;
      throw err;
    }

    if (email) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [email.trim(), parsedId]);
      if (emailCheck.rows.length > 0) {
        const err = new Error('Email này đã thuộc về người dùng khác');
        err.statusCode = 400;
        throw err;
      }
    }

    const roleId = await this._getOrCreateRoleId(role_name);

    const updateQuery = `
      UPDATE users
      SET full_name = COALESCE($1, full_name),
          email = COALESCE($2, email),
          role_id = COALESCE($3, role_id),
          department = COALESCE($4, department)
      WHERE id = $5
      RETURNING id, role_id, full_name, email, department
    `;
    const updateRes = await pool.query(updateQuery, [
      full_name ? full_name.trim() : null,
      email ? email.trim() : null,
      roleId,
      department !== undefined ? (department ? department.trim() : null) : null,
      parsedId,
    ]);

    return {
      ...updateRes.rows[0],
      role_name: role_name || 'Sinh viên',
    };
  }

  async deleteUser(id, currentUserId) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID người dùng không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (currentUserId && parseInt(parsedId, 10) === parseInt(currentUserId, 10)) {
      const err = new Error('Bạn không thể tự xóa tài khoản của chính mình!');
      err.statusCode = 400;
      throw err;
    }

    const res = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [parsedId]);
    if (res.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng cần xóa');
      err.statusCode = 404;
      throw err;
    }
    return { success: true, deleted_id: parsedId };
  }

  async toggleLockUser(id, currentUserId) {
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      const err = new Error('ID người dùng không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    if (currentUserId && parseInt(parsedId, 10) === parseInt(currentUserId, 10)) {
      const err = new Error('Bạn không thể tự khóa tài khoản của chính mình!');
      err.statusCode = 400;
      throw err;
    }

    const checkRes = await pool.query('SELECT id, is_locked FROM users WHERE id = $1', [parsedId]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Không tìm thấy người dùng cần thao tác');
      err.statusCode = 404;
      throw err;
    }

    const currentStatus = Boolean(checkRes.rows[0].is_locked);
    const newStatus = !currentStatus;

    await pool.query('UPDATE users SET is_locked = $1 WHERE id = $2', [newStatus, parsedId]);
    return { success: true, id: parsedId, is_locked: newStatus };
  }

  async bulkImportUsers(usersList = []) {
    if (!Array.isArray(usersList) || usersList.length === 0) {
      const err = new Error('Danh sách tài khoản trống');
      err.statusCode = 400;
      throw err;
    }

    const defaultPasswordHash = await bcrypt.hash('123123', 10);
    let successCount = 0;

    for (const u of usersList) {
      const fullName = (u.full_name || u['Họ và Tên'] || u['Họ Tên'] || '').trim();
      const email = (u.email || u['Email'] || '').trim();
      const roleName = (u.role_name || u.role || u['Role'] || u['Vai trò'] || 'Sinh viên').trim();
      const department = (u.department || u['Khoa'] || u['Phòng ban'] || '').trim();

      if (!fullName || !email || !email.includes('@')) {
        continue;
      }

      try {
        const roleId = await this._getOrCreateRoleId(roleName);
        const upsertQuery = `
          INSERT INTO users (role_id, full_name, email, password_hash, department)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (email) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            role_id = EXCLUDED.role_id,
            department = COALESCE(EXCLUDED.department, users.department)
        `;
        await pool.query(upsertQuery, [
          roleId,
          fullName,
          email,
          defaultPasswordHash,
          department || null,
        ]);
        successCount++;
      } catch (err) {
        console.warn(`Lỗi import user ${email}:`, err.message);
      }
    }

    return {
      success: true,
      count: successCount,
      message: `Đã nhập thành công ${successCount} tài khoản vào hệ thống`,
    };
  }
}

module.exports = new UsersService();
