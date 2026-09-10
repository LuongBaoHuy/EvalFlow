import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSurveyAnalyticsApi } from '../../api/analytics.api';

export default function SurveyReport() {
  const { surveyId } = useParams();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await getSurveyAnalyticsApi(surveyId);
        if (res.success) {
          setAnalytics(res.data);
        } else {
          setError(res.message || 'Không thể tải báo cáo khảo sát');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Lỗi khi tải báo cáo khảo sát');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [surveyId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3"></div>
        <p className="text-sm font-medium">Đang tính toán kết quả báo cáo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button & Title */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition mb-2 block"
          >
            ← Quay lại Bảng điều khiển
          </button>
          <h1 className="text-2xl font-extrabold text-gray-800">
            {analytics?.survey_title || 'Báo cáo Chi tiết Khảo sát'}
          </h1>
          {analytics?.survey_description && (
            <p className="text-sm text-gray-500 mt-1">{analytics.survey_description}</p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center shrink-0">
          <div className="text-xs font-semibold text-blue-600 uppercase">Tổng lượt phản hồi</div>
          <div className="text-3xl font-extrabold text-blue-800 mt-0.5">
            {analytics?.total_responses || 0}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          ✕ {error}
        </div>
      )}

      {/* Questions Analytics List */}
      {!analytics?.questions?.length ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400">
          Chưa có câu hỏi hoặc bài nộp nào cho khảo sát này.
        </div>
      ) : (
        <div className="space-y-5">
          {analytics.questions.map((q, idx) => (
            <div key={q.question_id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <h3 className="font-bold text-gray-800 text-base">{q.question_text}</h3>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg uppercase">
                  {q.type}
                </span>
              </div>

              {/* RADIO & CHECKBOX BREAKDOWN */}
              {(q.type === 'radio' || q.type === 'checkbox') && (
                <div className="space-y-3 pt-1">
                  {Object.entries(q.breakdown || {}).map(([choice, count]) => {
                    const totalAns = q.total_answers || 1;
                    const percent = Math.round((count / totalAns) * 100);

                    return (
                      <div key={choice} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                          <span>{choice}</span>
                          <span>
                            {count} lượt ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* RATING & SLIDER SCORES */}
              {(q.type === 'rating' || q.type === 'slider') && (
                <div className="grid grid-cols-3 gap-4 pt-1 text-center">
                  <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                    <span className="text-xs text-blue-600 font-semibold block mb-1">Điểm Trung Bình</span>
                    <span className="text-2xl font-extrabold text-blue-800">{q.average_score}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <span className="text-xs text-gray-500 font-semibold block mb-1">Điểm Thấp Nhất</span>
                    <span className="text-2xl font-bold text-gray-700">{q.min_score}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <span className="text-xs text-gray-500 font-semibold block mb-1">Điểm Cao Nhất</span>
                    <span className="text-2xl font-bold text-gray-700">{q.max_score}</span>
                  </div>
                </div>
              )}

              {/* TEXT RESPONSES */}
              {q.type === 'text' && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-semibold text-gray-500 block">Danh sách Ý kiến đóng góp:</span>
                  {!q.text_responses?.length ? (
                    <p className="text-xs italic text-gray-400">Chưa có câu trả lời tự luận</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {q.text_responses.map((txt, tIdx) => (
                        <div key={tIdx} className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-gray-700">
                          "{txt}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
