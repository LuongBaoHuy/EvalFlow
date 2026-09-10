import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Rocket, Inbox, Target, AlertTriangle, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { getAnalyticsOverviewApi } from '../../api/analytics.api';
import FloatingAICopilot from '../../components/FloatingAICopilot';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('all');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = async (range) => {
    try {
      setLoading(true);
      const res = await getAnalyticsOverviewApi({ timeRange: range });
      if (res.success) {
        setOverview(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải dữ liệu thống kê bảng điều khiển');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(timeRange);
  }, [timeRange]);

  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value);
  };

  if (loading && !overview) {
    return (
      <div className="p-16 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
        <p className="text-xs font-medium">Đang tổng hợp số liệu báo cáo & biểu đồ...</p>
      </div>
    );
  }

  const anomalyCount = overview?.anomaly_count || 0;
  const dailyData = overview?.daily_submissions || [];
  const statusData = overview?.campaign_status_breakdown || [];
  const recentResponses = overview?.recent_responses || [];
  const anomalyItem = recentResponses.find((r) => r.is_anomaly);
  const anomalyCampaignId = anomalyItem ? anomalyItem.campaign_id : null;

  return (
    <div className="p-6 space-y-8">
      {/* 1. Header Banner & Global Time Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bảng Điều Khiển Admin</h1>
          <p className="text-sm text-gray-500 mb-6">
            Tổng quan hệ thống, phân tích lưu lượng nộp bài, cảnh báo AI và tỷ lệ phản hồi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          {/* Global Time Range Dropdown Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">Thời gian:</span>
            <select
              value={timeRange}
              onChange={handleTimeRangeChange}
              className="text-sm border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer"
            >
              <option value="all">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="7days">7 ngày qua</option>
              <option value="30days">30 ngày qua</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/surveys/create')}
            className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium text-sm px-4 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            + Tạo Mẫu Form
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/campaigns')}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-6 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            + Tạo Form Khảo sát
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
          ✕ {error}
        </div>
      )}

      {/* 2. Seamless Stat Row with Vertical Dividers */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-slate-100 py-6 my-6">
          <div className="space-y-2 lg:pr-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Mẫu Form Khảo sát</span>
              <ClipboardList size={24} className="text-gray-400" />
            </div>
            <div className="text-5xl font-light text-slate-900">{overview.total_surveys}</div>
            <p className="text-sm text-gray-500">Đã khởi tạo trong hệ thống</p>
          </div>

          <div className="space-y-2 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Form Khảo sát</span>
              <Rocket size={24} className="text-gray-400" />
            </div>
            <div className="text-5xl font-light text-slate-900">{overview.total_campaigns}</div>
            <p className="text-sm text-gray-500">Đợt triển khai giao bài</p>
          </div>

          <div className="space-y-2 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Lượt Nộp Bài</span>
              <Inbox size={24} className="text-gray-400" />
            </div>
            <div className="text-5xl font-light text-slate-900">{overview.total_responses}</div>
            <p className="text-sm text-gray-500">Phiếu kết quả đã thu thập</p>
          </div>

          <div className="space-y-2 lg:pl-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Tỉ lệ Hoàn thành</span>
              <Target size={24} className="text-amber-500" />
            </div>
            <div className="text-5xl font-light text-slate-900">{overview.completion_rate}%</div>
            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden mt-2">
              <div
                className="bg-slate-900 h-full rounded-full transition-all duration-500"
                style={{ width: `${overview.completion_rate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. AI Anomaly Alert Banner (Retained red background for high priority visibility) */}
      {anomalyCount > 0 && (
        <div className="bg-rose-50 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 animate-fadeIn my-6">
          <div className="flex items-center gap-4">
            <AlertTriangle size={32} className="text-rose-600" />
            <div>
              <h4 className="text-base font-semibold text-rose-900">Cảnh báo Bất thường từ AI Copilot</h4>
              <p className="text-sm text-rose-700 mt-1">
                Hệ thống AI phát hiện <span className="font-bold underline">{anomalyCount}</span> phiếu khảo sát có dấu hiệu bất thường.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate(
                anomalyCampaignId
                  ? `/admin/campaigns/${anomalyCampaignId}/results?tab=anomalies`
                  : '/admin/campaigns'
              )
            }
            className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm px-6 py-2 rounded-md transition-colors cursor-pointer"
          >
            Xem chi tiết
          </button>
        </div>
      )}

      {/* 4. Unboxed Visualizations Grid (Line Chart & Donut Chart directly on canvas) */}
      <div className="border-t border-gray-100 pt-8 mt-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column: Line Chart - Lưu lượng nộp bài gần đây */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
              <TrendingUp size={24} className="text-slate-800" /> Lưu lượng nộp bài gần đây
            </h3>
            <p className="text-sm text-slate-500 mb-8 mt-0.5">Xu hướng số lượng phiếu nộp theo các ngày gần đây</p>
          </div>

          <div className="h-72 w-full pt-2">
            {dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                Chưa có dữ liệu lượt nộp bài theo ngày
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                    formatter={(value) => [`${value} bài nộp`, 'Lượt nộp']}
                    labelFormatter={(label) => `Ngày ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="submissions"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#2563eb', strokeWidth: 1.5, stroke: '#fff' }}
                    activeDot={{ r: 5.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Column: Donut/Pie Chart - Trạng thái Chiến dịch */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
              <PieChartIcon size={24} className="text-slate-800" /> Trạng thái Chiến dịch
            </h3>
            <p className="text-sm text-slate-500 mb-8 mt-0.5">Tỷ lệ các đợt khảo sát đang chạy, tạm dừng và kết thúc</p>
          </div>

          <div className="h-72 w-full pt-2">
            {statusData.length === 0 || statusData.every((item) => item.value === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                Chưa có dữ liệu đợt khảo sát nào
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                    formatter={(value) => [`${value} đợt`, 'Số lượng']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-xs font-medium text-slate-700">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 5. Borderless Recent Submissions Data Table */}
      <div className="border-t border-gray-100 pt-8 mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
              <ClipboardList size={24} className="text-slate-800" /> Lượt nộp bài gần đây
            </h3>
            <p className="text-sm text-slate-500 mb-8 mt-0.5">Danh sách các phiếu khảo sát vừa được thu thập trong hệ thống</p>
          </div>
        </div>

        {recentResponses.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 font-medium">
            Chưa thu thập được lượt nộp bài nào
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 w-20 border-b border-gray-200">Mã Phiếu</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Form Khảo sát / Đợt</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Người Thực hiện</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Thời gian nộp</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Trạng thái AI</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 text-right border-b border-gray-200">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-normal text-gray-800">
                {recentResponses.map((r) => (
                  <tr key={r.response_id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-3 font-mono font-medium text-gray-400">#{r.response_id}</td>
                    <td className="py-4 px-3">
                      <p className="font-medium text-gray-900">{r.campaign_name}</p>
                      <p className="text-sm text-gray-500 line-clamp-1">{r.survey_title}</p>
                    </td>
                    <td className="py-4 px-3">
                      <p className="font-medium text-gray-900">{r.evaluator_name}</p>
                      <p className="text-sm font-mono text-gray-500">{r.evaluator_email}</p>
                    </td>
                    <td className="py-4 px-3 text-gray-500 font-mono text-sm">
                      {new Date(r.submitted_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-4 px-3">
                      {r.is_anomaly ? (
                        <span className="inline-flex items-center gap-1 font-medium text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700">
                          <AlertTriangle size={14} className="text-rose-700" /> Bất thường
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          ✓ Bình thường
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/admin/campaigns/${r.campaign_id}/results${
                              r.is_anomaly ? '?tab=anomalies' : ''
                            }`
                          )
                        }
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition cursor-pointer ml-auto flex items-center gap-1 justify-end"
                      >
                        Xem báo cáo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating AI Form Generator Copilot Widget */}
      <FloatingAICopilot />
    </div>
  );
}
