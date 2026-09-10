import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMyReviewedCampaignsApi, getReviewedResponsesInCampaignApi } from '../api/workflow.api';
import {
  Check,
  X,
  Clock,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Inbox,
  ClipboardList,
  FileText,
  Search,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  const map = {
    APPROVED: {
      label: <><Check size={12} className="currentColor" /> Đã duyệt</>,
      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    },
    REJECTED: {
      label: <><X size={12} className="currentColor" /> Từ chối</>,
      className: 'bg-red-50 text-red-700 border border-red-200',
    },
    PENDING: {
      label: <><Clock size={12} className="currentColor" /> Chờ duyệt</>,
      className: 'bg-amber-50 text-amber-800 border border-amber-200',
    },
  };
  const s = map[status] || map.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${s.className}`}
    >
      {s.label}
    </span>
  );
}

// ── Campaign List View ────────────────────────────────────────────────
function CampaignListView() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyReviewedCampaignsApi();
      setCampaigns(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Hero */}
      <div className="bg-white">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Phiếu Tôi Đã Duyệt
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Tổng hợp danh sách các Đợt Khảo sát bạn đã tham gia thực hiện chấm điểm và phê duyệt.
            </p>
          </div>

          {/* Action / Stat Switcher */}
          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2">
              <CheckCircle size={16} className="currentColor" /> <span>Chiến dịch:</span>
              <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {campaigns.length}
              </span>
            </div>
            <button
              type="button"
              onClick={load}
              className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium px-4 py-2 rounded-md text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin currentColor' : 'currentColor'} /> <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={16} className="currentColor" /> <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="py-16 text-center text-gray-500 bg-white">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent mb-3"></div>
          <p className="text-base text-gray-700">Đang tải danh sách chiến dịch đã duyệt...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
          <Inbox size={48} className="mx-auto text-gray-400" />
          <h3 className="text-lg font-semibold text-slate-900">
            Chưa có phiếu nào đã duyệt
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            Bạn chưa thực hiện phê duyệt phiếu nào. Sau khi bạn chấm điểm phiếu trong mục "Phiếu chờ duyệt", lịch sử sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {campaigns.map((camp) => (
            <div
              key={camp.campaign_id}
              className="group bg-white py-6 border-b border-gray-100 flex flex-col md:flex-row gap-6 md:items-center justify-between transition-colors hover:bg-slate-50/50"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
                    Đợt khảo sát #{camp.campaign_id}
                  </span>
                  {camp.deleted_at && (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                      Đã lưu trữ
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Check size={12} className="currentColor" /> {camp.reviewed_count} phiếu đã duyệt
                  </span>
                </div>

                <h3 className="text-xl font-medium text-gray-900 leading-snug">
                  {camp.campaign_name}
                </h3>

                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 pt-1">
                  <div>
                    Lần duyệt gần nhất: <span className="font-medium text-gray-900">{fmtDate(camp.last_reviewed_at)}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="md:w-60 shrink-0 flex items-center">
                <button
                  type="button"
                  onClick={() => navigate(`/my-reviewed/${camp.campaign_id}`)}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ClipboardList size={16} className="currentColor" /> <span>Xem danh sách phiếu</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campaign Detail View (responses in campaign) ──────────────────────
function CampaignDetailView() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ totalRecords: 0, totalPages: 1, currentPage: 1 });
  const [campaignName, setCampaignName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getReviewedResponsesInCampaignApi(campaignId, { page, limit: 20 });
      setData(res.data || []);
      setMeta(res.meta || { totalRecords: 0, totalPages: 1, currentPage: 1 });
      if (res.data?.[0]?.campaign_name) setCampaignName(res.data[0].campaign_name);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [campaignId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const getOverallStatus = (row) => {
    const steps = row.review_steps || [];
    const maxApproved = parseInt(row.max_approved_step || 0, 10);
    const total = parseInt(row.total_steps || 0, 10);
    if (steps.some((s) => s.status === 'REJECTED')) return 'REJECTED';
    if (maxApproved >= total && total > 0) return 'APPROVED';
    return 'PENDING';
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back Link */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/my-reviewed')}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft size={16} className="currentColor" /> Quay lại danh sách đợt khảo sát
        </button>
      </div>

      {/* Top Header Hero */}
      <div className="bg-white">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {campaignName || `Chiến dịch #${campaignId}`}
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Chi tiết các phiếu bạn đã tham gia đánh giá trong chiến dịch này.
            </p>
          </div>

          {/* Stat / Refresh Action */}
          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2">
              <FileText size={16} className="currentColor" /> <span>Đã duyệt:</span>
              <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {meta.totalRecords} phiếu
              </span>
            </div>
            <button
              type="button"
              onClick={load}
              className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium px-4 py-2 rounded-md text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin currentColor' : 'currentColor'} /> <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={16} className="currentColor" /> <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="py-16 text-center text-gray-500 bg-white">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent mb-3"></div>
          <p className="text-base text-gray-700">Đang tải danh sách phiếu...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
          <Inbox size={48} className="mx-auto text-gray-400" />
          <h3 className="text-lg font-semibold text-slate-900">
            Không có phiếu nào
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            Chưa tìm thấy phiếu nào được hoàn thành đánh giá trong chiến dịch này.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((row) => {
            const overallStatus = getOverallStatus(row);
            const steps = row.review_steps || [];
            const isExpanded = expandedId === row.response_id;

            return (
              <div
                key={row.response_id}
                className={`bg-white border rounded-xl overflow-hidden transition-all ${
                  isExpanded ? 'border-blue-400 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Row Header */}
                <div
                  onClick={() => toggleExpand(row.response_id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-base font-bold text-slate-900">
                        Phiếu #{row.response_id}
                      </span>
                      <StatusBadge status={overallStatus} />
                      <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded font-medium">
                        {parseInt(row.max_approved_step || 0, 10)}/{parseInt(row.total_steps || 0, 10)} bước đã duyệt
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
                      {row.submitter_name && (
                        <div>
                          Người nộp: <span className="font-medium text-gray-900">{row.submitter_name}</span>
                        </div>
                      )}
                      <div>
                        Thời gian nộp: <span className="font-medium text-gray-900">{fmtDate(row.submitted_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/workflow/review/${row.response_id}`, '_blank');
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Search size={16} className="currentColor" /> <span>Xem chi tiết phiếu</span>
                    </button>
                    <button
                      type="button"
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-md transition-transform"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                      <ChevronRight size={20} className="currentColor" />
                    </button>
                  </div>
                </div>

                {/* Expanded Step Timeline */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-slate-50/80 p-5 space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Lịch sử tiến trình phê duyệt
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-start md:items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {step.step_order}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-800">
                                  {step.step_name}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                  {step.reviewer_role}
                                </span>
                                <StatusBadge status={step.status} />
                              </div>
                              {step.note && (
                                <p className="text-xs text-slate-600 mt-1 italic">
                                  "{step.note}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 md:text-right shrink-0">
                            {step.reviewer_name && (
                              <div className="font-medium text-slate-700">
                                Người duyệt: {step.reviewer_name}
                              </div>
                            )}
                            <div>{fmtDate(step.reviewed_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-6">
          {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                p === page
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Named Exports ─────────────────────────────────────────────────────
export function MyReviewedCampaigns() {
  return <CampaignListView />;
}

export function MyReviewedCampaignDetail() {
  return <CampaignDetailView />;
}
