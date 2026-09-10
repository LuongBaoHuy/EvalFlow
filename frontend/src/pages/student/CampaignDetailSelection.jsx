import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMyAssignmentsInCampaignApi, skipRemainingCampaignAssignmentsApi } from '../../api/campaigns.api';
import { getUser } from '../../utils/auth.utils';

export default function CampaignDetailSelection() {
  const { campaignId } = useParams();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skipping, setSkipping] = useState(false);

  const user = getUser();

  const fetchCampaignAssignments = async () => {
    try {
      setLoading(true);
      setError('');
      const userId = user?.id || 2;
      const res = await getMyAssignmentsInCampaignApi(campaignId, userId);
      if (res.success && res.data) {
        const list = res.data;
        // Check case A: General survey (no target_user_id)
        const isGeneral = list.every((a) => !a.target_user_id);
        if (isGeneral && list.length > 0) {
          const firstPending = list.find((a) => a.status === 'Pending') || list[0];
          navigate(`/surveys/do/${campaignId}?assignment_id=${firstPending.assignment_id}`, {
            replace: true,
          });
          return;
        }

        setAssignments(list);
      } else {
        setError(res.message || 'Không thể tải danh sách đánh giá');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải thông tin đợt khảo sát');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignAssignments();
  }, [campaignId, user?.id]);

  const handleSkipRemaining = async () => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn hoàn tất đợt khảo sát này? Các giảng viên chưa đánh giá còn lại sẽ được đóng.'
      )
    )
      return;

    try {
      setSkipping(true);
      const userId = user?.id || 2;
      const res = await skipRemainingCampaignAssignmentsApi(campaignId, userId);
      if (res.success) {
        navigate('/my-surveys', { replace: true });
      } else {
        alert(res.message || 'Không thể hoàn tất đợt khảo sát');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi đóng đợt khảo sát');
    } finally {
      setSkipping(false);
    }
  };

  const completedCount = assignments.filter((a) => a.status === 'Completed').length;
  const pendingCount = assignments.filter((a) => a.status === 'Pending').length;
  const totalCount = assignments.length;
  const campaignName = assignments[0]?.campaign_name || 'Đợt Khảo sát Đánh giá';
  const campaignDesc = assignments[0]?.campaign_description;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center bg-white space-y-4">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent"></div>
        <p className="text-base text-gray-700">Đang tải danh sách các mục đánh giá...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate('/my-surveys')}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          ← Quay lại danh sách
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm font-medium">
          ✕ {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pt-6 pb-12">
      {/* Top Back Nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/my-surveys')}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2 cursor-pointer"
        >
          <span>←</span> Quay lại Dashboard
        </button>
        <span className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
          Tiến độ: {completedCount}/{totalCount} mục đã xong
        </span>
      </div>

      {/* Hero Banner */}
      <div className="bg-white space-y-3">
        <h1 className="text-3xl font-light text-gray-900 tracking-tight">{campaignName}</h1>
        {campaignDesc && <p className="text-base text-gray-700 leading-relaxed max-w-2xl">{campaignDesc}</p>}
      </div>

      {/* List of Teachers / Assignments */}
      <div className="bg-white">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
            Các môn học & Giảng viên được phân công ({totalCount})
          </h2>
        </div>

        <div className="flex flex-col">
          {assignments.map((item) => {
            const isDone = item.status === 'Completed';
            const isSkipped = item.status === 'Skipped';

            return (
              <div
                key={item.assignment_id}
                className="py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${isDone
                        ? 'bg-emerald-50 text-emerald-700'
                        : isSkipped
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    {isDone ? '✓' : '👨‍🏫'}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-medium text-gray-900 text-lg">
                      Thầy/Cô {item.target_user_name || 'Giảng viên'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span>
                        Môn: <span className="text-gray-900 font-medium">{item.context_reference || 'Môn học'}</span>
                      </span>
                      {item.target_user_department && (
                        <span>
                          Khoa/Bộ môn: <span className="text-gray-900 font-medium">{item.target_user_department}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  {isDone ? (
                    <span className="text-emerald-700 text-sm font-medium flex items-center gap-1.5">
                      <span>✓</span> Đã khảo sát
                    </span>
                  ) : isSkipped ? (
                    <span className="text-gray-500 text-sm font-medium">
                      Đã bỏ qua
                    </span>
                  ) : item.is_active === false ? (
                    <span className="text-gray-500 text-sm font-medium">
                      Đang tạm dừng
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/surveys/do/${campaignId}?assignment_id=${item.assignment_id}`
                        )
                      }
                      className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <span>Thực hiện</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EXIT STRATEGY BUTTON (HIỂN THỊ KHI ĐÃ ĐÁNH GIÁ ÍT NHẤT 1 BÀI VÀ CÒN BÀI CHƯA LÀM) */}
      {completedCount >= 1 && pendingCount > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-1">
            <h3 className="font-medium text-gray-900 text-lg">
              Bạn đã hoàn thành {completedCount} mục đánh giá!
            </h3>
            <p className="text-base text-gray-500">
              Nếu bạn không muốn tiếp tục đánh giá thêm giảng viên khác, bạn có thể hoàn tất đợt khảo sát ngay bây giờ.
            </p>
          </div>
          <button
            type="button"
            disabled={skipping}
            onClick={handleSkipRemaining}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-md transition flex items-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <span>{skipping ? 'Đang xử lý...' : 'Xác nhận hoàn thành Đợt khảo sát này'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
