import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getCampaignsApi,
  getCampaignByIdApi,
  toggleCampaignStatusApi,
  deleteCampaignApi,
  createCampaignApi,
  updateCampaignApi,
  downloadCampaignTemplateApi,
  downloadAssignmentFileApi,
  getTrashCampaignsApi,
  restoreCampaignApi,
  forceDeleteCampaignApi,
} from '../../api/campaigns.api';
import { getSurveysApi, getSurveyByIdApi, createSurveyApi } from '../../api/surveys.api';
import { getSurveyQuestionsApi, replaceQuestionsBatchApi } from '../../api/questions.api';
import { getRolesApi } from '../../api/users.api';
import QuestionBuilder from '../../components/QuestionBuilder';
import MatrixWysiwygEditor from '../../components/matrix/MatrixWysiwygEditor';
import SurveyLivePreview from '../../components/SurveyLivePreview';
import ConflictWarningModal from '../../components/ConflictWarningModal';
import AiGoalsInput from '../../components/AiGoalsInput';
import { getUser } from '../../utils/auth.utils';
import useDebounce from '../../hooks/useDebounce';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';
import ActionMenu from '../../components/ActionMenu';
import { Trash2, Check, X, AlertTriangle, ClipboardList, Paperclip, FileText, Pin, Lock, Globe, RefreshCw, FileSpreadsheet, UploadCloud, Download, CheckCircle2, GitMerge } from 'lucide-react';

const DEFAULT_ROLES = ['Sinh viên', 'Giảng viên', 'Nhân sự', 'Trưởng khoa'];

function formatLocalDateTimeInput(d, defaultTime = '00:00') {
  if (!d) return '';
  if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)) {
    return d.substring(0, 16);
  }
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTimeDisplay(d) {
  if (!d) return 'N/A';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return 'N/A';
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

const ALL_AVAILABLE_ROLES = ['Sinh viên', 'Giảng viên', 'Nhân sự', 'Trưởng khoa'];

function getCampaignStatusBadge(item) {
  const now = new Date();
  const start = item.start_date ? new Date(item.start_date) : null;
  const end = item.end_date ? new Date(item.end_date) : null;

  if (end && now > end) {
    return {
      label: '● Đã kết thúc',
      className: 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200',
    };
  }

  if (!item.is_active) {
    return {
      label: '○ Tạm dừng',
      className: 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200',
    };
  }

  if (start && now < start) {
    return {
      label: '● Sắp diễn ra',
      className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200',
    };
  }

  return {
    label: '● Đang hoạt động',
    className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200',
  };
}

export default function CampaignsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPage = parseInt(searchParams.get('page'), 10) || 1;
  const urlSearch = searchParams.get('search') || '';
  const urlStatus = searchParams.get('status') || 'all';
  const urlFromDate = searchParams.get('fromDate') || '';
  const urlToDate = searchParams.get('toDate') || '';

  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchInput, 500);

  const [campaigns, setCampaigns] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);
  const [meta, setMeta] = useState({ totalRecords: 0, totalPages: 1, currentPage: urlPage, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [toastMessage, setToastMessage] = useState('');

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

  // Edit vs Create Modal State
  const [editingCampaignId, setEditingCampaignId] = useState(null);
  const [editingCampaignAssignmentFileUrl, setEditingCampaignAssignmentFileUrl] = useState(null);
  const [downloadingAssignmentFile, setDownloadingAssignmentFile] = useState(false);
  const [hasResponses, setHasResponses] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const handleDownloadOriginalAssignmentFile = async () => {
    if (!editingCampaignAssignmentFileUrl) return;
    try {
      setDownloadingAssignmentFile(true);
      // responseType: 'blob' → res.data is already a Blob, do NOT wrap again
      const res = await downloadAssignmentFileApi(editingCampaignId);
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = campaignTitle
        ? campaignTitle.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'PhanCong';
      link.setAttribute('download', `PhanCongGoc_${editingCampaignId}_${safeName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tải xuống file phân công gốc');
    } finally {
      setDownloadingAssignmentFile(false);
    }
  };

  const handleCopyLink = (campaignId) => {
    const shareUrl = `${window.location.origin}/surveys/do/${campaignId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          setToastMessage('Đã copy link thành công');
          setTimeout(() => setToastMessage(''), 3000);
        })
        .catch(() => {
          fallbackCopyText(shareUrl);
        });
    } else {
      fallbackCopyText(shareUrl);
    }
  };

  const fallbackCopyText = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setToastMessage('Đã copy link thành công');
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Campaign Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [isCreatingNewForm, setIsCreatingNewForm] = useState(false);
  const [newSurveyTitle, setNewSurveyTitle] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [isWorkflowEnabled, setIsWorkflowEnabled] = useState(false);
  const [workflowSteps, setWorkflowSteps] = useState([
    { step_order: 1, step_name: 'Cố vấn học tập duyệt', reviewer_role: 'Giảng viên', can_edit_answers: true },
    { step_order: 2, step_name: 'Khoa chốt điểm', reviewer_role: 'Admin', can_edit_answers: true },
  ]);
  const [targetRoles, setTargetRoles] = useState(['Sinh viên']);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Excel Assignment Mode State
  const [useExcelAssignment, setUseExcelAssignment] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const excelFileInputRef = useRef(null);

  // AI Analysis Goals state
  const [aiGoals, setAiGoals] = useState([]);

  const handleToggleRole = (role) => {
    if (targetRoles.includes(role)) {
      setTargetRoles(targetRoles.filter((r) => r !== role));
    } else {
      setTargetRoles([...targetRoles, role]);
    }
  };

  // Standalone Separate Preview Window State (opens on the right)
  const [showSeparatePreview, setShowSeparatePreview] = useState(false);

  // Trash Modal State for Campaigns
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashCampaigns, setTrashCampaigns] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [trashLoading, setTrashLoading] = useState(false);
  const [forceDeleteTarget, setForceDeleteTarget] = useState(null);

  const fetchTrashCampaigns = async () => {
    try {
      setTrashLoading(true);
      const res = await getTrashCampaignsApi({ limit: 50 });
      if (res.success && Array.isArray(res.data)) {
        setTrashCampaigns(res.data);
        setTrashCount(res.meta?.totalRecords ?? res.data.length ?? 0);
      }
    } catch (err) {
      console.warn('Lỗi tải thùng rác chiến dịch:', err);
    } finally {
      setTrashLoading(false);
    }
  };

  const handleOpenTrashModal = () => {
    setShowTrashModal(true);
    fetchTrashCampaigns();
  };

  const handleRestoreCampaign = async (id, name) => {
    try {
      const res = await restoreCampaignApi(id);
      if (res.success) {
        setSuccessMsg(`Đã khôi phục form khảo sát "${name}" thành công!`);
        fetchTrashCampaigns();
        fetchData();
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Khôi phục form khảo sát thất bại');
    }
  };

  const handleForceDeleteCampaign = async () => {
    if (!forceDeleteTarget) return;
    try {
      const res = await forceDeleteCampaignApi(forceDeleteTarget.id);
      if (res.success) {
        setSuccessMsg(`Đã xóa vĩnh viễn form khảo sát "${forceDeleteTarget.name}"!`);
        setForceDeleteTarget(null);
        fetchTrashCampaigns();
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      // Requirement 4: Display exact constraint message if campaign has responses
      alert(err.response?.data?.message || 'Không thể xóa vĩnh viễn đợt khảo sát này');
    }
  };

  // Auto-Save Draft State for Campaign Modal (Key: admin_draft_campaign)
  const DRAFT_KEY = 'admin_draft_campaign';
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [pendingDraftData, setPendingDraftData] = useState(null);

  // Snapshot & Conflict Modal State
  const [originalTemplateQuestions, setOriginalTemplateQuestions] = useState([]);
  const [showQuestionConflictModal, setShowQuestionConflictModal] = useState(false);
  const [editingVersion, setEditingVersion] = useState(1);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Auto-save effect with 1 second debounce
  useEffect(() => {
    if (!isModalOpen || editingCampaignId || draftPromptOpen || submitting) return;
    if (!campaignName && !newSurveyTitle && questions.length === 0) return;

    const timer = setTimeout(() => {
      const draftObj = {
        selectedSurveyId,
        isCreatingNewForm,
        newSurveyTitle,
        campaignName,
        campaignDescription,
        startDate,
        endDate,
        isAnonymous,
        isPublic,
        targetRoles,
        useExcelAssignment,
        questions,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftObj));
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    isModalOpen,
    editingCampaignId,
    draftPromptOpen,
    submitting,
    selectedSurveyId,
    isCreatingNewForm,
    newSurveyTitle,
    campaignName,
    campaignDescription,
    startDate,
    endDate,
    isAnonymous,
    isPublic,
    targetRoles,
    useExcelAssignment,
    questions,
  ]);

  // Sync search input with URL search param
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // When debounced search value changes, update URL and reset page to 1
  useEffect(() => {
    const currentUrlSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentUrlSearch) {
      const params = { page: 1 };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (urlStatus && urlStatus !== 'all') params.status = urlStatus;
      if (urlFromDate) params.fromDate = urlFromDate;
      if (urlToDate) params.toDate = urlToDate;
      setSearchParams(params);
    }
  }, [debouncedSearch]);

  const handleStatusFilterChange = (e) => {
    const newStatus = e.target.value;
    const params = { page: 1 };
    if (urlSearch) params.search = urlSearch;
    if (newStatus !== 'all') params.status = newStatus;
    if (urlFromDate) params.fromDate = urlFromDate;
    if (urlToDate) params.toDate = urlToDate;
    setSearchParams(params);
  };

  const handleFromDateChange = (e) => {
    const val = e.target.value;
    const params = { page: 1 };
    if (urlSearch) params.search = urlSearch;
    if (urlStatus && urlStatus !== 'all') params.status = urlStatus;
    if (val) params.fromDate = val;
    if (urlToDate) params.toDate = urlToDate;
    setSearchParams(params);
  };

  const handleToDateChange = (e) => {
    const val = e.target.value;
    const params = { page: 1 };
    if (urlSearch) params.search = urlSearch;
    if (urlStatus && urlStatus !== 'all') params.status = urlStatus;
    if (urlFromDate) params.fromDate = urlFromDate;
    if (val) params.toDate = val;
    setSearchParams(params);
  };

  const handleClearDateRange = () => {
    const params = { page: 1 };
    if (urlSearch) params.search = urlSearch;
    if (urlStatus && urlStatus !== 'all') params.status = urlStatus;
    setSearchParams(params);
  };

  const fetchData = async (page = urlPage, search = urlSearch, status = urlStatus, fromDate = urlFromDate, toDate = urlToDate) => {
    try {
      setLoading(true);
      setError('');
      const [campRes, survRes] = await Promise.all([
        getCampaignsApi({ page, limit: 10, search, status, fromDate, toDate }),
        getSurveysApi({ limit: 100 }),
      ]);

      if (campRes.success) {
        setCampaigns(campRes.data || []);
        if (campRes.meta) setMeta(campRes.meta);
      }
      if (survRes.success) setSurveys(survRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách form khảo sát');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(urlPage, urlSearch, urlStatus, urlFromDate, urlToDate);
    fetchTrashCampaigns();
  }, [urlPage, urlSearch, urlStatus, urlFromDate, urlToDate]);

  const handlePageChange = (newPage) => {
    const params = { page: newPage };
    if (urlSearch) params.search = urlSearch;
    if (urlStatus && urlStatus !== 'all') params.status = urlStatus;
    if (urlFromDate) params.fromDate = urlFromDate;
    if (urlToDate) params.toDate = urlToDate;
    setSearchParams(params);
  };

  const handleToggleStatus = async (id, currentStatus, name = '') => {
    const actionText = currentStatus ? 'TẠM DỪNG' : 'KÍCH HOẠT LẠI';
    const detailText = currentStatus
      ? 'Người dùng sẽ tạm thời không thể nộp bài cho đến khi bạn mở lại.'
      : 'Người dùng sẽ có thể truy cập và nộp bài trở lại bình thường.';

    const confirmMessage = name
      ? `Xác nhận thay đổi trạng thái:\n\nBạn có chắc chắn muốn ${actionText} form khảo sát "${name}"?\n(${detailText})`
      : `Xác nhận thay đổi trạng thái:\n\nBạn có chắc chắn muốn ${actionText} form khảo sát này?\n(${detailText})`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await toggleCampaignStatusApi(id, !currentStatus);
      if (res.success) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? { ...c, is_active: !currentStatus } : c))
        );
        const successAction = !currentStatus ? 'Kích hoạt lại' : 'Tạm dừng';
        setSuccessMsg(`Đã ${successAction} form khảo sát thành công!`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Cập nhật trạng thái thất bại');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa form khảo sát "${name}"?`)) return;
    try {
      const res = await deleteCampaignApi(id);
      if (res.success) {
        setSuccessMsg(`Đã xóa form khảo sát "${name}".`);
        fetchData();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Xóa form khảo sát thất bại');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await downloadCampaignTemplateApi();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Giao_Viec_Khao_Sat.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Không thể tải file mẫu Excel');
    }
  };

  const checkQuestionsDirty = () => {
    if (isCreatingNewForm || selectedSurveyId === 'NEW') return false;

    const normalize = (qList) =>
      (qList || []).map((q) => ({
        question_text: (q.question_text || '').trim(),
        type: q.type,
        is_required: Boolean(q.is_required),
        options: q.options || {},
      }));

    const strCurrent = JSON.stringify(normalize(questions));
    const strOriginal = JSON.stringify(normalize(originalTemplateQuestions || []));
    return strCurrent !== strOriginal;
  };

  const loadQuestionsForSurvey = async (surveyId, loadAiGoals = false) => {
    if (!surveyId || surveyId === 'NEW') {
      setQuestions([]);
      setOriginalTemplateQuestions([]);
      return;
    }
    try {
      setLoadingQuestions(true);
      const promises = [getSurveyQuestionsApi(surveyId)];
      if (loadAiGoals) {
        promises.push(getSurveyByIdApi(surveyId));
      }
      const [res, survDetailRes] = await Promise.all(promises);

      if (loadAiGoals && survDetailRes?.success && survDetailRes.data && Array.isArray(survDetailRes.data.ai_goals)) {
        setAiGoals(survDetailRes.data.ai_goals);
      }

      if (res.success && Array.isArray(res.data)) {
        const deepCopyCurrent = JSON.parse(JSON.stringify(res.data));
        const deepCopyOriginal = JSON.parse(JSON.stringify(res.data));
        setQuestions(deepCopyCurrent);
        setOriginalTemplateQuestions(deepCopyOriginal);
      }
    } catch {
      setQuestions([]);
      setOriginalTemplateQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const applyDefaultModalState = () => {
    if (surveys.length > 0) {
      const firstId = surveys[0].id;
      setSelectedSurveyId(firstId);
      setCampaignName(`Form khảo sát: ${surveys[0].title}`);
      setCampaignDescription(surveys[0].description || '');
      setAiGoals(Array.isArray(surveys[0].ai_goals) ? surveys[0].ai_goals : []);
      loadQuestionsForSurvey(firstId, true);
    } else {
      setSelectedSurveyId('NEW');
      setIsCreatingNewForm(true);
      setCampaignName('Form khảo sát mới');
      setCampaignDescription('');
      setQuestions([]);
      setAiGoals([]);
    }

    const todayDate = new Date();
    const todayStr = formatLocalDateTimeInput(todayDate, '00:00').substring(0, 10) + 'T00:00';
    const nextWeekDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekStr = formatLocalDateTimeInput(nextWeekDate, '23:59').substring(0, 10) + 'T23:59';
    setStartDate(todayStr);
    setEndDate(nextWeekStr);
    setIsAnonymous(false);
    setIsPublic(false);
    setEditingCampaignAssignmentFileUrl(null);
  };

  const handleOpenModal = () => {
    setEditingCampaignId(null);
    setEditingCampaignAssignmentFileUrl(null);
    setHasResponses(false);
    setIsActive(true);
    setIsCreatingNewForm(false);
    setNewSurveyTitle('');
    setShowSeparatePreview(false);
    setUseExcelAssignment(false);
    setExcelFile(null);
    if (excelFileInputRef?.current) excelFileInputRef.current.value = '';

    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && (parsed.campaignName || parsed.newSurveyTitle || (parsed.questions && parsed.questions.length > 0))) {
          setPendingDraftData(parsed);
          setDraftPromptOpen(true);
          setIsModalOpen(true);
          return;
        }
      } catch (err) {
        console.error('Lỗi khi đọc bản nháp chiến dịch:', err);
      }
    }

    applyDefaultModalState();
    setIsWorkflowEnabled(false);
    setWorkflowSteps([
      { step_order: 1, step_name: 'Cố vấn học tập duyệt', reviewer_role: 'Giảng viên', can_edit_answers: true },
      { step_order: 2, step_name: 'Khoa chốt điểm', reviewer_role: 'Admin', can_edit_answers: true },
    ]);
    setIsModalOpen(true);
  };

  const handleApplyDraft = () => {
    if (pendingDraftData) {
      if (pendingDraftData.selectedSurveyId) setSelectedSurveyId(pendingDraftData.selectedSurveyId);
      if (typeof pendingDraftData.isCreatingNewForm === 'boolean') setIsCreatingNewForm(pendingDraftData.isCreatingNewForm);
      if (pendingDraftData.newSurveyTitle) setNewSurveyTitle(pendingDraftData.newSurveyTitle);
      if (pendingDraftData.campaignName) setCampaignName(pendingDraftData.campaignName);
      if (pendingDraftData.campaignDescription) setCampaignDescription(pendingDraftData.campaignDescription);
      if (pendingDraftData.startDate) setStartDate(pendingDraftData.startDate);
      if (pendingDraftData.endDate) setEndDate(pendingDraftData.endDate);
      if (typeof pendingDraftData.isAnonymous === 'boolean') setIsAnonymous(pendingDraftData.isAnonymous);
      if (typeof pendingDraftData.isPublic === 'boolean') setIsPublic(pendingDraftData.isPublic);
      if (Array.isArray(pendingDraftData.targetRoles)) setTargetRoles(pendingDraftData.targetRoles);
      if (typeof pendingDraftData.useExcelAssignment === 'boolean') setUseExcelAssignment(pendingDraftData.useExcelAssignment);
      if (Array.isArray(pendingDraftData.questions)) setQuestions(pendingDraftData.questions);
    }
    setDraftPromptOpen(false);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftPromptOpen(false);
    setPendingDraftData(null);
    applyDefaultModalState();
  };

  const handleOpenEditModal = async (campaignItem) => {
    setEditingCampaignId(campaignItem.id);
    setEditingCampaignAssignmentFileUrl(campaignItem.assignment_file_url || null);
    setEditingVersion(campaignItem.version || 1);
    setIsCreatingNewForm(false);
    setNewSurveyTitle('');
    setShowSeparatePreview(false);
    setUseExcelAssignment(Boolean(campaignItem.assignment_file_url));
    setExcelFile(null);

    setCampaignName(campaignItem.name || '');
    setCampaignDescription(campaignItem.description || '');
    setSelectedSurveyId(campaignItem.survey_id);
    setStartDate(formatLocalDateTimeInput(campaignItem.start_date, '00:00'));
    setEndDate(formatLocalDateTimeInput(campaignItem.end_date, '23:59'));
    setIsAnonymous(Boolean(campaignItem.is_anonymous));
    setIsPublic(Boolean(campaignItem.is_public));
    setIsActive(campaignItem.is_active ?? true);
    setHasResponses(campaignItem.total_completed > 0);
    setAiGoals(Array.isArray(campaignItem.ai_goals) ? campaignItem.ai_goals : []);

    loadQuestionsForSurvey(campaignItem.survey_id, false);
    setIsModalOpen(true);

    try {
      const res = await getCampaignByIdApi(campaignItem.id);
      if (res.success && res.data) {
        if (res.data.version) setEditingVersion(res.data.version);
        if (res.data.response_count > 0 || res.data.total_completed > 0) {
          setHasResponses(true);
        }
        if (res.data.start_date) setStartDate(formatLocalDateTimeInput(res.data.start_date, '00:00'));
        if (res.data.end_date) setEndDate(formatLocalDateTimeInput(res.data.end_date, '23:59'));
        if (Array.isArray(res.data.ai_goals)) setAiGoals(res.data.ai_goals);
        if (res.data.assignment_file_url) {
          setEditingCampaignAssignmentFileUrl(res.data.assignment_file_url);
          setUseExcelAssignment(true);
        }
        if (typeof res.data.is_anonymous === 'boolean') {
          setIsAnonymous(res.data.is_anonymous);
        }
      }
    } catch (err) {
      console.warn('Lỗi lấy chi tiết form khảo sát:', err);
    }
  };

  const handleStartDateChange = (val) => {
    if (!val) {
      setStartDate('');
      return;
    }
    if (val.length === 10) {
      setStartDate(`${val}T00:00`);
    } else {
      setStartDate(val);
    }
  };

  const handleEndDateChange = (val) => {
    if (!val) {
      setEndDate('');
      return;
    }
    if (val.length === 10) {
      setEndDate(`${val}T23:59`);
    } else {
      setEndDate(val);
    }
  };

  const isEnded = Boolean(editingCampaignId && endDate && new Date(endDate) < new Date());

  const handleToggleActiveSwitch = () => {
    if (isEnded) return;

    if (isActive) {
      const confirmed = window.confirm(
        'Xác nhận thay đổi trạng thái:\n\nBạn có chắc chắn muốn TẠM DỪNG form khảo sát này?\n(Người dùng sẽ không thể nộp bài cho đến khi bạn mở lại)'
      );
      if (!confirmed) return;
      setIsActive(false);
    } else {
      const confirmed = window.confirm(
        'Xác nhận thay đổi trạng thái:\n\nBạn có chắc chắn muốn KÍCH HOẠT LẠI form khảo sát này?'
      );
      if (!confirmed) return;
      setIsActive(true);
    }
  };

  const handleSurveyChange = (val) => {
    if (val === 'NEW') {
      setIsCreatingNewForm(true);
      setSelectedSurveyId('NEW');
      setCampaignName('Form khảo sát mới');
      setCampaignDescription('');
      setQuestions([]);
      setAiGoals([]);
      return;
    }

    setIsCreatingNewForm(false);
    setSelectedSurveyId(val);
    const surv = surveys.find((s) => String(s.id) === String(val));
    if (surv) {
      setCampaignName(`Form khảo sát: ${surv.title}`);
      setCampaignDescription(surv.description || '');
      setAiGoals(Array.isArray(surv.ai_goals) ? surv.ai_goals : []);
    } else {
      setAiGoals([]);
    }
    loadQuestionsForSurvey(val, true);
  };

  const executeFinalSubmit = async (userChoice = 'DEFAULT') => {
    try {
      setSubmitting(true);
      let targetSurveyId = selectedSurveyId;
      const user = getUser();
      const created_by = user?.id || 1;

      // 1. If user chose ONLY_CAMPAIGN -> Create a new isolated Snapshot Survey template
      if (userChoice === 'ONLY_CAMPAIGN') {
        const snapshotTitle = `${campaignName} (Bản sao)`;
        const newSurvRes = await createSurveyApi({
          title: snapshotTitle,
          description: campaignDescription || `Bản sao riêng cho đợt khảo sát ${campaignName}`,
          theme_config: { primaryColor: '#2563eb' },
          created_by,
          ai_goals: aiGoals,
        });
        if (newSurvRes.success) {
          targetSurveyId = newSurvRes.data.id;
          await replaceQuestionsBatchApi(targetSurveyId, questions);
        }
      } else if (userChoice === 'NEW_TEMPLATE') {
        const newTemplateTitle = `${campaignName} (Mẫu mới)`;
        const newSurvRes = await createSurveyApi({
          title: newTemplateTitle,
          description: campaignDescription || `Mẫu khảo sát mới đẻ ra từ ${campaignName}`,
          theme_config: { primaryColor: '#2563eb' },
          created_by,
          ai_goals: aiGoals,
        });
        if (newSurvRes.success) {
          targetSurveyId = newSurvRes.data.id;
          await replaceQuestionsBatchApi(targetSurveyId, questions);
        }
      } else if (isCreatingNewForm || selectedSurveyId === 'NEW') {
        if (!newSurveyTitle.trim()) {
          alert('Vui lòng nhập Tên Form khảo sát mới');
          setSubmitting(false);
          return;
        }
        const newSurvRes = await createSurveyApi({
          title: newSurveyTitle.trim(),
          description: `Form khởi tạo tự động cho ${campaignName}`,
          theme_config: { primaryColor: '#2563eb' },
          created_by,
          ai_goals: aiGoals,
        });
        if (newSurvRes.success) {
          targetSurveyId = newSurvRes.data.id;
          await replaceQuestionsBatchApi(targetSurveyId, questions);
        }
      } else if (userChoice === 'UPDATE_BOTH') {
        await replaceQuestionsBatchApi(targetSurveyId, questions);
      }

      let res;
      if (editingCampaignId) {
        res = await updateCampaignApi(editingCampaignId, {
          survey_id: targetSurveyId,
          name: campaignName,
          description: campaignDescription,
          start_date: startDate,
          end_date: endDate,
          is_public: isPublic,
          is_active: isActive,
          target_role: targetRoles,
          version: editingVersion,
          ai_goals: aiGoals,
          questions: questions,
        });
        if (res.success) {
          localStorage.removeItem(DRAFT_KEY);
          setSuccessMsg(`Đã cập nhật form khảo sát "${campaignName}" thành công!`);
          setIsModalOpen(false);
          setShowSeparatePreview(false);
          setShowQuestionConflictModal(false);
          fetchData();
          setTimeout(() => setSuccessMsg(''), 5000);
        }
      } else if (useExcelAssignment && excelFile) {
        const formData = new FormData();
        formData.append('survey_id', targetSurveyId);
        formData.append('name', campaignName);
        formData.append('description', campaignDescription || '');
        formData.append('start_date', startDate);
        formData.append('end_date', endDate);
        formData.append('is_anonymous', String(Boolean(isAnonymous)));
        formData.append('is_public', String(Boolean(isPublic)));
        formData.append('is_workflow_enabled', String(Boolean(isWorkflowEnabled)));
        formData.append('workflow_steps', JSON.stringify(workflowSteps));
        formData.append('ai_goals', JSON.stringify(aiGoals));
        formData.append('assignments_file', excelFile);

        res = await createCampaignApi(formData, true);
        if (res.success) {
          localStorage.removeItem(DRAFT_KEY);
          setSuccessMsg(
            `Đã tạo form khảo sát thành công! Phân công ${res.data?.total_assignments_count || 0} nhiệm vụ cho ${res.data?.assigned_users_count || 0} sinh viên từ file Excel.`
          );
          setIsModalOpen(false);
          setShowSeparatePreview(false);
          setShowQuestionConflictModal(false);
          fetchData();
          setTimeout(() => setSuccessMsg(''), 5000);
        }
      } else {
        res = await createCampaignApi({
          survey_id: targetSurveyId,
          name: campaignName,
          description: campaignDescription,
          start_date: startDate,
          end_date: endDate,
          is_anonymous: isAnonymous,
          is_public: isPublic,
          is_workflow_enabled: isWorkflowEnabled,
          workflow_steps: workflowSteps,
          target_role: targetRoles,
          ai_goals: aiGoals,
          questions: questions,
        });
        if (res.success) {
          localStorage.removeItem(DRAFT_KEY);
          setSuccessMsg(
            `Đã tạo form khảo sát thành công và tự động giao cho ${res.data?.assigned_users_count || 0} người dùng!`
          );
          setIsModalOpen(false);
          setShowSeparatePreview(false);
          setShowQuestionConflictModal(false);
          fetchData();
          setTimeout(() => setSuccessMsg(''), 5000);
        }
      }
    } catch (err) {
      if (err.response?.status === 409 || err.statusCode === 409) {
        setShowConflictModal(true);
      } else {
        alert(err.response?.data?.message || (editingCampaignId ? 'Cập nhật form khảo sát thất bại' : 'Tạo form khảo sát thất bại'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      alert('Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu!');
      return;
    }

    const targetSurv = surveys.find(s => String(s.id) === String(selectedSurveyId));
    const isCanvasTemplate = targetSurv?.survey_type === 'CANVAS_TEMPLATE' || targetSurv?.theme_config?.surveyType === 'CANVAS_TEMPLATE';

    if (!isCanvasTemplate && (!questions || questions.length === 0)) {
      alert('Vui lòng thêm ít nhất 1 câu hỏi cho Form khảo sát trước khi lưu!');
      return;
    }

    if (!editingCampaignId && useExcelAssignment && !excelFile) {
      alert('Vui lòng chọn file Excel phân công chi tiết!');
      return;
    }

    if (!isPublic && !useExcelAssignment && targetRoles.length === 0) {
      alert('Vui lòng chọn ít nhất một Đối tượng áp dụng (Tự động giao việc) cho form khảo sát nội bộ!');
      return;
    }

    if (editingCampaignId && isActive && endDate && new Date(endDate) < new Date()) {
      alert('Thời gian kết thúc đã qua. Vui lòng gia hạn Thời gian kết thúc mới trước khi kích hoạt lại form khảo sát.');
      return;
    }

    // Question conflict / dirty checking: Check if questions were modified from original template
    if (selectedSurveyId && selectedSurveyId !== 'NEW' && !isCreatingNewForm) {
      if (checkQuestionsDirty()) {
        setShowQuestionConflictModal(true);
        return;
      }
    }

    executeFinalSubmit('DEFAULT');
  };

  const isTemplateExist = surveys.some((s) => String(s.id) === String(selectedSurveyId));
  const templateOptions = [...surveys];
  if (editingCampaignId && selectedSurveyId && !isTemplateExist) {
    const currentCampaign = campaigns.find((c) => c.id === editingCampaignId);
    const templateName = currentCampaign?.survey_title || currentCampaign?.template_name || 'Mẫu form';
    templateOptions.unshift({
      id: selectedSurveyId,
      title: `${templateName} (Đã bị xóa)`,
    });
  }

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quản lý Form Khảo sát</h1>
          <p className="text-sm text-gray-500 mb-6">
            Tạo mới, giao công việc đánh giá theo vai trò người dùng và theo dõi tiến độ hoàn thành theo thời gian thực.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={handleOpenTrashModal}
            className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium text-sm px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 size={20} className="currentColor" /> Thùng rác ({trashCount})
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-6 py-2 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>+ Tạo Form Khảo sát Mới</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-md text-sm font-medium flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <Check size={16} className="currentColor" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-800 font-bold cursor-pointer">
            <X size={16} className="currentColor" />
          </button>
        </div>
      )}

      {/* Main Filter & Table Card (Borderless Container) */}
      <div className="space-y-6 pt-2">
        {/* Filters bar */}
        <div className="flex flex-wrap items-center justify-between gap-6 py-4">
          <div className="w-full md:w-80">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Tìm theo tên Form khảo sát..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <select
              value={urlStatus}
              onChange={handleStatusFilterChange}
              className="text-sm border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang diễn ra</option>
              <option value="upcoming">Sắp diễn ra</option>
              <option value="ended">Đã kết thúc</option>
              <option value="paused">Tạm dừng</option>
            </select>

            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="text-gray-500">Từ:</span>
              <input
                type="date"
                value={urlFromDate}
                onChange={handleFromDateChange}
                className="bg-transparent border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 cursor-pointer"
              />
              <span className="text-gray-500">đến:</span>
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
          </div>
        </div>

        {/* Campaigns Table */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium">
            Đang tải danh sách Form khảo sát...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium">
            Không tìm thấy Form khảo sát nào khớp với bộ lọc.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Tên Form khảo sát</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Mẫu Form gốc</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Thời gian</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Tiến độ</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Trạng thái</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 text-right border-b border-gray-200">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {campaigns.map((item) => {
                    const percent =
                      item.total_assigned > 0
                        ? Math.round((item.total_completed / item.total_assigned) * 100)
                        : 0;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="py-4 px-3 font-medium text-gray-900">
                          <span className="block text-base truncate max-w-xs" title={item.name}>{item.name}</span>
                        </td>
                        <td className="py-4 px-3 text-gray-500 text-sm max-w-xs truncate" title={item.survey_title || ''}>
                          {item.survey_title}
                        </td>
                        <td className="py-4 px-4 text-gray-600 text-sm">
                          <div className="font-medium text-gray-900">{formatDateTimeDisplay(item.start_date)}</div>
                          <div className="text-xs text-gray-500">đến {formatDateTimeDisplay(item.end_date)}</div>
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {item.is_public ? (
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                              <Globe size={14} className="currentColor" /> <span>Công khai ({item.total_completed} phiếu)</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">
                                  {item.total_completed} / {item.total_assigned}
                                </span>
                                <span className="text-gray-500">({percent}%)</span>
                              </div>
                              <div className="w-24 bg-gray-100 h-1 rounded-full overflow-hidden">
                                <div
                                  className="bg-slate-900 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {(() => {
                            const badge = getCampaignStatusBadge(item);
                            const isItemEnded = Boolean(item.end_date && new Date(item.end_date) < new Date());
                            return (
                              <button
                                type="button"
                                disabled={isItemEnded}
                                onClick={() => !isItemEnded && handleToggleStatus(item.id, item.is_active, item.name)}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${badge.className} ${
                                  isItemEnded ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                                }`}
                                title={
                                  isItemEnded
                                    ? 'Form khảo sát đã kết thúc thời hạn (Gia hạn thời gian kết thúc để mở lại)'
                                    : item.is_active
                                      ? 'Nhấp để tạm dừng'
                                      : 'Nhấp để kích hoạt lại'
                                }
                              >
                                {badge.label}
                              </button>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-3 text-right">
                          <ActionMenu
                            onEdit={() => handleOpenEditModal(item)}
                            onResults={() => navigate(`/admin/campaigns/${item.id}/results`)}
                            onCopyLink={() => handleCopyLink(item.id)}
                            onDelete={() => handleDelete(item.id, item.name)}
                          />
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

        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-gray-800 animate-bounce">
            <Check size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* DUAL WINDOW OVERLAY: Left Window (Campaign Creation Modal) + Right Window (Separate Standalone Live Preview) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-x-auto overflow-y-auto">
          <div className="flex items-start justify-center gap-6 w-full max-w-[96vw] my-4">
            {(() => {
              const activeSurv = surveys.find((s) => String(s.id) === String(selectedSurveyId));
              const isMatrixRubricMode = activeSurv?.theme_config?.surveyType === 'MATRIX_RUBRIC';
              const isCanvasTemplateMode = activeSurv?.survey_type === 'CANVAS_TEMPLATE' || activeSurv?.theme_config?.surveyType === 'CANVAS_TEMPLATE';
              const showPreview = showSeparatePreview;
              
              return (
                <>
                  {/* LEFT WINDOW: Campaign Creation Modal Card */}
                  <div
                    className={`bg-white rounded-2xl shadow-2xl transition-all duration-300 p-6 border border-gray-100 max-h-[92vh] flex flex-col ${showPreview ? 'w-[52%] shrink-0' : (isMatrixRubricMode ? 'max-w-6xl w-full' : 'max-w-4xl w-full')}
                      `}
                  >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {editingCampaignId ? 'Sửa Form Khảo sát' : 'Tạo Form Khảo sát Mới'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {editingCampaignId
                      ? 'Cập nhật tên, thời gian, trạng thái hoạt động và mẫu khảo sát của form khảo sát.'
                      : 'Cấu hình tên form khảo sát, thời hạn, và tùy chỉnh câu hỏi động.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setShowSeparatePreview(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} className="currentColor" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto pr-1 space-y-6">
                {editingCampaignId && isEnded && (
                  <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={20} className="currentColor" />
                    <span>
                      Form khảo sát này <b>Đã kết thúc</b> (Hạn chót: {formatDateTimeDisplay(endDate)}). Toàn bộ thông tin bị khóa, ngoại trừ <b>Thời gian kết thúc</b>. Vui lòng gia hạn Thời gian kết thúc mới sang tương lai để Tái kích hoạt (Reopen) form khảo sát.
                    </span>
                  </div>
                )}

                {/* Top Configuration Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Chọn Mẫu khảo sát <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedSurveyId}
                      onChange={(e) => handleSurveyChange(e.target.value)}
                      disabled={Boolean(editingCampaignId)}
                      className={`w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none ${editingCampaignId
                        ? 'bg-gray-100 cursor-not-allowed text-gray-500'
                        : 'bg-white focus:ring-2 focus:ring-emerald-500'
                        }`}
                    >
                      {templateOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                      {!editingCampaignId && <option value="NEW">+ Tạo Form khảo sát mới hoàn toàn...</option>}
                    </select>
                    {editingCampaignId && (
                      <p className="text-[11px] text-gray-500 font-semibold mt-1 flex items-center gap-1">
                        <Lock size={12} className="currentColor" /> Không thể thay đổi Mẫu khảo sát khi đang ở chế độ chỉnh sửa.
                      </p>
                    )}
                  </div>

                  {isCreatingNewForm ? (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Tên Form khảo sát mới <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newSurveyTitle}
                        onChange={(e) => setNewSurveyTitle(e.target.value)}
                        placeholder="Nhập tên Form khảo sát mới..."
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Tên form khảo sát <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        disabled={Boolean(editingCampaignId && isEnded)}
                        className={`w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none ${editingCampaignId && isEnded ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white focus:ring-2 focus:ring-emerald-500'
                          }`}
                        placeholder="Nhập tên form khảo sát..."
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Mô tả chi tiết form khảo sát (Hiển thị cho người nộp bài)
                    </label>
                    <input
                      type="text"
                      value={campaignDescription}
                      onChange={(e) => setCampaignDescription(e.target.value)}
                      disabled={Boolean(editingCampaignId && isEnded)}
                      className={`w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none ${editingCampaignId && isEnded ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white focus:ring-2 focus:ring-emerald-500'
                        }`}
                      placeholder="Nhập mô tả hoặc hướng dẫn riêng cho form khảo sát này..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Thời gian bắt đầu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      disabled={Boolean(editingCampaignId && isEnded)}
                      className={`w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none ${editingCampaignId && isEnded ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white focus:ring-2 focus:ring-emerald-500'
                        }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Thời gian kết thúc <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={endDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Active / Paused Status Toggle Switch */}
                  <div className={`md:col-span-2 border rounded-xl p-3.5 flex items-center justify-between shadow-sm ${isEnded ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-200'
                    }`}>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">
                        Trạng thái Hoạt động
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {isEnded
                          ? 'Form khảo sát Đã kết thúc (Gia hạn Ngày kết thúc để tái kích hoạt)'
                          : isActive
                            ? 'Form khảo sát đang MỞ (Hoạt động bình thường theo thời hạn)'
                            : 'Form khảo sát đang TẠM DỪNG (Chặn quyền truy cập làm bài từ người dùng)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isEnded}
                      onClick={handleToggleActiveSwitch}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isEnded
                        ? 'cursor-not-allowed bg-gray-300'
                        : isActive
                          ? 'cursor-pointer bg-emerald-600'
                          : 'cursor-pointer bg-gray-300'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive && !isEnded ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>

                  <div className={`md:col-span-2 space-y-1.5 ${isEnded ? 'opacity-60 pointer-events-none' : ''}`}>
                    <label className="block text-xs font-semibold text-gray-600">
                      Đối tượng áp dụng (Tự động giao việc){' '}
                      {!isPublic && !useExcelAssignment ? (
                        <span className="text-red-500">*</span>
                      ) : (
                        <span className="text-gray-400 font-normal italic">(Không bắt buộc khi mở Khảo sát Công khai)</span>
                      )}
                    </label>
                    <div className="bg-gray-50 border border-gray-300 rounded-xl p-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-100 transition">
                          <input
                            type="checkbox"
                            disabled={Boolean(editingCampaignId && isEnded)}
                            checked={targetRoles.length === availableRoles.length}
                            onChange={(e) => {
                              if (e.target.checked) setTargetRoles([...availableRoles]);
                              else setTargetRoles([]);
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
                                disabled={Boolean(editingCampaignId && isEnded)}
                                checked={isChecked}
                                onChange={() => handleToggleRole(roleName)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                              />
                              <span>{roleName}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-gray-500 italic pt-0.5 flex flex-col gap-1">
                        {isPublic ? (
                          <span className="text-emerald-700 font-medium flex items-center gap-1"><Globe size={12} className="currentColor"/> Đang mở Khảo sát Công khai: Không bắt buộc chọn nhóm đối tượng nội bộ. Bất kỳ ai có link (đăng nhập Google) đều có thể tham gia.</span>
                        ) : targetRoles.length === 0 ? (
                          <span className="text-amber-700 font-semibold flex items-center gap-1"><AlertTriangle size={12} className="currentColor"/> Vui lòng chọn ít nhất 1 nhóm đối tượng bên trên để hệ thống giao việc khảo sát nội bộ.</span>
                        ) : targetRoles.length === availableRoles.length ? (
                          <span className="flex items-center gap-1"><Check size={12} className="currentColor"/> Hệ thống sẽ giao bài cho TẤT CẢ người dùng thuộc {availableRoles.length} vai trò ({availableRoles.join(', ')}).</span>
                        ) : (
                          <span className="flex items-center gap-1"><Check size={12} className="currentColor"/> Bài khảo sát sẽ tự động được giao cho các nhóm: {targetRoles.join(', ')}.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Excel Assignment Mode Toggle */}
                  {!isCanvasTemplateMode && (
                    <div className={`md:col-span-2 bg-blue-50/60 border border-blue-200 rounded-xl p-3 space-y-3 ${isEnded ? 'opacity-60 pointer-events-none' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet size={16} className="text-blue-600" />
                          <span className="text-xs font-bold text-blue-900">Phân công chi tiết bằng file Excel</span>
                        </div>
                        <label 
                          className={`relative inline-flex items-center ${Boolean(editingCampaignId) || (!isCanvasTemplateMode && isWorkflowEnabled) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          onClickCapture={(e) => {
                            if (!isCanvasTemplateMode && isWorkflowEnabled && !useExcelAssignment && !Boolean(editingCampaignId)) {
                              e.preventDefault();
                              e.stopPropagation();
                              setToastMessage('Vui lòng tắt "Chế độ nâng cao" trước khi bật tính năng này!');
                              setTimeout(() => setToastMessage(''), 4000);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={useExcelAssignment}
                            onChange={(e) => {
                              setUseExcelAssignment(e.target.checked);
                              if (e.target.checked) {
                                setIsPublic(false); // Excel assignment and public link are mutually exclusive
                                if (!isCanvasTemplateMode) setIsWorkflowEnabled(false);
                              }
                            }}
                            disabled={Boolean(editingCampaignId) || (!isCanvasTemplateMode && isWorkflowEnabled)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {useExcelAssignment && (
                        <div className="pt-2 border-t border-blue-100 flex items-start gap-4">
                          <div className="flex-1">
                            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded cursor-pointer hover:bg-blue-50 transition">
                              <UploadCloud size={16} />
                              <span className="text-xs font-semibold">{excelFile ? excelFile.name : (editingCampaignAssignmentFileUrl ? 'Đã có file phân công (Chọn file mới để ghi đè)' : 'Tải lên file Excel (.xlsx)')}</span>
                              <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                ref={excelFileInputRef}
                                onChange={(e) => setExcelFile(e.target.files[0])}
                              />
                            </label>
                            {editingCampaignId && editingCampaignAssignmentFileUrl && !excelFile && (
                              <p className="mt-2 text-xs text-blue-600 italic">
                                Đang sử dụng file phân công cũ.{' '}
                                <a href={editingCampaignAssignmentFileUrl} target="_blank" rel="noreferrer" className="underline font-semibold">Tải xuống xem lại</a>
                              </p>
                            )}
                          </div>
                          <a href="/templates/phan_cong_chi_tiet.xlsx" download className="text-[11px] text-gray-500 hover:text-blue-600 underline flex items-center gap-1 mt-2 shrink-0">
                            <Download size={12} /> File mẫu
                          </a>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-500 leading-tight">
                        (Bật để phân công riêng Sinh viên ➝ Giảng viên ➝ Môn học, dùng cho Đánh giá Giảng viên)
                      </p>
                    </div>
                  )}

                  {/* Anonymous Mode Toggle */}
                  <div className={`md:col-span-2 bg-amber-50/50 border border-amber-200 rounded-xl p-3 flex items-center justify-between ${isEnded ? 'opacity-60 pointer-events-none' : ''}`}>
                    <div>
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Lock size={14} className="currentColor" />
                        Khảo sát Ẩn danh (Bảo mật danh tính người nộp)
                      </span>
                      <p className="text-[11px] text-amber-700/80 mt-0.5">
                        Nếu bật, bài nộp sẽ không lưu danh tính người dùng trong báo cáo chi tiết.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        disabled={Boolean(editingCampaignId)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {/* Public Campaign Toggle */}
                  <div className={`md:col-span-2 bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between ${isEnded ? 'opacity-60 pointer-events-none' : ''}`}>
                    <div>
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Globe size={14} className="currentColor" />
                        Khảo sát Công khai (Cho phép người ngoài tham gia qua link, bắt buộc đăng nhập Gmail)
                      </span>
                      <p className="text-[11px] text-emerald-700/80 mt-0.5">
                        Nếu bật, bất kỳ ai có link đều có thể đăng nhập Google để thực hiện khảo sát mà không cần tạo trước tài khoản nội bộ.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => {
                          setIsPublic(e.target.checked);
                          if (e.target.checked) setUseExcelAssignment(false); // Excel assignment and public link are mutually exclusive
                        }}
                        disabled={Boolean(editingCampaignId)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Multi-step Review Workflow Configuration */}
                  <div className={`md:col-span-2 bg-indigo-50/40 border border-indigo-200 rounded-xl p-3 ${isEnded ? 'opacity-60 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="currentColor" />
                          Chế độ nâng cao (Advanced Mode): Chấm điểm nhiều cấp <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded ml-1">MỚI</span>
                        </span>
                        <p className="text-[11px] text-indigo-700 mt-1 flex items-center gap-1">
                          <GitMerge size={12} className="currentColor"/>
                          Kích hoạt quy trình duyệt/chấm điểm đa cấp (Ví dụ: Sinh viên tự chấm -{'>'} Lớp trưởng -{'>'} Cố vấn học tập). 
                        </p>
                        <p className="text-[10px] text-indigo-500 italic mt-0.5">Chi tiết lập được lúc tạo mới.</p>
                      </div>
                      <div className="shrink-0">
                        <label 
                          className={`relative inline-flex items-center ${Boolean(editingCampaignId) || (!isCanvasTemplateMode && useExcelAssignment) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          onClickCapture={(e) => {
                            if (!isCanvasTemplateMode && useExcelAssignment && !isWorkflowEnabled && !Boolean(editingCampaignId)) {
                              e.preventDefault();
                              e.stopPropagation();
                              setToastMessage('Vui lòng tắt "Phân công Excel" trước khi bật tính năng này!');
                              setTimeout(() => setToastMessage(''), 4000);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            disabled={Boolean(editingCampaignId) || (!isCanvasTemplateMode && useExcelAssignment)}
                            checked={isWorkflowEnabled}
                            onChange={(e) => {
                              setIsWorkflowEnabled(e.target.checked);
                              if (e.target.checked && !isCanvasTemplateMode) {
                                setUseExcelAssignment(false);
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>

                    {isWorkflowEnabled && (
                      <div className="bg-white rounded-lg border border-indigo-100 p-3 space-y-3 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-900">Cấu hình các cấp duyệt</span>
                          <button
                            type="button"
                            onClick={() => setWorkflowSteps([...workflowSteps, { step_order: workflowSteps.length + 1, step_name: '', reviewer_role: 'Giảng viên', can_edit_answers: true }])}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded transition-colors"
                          >
                            + Thêm cấp duyệt
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          {workflowSteps.map((step, idx) => (
                            <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-gray-50 border border-gray-100 p-2 rounded">
                              <span className="font-bold text-gray-500 text-xs px-1">Bước {idx + 1}</span>
                              
                              <input 
                                type="text"
                                value={step.step_name}
                                onChange={e => {
                                  const newSteps = [...workflowSteps];
                                  newSteps[idx].step_name = e.target.value;
                                  setWorkflowSteps(newSteps);
                                }}
                                placeholder="Tên bước (VD: Lớp trưởng duyệt)"
                                className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded outline-none focus:border-indigo-400"
                              />

                              <select
                                value={step.reviewer_role}
                                onChange={e => {
                                  const newSteps = [...workflowSteps];
                                  newSteps[idx].reviewer_role = e.target.value;
                                  setWorkflowSteps(newSteps);
                                }}
                                className="w-32 text-xs px-2 py-1.5 border border-gray-200 rounded outline-none focus:border-indigo-400"
                              >
                                {ALL_AVAILABLE_ROLES.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>

                              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={step.can_edit_answers}
                                  onChange={e => {
                                    const newSteps = [...workflowSteps];
                                    newSteps[idx].can_edit_answers = e.target.checked;
                                    setWorkflowSteps(newSteps);
                                  }}
                                  className="rounded text-indigo-600"
                                />
                                Sửa điểm/câu trả lời
                              </label>

                              {workflowSteps.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setWorkflowSteps(workflowSteps.filter((_, i) => i !== idx))}
                                  className="text-gray-400 hover:text-red-500 p-1"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Analysis Goals Input Component */}
                  <div className="md:col-span-2 pt-1">
                    <AiGoalsInput aiGoals={aiGoals} setAiGoals={setAiGoals} />
                  </div>
                </div>

                {/* Dynamic Question Builder Section */}
                {!isCanvasTemplateMode && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-800">
                        {isMatrixRubricMode ? 'Xây dựng Bảng Đánh Giá' : 'Cấu hình & Tùy chỉnh Câu hỏi Động cho Form khảo sát này'}
                      </h4>
                      {!isMatrixRubricMode ? (
                        <span className="text-xs text-gray-400">
                          Hỗ trợ: Tự luận, Trắc nghiệm, Thanh trượt, Đánh giá sao
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowSeparatePreview(!showSeparatePreview)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
                            showSeparatePreview 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          👁️ Xem trước
                        </button>
                      )}
                    </div>

                    {loadingQuestions ? (
                      <div className="p-6 text-center text-xs text-gray-400">
                        Đang tải danh sách câu hỏi...
                      </div>
                    ) : isMatrixRubricMode ? (
                      <MatrixWysiwygEditor
                        questions={questions}
                        onChange={setQuestions}
                        isLocked={Boolean(editingCampaignId) && hasResponses}
                      />
                    ) : (
                      <QuestionBuilder
                        questions={questions}
                        setQuestions={setQuestions}
                        onPreview={() => setShowSeparatePreview(!showSeparatePreview)}
                        isEditMode={Boolean(editingCampaignId)}
                        hasResponses={hasResponses}
                        aiGoals={aiGoals}
                      />
                    )}
                  </div>
                )}

                {isCanvasTemplateMode && (
                  <div className="border-t border-gray-200 pt-4 pb-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-blue-900 mb-1">Đây là Biểu mẫu Hành chính (Canvas Template)</h4>
                        <p className="text-xs text-blue-700">Mẫu này đã được thiết kế khung sẵn. Bạn không cần cấu hình danh sách câu hỏi tại đây.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSeparatePreview(!showSeparatePreview)}
                        className={`text-xs px-4 py-2 rounded-lg border font-bold flex items-center gap-1.5 transition-colors ${
                          showSeparatePreview 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50 hover:shadow'
                        }`}
                      >
                        👁️ Xem trước Biểu mẫu
                      </button>
                    </div>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setShowSeparatePreview(false);
                    }}
                    className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md hover:shadow-lg transition disabled:opacity-50"
                  >
                    {submitting
                      ? 'Đang lưu dữ liệu...'
                      : editingCampaignId
                        ? 'Lưu thay đổi'
                        : 'Tạo Form Khảo sát & Phân công'}
                  </button>
                </div>
              </form>
            </div>

            {/* RIGHT WINDOW: Standalone Separate Live Preview Window */}
            {showPreview && (
              <div className="w-[46%] shrink-0 max-h-[92vh] flex flex-col animate-fadeIn">
                {(() => {
                  return (
                    <SurveyLivePreview
                      title={campaignName || newSurveyTitle || 'Xem trước Form Khảo sát'}
                      description={campaignDescription || activeSurv?.description || ''}
                      primaryColor={activeSurv?.theme_config?.primaryColor || '#2563eb'}
                      fontFamily={activeSurv?.theme_config?.fontFamily || 'Inter'}
                      logoUrl={activeSurv?.theme_config?.logoUrl || ''}
                      coverImageUrl={activeSurv?.theme_config?.coverImageUrl || ''}
                      surveyType={activeSurv?.theme_config?.surveyType || activeSurv?.survey_type || 'STANDARD'}
                      canvasHtml={activeSurv?.theme_config?.canvasHtml || ''}
                      questions={questions}
                      onClose={() => setShowSeparatePreview(false)}
                    />
                  );
                })()}
              </div>
            )}

            </>
            );
            })()}
          </div>
        </div>
      )}

      {/* Draft Restore Confirmation Modal for Campaign */}
      {draftPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <span className="text-2xl">📋</span>
              <h3 className="text-base font-bold text-gray-800">
                Tìm thấy bản nháp Form Khảo sát chưa lưu
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Hệ thống tìm thấy một bản nháp chưa được lưu từ lần thao tác trước (thời gian:{' '}
              <b>{pendingDraftData?.savedAt ? new Date(pendingDraftData.savedAt).toLocaleString('vi-VN') : 'vừa rồi'}</b>). Bạn có muốn khôi phục lại không?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition"
              >
                Bỏ qua (Tạo mới)
              </button>
              <button
                type="button"
                onClick={handleApplyDraft}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition"
              >
                ✓ Khôi phục bản nháp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Button Confirmation Modal for Question Changes (Snapshot / Update Reverse) */}
      {showQuestionConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <span className="text-2xl">⚡</span>
              <h3 className="text-base font-bold text-gray-800">
                Phát hiện chỉnh sửa nội dung câu hỏi
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn đã có sự chỉnh sửa về nội dung câu hỏi so với Mẫu Form gốc. Bạn có muốn cập nhật những thay đổi này ngược lại vào Mẫu Form không?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 space-y-1.5">
              <p>• <b>Không lưu vào Mẫu:</b> Tạo đợt khảo sát với bộ câu hỏi này. Mẫu Form gốc giữ nguyên.</p>
              <p>• <b>Cập nhật Mẫu hiện tại:</b> Ghi đè bộ câu hỏi mới này vào Mẫu Form gốc hiện tại.</p>
              <p>• <b>Lưu thành Mẫu mới:</b> Tạo một Mẫu Form hoàn toàn mới chứa bộ câu hỏi này.</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowQuestionConflictModal(false)}
                className="px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuestionConflictModal(false);
                  executeFinalSubmit('ONLY_CAMPAIGN');
                }}
                className="px-3.5 py-2 text-xs font-bold bg-gray-600 hover:bg-gray-700 text-white rounded-xl shadow transition"
              >
                Không lưu vào Mẫu
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuestionConflictModal(false);
                  executeFinalSubmit('UPDATE_BOTH');
                }}
                className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition"
              >
                Cập nhật Mẫu hiện tại
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuestionConflictModal(false);
                  executeFinalSubmit('NEW_TEMPLATE');
                }}
                className="px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow transition"
              >
                Lưu thành Mẫu mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash Modal for Campaigns */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl border border-gray-100 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🗑️</span>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Thùng rác Form Khảo sát</h3>
                  <p className="text-xs text-gray-500 font-medium">Danh sách các Form khảo sát đã xóa mềm. Bạn có thể khôi phục hoặc xóa vĩnh viễn.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTrashModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {trashLoading ? (
                <div className="p-8 text-center text-xs text-gray-400 font-medium">Đang tải Thùng rác...</div>
              ) : trashCampaigns.length === 0 ? (
                <div className="p-10 text-center text-gray-400 space-y-2">
                  <span className="text-3xl">🗑️</span>
                  <p className="text-xs font-semibold text-gray-600">Thùng rác trống</p>
                  <p className="text-[11px] text-gray-400">Không có Form khảo sát nào bị xóa mềm.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                      <th className="py-2.5 px-3">Tên Form khảo sát</th>
                      <th className="py-2.5 px-3">Mẫu gốc</th>
                      <th className="py-2.5 px-3">Thời gian xóa</th>
                      <th className="py-2.5 px-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trashCampaigns.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-3">
                          <p className="font-bold text-gray-900 truncate max-w-xs" title={item.name}>{item.name}</p>
                          <p className="text-[11px] text-gray-500 line-clamp-1" title={item.description || 'Không có mô tả'}>{item.description || 'Không có mô tả'}</p>
                        </td>
                        <td className="py-3 px-3 text-gray-600 text-[11px] font-medium truncate max-w-xs" title={item.survey_title || 'Mẫu gốc N/A'}>
                          {item.survey_title || 'Mẫu gốc N/A'}
                        </td>
                        <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">
                          {item.deleted_at ? new Date(item.deleted_at).toLocaleString('vi-VN') : 'Mới đây'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRestoreCampaign(item.id, item.name)}
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition"
                            >
                              ♻️ Phục hồi
                            </button>
                            <button
                              type="button"
                              onClick={() => setForceDeleteTarget(item)}
                              className="px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl border border-rose-200 transition"
                            >
                              ❌ Xóa vĩnh viễn
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
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
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
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-base font-black text-gray-900">Xác nhận xóa vĩnh viễn</h3>
                <p className="text-xs text-rose-600 font-semibold">Cảnh báo: Hành động này KHÔNG THỂ hoàn tác!</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa VĨNH VIỄN Form khảo sát <b>"{forceDeleteTarget.name}"</b> khỏi hệ thống? Dữ liệu này sẽ mất hoàn toàn.
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl font-medium">
              💡 Lưu ý: Nếu đợt khảo sát này đã có bài nộp từ người tham gia, hệ thống sẽ ngăn chặn xóa vĩnh viễn để bảo vệ toàn vẹn dữ liệu.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setForceDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleForceDeleteCampaign}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition"
              >
                ❌ Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 409 Conflict Warning Modal */}
      <ConflictWarningModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        draftContent={`Tên form khảo sát: ${campaignName}\nMô tả: ${campaignDescription}`}
      />
    </div>
  );
}
