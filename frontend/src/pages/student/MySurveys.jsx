import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyAssignmentsApi } from '../../api/assignments.api';
import { getUser } from '../../utils/auth.utils';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  PartyPopper,
  FolderOpen,
  Lock,
  PauseCircle,
  ClipboardEdit,
  PenTool
} from 'lucide-react';

export default function MySurveys() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('Pending'); // 'Pending' | 'Completed'

  const fetchAssignments = async () => {
    const user = getUser();
    const userId = user?.id || 2;
    try {
      setLoading(true);
      setError('');
      const res = await getMyAssignmentsApi(userId);
      if (res.success) {
        setAssignments(res.data || []);
      } else {
        setError(res.message || 'Không thể tải danh sách khảo sát');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách khảo sát');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  // Group all user assignments by campaign_id
  const campaignMap = {};
  assignments.forEach((item) => {
    const cid = item.campaign_id;
    if (!campaignMap[cid]) {
      campaignMap[cid] = {
        campaign_id: cid,
        campaign_name: item.campaign_name || item.survey_title,
        campaign_description: item.campaign_description || item.survey_description,
        end_date: item.end_date,
        start_date: item.start_date,
        theme_config: item.theme_config,
        is_active: item.is_active !== false && item.is_active !== 0,
        isTargeted: false,
        items: [],
      };
    }
    if (item.target_user_id != null) {
      campaignMap[cid].isTargeted = true;
    }
    campaignMap[cid].items.push(item);
  });

  const campaignsList = Object.values(campaignMap).map((c) => {
    const totalCount = c.items.length;
    const completedCount = c.items.filter((i) => i.status === 'Completed').length;
    const pendingCount = c.items.filter((i) => i.status === 'Pending').length;
    const isFinished = totalCount > 0 && pendingCount === 0;

    return {
      ...c,
      totalCount,
      completedCount,
      pendingCount,
      isFinished,
    };
  });

  // Filter campaigns for Pending vs Completed tab
  const pendingCampaigns = campaignsList.filter((c) => !c.isFinished);
  const completedCampaigns = campaignsList.filter((c) => c.isFinished);

  const displayCampaigns = activeTab === 'Pending' ? pendingCampaigns : completedCampaigns;

  // Format date helper (YYYY-MM-DD to DD/MM/YYYY)
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Hero */}
      <div className="bg-white">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Bài Khảo sát của Tôi</h1>
            <p className="text-sm text-gray-500 mb-6">
              Tổng hợp danh sách các Đợt Khảo sát được phân công. Vui lòng chọn đợt khảo sát để thực hiện.
            </p>
          </div>

          {/* Interactive Tab Switcher */}
          <div className="bg-gray-100 p-1.5 rounded-lg flex shrink-0 self-start md:self-auto gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('Pending')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'Pending'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-gray-500 hover:text-slate-900'
                }`}
            >
              <Clock size={16} className="currentColor" /> Đang diễn ra
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${activeTab === 'Pending' ? 'bg-slate-100 text-slate-800' : 'bg-gray-200 text-gray-500'
                  }`}
              >
                {pendingCampaigns.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('Completed')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'Completed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-gray-500 hover:text-slate-900'
                }`}
            >
              <CheckCircle size={16} className="currentColor" /> Đã hoàn thành
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${activeTab === 'Completed' ? 'bg-slate-100 text-slate-800' : 'bg-gray-200 text-gray-500'
                  }`}
              >
                {completedCampaigns.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={16} className="currentColor" /> <span>{error}</span>
        </div>
      )}

      {/* Main Content Grid: Render 1 Card Per Campaign */}
      {loading ? (
        <div className="py-16 text-center text-gray-500 bg-white">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent mb-3"></div>
          <p className="text-base text-gray-700">Đang tải danh sách đợt khảo sát...</p>
        </div>
      ) : displayCampaigns.length === 0 ? (
        <div className="py-16 text-center bg-white text-gray-500 space-y-3">
          {activeTab === 'Pending' ? <PartyPopper size={48} className="mx-auto text-gray-400" /> : <FolderOpen size={48} className="mx-auto text-gray-400" />}
          <h3 className="text-lg font-medium text-gray-900">
            {activeTab === 'Pending'
              ? 'Tuyệt vời! Bạn không có đợt khảo sát nào đang chờ'
              : 'Chưa có lịch sử đợt khảo sát đã hoàn thành'}
          </h3>
          <p className="text-base text-gray-700 max-w-sm mx-auto">
            {activeTab === 'Pending'
              ? 'Mọi đợt khảo sát được phân công sẽ xuất hiện tại đây.'
              : 'Sau khi bạn làm xong bài khảo sát, thông tin lịch sử sẽ hiển thị tại đây.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {displayCampaigns.map((campaign) => {
            const primaryColor = campaign.theme_config?.primaryColor || '#0f172a';

            return (
              <div
                key={campaign.campaign_id}
                className="group bg-white py-8 border-b border-gray-100 flex flex-col md:flex-row gap-6 md:items-start justify-between"
              >
                <div className="space-y-3 flex-1">
                  <div>
                    {/* Header Row Badges */}
                    <div className="flex items-center gap-3 mb-2">
                      {campaign.isTargeted ? (
                        <span className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
                          Đánh giá Giảng viên ({campaign.totalCount} mục)
                        </span>
                      ) : (
                        <span className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
                          Khảo sát Chung
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          campaign.end_date && new Date(campaign.end_date) < new Date()
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : !campaign.is_active
                              ? 'bg-gray-100 text-gray-500'
                              : campaign.isFinished
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {campaign.end_date && new Date(campaign.end_date) < new Date()
                          ? '● Đã kết thúc'
                          : !campaign.is_active
                            ? '○ Tạm dừng'
                            : campaign.isFinished
                              ? '✓ Đã hoàn thành'
                              : '● Đang diễn ra'}
                      </span>
                    </div>

                    {/* Campaign Title */}
                    <h2 className="text-xl font-medium text-gray-900 leading-snug">
                      {campaign.campaign_name}
                    </h2>
                    <p className="text-base text-gray-700 mt-2 max-w-2xl leading-relaxed">
                      {campaign.survey_description ||
                        'Vui lòng nhấp vào nút bên dưới để bắt đầu điền phiếu đánh giá cho đợt này.'}
                    </p>

                    {/* Meta info chips */}
                    <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-gray-500">
                      <div>
                        Bắt đầu: <span className="font-medium text-gray-900">{formatDate(campaign.start_date)}</span>
                      </div>
                      <div>
                        Hạn nộp: <span className="font-medium text-gray-900">{formatDate(campaign.end_date)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions / Progress Footer */}
                <div className="md:w-64 shrink-0 flex items-center">
                  {campaign.end_date && new Date(campaign.end_date) < new Date() ? (
                    <div className="w-full py-2 bg-red-50 text-red-600 border border-red-200 font-medium text-sm rounded-md flex items-center justify-center gap-2 select-none">
                      <Lock size={16} className="currentColor" /> Đợt khảo sát đã kết thúc
                    </div>
                  ) : !campaign.is_active ? (
                    <div className="w-full py-2 bg-gray-100 text-gray-500 font-medium text-sm rounded-md flex items-center justify-center gap-2 select-none">
                      <PauseCircle size={16} className="currentColor" /> Đợt khảo sát đang tạm dừng
                    </div>
                  ) : campaign.isTargeted ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/my-surveys/campaign/${campaign.campaign_id}`)}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ClipboardEdit size={16} className="currentColor" />
                      <span>Chọn Giảng viên & Thực hiện ({campaign.completedCount}/{campaign.totalCount})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/surveys/do/${campaign.campaign_id}`)}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {campaign.isFinished ? <CheckCircle size={16} className="currentColor" /> : <PenTool size={16} className="currentColor" />}
                      <span>{campaign.isFinished ? 'Xem lại bài nộp' : 'Bắt đầu làm bài khảo sát'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
