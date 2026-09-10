const pool = require('../config/db');

class NotificationsService {
  async getUserNotifications(userId) {
    const parsedUserId = parseInt(userId, 10);
    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      const err = new Error('ID người dùng không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT id, user_id, message, action_link, is_read, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [parsedUserId]);

    const unreadCountQuery = `
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE
    `;
    const unreadRes = await pool.query(unreadCountQuery, [parsedUserId]);

    return {
      notifications: result.rows,
      unread_count: parseInt(unreadRes.rows[0].unread_count, 10) || 0,
    };
  }

  async markAllAsRead(userId) {
    const parsedUserId = parseInt(userId, 10);
    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      const err = new Error('ID người dùng không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [parsedUserId]);
    return { success: true };
  }

  async markAsRead(id, userId) {
    const parsedId = parseInt(id, 10);
    const parsedUserId = parseInt(userId, 10);

    const query = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1 AND (user_id = $2 OR $2 IS NULL)
      RETURNING id, is_read
    `;
    let result = await pool.query(query, [parsedId, Number.isFinite(parsedUserId) ? parsedUserId : null]);
    if (result.rows.length === 0) {
      // Fallback: update by ID directly
      const fallback = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING id, is_read', [parsedId]);
      if (fallback.rows.length > 0) return fallback.rows[0];
      const err = new Error('Không tìm thấy thông báo');
      err.statusCode = 404;
      throw err;
    }
    return result.rows[0];
  }

  async deleteNotification(id, userId) {
    const parsedId = parseInt(id, 10);
    const parsedUserId = parseInt(userId, 10);

    const query = 'DELETE FROM notifications WHERE id = $1 AND (user_id = $2 OR $2 IS NULL)';
    let result = await pool.query(query, [parsedId, Number.isFinite(parsedUserId) ? parsedUserId : null]);
    if (result.rowCount === 0) {
      // Fallback: delete by ID directly
      result = await pool.query('DELETE FROM notifications WHERE id = $1', [parsedId]);
    }
    return { success: true, deleted_id: parsedId };
  }

  async clearReadNotifications(userId) {
    const parsedUserId = parseInt(userId, 10);
    let query = 'DELETE FROM notifications WHERE is_read = TRUE';
    let params = [];
    if (Number.isFinite(parsedUserId) && parsedUserId > 0) {
      query = 'DELETE FROM notifications WHERE user_id = $1 AND is_read = TRUE';
      params = [parsedUserId];
    }

    const result = await pool.query(query, params);
    return { success: true, deleted_count: result.rowCount };
  }
}

module.exports = new NotificationsService();
