import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getSurveysApi,
  getSurveyByIdApi,
  deleteSurveyApi,
  getTrashSurveysApi,
  restoreSurveyApi,
  forceDeleteSurveyApi,
} from '../../api/surveys.api';
import { createCampaignApi } from '../../api/campaigns.api';
import { getSurveyQuestionsApi, replaceQuestionsBatchApi } from '../../api/questions.api';
import { getRolesApi } from '../../api/users.api';
import { Trash2, RefreshCw, XCircle, AlertTriangle, Lock, Check, X } from 'lucide-react';
import QuestionBuilder from '../../components/QuestionBuilder';
import SurveyLivePreview from '../../components/SurveyLivePreview';
import useDebounce from '../../hooks/useDebounce';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';
import FloatingAICopilot from '../../components/FloatingAICopilot';
import AiGoalsInput from '../../components/AiGoalsInput';

const DEFAULT_ROLES = ['Sinh viên', 'Giảng viên', 'Nhân sự', 'Trưởng khoa'];

export default function SurveysList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPage = parseInt(searchParams.get('page'), 10) || 1;
  const urlSearch = searchParams.get('search') || '';
  const urlSort = searchParams.get('sort') || 'newest';
  const urlFromDate = searchParams.get('fromDate') || '';
  const urlToDate = searchParams.get('toDate') || '';

  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchInput, 500);

  const [surveys, setSurveys] = useState([]);
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);
  const [meta, setMeta] = useState({ totalRecords: 0, totalPages: 1, currentPage: urlPage, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch dynamic roles from DB (excluding Guest)
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await getRolesApi();
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const filtered = res.data.filter((r) => r && String(r).trim().toLowerCase() !== 'guest');
          if (filtered.length > 0) {
            setAvailableRoles(filtered);
          }
        }
      } catch (err) {
        console.warn('Không thể tải danh sách vai trò từ hệ thống, dùng mặc định:', err);
      }
    };
    fetchRoles();
  }, []);

  // Trash Modal State
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashSurveys, setTrashSurveys] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [forceDeleteTarget, setForceDeleteTarget] = useState(null);

  const fetchTrashSurveys = async () => {
    try {
      setTrashLoading(true);
      const res = await getTrashSurveysApi({ limit: 50 });
      if (res.success && Array.isArray(res.data)) {
        setTrashSurveys(res.data);
      }
    } catch (err) {
      console.warn('Lỗi tải thùng rác:', err);
    } finally {
      setTrashLoading(false);
    }
  };

  const handleOpenTrashModal = () => {
    setShowTrashModal(true);
    fetchTrashSurveys();
  };

  const handleRestoreSurvey = async (id, title) => {
    try {
      const res = await restoreSurveyApi(id);
      if (res.success) {
        setSuccessMsg(`Đã khôi phục Mẫu Form "${title}" thành công!`);
        fetchTrashSurveys();
        fetchData();
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Khôi phục Mẫu Form thất bại');
    }
  };

  const handleForceDeleteSurvey = async () => {
    if (!forceDeleteTarget) return;
    try {
      const res = await forceDeleteSurveyApi(forceDeleteTarget.id);
      if (res.success) {
        setSuccessMsg(`Đã xóa vĩnh viễn Mẫu Form "${forceDeleteTarget.title}"!`);
        setForceDeleteTarget(null);
        fetchTrashSurveys();
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xóa vĩnh viễn Mẫu Form này');
    }
  };

  // Modal Campaign state
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [targetRoles, setTargetRoles] = useState(['Sinh viên']);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submittingCampaign, setSubmittingCampaign] = useState(false);
  const [aiGoals, setAiGoals] = useState([]);

  const handleToggleRole = (role) => {
    if (targetRoles.includes(role)) {
      if (targetRoles.length === 1) return;
      setTargetRoles(targetRoles.filter((r) => r !== role));
    } else {
      setTargetRoles([...targetRoles, role]);
    }
  };

  // Standalone Separate Preview Window State (opens on the right)
  const [showSeparatePreview, setShowSeparatePreview] = useState(false);

  // Sync search input when URL param changes externally
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // When debounced search value changes, update URL and reset page to 1
  useEffect(() => {
    const currentUrlSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentUrlSearch) {
      const params = { page: 1 };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (urlSort && urlSort !== 'newest') params.sort = urlSort;
      if (urlFromDate) params.fromDate = urlFromDate;
      if (urlToDate) params.toDate = urlToDate;
      setSearchParams(params);
    }
  }, [debouncedSearch]);

  const handleSortChange = (e) => {
    const newSort = e.target.value;
    const params = { page: 1 };
    if (urlSearch) params.search = urlSearch;
    if (newSort !== 'newest') params.sort = newSort;
    if (urlFromDate) params.fromDate = urlFromDate;
    if (urlToDate) params.toDate = urlToDate;
    setSearchParams(params);
  };

  const handleFromDateChange = (e) => {
    const val = e.target.value;
    const params = { page: 1 };
    if (urlSearch) params.search = urlSearch;
    if (urlSort && urlSort !== 'newest') params.sort = urlSort;
    if (val) params.fromDate = val;
    if (urlToDate) params.toDate = urlToDate;
    setSearchParams(params);
  };

  const handleToDateChange = (e) => {
    const val = e.target.value;
    const params = { page: 1 };
    if (urlSearch) params.search = urlSearch;
    if (urlSort && urlSort !== 'newest') params.sort = urlSort;
    if (urlFromDate) params.fromDate = urlFromDate;
    if (val) params.toDate = val;
    setSearchParams(params);
  };

  const handleClearDateRange = () => {
    const params = { page: 1 };
    if (urlSearch) params.search = urlSearch;
    if (urlSort && urlSort !== 'newest') params.sort = urlSort;
    setSearchParams(params);
  };

  const fetchSurveys = async (page = urlPage, search = urlSearch, sort = urlSort, fromDate = urlFromDate, toDate = urlToDate) => {
    try {
      setLoading(true);
      setError('');
      const res = await getSurveysApi({ page, limit: 10, search, sort, fromDate, toDate });
      if (res.success) {
        setSurveys(res.data || []);
        if (res.meta) {
          setMeta(res.meta);
        }
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
    fetchSurveys(urlPage, urlSearch, urlSort, urlFromDate, urlToDate);
  }, [urlPage, urlSearch, urlSort, urlFromDate, urlToDate]);

  const handlePageChange = (newPage) => {
    const params = { page: newPage };
    if (urlSearch) params.search = urlSearch;
    if (urlSort && urlSort !== 'newest') params.sort = urlSort;
    if (urlFromDate) params.fromDate = urlFromDate;
    if (urlToDate) params.toDate = urlToDate;
    setSearchParams(params);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Form khảo sát "${title}"?`)) {
      return;
    }
    try {
      const res = await deleteSurveyApi(id);
      if (res.success) {
        setSuccessMsg(`Đã xóa khảo sát "${title}" thành công.`);
        fetchSurveys();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Xóa khảo sát thất bại');
    }
  };

  const handleOpenCampaignModal = async (survey) => {
    setSelectedSurvey(survey);
    setCampaignName(`Form khảo sát: ${survey.title}`);
    setCampaignDescription(survey.description || '');
    setShowSeparatePreview(false);
    setAiGoals(Array.isArray(survey.ai_goals) ? [...survey.ai_goals] : []);
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(nextWeek);
    setTargetRole('Sinh viên');

    try {
      setLoadingQuestions(true);
      const [res, survDetailRes] = await Promise.all([
        getSurveyQuestionsApi(survey.id),
        getSurveyByIdApi(survey.id),
      ]);
      if (survDetailRes.success && survDetailRes.data) {
        setSelectedSurvey(survDetailRes.data);
        if (Array.isArray(survDetailRes.data.ai_goals)) {
          setAiGoals(survDetailRes.data.ai_goals);
        }
      }
      if (res.success && Array.isArray(res.data)) {
        setQuestions(res.data);
      } else {
        setQuestions([]);
      }
    } catch {
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleCreateCampaignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSurvey) return;

    if (new Date(startDate) > new Date(endDate)) {
      alert('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!');
      return;
    }

    try {
      setSubmittingCampaign(true);

      await replaceQuestionsBatchApi(selectedSurvey.id, questions);

      const res = await createCampaignApi({
        survey_id: selectedSurvey.id,
        name: campaignName,
        description: campaignDescription,
        start_date: startDate,
        end_date: endDate,
        is_anonymous: isAnonymous,
        target_role: targetRoles,
        ai_goals: aiGoals,
      });

      if (res.success) {
        setSuccessMsg(`Đã tạo thành công form khảo sát và giao cho ${res.data?.assigned_users_count || 0} người dùng!`);
        setSelectedSurvey(null);
        setShowSeparatePreview(false);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Tạo form khảo sát thất bại');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quản lý mẫu Form Khảo sát</h1>
          <p className="text-sm text-gray-500 mb-6">
            Tạo mới, chỉnh sửa giao diện & câu hỏi, hoặc triển khai thành các form khảo sát.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleOpenTrashModal}
            className="bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium text-sm px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            title="Xem danh sách Mẫu Form đã xóa"
          >
            <Trash2 size={20} className="currentColor" /> Thùng rác
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/surveys/create')}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-6 py-2 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>+ Tạo mẫu Form mới</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-md text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Check size={16} className="currentColor" /> {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-800 cursor-pointer">
            <X size={16} className="currentColor" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm font-medium flex items-center gap-1.5">
          <X size={16} className="currentColor" /> {error}
        </div>
      )}

      {/* Surveys Table / List (Borderless Container) */}
      <div className="space-y-6 pt-4">
        {/* Table Header with Search Input & Sort Dropdown */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
          <div className="text-sm text-gray-500 font-medium shrink-0">
            Danh sách Form khảo sát ({meta.totalRecords || 0})
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-6">
            {/* Date Range Filter */}
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="text-gray-500">Từ:</span>
              <input
                type="date"
                value={urlFromDate}
                onChange={handleFromDateChange}
                className="bg-transparent border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 cursor-pointer"
              />
              <span className="text-gray-500">Đến:</span>
              <input
                type="date"
                value={urlToDate}
                onChange={handleToDateChange}
                className="bg-transparent border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 cursor-pointer"
              />
              {(urlFromDate || urlToDate) && (
                <button
                  type="button"
                  onClick={handleClearDateRange}
                  className="ml-2 text-gray-400 hover:text-red-600 font-medium text-sm flex items-center justify-center"
                  title="Xóa bộ lọc ngày"
                >
                  <X size={14} className="currentColor" />
                </button>
              )}
            </div>

            <select
              value={urlSort}
              onChange={handleSortChange}
              className="text-sm border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>

            <SearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên Form..."
              className="w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent mb-3"></div>
            <p className="text-base font-medium">Đang tải danh sách Form khảo sát...</p>
          </div>
        ) : surveys.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-900 font-medium mb-2 text-lg">
              {urlSearch ? 'Không tìm thấy Form khảo sát nào khớp với từ khóa' : 'Chưa có Form khảo sát nào được tạo'}
            </p>
            <p className="text-gray-500 text-base mb-6">
              {urlSearch ? `Không có kết quả nào cho "${urlSearch}"` : 'Hãy bấm nút "Tạo Form khảo sát mới" để khởi tạo bài khảo sát đầu tiên'}
            </p>
            {!urlSearch && (
              <button
                onClick={() => navigate('/admin/surveys/create')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-6 py-2 rounded-md transition-colors cursor-pointer"
              >
                + Tạo ngay
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Tên Form Khảo sát</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Mô tả</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Màu chủ đạo</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Người tạo</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Ngày tạo</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 text-right border-b border-gray-200">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {surveys.map((item) => {
                    const primaryColor = item.theme_config?.primaryColor || '#2563eb';
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="py-4 px-3 font-medium text-gray-900">
                          <span className="block text-base truncate max-w-xs" title={item.title}>{item.title}</span>
                        </td>
                        <td className="py-4 px-3 text-gray-500 text-sm max-w-xs truncate" title={item.description || ''}>
                          {item.description || <span className="italic text-gray-300">Chưa có mô tả</span>}
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-full border border-gray-200 inline-block shadow-sm shrink-0"
                              style={{ backgroundColor: primaryColor }}
                            ></span>
                            <span className="text-xs text-gray-500 uppercase font-mono">{primaryColor}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-gray-600 text-sm">
                          {item.created_by_name || 'Admin'}
                        </td>
                        <td className="py-4 px-3 text-gray-500 text-sm">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-4 px-3 text-right space-x-4">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/surveys/edit/${item.id}`)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition cursor-pointer"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.title)}
                            className="text-sm font-medium text-red-600 hover:text-red-800 transition cursor-pointer"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination meta={meta} onPageChange={handlePageChange} />
          </>
        )}
      </div>

      {/* DUAL WINDOW OVERLAY: Left Modal (Campaign Creation) + Right Standalone Live Preview Window */}
      {selectedSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-x-auto overflow-y-auto">
          <div className="flex items-start justify-center gap-6 w-full max-w-[96vw] my-4">

            {/* LEFT WINDOW: Campaign Creation Modal Card */}
            <div
              className={`bg-white rounded-lg shadow-xl transition-all duration-300 p-6 border border-gray-200 max-h-[92vh] flex flex-col ${showSeparatePreview ? 'w-[52%] shrink-0' : 'max-w-4xl w-full'
                }`}
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Tạo Form Khảo sát</h3>
                  <p className="text-xs text-gray-500">
                    Mẫu khảo sát: <span className="font-semibold text-gray-700">{selectedSurvey.title}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSurvey(null);
                    setShowSeparatePreview(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} className="currentColor" />
                </button>
              </div>

              <form onSubmit={handleCreateCampaignSubmit} className="space-y-6 overflow-y-auto pr-1 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="space-y-3 md:col-span-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Tên form khảo sát <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Ví dụ: Đánh giá chất lượng môn học Học kỳ 1 2024"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Mô tả chi tiết form khảo sát (Hiển thị cho người nộp bài)
                      </label>
                      <input
                        type="text"
                        value={campaignDescription}
                        onChange={(e) => setCampaignDescription(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Nhập mô tả hoặc hướng dẫn riêng cho form khảo sát này..."
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600">
                      Đối tượng giao khảo sát <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-gray-50 border border-gray-300 rounded-xl p-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-100 transition">
                          <input
                            type="checkbox"
                            checked={targetRoles.length === availableRoles.length}
                            onChange={(e) => {
                              if (e.target.checked) setTargetRoles([...availableRoles]);
                              else setTargetRoles(availableRoles.length > 0 ? [availableRoles[0]] : []);
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                          />
                          <span>Tất cả người dùng</span>
                        </label>

                        {availableRoles.map((roleName) => {
                          const isChecked = targetRoles.includes(roleName);
                          return (
                            <label
                              key={roleName}
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer px-2.5 py-1.5 rounded-lg border transition ${isChecked
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm font-bold'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleRole(roleName)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                              />
                              <span>{roleName}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-gray-500 italic pt-0.5 flex items-center gap-1">
                        <Check size={12} className="currentColor" />
                        {targetRoles.length === availableRoles.length
                          ? `Giao bài cho TẤT CẢ các đối tượng người dùng (${availableRoles.join(', ')}).`
                          : `Tự động giao bài khảo sát cho các nhóm: ${targetRoles.join(', ')}.`}
                      </p>
                    </div>
                  </div>

                  {/* Anonymous Survey Toggle */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={20} className="text-amber-600" />
                      <div>
                        <span className="text-xs font-bold text-amber-900 block">
                          Khảo sát Ẩn danh (Bảo mật danh tính người nộp)
                        </span>
                        <span className="text-[11px] text-amber-800">
                          Nếu bật, bài nộp sẽ không lưu danh tính người dùng trong báo cáo chi tiết.
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Ngày bắt đầu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Ngày kết thúc <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* AI Analysis Goals Input Component */}
                <div className="pt-2">
                  <AiGoalsInput aiGoals={aiGoals} setAiGoals={setAiGoals} />
                </div>

                {/* Question Builder inside Campaign Modal */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-800">
                      Cấu hình & Tùy chỉnh Các Câu hỏi Cho Form Khảo sát Này
                    </h4>
                    <span className="text-xs text-gray-400">
                      Thêm/bớt câu hỏi, kiểu câu hỏi, số lượng câu trả lời & độ bắt buộc
                    </span>
                  </div>

                  {loadingQuestions ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Đang tải danh sách câu hỏi...
                    </div>
                  ) : (
                    <QuestionBuilder
                      questions={questions}
                      setQuestions={setQuestions}
                      onPreview={() => setShowSeparatePreview(!showSeparatePreview)}
                      isTemplateEntity={true}
                      aiGoals={aiGoals}
                    />
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSurvey(null);
                      setShowSeparatePreview(false);
                    }}
                    className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCampaign}
                    className="px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md hover:shadow-lg transition disabled:opacity-50"
                  >
                    {submittingCampaign ? 'Đang khởi tạo & lưu câu hỏi...' : 'Khởi chạy & Giao bài'}
                  </button>
                </div>
              </form>
            </div>

            {/* RIGHT WINDOW: Standalone Separate Live Preview Window */}
            {showSeparatePreview && (
              <div className="w-[46%] shrink-0 max-h-[92vh] flex flex-col animate-fadeIn">
                <SurveyLivePreview
                  title={campaignName || selectedSurvey.title || 'Xem trước Form Khảo sát'}
                  description={campaignDescription || selectedSurvey.description || ''}
                  primaryColor={selectedSurvey.theme_config?.primaryColor || '#2563eb'}
                  fontFamily={selectedSurvey.theme_config?.fontFamily || 'Inter'}
                  logoUrl={selectedSurvey.theme_config?.logoUrl || ''}
                  coverImageUrl={selectedSurvey.theme_config?.coverImageUrl || ''}
                  surveyType={selectedSurvey.theme_config?.surveyType || 'STANDARD'}
                  questions={questions}
                  onClose={() => setShowSeparatePreview(false)}
                />
              </div>
            )}

          </div>
        </div>
      )}

      {/* Trash Modal for Surveys */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full shadow-xl border border-gray-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Trash2 size={24} className="text-gray-900" />
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Thùng rác Mẫu Form Khảo sát</h3>
                  <p className="text-xs text-gray-500 font-medium">Danh sách các Mẫu Form đã xóa mềm. Bạn có thể khôi phục hoặc xóa vĩnh viễn.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTrashModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={20} className="currentColor" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {trashLoading ? (
                <div className="p-8 text-center text-xs text-gray-400 font-medium">Đang tải Thùng rác...</div>
              ) : trashSurveys.length === 0 ? (
                <div className="p-10 text-center text-gray-400 space-y-2 flex flex-col items-center">
                  <Trash2 size={32} className="text-gray-400" />
                  <p className="text-xs font-semibold text-gray-600">Thùng rác trống</p>
                  <p className="text-[11px] text-gray-400">Không có Mẫu Form nào bị xóa mềm.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-2.5 px-3 border-b border-gray-200">Tên Mẫu Form</th>
                      <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-2.5 px-3 border-b border-gray-200">Thời gian xóa</th>
                      <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-2.5 px-3 text-right border-b border-gray-200">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trashSurveys.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-3">
                          <p className="font-bold text-gray-900">{item.title}</p>
                          <p className="text-[11px] text-gray-500 line-clamp-1">{item.description || 'Không có mô tả'}</p>
                        </td>
                        <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">
                          {item.deleted_at ? new Date(item.deleted_at).toLocaleString('vi-VN') : 'Mới đây'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRestoreSurvey(item.id, item.title)}
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition flex items-center gap-1"
                            >
                              <RefreshCw size={14} className="currentColor" /> Phục hồi
                            </button>
                            <button
                              type="button"
                              onClick={() => setForceDeleteTarget(item)}
                              className="px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 transition flex items-center gap-1"
                            >
                              <XCircle size={14} className="currentColor" /> Xóa vĩnh viễn
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTrashModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Confirm Modal for Force Delete */}
      {forceDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle size={32} className="currentColor" />
              <div>
                <h3 className="text-base font-black text-gray-900">Xác nhận xóa vĩnh viễn</h3>
                <p className="text-xs text-rose-600 font-semibold">Cảnh báo: Hành động này KHÔNG THỂ hoàn tác!</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa VĨNH VIỄN Mẫu Form <b>"{forceDeleteTarget.title}"</b> khỏi hệ thống? Dữ liệu này sẽ mất hoàn toàn và không thể khôi phục.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setForceDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleForceDeleteSurvey}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition flex items-center gap-2"
              >
                <XCircle size={16} className="currentColor" /> Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Form Generator Copilot Widget */}
      <FloatingAICopilot />
    </div>
  );
}
