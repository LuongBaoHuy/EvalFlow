const pool = require('../config/db');

// In-memory request log & endpoint call counters
const requestLogs = [];
const endpointStats = {};
const MAX_LOGS = 50;

// API Route Directory with descriptions
const API_DIRECTORY = [
  {
    category: 'Xác thực & Tài khoản (Auth)',
    prefix: '/api/auth',
    endpoints: [
      { method: 'POST', path: '/api/auth/login', desc: 'Đăng nhập hệ thống (Mật khẩu mặc định: 123123)' },
      { method: 'POST', path: '/api/auth/register', desc: 'Đăng ký tài khoản mới' },
      { method: 'GET', path: '/api/auth/me', desc: 'Lấy thông tin tài khoản đang đăng nhập' },
      { method: 'POST', path: '/api/auth/change-password', desc: 'Đổi mật khẩu cá nhân' },
      { method: 'POST', path: '/api/auth/google-login', desc: 'Đăng nhập bằng tài khoản Google' },
    ],
  },
  {
    category: 'Mẫu Form Khảo sát (Surveys)',
    prefix: '/api/surveys',
    endpoints: [
      { method: 'GET', path: '/api/surveys', desc: 'Lấy danh sách Mẫu khảo sát (Phân trang, Bộ lọc)' },
      { method: 'GET', path: '/api/surveys/trash', desc: 'Lấy danh sách Mẫu khảo sát trong Thùng rác' },
      { method: 'GET', path: '/api/surveys/:id', desc: 'Lấy chi tiết 1 Mẫu khảo sát (kèm Version)' },
      { method: 'POST', path: '/api/surveys', desc: 'Tạo mới Mẫu khảo sát' },
      { method: 'PUT', path: '/api/surveys/:id', desc: 'Cập nhật Mẫu khảo sát (Transaction & Optimistic Locking)' },
      { method: 'DELETE', path: '/api/surveys/:id', desc: 'Xóa mềm Mẫu khảo sát (Move to Trash)' },
      { method: 'PUT', path: '/api/surveys/trash/:id/restore', desc: 'Phục hồi Mẫu khảo sát từ Thùng rác' },
      { method: 'DELETE', path: '/api/surveys/trash/:id/force', desc: 'Xóa vĩnh viễn Mẫu khảo sát' },
    ],
  },
  {
    category: 'Câu hỏi Khảo sát (Questions)',
    prefix: '/api/questions',
    endpoints: [
      { method: 'GET', path: '/api/questions/survey/:surveyId', desc: 'Lấy danh sách câu hỏi của Form' },
      { method: 'POST', path: '/api/questions/batch/:surveyId', desc: 'Lưu / Thay thế mảng câu hỏi (Batch update)' },
    ],
  },
  {
    category: 'Chiến dịch Khảo sát (Campaigns)',
    prefix: '/api/campaigns',
    endpoints: [
      { method: 'GET', path: '/api/campaigns', desc: 'Lấy danh sách Form khảo sát / Chiến dịch' },
      { method: 'GET', path: '/api/campaigns/trash', desc: 'Lấy danh sách Chiến dịch trong Thùng rác' },
      { method: 'GET', path: '/api/campaigns/:id', desc: 'Chi tiết Form khảo sát (kèm Danh sách phân công)' },
      { method: 'POST', path: '/api/campaigns', desc: 'Tạo Form khảo sát mới (Giao việc tự động/Excel)' },
      { method: 'PUT', path: '/api/campaigns/:id', desc: 'Cập nhật Form khảo sát (Transaction & Optimistic Locking)' },
      { method: 'PATCH', path: '/api/campaigns/:id/status', desc: 'Bật / Tạm dừng trạng thái Form khảo sát' },
      { method: 'DELETE', path: '/api/campaigns/:id', desc: 'Xóa mềm Form khảo sát' },
      { method: 'PUT', path: '/api/campaigns/trash/:id/restore', desc: 'Phục hồi Form khảo sát từ Thùng rác' },
      { method: 'DELETE', path: '/api/campaigns/trash/:id/force', desc: 'Xóa vĩnh viễn Form khảo sát' },
      { method: 'POST', path: '/api/campaigns/:id/copilot', desc: 'Chatbot AI Copilot phân tích kết quả & bất thường' },
      { method: 'GET', path: '/api/campaigns/:id/export-excel', desc: 'Xuất file Excel báo cáo chi tiết' },
    ],
  },
  {
    category: 'Bài nộp Khảo sát (Responses)',
    prefix: '/api/responses',
    endpoints: [
      { method: 'POST', path: '/api/responses/submit', desc: 'Nộp bài làm khảo sát (Kiểm tra Anomaly)' },
      { method: 'GET', path: '/api/responses/campaign/:campaignId', desc: 'Lấy danh sách bài nộp của 1 Chiến dịch' },
      { method: 'GET', path: '/api/responses/detail/:responseId', desc: 'Xem chi tiết 1 bài nộp khảo sát' },
    ],
  },
  {
    category: 'Báo cáo & Thống kê (Analytics)',
    prefix: '/api/analytics',
    endpoints: [
      { method: 'GET', path: '/api/analytics/dashboard', desc: 'Thống kê tổng quan Dashboard (Filter thời gian)' },
      { method: 'GET', path: '/api/analytics/campaign/:campaignId', desc: 'Thống kê chi tiết & Biểu đồ chiến dịch' },
    ],
  },
  {
    category: 'AI Copilot & Smart Generator (AI)',
    prefix: '/api/ai',
    endpoints: [
      { method: 'POST', path: '/api/ai/generate-form', desc: 'Tạo Form tự động bằng AI từ Prompt' },
      { method: 'POST', path: '/api/ai/append-questions', desc: 'Sinh thêm câu hỏi nối tiếp vào Form' },
      { method: 'POST', path: '/api/ai/copilot', desc: 'AI Copilot Multi-turn Chat & CRUD Mutations (Add, Update, Delete)' },
    ],
  },
  {
    category: 'Quản lý Người dùng & Quyền (Users)',
    prefix: '/api/users',
    endpoints: [
      { method: 'GET', path: '/api/users', desc: 'Lấy danh sách Người dùng' },
      { method: 'POST', path: '/api/users', desc: 'Tạo tài khoản mới (Mật khẩu mặc định 123123)' },
      { method: 'PUT', path: '/api/users/:id', desc: 'Cập nhật thông tin tài khoản' },
      { method: 'PATCH', path: '/api/users/:id/lock', desc: 'Khóa / Mở khóa tài khoản' },
      { method: 'DELETE', path: '/api/users/:id', desc: 'Xóa tài khoản' },
      { method: 'GET', path: '/api/users/roles', desc: 'Danh sách Vai trò / Quyền (trừ Guest)' },
    ],
  },
  {
    category: 'Phân công & Việc của tôi (Assignments)',
    prefix: '/api/assignments',
    endpoints: [
      { method: 'GET', path: '/api/assignments/my-surveys', desc: 'Lấy danh sách bài khảo sát được giao cho tôi' },
    ],
  },
  {
    category: 'Thông báo Hệ thống (Notifications)',
    prefix: '/api/notifications',
    endpoints: [
      { method: 'GET', path: '/api/notifications', desc: 'Lấy danh sách thông báo' },
      { method: 'PATCH', path: '/api/notifications/:id/read', desc: 'Đánh dấu đã đọc thông báo' },
    ],
  },
  {
    category: 'Tải lên Tệp (Uploads)',
    prefix: '/api/uploads',
    endpoints: [
      { method: 'POST', path: '/api/uploads/image', desc: 'Tải lên hình ảnh đính kèm' },
    ],
  },
];

// Middleware to track all incoming HTTP requests
function apiTrackerMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const pathKey = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
    const statKey = `${req.method} ${req.baseUrl || req.path}`;

    // Update endpoint stats
    if (!endpointStats[statKey]) {
      endpointStats[statKey] = { method: req.method, path: pathKey, count: 0, lastStatus: 200, lastCall: null };
    }
    endpointStats[statKey].count += 1;
    endpointStats[statKey].lastStatus = res.statusCode;
    endpointStats[statKey].lastCall = new Date().toISOString();

    // Store in recent logs
    if (pathKey.startsWith('/api') && pathKey !== '/api/health') {
      requestLogs.unshift({
        id: Date.now() + Math.random(),
        method: req.method,
        path: req.originalUrl || pathKey,
        status: res.statusCode,
        duration: `${duration}ms`,
        time: new Date().toLocaleTimeString('vi-VN'),
      });
      if (requestLogs.length > MAX_LOGS) requestLogs.pop();
    }
  });

  next();
}

// Generate Dashboard HTML for /api/health when opened in browser
function renderDashboardHTML(req, res) {
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

  const totalCalls = Object.values(endpointStats).reduce((acc, s) => acc + s.count, 0);
  const activeRoutesCount = Object.keys(endpointStats).length;

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EvalFlow Backend API Explorer & Health Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body className="bg-slate-900 text-slate-100 min-h-screen p-6">
  <div className="max-w-7xl mx-auto space-y-6">
    
    <!-- Top Header -->
    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-2xl shadow-lg">
          🚀
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            EvalFlow Backend API Dashboard
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-extrabold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              ONLINE (Port 3000)
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Trang kiểm tra sức khỏe hệ thống & Tra cứu danh mục Backend API</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a href="/api/health" className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-600 transition">
          🔄 Tải lại dữ liệu (F5)
        </a>
        <a href="http://localhost:5173" target="_blank" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg transition">
          🌐 Mở Frontend App (5173) ↗
        </a>
      </div>
    </div>

    <!-- Status Cards Grid -->
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-sm">
        <span className="text-xs text-slate-400 font-semibold block mb-1">Trạng thái Server:</span>
        <span className="text-lg font-extrabold text-emerald-400 flex items-center gap-2">
          <span>✅ Đang hoạt động bình thường</span>
        </span>
      </div>
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-sm">
        <span className="text-xs text-slate-400 font-semibold block mb-1">Thời gian chạy (Uptime):</span>
        <span className="text-lg font-extrabold text-blue-400 font-mono">{uptimeStr}</span>
      </div>
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-sm">
        <span className="text-xs text-slate-400 font-semibold block mb-1">Tổng lượt gọi API:</span>
        <span className="text-lg font-extrabold text-purple-400 font-mono">{totalCalls} requests</span>
      </div>
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-sm">
        <span className="text-xs text-slate-400 font-semibold block mb-1">Số API Route đã gọi:</span>
        <span className="text-lg font-extrabold text-amber-400 font-mono">{activeRoutesCount} endpoints</span>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left Column: API Directory (2 cols wide) -->
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span>📚 Danh mục Tất cả Endpoint API của Backend (${API_DIRECTORY.reduce((acc, c) => acc + c.endpoints.length, 0)} APIs)</span>
        </h2>

        <div className="space-y-4">
          ${API_DIRECTORY.map((cat) => `
            <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <h3 className="font-extrabold text-sm text-indigo-400 flex items-center gap-2">
                  <span>📂 ${cat.category}</span>
                  <span className="text-xs text-slate-400 font-mono">(${cat.prefix})</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-700 px-2 py-0.5 rounded-md">
                  ${cat.endpoints.length} APIs
                </span>
              </div>

              <div className="divide-y divide-slate-700/50">
                ${cat.endpoints.map((ep) => {
                  const statKey = `${ep.method} ${ep.path}`;
                  const stat = endpointStats[statKey];
                  const callCount = stat ? stat.count : 0;
                  const isMethodGet = ep.method === 'GET';
                  const methodBg = isMethodGet
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : ep.method === 'POST'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : ep.method === 'PUT'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30';

                  return `
                    <div className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-extrabold text-[11px] px-2 py-0.5 rounded border ${methodBg}">
                          ${ep.method}
                        </span>
                        <span className="font-mono text-slate-200 font-bold">${ep.path}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-[11px]">${ep.desc}</span>
                        ${callCount > 0 ? `
                          <span className="bg-emerald-900/60 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-700">
                            🔥 Called ${callCount}x
                          </span>
                        ` : `
                          <span className="bg-slate-700 text-slate-400 font-mono text-[10px] px-2 py-0.5 rounded">
                            Sẵn sàng
                          </span>
                        `}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right Column: Live Request Feed (1 col wide) -->
      <div className="space-y-4">
        <h2 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>⚡ Lịch sử gọi API gần đây (Live Feed)</span>
          <span className="text-xs text-slate-400">Tự ghi nhận</span>
        </h2>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-md max-h-[800px] overflow-y-auto">
          ${requestLogs.length === 0 ? `
            <div className="text-center py-8 text-slate-500 text-xs font-semibold">
              Chưa có lượt gọi API nào từ Frontend. Hãy thao tác trên ứng dụng!
            </div>
          ` : requestLogs.map((log) => {
            const statusBg = log.status >= 200 && log.status < 300
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : log.status === 409
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30';

            return `
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/60 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-blue-400">${log.method}</span>
                    <span className="text-slate-300 font-bold truncate max-w-[180px]">${log.path}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusBg}">
                    ${log.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>⏱️ ${log.duration}</span>
                  <span>🕒 ${log.time}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

    </div>

  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}

module.exports = {
  apiTrackerMiddleware,
  renderDashboardHTML,
  API_DIRECTORY,
  endpointStats,
  requestLogs,
};
