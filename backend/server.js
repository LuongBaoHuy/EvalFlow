require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  apiTrackerMiddleware,
  renderDashboardHTML,
  API_DIRECTORY,
  endpointStats,
  requestLogs,
} = require('./middleware/apiTracker');

const authRoutes = require('./routes/auth.route');
const surveysRoutes = require('./routes/surveys.route');
const questionsRoutes = require('./routes/questions.route');
const campaignsRoutes = require('./routes/campaigns.route');
const notificationsRoutes = require('./routes/notifications.route');
const assignmentsRoutes = require('./routes/assignments.route');
const responsesRoutes = require('./routes/responses.route');
const analyticsRoutes = require('./routes/analytics.route');
const uploadsRoutes = require('./routes/uploads.route');
const usersRoutes = require('./routes/users.route');
const aiRoutes = require('./routes/ai.route');
const lecturerRoutes = require('./routes/lecturer.route');
const adminLecturerRoutes = require('./routes/adminLecturer.route');
const auditLogsRoutes = require('./routes/auditLogs.route');
const auditLoggerMiddleware = require('./middleware/auditLogger.middleware');
const workflowRoutes = require('./routes/workflow.route');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve OpenAPI Swagger UI Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Real-time API Tracker Middleware & Automatic Audit Logger Interceptor
app.use(apiTrackerMiddleware);
app.use(auditLoggerMiddleware);

// Serve uploaded image files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/surveys', surveysRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/responses', responsesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/lecturer', lecturerRoutes);
app.use('/api/admin', adminLecturerRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/workflow', workflowRoutes);

// Endpoint Tra cứu danh mục API của hệ thống dạng JSON
app.get('/api/routes', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Danh mục API của hệ thống EvalFlow Backend',
    data: {
      total_categories: API_DIRECTORY.length,
      total_endpoints: API_DIRECTORY.reduce((acc, c) => acc + c.endpoints.length, 0),
      categories: API_DIRECTORY,
      active_stats: endpointStats,
    },
  });
});

// Endpoint Health Check & Dashboard API Explorer
app.get('/api/health', (req, res) => {
  const acceptHeader = req.headers.accept || '';

  // If opened directly in Web Browser (Accept: text/html) -> Render UI Dashboard Explorer
  if (acceptHeader.includes('text/html')) {
    return renderDashboardHTML(req, res);
  }

  // Otherwise return JSON status
  res.status(200).json({
    success: true,
    message: 'Server is running',
    data: {
      status: 'ONLINE',
      port: PORT,
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      memory_usage: process.memoryUsage(),
      total_endpoints: API_DIRECTORY.reduce((acc, c) => acc + c.endpoints.length, 0),
      active_called_routes: Object.keys(endpointStats).length,
      recent_api_calls: requestLogs.slice(0, 10),
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API không tồn tại',
    data: null,
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi hệ thống',
    data: null,
  });
});

const backgroundTaskService = require('./services/backgroundTask.service');
backgroundTaskService.start();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
// Server ready: loginLimiter updated and port 3000 freed
