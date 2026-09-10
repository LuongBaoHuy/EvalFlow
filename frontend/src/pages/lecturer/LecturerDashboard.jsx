import React, { useState, useEffect } from 'react';
import { getMyEvaluationsApi } from '../../api/lecturer.api';
import { getUser } from '../../utils/auth.utils';
import { 
  RadioAnalyticsCard, 
  CheckboxAnalyticsCard, 
  SliderAnalyticsCard, 
  RatingAmazonStyleCard, 
  TextAnalyticsCard, 
  FileUploadDocumentGrid 
} from '../admin/CampaignResults';

export default function LecturerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  const currentUser = getUser() || {};

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyEvaluationsApi();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Không thể tải báo cáo đánh giá giảng viên');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi kết nối hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const overview = data?.overview || { total_evaluations: 0, overall_average_rating: null, campaigns_count: 0 };
  const rawCampaigns = data?.campaigns || [];

  const ratingScores = [];
  rawCampaigns.forEach((camp) => {
    (camp.questions || []).forEach((q) => {
      const qType = (q.type || '').toLowerCase();
      const avg = parseFloat(q.average_score);
      if (qType === 'rating' && Number.isFinite(avg)) {
        ratingScores.push(Math.min(Math.max(avg, 0), 5.0));
      }
    });
  });

  const displayAverageRating = ratingScores.length > 0
    ? (Math.min(ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length, 5.0)).toFixed(1)
    : (overview.overall_average_rating !== null && overview.overall_average_rating !== undefined
      ? (Math.min(parseFloat(overview.overall_average_rating), 5.0)).toFixed(1)
      : null);

  // Extract unique subjects/courses for filtering
  const availableSubjects = Array.from(
    new Set(rawCampaigns.map((c) => c.context_reference).filter(Boolean))
  );

  // Filter & Sort logic
  const filteredCampaigns = rawCampaigns
    .filter((c) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.campaign_name?.toLowerCase().includes(q);
        const matchSurvey = c.survey_title?.toLowerCase().includes(q);
        const matchContext = c.context_reference?.toLowerCase().includes(q);
        const matchId = String(c.campaign_id).includes(q);
        if (!matchName && !matchSurvey && !matchContext && !matchId) return false;
      }

      // 2. Subject / Course Filter
      if (selectedSubject !== 'all') {
        if (c.context_reference !== selectedSubject) return false;
      }

      // 3. Rating / Submissions Filter
      const rating = c.average_rating !== null ? parseFloat(c.average_rating) : null;
      const responses = c.total_responses || 0;
      if (ratingFilter === 'high') {
        if (rating === null || rating < 4.0) return false;
      } else if (ratingFilter === 'medium') {
        if (rating === null || rating < 3.0 || rating >= 4.0) return false;
      } else if (ratingFilter === 'low') {
        if (rating === null || rating >= 3.0) return false;
      } else if (ratingFilter === 'has_responses') {
        if (responses === 0) return false;
      } else if (ratingFilter === 'no_responses') {
        if (responses > 0) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // By default ('newest'): Latest created campaign on top (highest ID or date)
      if (sortBy === 'newest') {
        return (b.campaign_id || 0) - (a.campaign_id || 0);
      }
      if (sortBy === 'oldest') {
        return (a.campaign_id || 0) - (b.campaign_id || 0);
      }
      if (sortBy === 'rating_desc') {
        const rA = a.average_rating !== null ? parseFloat(a.average_rating) : -1;
        const rB = b.average_rating !== null ? parseFloat(b.average_rating) : -1;
        return rB - rA || (b.campaign_id || 0) - (a.campaign_id || 0);
      }
      if (sortBy === 'rating_asc') {
        const rA = a.average_rating !== null ? parseFloat(a.average_rating) : 999;
        const rB = b.average_rating !== null ? parseFloat(b.average_rating) : 999;
        return rA - rB || (b.campaign_id || 0) - (a.campaign_id || 0);
      }
      if (sortBy === 'responses_desc') {
        return (b.total_responses || 0) - (a.total_responses || 0) || (b.campaign_id || 0) - (a.campaign_id || 0);
      }
      if (sortBy === 'responses_asc') {
        return (a.total_responses || 0) - (b.total_responses || 0) || (b.campaign_id || 0) - (a.campaign_id || 0);
      }
      return (b.campaign_id || 0) - (a.campaign_id || 0);
    });

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>Giảng Viên • Dashboard Cá Nhân</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span>Kết Quả Đánh Giá Giảng Dạy</span>
          </h1>
          <p className="text-base text-gray-700 max-w-2xl leading-relaxed">
            Xin chào <span className="text-gray-900 font-medium">{currentUser.full_name || 'Thầy/Cô'}</span>! Dưới đây là tổng hợp phản hồi và kết quả khảo sát từ sinh viên cho các học phần giảng dạy của bạn.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchEvaluations}
          disabled={loading}
          className="bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900 text-sm font-medium px-4 py-2 rounded-md transition-colors flex items-center gap-2 self-start md:self-auto cursor-pointer shrink-0"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* 3 Metric Cards Grid with Vertical Dividers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x sm:divide-slate-100 py-6">
        <div className="flex flex-col space-y-2 sm:pr-8">
          <span className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
            Tổng số bài đánh giá
          </span>
          <div className="text-4xl font-light text-gray-900 tracking-tight">
            {overview.total_evaluations}
          </div>
          <span className="text-sm text-gray-500">Phiếu đánh giá đã nhận</span>
        </div>

        <div className="flex flex-col space-y-2 sm:px-8">
          <span className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
            Điểm trung bình chung
          </span>
          <div className="text-4xl font-light text-gray-900 tracking-tight flex items-baseline gap-1.5">
            {displayAverageRating !== null ? (
              <>
                <span>{displayAverageRating}</span>
                <span className="text-base text-gray-400">/ 5.0</span>
              </>
            ) : (
              'N/A'
            )}
          </div>
          <span className="text-sm text-gray-500">Dựa trên thang điểm 5 sao</span>
        </div>

        <div className="flex flex-col space-y-2 sm:pl-8">
          <span className="text-sm font-semibold uppercase text-gray-400 tracking-wider">
            Đợt khảo sát tham gia
          </span>
          <div className="text-4xl font-light text-gray-900 tracking-tight">
            {overview.campaigns_count}
          </div>
          <span className="text-sm text-gray-500">Đợt khảo sát được giao</span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-4 border-b border-slate-100">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tên đợt khảo sát, học phần..."
            className="w-full text-base border-b border-gray-300 py-2 focus:outline-none focus:border-gray-900 text-gray-900 placeholder:text-gray-400 bg-transparent transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Subject Filter */}
          {availableSubjects.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Học phần:</span>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="text-sm border-b border-gray-300 py-1.5 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer"
              >
                <option value="all">Tất cả học phần</option>
                {availableSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Rating / Submissions Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Đánh giá:</span>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="text-sm border-b border-gray-300 py-1.5 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer"
            >
              <option value="all">Tất cả mức đánh giá</option>
              <option value="high">⭐ Rất tốt (≥ 4.0)</option>
              <option value="medium">⭐ Trung bình (3.0 - 3.9)</option>
              <option value="low">⭐ Cần cải thiện (&lt; 3.0)</option>
              <option value="has_responses">📥 Đã có bài nộp</option>
              <option value="no_responses">⏳ Chưa có bài nộp</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border-b border-gray-300 py-1.5 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer font-medium"
            >
              <option value="newest">Mới nhất (Mặc định)</option>
              <option value="oldest">Cũ nhất</option>
              <option value="rating_desc">Điểm đánh giá (Cao ➔ Thấp)</option>
              <option value="rating_asc">Điểm đánh giá (Thấp ➔ Cao)</option>
              <option value="responses_desc">Lượt nộp bài (Nhiều ➔ Ít)</option>
              <option value="responses_asc">Lượt nộp bài (Ít ➔ Nhiều)</option>
            </select>
          </div>

          <span className="text-xs font-medium text-gray-400 self-center">
            Hiển thị {filteredCampaigns.length} / {rawCampaigns.length} đợt
          </span>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="py-16 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
          <p className="text-base text-gray-500">Đang truy vấn dữ liệu đánh giá giảng viên...</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-red-600 py-4 text-base font-medium">
          ✕ {error}
        </div>
      )}

      {/* Empty Data Banner */}
      {!loading && !error && filteredCampaigns.length === 0 && (
        <div className="py-16 text-center space-y-3">
          <div className="text-4xl">📚</div>
          <h3 className="font-medium text-gray-900 text-lg">Chưa có bài đánh giá nào</h3>
          <p className="text-base text-gray-500 max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? 'Không tìm thấy kết quả phù hợp với từ khóa tìm kiếm.'
              : 'Hiện tại chưa có dữ liệu bài nộp khảo sát nào được ghi nhận cho tài khoản của bạn.'}
          </p>
        </div>
      )}

      {/* Campaigns List */}
      {!loading && !error && filteredCampaigns.length > 0 && (
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
                  <h2 className={`text-xl leading-snug flex items-center gap-2.5 transition-colors ${
                    isExpanded 
                      ? 'text-blue-700 font-bold' 
                      : 'text-slate-700 font-semibold group-hover:text-blue-600'
                  }`}>
                    {camp.campaign_name}
                    <span className={`text-sm inline-block transition-transform duration-300 ${
                      isExpanded ? 'rotate-180 text-blue-600' : 'rotate-0 text-gray-400 group-hover:text-blue-600'
                    }`}>▼</span>
                  </h2>
                  <p className="text-sm text-gray-500">{camp.survey_title}</p>
                </div>

                <div className="flex items-center gap-6 shrink-0 pt-1">
                  <div className="text-center">
                    <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider block">Bài nộp</span>
                    <span className="text-xl font-light text-gray-900">{camp.total_responses}</span>
                  </div>
                  {camp.average_rating !== null && (
                    <div className="text-center">
                      <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider block">Hài lòng</span>
                      <span className="text-xl font-light text-gray-900">⭐ {camp.average_rating}</span>
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

                        {/* Rating Score Badge */}
                        {q.average_score !== undefined && (
                          <div className="shrink-0 text-amber-600 text-lg font-medium flex items-center gap-1.5">
                            <span>⭐</span>
                            <span>{q.average_score} / {q.max_score}</span>
                          </div>
                        )}
                      </div>

                      <div className="pl-8 pt-2 border-0 shadow-none">
                        {(() => {
                          const type = (q.type || '').toLowerCase();
                          switch (type) {
                            case 'radio':
                            case 'dropdown':
                              return <RadioAnalyticsCard breakdown={q.choice_breakdown || {}} total={q.answers_count || 0} />;
                            case 'checkbox':
                              return <CheckboxAnalyticsCard breakdown={q.choice_breakdown || {}} total={q.answers_count || 0} />;
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
                              return <FileUploadDocumentGrid fileUrls={q.comments || []} onPreviewImage={() => {}} />;
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

