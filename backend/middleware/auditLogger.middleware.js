const jwt = require('jsonwebtoken');
const auditLogsService = require('../services/auditLogs.service');

/**
 * Centralized Audit Logger Interceptor Middleware
 * Automatically captures mutating requests (POST, PUT, PATCH, DELETE) as well as EXPORT and LOGIN events.
 */
function auditLoggerMiddleware(req, res, next) {
  const method = req.method.toUpperCase();
  const urlPath = req.originalUrl || req.url || '';

  // Exclude /api/auth/login, /api/audit-logs, and non-export GET requests
  const isExport = urlPath.includes('/export');
  const isLogin = urlPath.includes('/auth/login') || urlPath.includes('/login');
  const isAuditLogsApi = urlPath.includes('/audit-logs');

  if (isAuditLogsApi || isLogin) {
    return next();
  }

  const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (!isMutatingMethod && !isExport) {
    return next();
  }

  // Intercept response finish event to log only successful requests from Admin users
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      return;
    }

    try {
      // 1. Extract User ID & User Role from req.user or decoded JWT token
      let userId = req.user?.id || req.user?.userId || null;
      let userRole = req.user?.role_name || req.user?.role || null;

      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.decode(token);
          if (decoded) {
            if (!userId && decoded.id) userId = decoded.id;
            if (!userRole && decoded.role_name) userRole = decoded.role_name;
          }
        } catch {
          // Ignore decode errors
        }
      }

      // STRICT ADMIN CHECK: Return immediately if user is NOT an Admin
      const ADMIN_ROLES = ['admin', 'quản trị viên', 'quản trị viên hệ thống'];
      const isAdmin = userRole && ADMIN_ROLES.includes(String(userRole).toLowerCase().trim());

      if (!isAdmin) {
        return; // Ignore log for non-admin users (Students, Lecturers, Guests)
      }

      // 2. Extract Client IP Address
      const ipAddress =
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      // 3. Determine Action Enum
      let action = 'UPDATE';
      if (isLogin) {
        action = 'LOGIN';
      } else if (isExport) {
        action = 'EXPORT';
      } else if (method === 'POST') {
        action = 'CREATE';
      } else if (method === 'DELETE') {
        action = 'DELETE';
      } else if (method === 'PUT' || method === 'PATCH') {
        action = 'UPDATE';
      }

      // 4. Infer Entity Type and Entity ID from Path
      let entityType = 'SYSTEM';
      let entityId = req.params?.id || req.params?.campaignId || req.params?.surveyId || null;

      const cleanPath = urlPath.split('?')[0];
      const segments = cleanPath.split('/').filter(Boolean);

      // E.g. ['api', 'campaigns', '108', 'results']
      if (segments.length >= 2) {
        const primaryResource = segments[1].toLowerCase();
        if (primaryResource === 'campaigns') entityType = 'CAMPAIGN';
        else if (primaryResource === 'surveys') entityType = 'SURVEY';
        else if (primaryResource === 'users') entityType = 'USER';
        else if (primaryResource === 'questions') entityType = 'QUESTION';
        else if (primaryResource === 'assignments') entityType = 'ASSIGNMENT';
        else if (primaryResource === 'responses') entityType = 'RESPONSE';
        else if (primaryResource === 'auth') entityType = 'USER';
        else if (primaryResource === 'ai') entityType = 'AI_FORM';
        else entityType = primaryResource.toUpperCase();

        // Infer ID if present in segment 2
        if (!entityId && segments[2] && !isNaN(parseInt(segments[2], 10))) {
          entityId = segments[2];
        }
      }

      // 5. Sanitize Body / Details
      const details = {
        method,
        path: cleanPath,
        statusCode: res.statusCode,
      };

      if (isLogin) {
        details.login_email = req.body?.email || req.body?.username || 'N/A';
        details.status = res.statusCode < 400 ? 'SUCCESS' : 'FAILED';
      } else if (req.body && typeof req.body === 'object') {
        // Create sanitized summary of payload (avoid storing password hashes or long tokens)
        const sanitizedBody = { ...req.body };
        delete sanitizedBody.password;
        delete sanitizedBody.password_hash;
        delete sanitizedBody.token;

        if (sanitizedBody.name) details.title = sanitizedBody.name;
        if (sanitizedBody.title) details.title = sanitizedBody.title;

        details.payload_summary = sanitizedBody;
      }

      // 6. Log event asynchronously
      auditLogsService.createAuditLog({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        ip_address: ipAddress,
      });
    } catch (err) {
      console.warn('[AuditLoggerMiddleware Exception]:', err.message);
    }
  });

  next();
}

module.exports = auditLoggerMiddleware;
