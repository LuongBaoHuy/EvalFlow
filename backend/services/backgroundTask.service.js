const pool = require('../config/db');

class BackgroundTaskService {
  constructor() {
    this.intervalId = null;
    this.checkInterval = 1000 * 60 * 60; // 1 hour by default
  }

  start() {
    // Check immediately on startup
    this.checkCampaignsExpirations();
    
    // Then check periodically (e.g. every hour)
    this.intervalId = setInterval(() => {
      this.checkCampaignsExpirations();
    }, this.checkInterval);
    
    console.log('[BackgroundTask] Started checking campaigns expiration periodically.');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[BackgroundTask] Stopped.');
    }
  }

  async checkCampaignsExpirations() {
    try {
      // Find admins
      const adminRes = await pool.query(`SELECT id FROM users WHERE role_id = 1`);
      if (adminRes.rows.length === 0) return;
      const adminIds = adminRes.rows.map(r => r.id);

      const expiredQuery = `
        SELECT id, name, end_date 
        FROM survey_campaigns 
        WHERE is_active = TRUE AND end_date < CURRENT_DATE
      `;
      const expiredRes = await pool.query(expiredQuery);
      
      for (const campaign of expiredRes.rows) {
        const message = `Form khảo sát "${campaign.name}" đã hết hạn.`;
        const actionLink = `/admin/surveys/${campaign.id}`;
        
        for (const adminId of adminIds) {
          await this.createNotificationIfNotExists(adminId, message, actionLink);
        }
      }

      // Check campaigns about to expire (end_date is within next 3 days, and end_date >= CURRENT_DATE)
      const expiringQuery = `
        SELECT id, name, end_date 
        FROM survey_campaigns 
        WHERE is_active = TRUE 
          AND end_date >= CURRENT_DATE 
          AND end_date <= CURRENT_DATE + INTERVAL '3 days'
      `;
      const expiringRes = await pool.query(expiringQuery);
      
      for (const campaign of expiringRes.rows) {
        const message = `Form khảo sát "${campaign.name}" sắp hết hạn vào ngày ${new Date(campaign.end_date).toLocaleDateString('vi-VN')}.`;
        const actionLink = `/admin/surveys/${campaign.id}`;
        
        for (const adminId of adminIds) {
          await this.createNotificationIfNotExists(adminId, message, actionLink);
        }
      }
      
    } catch (err) {
      console.error('[BackgroundTask] Error checking campaign expirations:', err);
    }
  }

  async createNotificationIfNotExists(userId, message, actionLink) {
    try {
      const checkQuery = `
        SELECT id FROM notifications 
        WHERE user_id = $1 AND message = $2 AND action_link = $3
        LIMIT 1
      `;
      const res = await pool.query(checkQuery, [userId, message, actionLink]);
      if (res.rows.length === 0) {
        await pool.query(
          `INSERT INTO notifications (user_id, message, action_link, is_read) VALUES ($1, $2, $3, FALSE)`,
          [userId, message, actionLink]
        );
      }
    } catch (err) {
      console.error('[BackgroundTask] Error creating notification:', err);
    }
  }
}

module.exports = new BackgroundTaskService();
