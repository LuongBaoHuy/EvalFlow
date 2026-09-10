import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPendingReviewsApi } from '../api/workflow.api';

export default function MyPendingReviews() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ totalRecords: 0, totalPages: 1, currentPage: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyPendingReviewsApi({ page, limit: 10 });
      setData(res.data || []);
      setMeta(res.meta || { totalRecords: 0, totalPages: 1, currentPage: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 pt-6">
      {/* Top Banner Hero */}
      <div className="bg-white">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
              Phiếu Chờ Tôi Duyệt
            </h1>
            <p className="text-sm text-slate-500 font-medium max-w-xl leading-relaxed">
              Danh sách các phiếu đánh giá đang chờ bạn thực hiện chấm điểm và phê duyệt theo vai trò được phân công.
            </p>
          </div>

          {/* Action / Stat Switcher */}
          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2">
              <span>📋 Đang chờ:</span>
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {meta.totalRecords}
              </span>
            </div>
            <button
              type="button"
              onClick={load}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3.5 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔄</span> Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-16 text-center text-gray-500 bg-white">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent mb-3"></div>
          <p className="text-base text-gray-700">Đang tải danh sách phiếu chờ duyệt...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
          <div className="text-4xl">🎉</div>
          <h3 className="text-lg font-semibold text-slate-900">
            Không có phiếu nào chờ duyệt
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            Bạn đã hoàn thành xử lý tất cả các phiếu trong hàng đợi. Hãy kiểm tra lại sau khi có đợt nộp mới!
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {data.map((item) => (
            <div
              key={item.response_id}
              className="group bg-white py-6 border-b border-gray-100 flex flex-col md:flex-row gap-6 md:items-center justify-between transition-colors hover:bg-slate-50/50"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">
                    Phiếu #{item.response_id}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Bước {item.pending_step_order}: {item.pending_step_name}
                  </span>
                  <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {item.reviewer_role}
                  </span>
                </div>

                <h3 className="text-lg font-medium text-gray-900 leading-snug">
                  {item.campaign_name}
                </h3>

                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 pt-1">
                  {item.submitter_name && (
                    <div>
                      Người nộp: <span className="font-medium text-gray-900">{item.submitter_name}</span>
                    </div>
                  )}
                  <div>
                    Thời gian nộp: <span className="font-medium text-gray-900">{formatDate(item.submitted_at)}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="md:w-52 shrink-0 flex items-center">
                <button
                  type="button"
                  onClick={() => navigate(`/workflow/review/${item.response_id}`)}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>✍️ Vào chấm điểm</span>
                </button>
              </div>
            </div>
          ))}
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
