import React, { useState, useEffect } from 'react';
import { getAuditLogsApi } from '../../api/auditLogs.api';
import {
  PlusCircle,
  Edit,
  Trash2,
  FileSpreadsheet,
  LogIn,
  Settings,
  RefreshCw,
  Search,
  X,
  ClipboardList
} from 'lucide-react';

function formatTimestamp(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function getActionBadge(action) {
  const act = String(action || '').toUpperCase();
  switch (act) {
    case 'CREATE':
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-lg">
          <PlusCircle size={14} className="currentColor" /> Thêm mới (CREATE)
        </span>
      );
    case 'UPDATE':
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2.5 py-1 rounded-lg">
          <Edit size={14} className="currentColor" /> Cập nhật (UPDATE)
        </span>
      );
    case 'DELETE':
      return (
        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-2.5 py-1 rounded-lg">
          <Trash2 size={14} className="currentColor" /> Xóa (DELETE)
        </span>
      );
    case 'EXPORT':
      return (
        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-1 rounded-lg">
          <FileSpreadsheet size={14} className="currentColor" /> Xuất file (EXPORT)
        </span>
      );
    case 'LOGIN':
      return (
        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-2.5 py-1 rounded-lg">
          <LogIn size={14} className="currentColor" /> Đăng nhập (LOGIN)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold px-2.5 py-1 rounded-lg">
          <Settings size={14} className="currentColor" /> {act}
        </span>
      );
  }
}

function getEntityLabel(entityType, entityId) {
  const type = String(entityType || '').toUpperCase();
  const idStr = entityId ? `#${entityId}` : '';

  switch (type) {
    case 'CAMPAIGN':
      return `Chiến dịch ${idStr}`;
    case 'SURVEY':
      return `Mẫu khảo sát ${idStr}`;
    case 'USER':
      return `Người dùng ${idStr}`;
    case 'QUESTION':
      return `Câu hỏi ${idStr}`;
    case 'ASSIGNMENT':
      return `Nhiệm vụ giao ${idStr}`;
    case 'RESPONSE':
      return `Phiếu nộp ${idStr}`;
    case 'AI_FORM':
      return `AI Form Copilot`;
    default:
      return `${type} ${idStr}`.trim();
  }
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters State
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Selected Log for JSON Modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch logs on filter/page change
  useEffect(() => {
    fetchAuditLogs();
  }, [page, actionFilter, entityFilter, debouncedSearch]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getAuditLogsApi({
        page,
        limit: 20,
        action: actionFilter,
        entity_type: entityFilter,
        search: debouncedSearch,
      });

      if (res.success && res.data) {
        setLogs(res.data.logs || []);
        setPagination(res.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      } else {
        setError(res.message || 'Không thể tải nhật ký hoạt động');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi kết nối khi tải nhật ký hoạt động');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 w-full text-gray-900">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Nhật ký Hoạt động (Audit Logs)</h1>
          <p className="text-sm text-gray-500 mb-6">
            Theo dõi tất cả thao tác quản trị, thay đổi dữ liệu và đăng nhập trong toàn bộ hệ thống EvalFlow.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAuditLogs}
          disabled={loading}
          className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium text-sm px-4 py-2 rounded-md transition-colors flex items-center gap-2 self-start md:self-auto cursor-pointer shrink-0"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin currentColor' : 'currentColor'} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* 2. Filter Bar (Clean & Borderless) */}
      <div className="flex flex-wrap items-center justify-between gap-6 py-4">
        <div className="flex flex-wrap items-center gap-6 w-full sm:w-auto">
          {/* Action Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">Hành động:</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer"
            >
              <option value="ALL">-- Tất cả --</option>
              <option value="CREATE">Thêm mới</option>
              <option value="UPDATE">Cập nhật</option>
              <option value="DELETE">Xóa</option>
              <option value="EXPORT">Xuất dữ liệu</option>
              <option value="LOGIN">Đăng nhập</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">Đối tượng:</span>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer"
            >
              <option value="ALL">-- Tất cả --</option>
              <option value="CAMPAIGN">Form khảo sát</option>
              <option value="SURVEY">Mẫu khảo sát</option>
              <option value="USER">Người dùng</option>
              <option value="QUESTION">Câu hỏi</option>
              <option value="ASSIGNMENT">Nhiệm vụ</option>
              <option value="RESPONSE">Bài nộp</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-[400px]">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
            <Search size={16} className="currentColor" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm người thực hiện, email, ID..."
            className="w-full text-base border-b border-gray-300 py-2 pl-9 focus:outline-none focus:border-gray-900 text-gray-900 placeholder:text-gray-400 bg-transparent transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-400 hover:text-gray-900 cursor-pointer"
            >
              <X size={16} className="currentColor" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Borderless Data Table */}
      {error ? (
        <div className="py-12 text-center text-red-600 bg-red-50/50 rounded-xl border border-red-100 text-xs font-semibold flex items-center justify-center gap-2">
          <X size={16} className="currentColor" /> {error}
        </div>
      ) : loading && logs.length === 0 ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Đang tải nhật ký hoạt động...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-slate-50/40 rounded-xl border border-slate-100 space-y-1">
          <p className="text-base font-semibold text-slate-600">Chưa có nhật ký hoạt động nào</p>
          <p className="text-xs text-slate-400">Không tìm thấy bản ghi phù hợp với bộ lọc hiện tại.</p>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold text-xs">
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Người thực hiện</th>
                  <th className="py-3 px-3">Hành động</th>
                  <th className="py-3 px-3">Đối tượng tác động</th>
                  <th className="py-3 px-3">Chi tiết & IP</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const detailsText =
                    typeof log.details === 'object'
                      ? JSON.stringify(log.details)
                      : String(log.details || '');

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      {/* Cột 1: THỜI GIAN */}
                      <td className="py-4 px-3 font-medium text-gray-700 whitespace-nowrap">
                        {formatTimestamp(log.created_at)}
                      </td>

                      {/* Cột 2: NGƯỜI THỰC HIỆN */}
                      <td className="py-4 px-3">
                        <div className="font-medium text-gray-900">{log.user_name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{log.user_email}</div>
                      </td>

                      {/* Cột 3: HÀNH ĐỘNG */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Cột 4: ĐỐI TƯỢNG */}
                      <td className="py-4 px-3 font-medium text-gray-800 whitespace-nowrap">
                        {getEntityLabel(log.entity_type, log.entity_id)}
                      </td>

                      {/* Cột 5: CHI TIẾT */}
                      <td className="py-4 px-3 max-w-xs">
                        <p className="truncate text-gray-600 text-xs font-mono" title={detailsText}>
                          {detailsText}
                        </p>
                        {log.ip_address && (
                          <span className="text-xs text-gray-400 block mt-0.5 font-mono">
                            IP: {log.ip_address}
                          </span>
                        )}
                      </td>

                      {/* Action: View Modal Button */}
                      <td className="py-4 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition cursor-pointer flex items-center gap-2 ml-auto"
                        >
                          <Search size={16} className="currentColor" /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Pagination Control Bar (Borderless) */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100 text-sm">
          <div className="text-slate-500 font-medium">
            Hiển thị <span className="font-bold text-slate-900">{(page - 1) * 20 + 1}</span> -{' '}
            <span className="font-bold text-slate-900">{Math.min(page * 20, pagination.total)}</span> trên tổng{' '}
            <span className="font-bold text-slate-900">{pagination.total}</span> bản ghi
          </div>

          <div className="flex items-center gap-1.5 font-semibold">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 transition cursor-pointer"
            >
              ◄ Trước
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, page - 3), Math.min(pagination.totalPages, page + 2))
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg font-bold transition flex items-center justify-center cursor-pointer ${
                    p === page
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}

            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 transition cursor-pointer"
            >
              Sau ►
            </button>
          </div>
        </div>
      )}

      {/* 5. JSON Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList size={24} className="text-gray-500" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Chi tiết Nhật ký #{selectedLog.id}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatTimestamp(selectedLog.created_at)} • {selectedLog.user_name} ({selectedLog.user_email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer text-xs"
              >
                <X size={14} className="currentColor" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="font-bold text-slate-500 block mb-1">Hành động:</span>
                  {getActionBadge(selectedLog.action)}
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-1">Đối tượng:</span>
                  <span className="font-bold text-slate-900">
                    {getEntityLabel(selectedLog.entity_type, selectedLog.entity_id)}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-1">Địa chỉ IP:</span>
                  <span className="font-mono text-slate-800">{selectedLog.ip_address || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-1">Vai trò người thực hiện:</span>
                  <span className="font-semibold text-slate-800">{selectedLog.user_role}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-2">Chi tiết dữ liệu Payload (JSON):</span>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed shadow-inner">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
