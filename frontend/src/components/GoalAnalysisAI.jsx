import React, { useState, useEffect } from 'react';
import { analyzeGoalsApi, getSavedAiGoalsResultApi } from '../api/ai.api';

export default function GoalAnalysisAI({ campaignId, aiGoals = [], responseCount = 0, onEvaluationsLoaded }) {
  const [evaluations, setEvaluations] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Fetch cached DB results on mount
  useEffect(() => {
    let isMounted = true;
    const fetchSavedResult = async () => {
      if (!campaignId) {
        setInitialLoading(false);
        return;
      }
      try {
        setInitialLoading(true);
        const res = await getSavedAiGoalsResultApi(campaignId);
        if (isMounted && res.success && res.data && Array.isArray(res.data.evaluations) && res.data.evaluations.length > 0) {
          setEvaluations(res.data.evaluations);
          if (onEvaluationsLoaded) onEvaluationsLoaded(res.data.evaluations);
          if (res.data.updated_at) setUpdatedAt(res.data.updated_at);
          setHasAnalyzed(true);
        }
      } catch (err) {
        console.warn('Chưa có kết quả đánh giá mục tiêu lưu trong DB:', err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };

    fetchSavedResult();
    return () => {
      isMounted = false;
    };
  }, [campaignId, onEvaluationsLoaded]);

  const handleAnalyze = async () => {
    if (!campaignId) return;
    try {
      setLoading(true);
      setError('');
      const res = await analyzeGoalsApi(campaignId);
      if (res.success && res.data) {
        setEvaluations(res.data.evaluations || []);
        if (onEvaluationsLoaded) onEvaluationsLoaded(res.data.evaluations || []);
        if (res.data.updated_at) {
          setUpdatedAt(res.data.updated_at);
        } else {
          setUpdatedAt(new Date().toISOString());
        }
        setHasAnalyzed(true);
      } else {
        setError(res.message || 'Không thể lấy đánh giá mục tiêu từ AI');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi gọi API đánh giá mục tiêu AI');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Đạt':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs px-3 py-1 rounded-full font-bold inline-flex items-center gap-1">
            <span>✓</span>
            <span>Đạt</span>
          </span>
        );
      case 'Chưa đạt':
        return (
          <span className="bg-rose-50 text-rose-700 border border-rose-300 text-xs px-3 py-1 rounded-full font-bold inline-flex items-center gap-1">
            <span>✕</span>
            <span>Chưa đạt</span>
          </span>
        );
      default:
        return (
          <span className="bg-amber-50 text-amber-800 border border-amber-300 text-xs px-3 py-1 rounded-full font-bold inline-flex items-center gap-1">
            <span>❓</span>
            <span>Chưa rõ</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Goal Header Box */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <h2 className="text-lg font-extrabold tracking-wide">
                Đánh Giá Mục Tiêu Phân Tích (AI Goal Evaluation)
              </h2>
              <span className="bg-purple-500/30 text-purple-200 border border-purple-400/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                Google Gemini AI
              </span>
            </div>
            <p className="text-xs text-indigo-200/90 leading-relaxed max-w-2xl">
              AI tự động tổng hợp toàn bộ bài nộp khảo sát của chiến dịch, đối chiếu trực tiếp với các mục tiêu đã đặt ra để đưa ra đánh giá Đạt/Chưa đạt kèm nhận xét chuyên sâu.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !aiGoals || aiGoals.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-5 py-3 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>AI Đang Phân Tích...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>{hasAnalyzed ? 'Đánh Giá Lại Mục Tiêu' : 'Yêu cầu AI Đánh giá Mục tiêu'}</span>
              </>
            )}
          </button>
        </div>

        {/* Configured Goals List Badges */}
        {aiGoals && aiGoals.length > 0 && (
          <div className="mt-4 pt-4 border-t border-indigo-700/50 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-300">Mục tiêu đã cấu hình ({aiGoals.length}):</span>
            {aiGoals.map((goal, idx) => (
              <span key={idx} className="bg-indigo-950/60 border border-indigo-700/60 text-indigo-200 text-xs px-2.5 py-1 rounded-lg font-medium">
                🎯 {goal}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Initial Cache Check Loader */}
      {initialLoading && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-xs text-gray-400 font-medium">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mb-1.5"></div>
          <p>Đang kiểm tra kết quả phân tích lưu trong hệ thống...</p>
        </div>
      )}

      {/* Notice if no goals configured */}
      {!initialLoading && (!aiGoals || aiGoals.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-2">
          <div className="text-2xl">💡</div>
          <h3 className="font-bold text-amber-900 text-sm">Chưa có Mục tiêu Phân tích AI</h3>
          <p className="text-xs text-amber-700 max-w-md mx-auto leading-relaxed">
            Chiến dịch này chưa được thiết lập mục tiêu phân tích. Bạn có thể mở giao diện <b>Chỉnh sửa Chiến dịch</b> để bổ sung các mục tiêu cho AI đánh giá.
          </p>
        </div>
      )}

      {/* AI Processing Loading State */}
      {loading && (
        <div className="bg-white p-10 rounded-2xl border border-gray-200 text-center space-y-3 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-9 w-9 border-4 border-indigo-600 border-t-transparent"></div>
          <h3 className="font-bold text-indigo-900 text-sm">AI Copilot đang phân tích dữ liệu...</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Hệ thống đang tổng hợp phản hồi từ {responseCount} phiếu nộp và kiểm tra đối chiếu từng mục tiêu phân tích.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && !loading && !initialLoading && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-semibold">
          ✕ {error}
        </div>
      )}

      {/* Evaluation Results List */}
      {!initialLoading && evaluations && !loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>📊</span>
              <span>Báo cáo Đánh giá Chi tiết từ AI ({evaluations.length} mục tiêu)</span>
            </h3>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              Cập nhật lần cuối: {updatedAt ? new Date(updatedAt).toLocaleString('vi-VN') : 'Vừa xong'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {evaluations.map((item, idx) => (
              <div
                key={idx}
                className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 hover:border-indigo-200 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="font-extrabold text-gray-900 text-sm leading-snug">
                      {item.goal}
                    </h4>
                  </div>
                  <div className="shrink-0">{getStatusBadge(item.status)}</div>
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100/80 p-3.5 rounded-xl text-xs text-indigo-950 leading-relaxed font-medium flex items-start gap-2.5">
                  <span className="text-base shrink-0">🤖</span>
                  <div>
                    <span className="font-bold text-indigo-900 block mb-0.5">Nhận xét & Đánh giá của AI:</span>
                    <span>{item.insight || 'Không có chi tiết giải thích.'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
