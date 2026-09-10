import React, { useState, useEffect } from 'react';
import { getAdminLecturersListApi, getAdminLecturerEvaluationsApi } from '../../api/adminLecturer.api';
import {
  RadioAnalyticsCard,
  CheckboxAnalyticsCard,
  SliderAnalyticsCard,
  RatingAmazonStyleCard,
  TextAnalyticsCard,
  FileUploadDocumentGrid,
} from './CampaignResults';
import {
  Crown,
  Lock,
  BarChart,
  RefreshCw,
  BarChart2,
  Star,
  Target,
  BookOpen,
  ChevronDown,
  X
} from 'lucide-react';

export default function AdminLecturerDashboard() {
  const [lecturers, setLecturers] = useState([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [evaluationsData, setEvaluationsData] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('ALL');
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  const [loadingLecturers, setLoadingLecturers] = useState(true);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLecturersList();
  }, []);

  const fetchLecturersList = async () => {
    try {
      setLoadingLecturers(true);
      setError('');
      const res = await getAdminLecturersListApi();
      if (res.success && Array.isArray(res.data)) {
        setLecturers(res.data);
        if (res.data.length > 0) {
          // Auto select first lecturer in list
          const firstLecturer = res.data[0];
          setSelectedLecturerId(String(firstLecturer.id));
          fetchLecturerEvaluations(firstLecturer.id);
        }
      } else {
        setError(res.message || 'Không thể tải danh sách giảng viên');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách giảng viên');
    } finally {
      setLoadingLecturers(false);
    }
  };

  const fetchLecturerEvaluations = async (targetId) => {
    if (!targetId) return;
    try {
      setLoadingEvaluations(true);
      setError('');
      setSelectedCampaignId('ALL');
      const res = await getAdminLecturerEvaluationsApi(targetId);
      if (res.success && res.data) {
        setEvaluationsData(res.data);
      } else {
        setEvaluationsData(null);
        setError(res.message || 'Không thể lấy bài đánh giá của giảng viên này');
      }
    } catch (err) {
      setEvaluationsData(null);
      setError(err.response?.data?.message || 'Lỗi khi kết nối tới máy chủ');
    } finally {
      setLoadingEvaluations(false);
    }
  };

  const handleLecturerChange = (e) => {
    const val = e.target.value;
    setSelectedLecturerId(val);
    if (val) {
      fetchLecturerEvaluations(val);
    } else {
      setEvaluationsData(null);
    }
  };

  const selectedLecturerObj = lecturers.find((l) => String(l.id) === String(selectedLecturerId));
  const rawCampaigns = [...(evaluationsData?.campaigns || [])].sort(
    (a, b) => (b.campaign_id || 0) - (a.campaign_id || 0)
  );

  const filteredCampaigns = rawCampaigns
    .filter((c) => {
      if (selectedCampaignId === 'ALL') return true;
      return String(c.campaign_id) === String(selectedCampaignId);
    })
    .sort((a, b) => (b.campaign_id || 0) - (a.campaign_id || 0));

  // Safe Math & Dynamic Aggregation per filtered view
  const totalEvaluationsCount = filteredCampaigns.reduce((sum, c) => sum + (c.total_responses || 0), 0);

  const ratingScores = [];
  const sliderScores = [];

  filteredCampaigns.forEach((camp) => {
    (camp.questions || []).forEach((q) => {
      const qType = (q.type || '').toLowerCase();
      const avg = parseFloat(q.average_score);
      if (Number.isFinite(avg)) {
        if (qType === 'rating') {
          // Strictly rating questions on a 1-5 scale, capped at 5.0
          ratingScores.push(Math.min(Math.max(avg, 0), 5.0));
        } else if (qType === 'slider') {
          // Strictly slider questions
          sliderScores.push(avg);
        }
      }
    });
  });

  const displayAverageRating = ratingScores.length > 0
    ? (Math.min(ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length, 5.0)).toFixed(1)
    : (evaluationsData?.overview?.overall_average_rating !== null && evaluationsData?.overview?.overall_average_rating !== undefined
      ? (Math.min(parseFloat(evaluationsData.overview.overall_average_rating), 5.0)).toFixed(1)
      : null);

  const displayAverageSlider = sliderScores.length > 0
    ? (sliderScores.reduce((a, b) => a + b, 0) / sliderScores.length).toFixed(1)
    : (evaluationsData?.overview?.overall_average_score !== null && evaluationsData?.overview?.overall_average_score !== undefined
      ? parseFloat(evaluationsData.overview.overall_average_score).toFixed(1)
      : null);

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tổng Hợp Báo Cáo Đánh Giá Giảng Viên</h1>
          <p className="text-sm text-gray-500 mb-6">
            Hệ thống giám sát toàn diện chất lượng giảng dạy. Cho phép Quản trị viên tra cứu chi tiết kết quả đánh giá theo từng giảng viên và từng đợt khảo sát.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLecturersList}
          disabled={loadingLecturers || loadingEvaluations}
          className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium text-sm px-4 py-2 rounded-md transition-colors flex items-center gap-2 self-start md:self-auto cursor-pointer shrink-0"
        >
          <RefreshCw size={16} className={loadingLecturers || loadingEvaluations ? 'animate-spin currentColor' : 'currentColor'} />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* 1. Filter Section & Selected Lecturer Info (Borderless & Clean) */}
      <div className="space-y-6 pb-6 border-b border-slate-100">
        {/* Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dropdown 1: Select Lecturer */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Chọn Giảng viên <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLecturerId}
              onChange={handleLecturerChange}
              disabled={loadingLecturers}
              className="w-full text-sm border-b border-gray-300 py-2 focus:outline-none focus:border-gray-900 text-slate-900 font-medium bg-transparent cursor-pointer"
            >
              {loadingLecturers ? (
                <option value="">Đang tải danh sách giảng viên...</option>
              ) : lecturers.length === 0 ? (
                <option value="">Chưa có giảng viên nào trong hệ thống</option>
              ) : (
                lecturers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} {l.department ? `(${l.department})` : ''} — [{l.evaluations_count} phiếu đánh giá]
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Dropdown 2: Select Campaign */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. Chọn Đợt khảo sát / Môn học
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              disabled={loadingEvaluations || rawCampaigns.length === 0}
              className="w-full text-sm border-b border-gray-300 py-2 focus:outline-none focus:border-gray-900 text-slate-900 font-medium bg-transparent cursor-pointer"
            >
              <option value="ALL">Tất cả đợt khảo sát ({rawCampaigns.length})</option>
              {rawCampaigns.map((c) => (
                <option key={c.campaign_id} value={c.campaign_id}>
                  {c.campaign_name} {c.context_reference ? `[${c.context_reference}]` : ''} ({c.total_responses} bài nộp)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Lecturer Info Details */}
        {selectedLecturerObj && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                {selectedLecturerObj.full_name?.charAt(0) || 'G'}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  Giảng viên: {selectedLecturerObj.full_name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Email: {selectedLecturerObj.email} {selectedLecturerObj.department ? `• Khoa/Phòng: ${selectedLecturerObj.department}` : ''}
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold text-slate-500 shrink-0 self-start sm:self-auto">
              Tổng <span className="font-bold text-slate-900">{selectedLecturerObj.evaluations_count}</span> phiếu đánh giá
            </span>
          </div>
        )}
      </div>

      {/* 2. Stat Row with Vertical Dividers (Borderless & Standard Typography) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x sm:divide-slate-100 py-6 border-b border-slate-100">
        <div className="space-y-2 sm:pr-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              Tổng phiếu nộp
            </span>
            <BarChart2 size={24} className="text-gray-400" />
          </div>
          <div className="text-5xl font-light text-slate-900">
            {selectedCampaignId === 'ALL'
              ? (evaluationsData?.overview?.total_evaluations ?? totalEvaluationsCount)
              : totalEvaluationsCount}
          </div>
          <p className="text-sm text-slate-500 font-medium">Phiếu khảo sát đã thu thập</p>
        </div>

        <div className="space-y-2 sm:px-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              Điểm trung bình
            </span>
            <Star size={24} className="text-amber-500" />
          </div>
          <div className="text-5xl font-light text-slate-900 flex items-baseline gap-1.5">
            {displayAverageRating !== null ? (
              <>
                <span>{displayAverageRating}</span>
                <span className="text-base text-slate-400 font-normal">/ 5.0</span>
              </>
            ) : (
              'N/A'
            )}
          </div>
          <p className="text-sm text-slate-500 font-medium">Dựa trên thang điểm 5 sao</p>
        </div>

        <div className="space-y-2 sm:pl-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              Điểm số trung bình
            </span>
            <Target size={24} className="text-purple-500" />
          </div>
          <div className="text-5xl font-light text-slate-900 flex items-baseline gap-1.5">
            {displayAverageSlider !== null ? (
              <>
                <span>{displayAverageSlider}</span>
                <span className="text-base text-slate-400 font-normal">/ 100</span>
              </>
            ) : (
              'N/A'
            )}
          </div>
          <p className="text-sm text-slate-500 font-medium">Dựa trên câu hỏi thang đo điểm</p>
        </div>
      </div>

      {/* Loading & Error States */}
      {loadingEvaluations && (
        <div className="py-16 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent"></div>
          <p className="text-base text-slate-500 font-medium">Đang truy vấn dữ liệu đánh giá cho Admin...</p>
        </div>
      )}

      {error && !loadingEvaluations && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <X size={16} className="currentColor" /> {error}
        </div>
      )}

      {/* Empty State */}
      {!loadingEvaluations && !error && filteredCampaigns.length === 0 && (
        <div className="py-16 text-center space-y-3">
          <BookOpen size={48} className="mx-auto text-gray-400" />
          <h3 className="font-medium text-slate-900 text-lg">Chưa có bài đánh giá nào</h3>
          <p className="text-base text-slate-500 max-w-md mx-auto leading-relaxed">
            Giảng viên này hiện chưa có bài nộp khảo sát nào trong đợt được chọn.
          </p>
        </div>
      )}

      {/* 3. Campaigns Evaluation Detail List (Accordion Style) */}
      {!loadingEvaluations && !error && filteredCampaigns.length > 0 && (
        <div className="flex flex-col divide-y divide-slate-100 mt-6 border-t border-slate-100">
          {filteredCampaigns.map((camp) => {
            const isExpanded = expandedCampaignId === camp.campaign_id;
            return (
              <div
                key={camp.campaign_id}
                className={`py-3 transition-all ${isExpanded ? 'space-y-6 pb-8' : ''}`}
              >
                {/* Campaign Header */}
                <div
                  className={`flex flex-col md:flex-row md:items-start justify-between gap-4 cursor-pointer group transition-colors duration-200 rounded-r-lg ${
                    isExpanded
                      ? 'bg-blue-50/50 border-l-4 border-blue-600 px-3.5 py-3'
                      : 'border-l-4 border-transparent hover:bg-slate-50 px-3.5 py-2'
                  }`}
                  onClick={() => setExpandedCampaignId(isExpanded ? null : camp.campaign_id)}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
                        Chiến dịch #{camp.campaign_id}
                      </span>
                      {camp.context_reference && (
                        <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
                          • Môn học: {camp.context_reference}
                        </span>
                      )}
                    </div>
                    <h2
                      className={`text-xl leading-snug flex items-center gap-2.5 transition-colors ${
                        isExpanded
                          ? 'text-blue-700 font-bold'
                          : 'text-slate-700 font-semibold group-hover:text-blue-600'
                      }`}
                    >
                      {camp.campaign_name}
                      <span
                        className={`inline-block transition-transform duration-300 ${
                          isExpanded
                            ? 'rotate-180 text-blue-600'
                            : 'rotate-0 text-gray-400 group-hover:text-blue-600'
                        }`}
                      >
                        <ChevronDown size={20} className="currentColor" />
                      </span>
                    </h2>
                    <p className="text-sm text-gray-500">{camp.survey_title}</p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 pt-1">
                    <div className="text-center">
                      <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider block">
                        Bài nộp
                      </span>
                      <span className="text-xl font-light text-gray-900">{camp.total_responses}</span>
                    </div>
                    {camp.average_rating !== null && (
                      <div className="text-center">
                        <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider block">
                          Hài lòng
                        </span>
                        <span className="text-xl font-light text-gray-900 flex items-center justify-center gap-1.5"><Star size={20} className="text-amber-500" fill="currentColor" /> {camp.average_rating}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Questions Breakdown */}
                {isExpanded && (
                  <div className="space-y-6 pt-2 pl-5 ml-1 border-l border-slate-200">
                    <h3 className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
                      Tổng hợp phản hồi chi tiết ({camp.questions?.length || 0} câu hỏi)
                    </h3>

                    <div className="flex flex-col">
                      {camp.questions.map((q, idx) => (
                        <div
                          key={q.question_id || idx}
                          className="py-5 border-b border-gray-100 last:border-0 space-y-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <span className="text-xl font-light text-gray-400 mt-0.5">
                                {idx + 1}.
                              </span>
                              <div className="space-y-1">
                                <h4 className="text-lg font-bold text-slate-800 leading-snug">
                                  {q.question_text}
                                </h4>
                                <span className="text-sm text-gray-500 inline-block">
                                  Loại: {q.type} • {q.answers_count} phản hồi
                                </span>
                              </div>
                            </div>

                            {q.average_score !== undefined && (
                              <div className="shrink-0 text-amber-600 text-lg font-medium flex items-center gap-1.5">
                                <Star size={20} fill="currentColor" />
                                <span>{q.average_score} / {q.max_score}</span>
                              </div>
                            )}
                          </div>

                          {/* Render Breakdown / Visual Charts based on question type */}
                          <div className="pl-8 pt-2 border-0 shadow-none">
                            {(() => {
                              const type = (q.type || '').toLowerCase();
                              switch (type) {
                                case 'radio':
                                case 'dropdown':
                                  return (
                                    <RadioAnalyticsCard
                                      breakdown={q.choice_breakdown || {}}
                                      total={q.answers_count || 0}
                                    />
                                  );
                                case 'checkbox':
                                  return (
                                    <CheckboxAnalyticsCard
                                      breakdown={q.choice_breakdown || {}}
                                      total={q.answers_count || 0}
                                    />
                                  );
                                case 'rating':
                                  return (
                                    <RatingAmazonStyleCard
                                      averageRating={q.average_score || 0}
                                      maxStars={q.max_score || 5}
                                      ratingBreakdown={q.choice_breakdown || {}}
                                      totalAnswers={q.answers_count || 0}
                                    />
                                  );
                                case 'slider':
                                  return (
                                    <SliderAnalyticsCard
                                      avgScore={q.average_score || 0}
                                      minScore={0}
                                      maxScore={q.max_score || 100}
                                    />
                                  );
                                case 'text':
                                  return <TextAnalyticsCard responses={q.comments || []} />;
                                case 'file_upload':
                                  return (
                                    <FileUploadDocumentGrid
                                      fileUrls={q.comments || []}
                                      onPreviewImage={() => {}}
                                    />
                                  );
                                default:
                                  return null;
                              }
                            })()}
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
    </div>
  );
}
