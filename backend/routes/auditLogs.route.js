const express = require('express');
const router = express.Router();
const auditLogsController = require('../controllers/auditLogs.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');

router.get(
  '/',
  authMiddleware,
  adminMiddleware,
  auditLogsController.getAuditLogs.bind(auditLogsController)
);

module.exports = router;
