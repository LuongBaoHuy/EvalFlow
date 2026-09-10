import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import CampaignCopilotChatbot from '../../components/CampaignCopilotChatbot';
import GoalAnalysisAI from '../../components/GoalAnalysisAI';
import { useReactToPrint } from 'react-to-print';
import PrintableReport from '../../components/PrintableReport';
import MatrixFormRenderer from '../../components/matrix/MatrixFormRenderer';
import CanvasOverview from '../../components/CanvasOverview';
import DynamicSurveyRenderer from '../../components/DynamicSurveyRenderer';
import WorkflowStepperBar from '../../components/WorkflowStepperBar';
import {
  FileText, File, BarChart2, Monitor, Archive, Folder, Lock, CheckCircle, RefreshCw, Users, Sparkles, Trophy, ArrowUpDown, Star, Book, Target, Search, Mail, Globe, User, Clock, Eye, AlertTriangle, PartyPopper, Check, SlidersHorizontal, ChevronDown, Paperclip, X, Download, GraduationCap, XCircle, CheckSquare, ClipboardList
} from 'lucide-react';
import {
  getCampaignAnalyticsApi,
  getCampaignTrackingApi,
  getCampaignResponsesApi,
  exportCampaignExcelApi,
  downloadAssignmentFileApi,
  downloadFileByUrlApi,
} from '../../api/campaigns.api';
import { getWorkflowStatusApi, getResponseAnswersForReviewApi } from '../../api/workflow.api';
import { getSavedAiGoalsResultApi } from '../../api/ai.api';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const CHART_COLORS = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
];

function isImageFile(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
}

function getFileIcon(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return <FileText size={16} className="currentColor" />;
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return <File size={16} className="currentColor" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <BarChart2 size={16} className="currentColor" />;
  if (['ppt', 'pptx'].includes(ext)) return <Monitor size={16} className="currentColor" />;
  if (['zip', 'rar', '7z'].includes(ext)) return <Archive size={16} className="currentColor" />;
  return <Folder size={16} className="currentColor" />;
}

export default function CampaignResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `BaoCao_KetQua_${id}`,
  });

  const [activeTab, setActiveTab] = useState(tabFromUrl || 'results'); // 'results' | 'tracking' | 'responses' | 'anomalies'
  const [analytics, setAnalytics] = useState(null);
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState('original');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [aiEvaluations, setAiEvaluations] = useState(null);

  // Tracking Progress State
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'completed'
  const [trackingSearch, setTrackingSearch] = useState('');
  const [trackingDebouncedSearch, setTrackingDebouncedSearch] = useState('');
  const [trackingPage, setTrackingPage] = useState(1);

  // Responses Detail State
  const [responsesData, setResponsesData] = useState(null);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesError, setResponsesError] = useState('');
  const [selectedResponse, setSelectedResponse] = useState(null); // Response object for modal
  const [modalLoading, setModalLoading] = useState(false);
  const [modalWorkflowStatus, setModalWorkflowStatus] = useState(null);
  const [modalReviewData, setModalReviewData] = useState(null);
  const [responsesSearch, setResponsesSearch] = useState('');
  const [responsesDebouncedSearch, setResponsesDebouncedSearch] = useState('');
  const [responsesPage, setResponsesPage] = useState(1);

  // Fetch full workflow review details when a response is opened in modal
  useEffect(() => {
    if (!selectedResponse?.response_id) {
      setModalWorkflowStatus(null);
      setModalReviewData(null);
      return;
    }

    let isMounted = true;
    const fetchModalDetails = async () => {
      setModalLoading(true);
      try {
        const [wfRes, reviewRes] = await Promise.allSettled([
          getWorkflowStatusApi(selectedResponse.response_id),
          getResponseAnswersForReviewApi(selectedResponse.response_id),
        ]);
        if (isMounted) {
          if (wfRes.status === 'fulfilled') setModalWorkflowStatus(wfRes.value?.data || wfRes.value);
          if (reviewRes.status === 'fulfilled') setModalReviewData(reviewRes.value?.data || reviewRes.value);
        }
      } catch (err) {
        console.error('Error loading modal response details:', err);
      } finally {
        if (isMounted) setModalLoading(false);
      }
    };

    fetchModalDetails();
    return () => { isMounted = false; };
  }, [selectedResponse?.response_id]);

  const displayModalAnswers = useMemo(() => {
    if (!selectedResponse) return [];

    if (responsesData?.survey_type === 'CANVAS_TEMPLATE' || analytics?.theme_config?.surveyType === 'CANVAS_TEMPLATE') {
      return selectedResponse.answers || [];
    }

    const baseAnswers = modalReviewData?.original_answers || selectedResponse.answers || [];
    const revHistory = modalReviewData?.review_history || selectedResponse.review_history || [];

    return baseAnswers.map((q) => {
      let activeVal = q.answer_value;
      const isMatrixType = q.type === 'matrix' || q.question_type === 'matrix';

      if (!isMatrixType) {
        // Non-matrix questions: pick the latest reviewed value if available
        if (Array.isArray(revHistory) && revHistory.length > 0) {
          for (let i = revHistory.length - 1; i >= 0; i--) {
            const rev = revHistory[i];
            if (Array.isArray(rev.reviewed_data)) {
              const found = rev.reviewed_data.find((r) => String(r.question_id) === String(q.question_id));
              if (found && found.answer_value !== undefined) {
                activeVal = found.answer_value;
                break;
              }
            }
          }
        }
        return {
          ...q,
          answer_value: activeVal,
        };
      }

      // Matrix questions: deep merge matrix scores & comments across all review steps
      let mergedMatrixVal = {};
      if (typeof activeVal === 'string') {
        try {
          mergedMatrixVal = JSON.parse(activeVal);
        } catch (e) {
          mergedMatrixVal = {};
        }
      } else if (activeVal && typeof activeVal === 'object' && !Array.isArray(activeVal)) {
        mergedMatrixVal = { ...activeVal };
      }

      if (Array.isArray(revHistory) && revHistory.length > 0) {
        revHistory.forEach((rev) => {
          if (Array.isArray(rev.reviewed_data)) {
            const found = rev.reviewed_data.find((r) => String(r.question_id) === String(q.question_id));
            if (found && found.answer_value !== undefined) {
              let revVal = found.answer_value;
              if (typeof revVal === 'string') {
                try {
                  revVal = JSON.parse(revVal);
                } catch (e) {
                  revVal = {};
                }
              }

              if (typeof mergedMatrixVal === 'object' && typeof revVal === 'object' && revVal !== null) {
                const mergedComments = {
                  ...(mergedMatrixVal._comments || {}),
                  ...(revVal._comments || {}),
                };
                const mergedStepComments = {
                  ...(mergedMatrixVal._stepComments || {}),
                  ...(revVal._stepComments || {}),
                };
                mergedMatrixVal = { ...mergedMatrixVal, ...revVal };
                Object.keys(revVal).forEach((k) => {
                  if (k.startsWith('_')) return;
                  if (typeof revVal[k] === 'object' && revVal[k] !== null && typeof mergedMatrixVal[k] === 'object' && mergedMatrixVal[k] !== null) {
                    mergedMatrixVal[k] = { ...mergedMatrixVal[k], ...revVal[k] };
                  }
                });
                if (Object.keys(mergedComments).length > 0) mergedMatrixVal._comments = mergedComments;
                if (Object.keys(mergedStepComments).length > 0) mergedMatrixVal._stepComments = mergedStepComments;
              } else if (revVal !== undefined) {
                mergedMatrixVal = revVal;
              }
            }
          }
        });
      }

      return {
        ...q,
        answer_value: mergedMatrixVal,
      };
    });
  }, [selectedResponse, modalReviewData]);

  // Anomaly Responses State
  const [anomalyData, setAnomalyData] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyError, setAnomalyError] = useState('');
  const [anomalyPage, setAnomalyPage] = useState(1);

  // Selected Filter State containing both targetId and context_reference
  const [selectedFilter, setSelectedFilter] = useState({ targetId: 'ALL', context: 'ALL' });

  // 1. Deterministic Context Detection
  const isTargetedCampaign = Boolean(
    analytics?.is_targeted || (analytics?.target_users && analytics.target_users.length > 0)
  );

  // 2. Composite Key Deduplication Map (target_user_id + context_reference)
  const uniqueTargets = useMemo(() => {
    const rawList = analytics?.target_users || [];
    const map = new Map();

    // 1. Group initial target_users configuration by composite key
    rawList.forEach((item) => {
      const targetId = item.target_user_id;
      const context = item.context_reference || '';
      const compositeKey = `${targetId}:::${context}`;

      if (!map.has(compositeKey)) {
        map.set(compositeKey, {
          compositeKey,
          target_user_id: targetId,
          target_name: item.target_user_name || `Giảng viên #${targetId}`,
          department: item.target_user_department || '',
          context_reference: context,
          total_assigned: item.total_assigned || 0,
          total_completed: item.total_completed || 0,
        });
      }
    });

    // 2. Add tracking users if any
    if (trackingData?.users) {
      trackingData.users.forEach((u) => {
        if (u.target_user_id) {
          const context = u.context_reference || '';
          const compositeKey = `${u.target_user_id}:::${context}`;
          if (!map.has(compositeKey)) {
            map.set(compositeKey, {
              compositeKey,
              target_user_id: u.target_user_id,
              target_name: u.target_user_name || `Giảng viên #${u.target_user_id}`,
              department: u.target_user_department || '',
              context_reference: context,
              total_assigned: 1,
              total_completed: u.status === 'Completed' ? 1 : 0,
            });
          }
        }
      });
    }

    // 3. Add responses users if any
    if (responsesData?.responses) {
      responsesData.responses.forEach((r) => {
        if (r.target_user_id) {
          const context = r.context_reference || '';
          const compositeKey = `${r.target_user_id}:::${context}`;
          if (!map.has(compositeKey)) {
            map.set(compositeKey, {
              compositeKey,
              target_user_id: r.target_user_id,
              target_name: r.target_user_name || `Giảng viên #${r.target_user_id}`,
              department: r.target_user_department || '',
              context_reference: context,
              total_assigned: 0,
              total_completed: 0,
            });
          }
        }
      });
    }

    const responsesList = responsesData?.responses || [];

    return Array.from(map.values()).map((target) => {
      // Filter actual responses matching BOTH target_user_id AND context_reference (Safe String Comparison)
      const actualResponses = responsesList.filter((r) => {
        const rTarget = r.target_user_id !== undefined && r.target_user_id !== null ? String(r.target_user_id).trim() : '';
        const tTarget = target.target_user_id !== undefined && target.target_user_id !== null ? String(target.target_user_id).trim() : '';
        const rContext = String(r.context_reference || '').trim();
        const tContext = String(target.context_reference || '').trim();

        const matchTarget = Boolean(rTarget && tTarget && rTarget === tTarget);
        const matchContext = rContext === tContext;
        return matchTarget && matchContext;
      });

      const actualCount = actualResponses.length;

      const ratings = [];
      actualResponses.forEach((r) => {
        if (r.answers && Array.isArray(r.answers)) {
          r.answers.forEach((ans) => {
            const num = Number(ans.answer_value);
            if (!isNaN(num) && num > 0 && num <= 5) {
              ratings.push(num);
            }
          });
        }
      });

      const avgRating =
        ratings.length > 0
          ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
          : null;

      return {
        ...target,
        actualCount,
        avgRating,
      };
    });
  }, [analytics, trackingData, responsesData]);

  // Leaderboard Sort State ('count_desc' | 'rating_desc' | 'default')
  const [leaderboardSortBy, setLeaderboardSortBy] = useState('count_desc');

  // Sorted Unique Targets for Leaderboard
  const sortedUniqueTargets = useMemo(() => {
    const list = [...uniqueTargets];
    if (leaderboardSortBy === 'count_desc') {
      list.sort((a, b) => {
        if (b.actualCount !== a.actualCount) return b.actualCount - a.actualCount;
        const avgA = a.avgRating !== null ? parseFloat(a.avgRating) : -1;
        const avgB = b.avgRating !== null ? parseFloat(b.avgRating) : -1;
        return avgB - avgA;
      });
    } else if (leaderboardSortBy === 'rating_desc') {
      list.sort((a, b) => {
        const avgA = a.avgRating !== null ? parseFloat(a.avgRating) : -1;
        const avgB = b.avgRating !== null ? parseFloat(b.avgRating) : -1;
        if (avgB !== avgA) return avgB - avgA;
        return b.actualCount - a.actualCount;
      });
    }
    return list;
  }, [uniqueTargets, leaderboardSortBy]);

  // Filtered Responses matching selectedFilter (targetId & context)
  const filteredResponsesForCharts = useMemo(() => {
    const list = responsesData?.responses || [];
    const targetId = selectedFilter?.targetId;
    const context = selectedFilter?.context;

    const isAll =
      !selectedFilter ||
      selectedFilter === 'ALL' ||
      !targetId ||
      targetId === 'ALL' ||
      targetId === '' ||
      targetId === 'null' ||
      targetId === 'undefined';

    if (isAll) {
      return list;
    }

    return list.filter((r) => {
      const matchTarget = r.target_user_id?.toString() === targetId?.toString();
      const matchContext =
        !context ||
        context === 'ALL' ||
        (r.context_reference ?? '').toString().trim() === (context ?? '').toString().trim();
      return matchTarget && matchContext;
    });
  }, [responsesData, selectedFilter]);

  // Dynamic Questions Analytics based on filteredResponsesForCharts
  const displayQuestionsAnalytics = useMemo(() => {
    if (!analytics?.questions) return [];

    return analytics.questions.map((q) => {
      const qId = q.question_id || q.id;
      const rawAnswers = [];

      filteredResponsesForCharts.forEach((r) => {
        if (r.answers && Array.isArray(r.answers)) {
          const found = r.answers.find(
            (a) => a.question_id?.toString() === qId?.toString()
          );
          if (found && found.answer_value !== undefined && found.answer_value !== null) {
            let val = found.answer_value;
            if (typeof val === 'object' && !Array.isArray(val) && 'value' in val) {
              val = val.value;
            }
            if (val !== undefined && val !== null) {
              rawAnswers.push(val);
            }
          }
        }
      });

      const totalAns = rawAnswers.length;

      // Fallback to backend pre-aggregated stats if raw responses are not loaded yet for 'ALL'
      const isAll = !selectedFilter || selectedFilter.targetId === 'ALL';
      if (
        totalAns === 0 &&
        isAll &&
        (q.total_answers > 0 || (q.breakdown && Object.keys(q.breakdown).length > 0))
      ) {
        return q;
      }

      if (q.type === 'radio') {
        const breakdown = {};
        if (q.options?.choices && Array.isArray(q.options.choices)) {
          q.options.choices.forEach((c) => {
            breakdown[String(c)] = 0;
          });
        }
        rawAnswers.forEach((val) => {
          const strVal = String(val).trim();
          if (strVal) {
            breakdown[strVal] = (breakdown[strVal] || 0) + 1;
          }
        });
        return { ...q, breakdown, total_answers: totalAns };
      }

      if (q.type === 'checkbox') {
        const breakdown = {};
        if (q.options?.choices && Array.isArray(q.options.choices)) {
          q.options.choices.forEach((c) => {
            breakdown[String(c)] = 0;
          });
        }
        rawAnswers.forEach((val) => {
          if (Array.isArray(val)) {
            val.forEach((item) => {
              const strItem = String(item).trim();
              if (strItem) breakdown[strItem] = (breakdown[strItem] || 0) + 1;
            });
          } else if (typeof val === 'string' && val.startsWith('[')) {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) {
                parsed.forEach((item) => {
                  const strItem = String(item).trim();
                  if (strItem) breakdown[strItem] = (breakdown[strItem] || 0) + 1;
                });
              }
            } catch (e) {
              const strVal = String(val).trim();
              if (strVal) breakdown[strVal] = (breakdown[strVal] || 0) + 1;
            }
          } else if (val) {
            const strVal = String(val).trim();
            if (strVal) breakdown[strVal] = (breakdown[strVal] || 0) + 1;
          }
        });
        return { ...q, breakdown, total_answers: totalAns };
      }

      if (q.type === 'rating') {
        const maxStars = q.max_stars || q.options?.max_stars || 5;
        const ratingBreakdown = {};
        for (let i = 1; i <= maxStars; i++) ratingBreakdown[String(i)] = 0;

        const nums = [];
        rawAnswers.forEach((val) => {
          const num = Number(val);
          if (!isNaN(num) && num > 0) {
            nums.push(num);
            const intKey = String(Math.round(num));
            ratingBreakdown[intKey] = (ratingBreakdown[intKey] || 0) + 1;
          }
        });

        const avgRating =
          nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : 0;
        return {
          ...q,
          rating_breakdown: ratingBreakdown,
          average_rating: Number(avgRating),
          max_stars: maxStars,
          total_answers: totalAns,
        };
      }

      if (q.type === 'slider') {
        const nums = rawAnswers.map((val) => Number(val)).filter((n) => !isNaN(n));
        const avgScore =
          nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : 0;
        const minScore = nums.length > 0 ? Math.min(...nums) : 0;
        const maxScore = nums.length > 0 ? Math.max(...nums) : 0;
        return {
          ...q,
          average_score: Number(avgScore),
          min_score: minScore,
          max_score: maxScore,
          total_answers: totalAns,
        };
      }

      if (q.type === 'text') {
        const textResponses = rawAnswers.map((val) => String(val).trim()).filter(Boolean);
        return { ...q, text_responses: textResponses, total_answers: totalAns };
      }

      if (q.type === 'file_upload') {
        const fileResponses = [];
        rawAnswers.forEach((val) => {
          if (Array.isArray(val)) fileResponses.push(...val);
          else if (val) fileResponses.push(String(val));
        });
        return { ...q, file_responses: fileResponses, total_answers: totalAns };
      }

      return { ...q, total_answers: totalAns };
    });
  }, [analytics, filteredResponsesForCharts, selectedFilter]);

  const handleSelectFilter = (targetId, context) => {
    setSelectedFilter({ targetId: String(targetId), context: context || '' });
    const elem = document.getElementById('questions-detailed-charts');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await getCampaignAnalyticsApi(id, selectedWorkflowStep);
        if (res.success) {
          setAnalytics(res.data);

          // Fetch AI goals for PrintableReport
          try {
            const aiRes = await getSavedAiGoalsResultApi(id);
            if (aiRes.success && aiRes.data && Array.isArray(aiRes.data.evaluations)) {
              setAiEvaluations(aiRes.data.evaluations);
            }
          } catch (e) {
            console.warn('Could not fetch AI evaluations for report:', e);
          }
        } else {
          setError(res.message || 'Không thể tải báo cáo chiến dịch');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Lỗi khi kết nối server');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, selectedWorkflowStep]);

  // 500ms Debounce for Tracking Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setTrackingDebouncedSearch(trackingSearch);
      setTrackingPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [trackingSearch]);

  // 500ms Debounce for Responses Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setResponsesDebouncedSearch(responsesSearch);
      setResponsesPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [responsesSearch]);

  // Fetch Tracking Data when activeTab, trackingPage, or trackingDebouncedSearch changes
  useEffect(() => {
    if (activeTab === 'tracking' || activeTab === 'results') {
      fetchTrackingData(trackingPage, trackingDebouncedSearch);
    }
  }, [activeTab, id, trackingPage, trackingDebouncedSearch]);

  // Fetch Responses Data when activeTab, responsesPage, or responsesDebouncedSearch changes
  useEffect(() => {
    if (activeTab === 'responses' || activeTab === 'results') {
      fetchResponsesData(responsesPage, responsesDebouncedSearch);
    }
  }, [activeTab, id, responsesPage, responsesDebouncedSearch]);

  // Fetch Anomaly Data when activeTab or anomalyPage changes
  useEffect(() => {
    if (activeTab === 'anomalies') {
      fetchAnomalyData(anomalyPage);
    }
  }, [activeTab, id, anomalyPage]);

  const fetchAnomalyData = async (page = 1) => {
    try {
      setAnomalyLoading(true);
      setAnomalyError('');
      const res = await getCampaignResponsesApi(id, { page, limit: 10, anomalyOnly: true });
      if (res.success) {
        setAnomalyData(res.data);
      } else {
        setAnomalyError(res.message || 'Không thể tải danh sách bài nộp bất thường');
      }
    } catch (err) {
      setAnomalyError(err.response?.data?.message || 'Lỗi khi tải bài nộp bất thường');
    } finally {
      setAnomalyLoading(false);
    }
  };

  const fetchTrackingData = async (page = 1, search = '') => {
    try {
      setTrackingLoading(true);
      setTrackingError('');
      const res = await getCampaignTrackingApi(id, { page, limit: 10, search });
      if (res.success) {
        setTrackingData(res.data);
      } else {
        setTrackingError(res.message || 'Không thể tải tiến độ nộp bài');
      }
    } catch (err) {
      setTrackingError(err.response?.data?.message || 'Lỗi kết nối khi tải tiến độ nộp bài');
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchResponsesData = async (page = 1, search = '') => {
    try {
      setResponsesLoading(true);
      setResponsesError('');
      const limit = activeTab === 'results' ? 1000 : 10;
      const res = await getCampaignResponsesApi(id, { page, limit, search });
      if (res.success) {
        setResponsesData(res.data);
      } else {
        setResponsesError(res.message || 'Không thể tải danh sách phiếu nộp');
      }
    } catch (err) {
      setResponsesError(err.response?.data?.message || 'Lỗi kết nối khi tải danh sách phiếu nộp');
    } finally {
      setResponsesLoading(false);
    }
  };

  const [exporting, setExporting] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);

  const handleDownloadAssignmentFile = async () => {
    if (!id) return;
    try {
      setDownloadingFile(true);
      // responseType: 'blob' → res.data is already a Blob, do NOT wrap again
      const res = await downloadAssignmentFileApi(id);
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = analytics?.campaign_name
        ? analytics.campaign_name.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'PhanCong';
      link.setAttribute('download', `PhanCongGoc_${id}_${safeName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tải xuống file phân công gốc');
    } finally {
      setDownloadingFile(false);
    }
  };

  const handleSendReminder = () => {
    if (!trackingData?.users) return;
    const pendingUsers = trackingData.users.filter((u) => u.status !== 'Completed');
    const pendingEmails = pendingUsers.map((u) => u.email).filter(Boolean);

    console.log('📢 Danh sách Email những người chưa nộp bài khảo sát:', pendingEmails);
    alert(
      `Đã gửi thông báo nhắc nhở thành công tới ${pendingEmails.length} người chưa nộp bài!\n\n(Danh sách Email chi tiết đã được ghi vào Console trình duyệt F12)`
    );
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const res = await exportCampaignExcelApi(id);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = analytics?.campaign_name
        ? analytics.campaign_name.replace(/[^a-zA-Z0-9_-]/g, '_')
        : '';
      a.download = `BaoCao_ChienDich_${id}_${safeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi xuất file Excel');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full p-12 text-center text-gray-500 my-8">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
        <p className="text-sm font-semibold">Đang tổng hợp báo cáo thống kê chiến dịch...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full my-8 py-6 text-red-700 space-y-3">
        <h3 className="font-bold text-lg flex items-center gap-2"><X size={20} className="currentColor" /> Không thể xem báo cáo</h3>
        <p className="text-sm">{error}</p>
        <button
          onClick={() => navigate('/admin/campaigns')}
          className="bg-red-600 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow hover:bg-red-700 transition"
        >
          ← Quay lại danh sách chiến dịch
        </button>
      </div>
    );
  }

  const completionRate =
    analytics?.total_assigned > 0
      ? Math.round((analytics.total_completed / analytics.total_assigned) * 100)
      : 0;

  // Filter users list for Tracking tab
  const filteredUsers = (trackingData?.users || []).filter((u) => {
    if (filterStatus === 'completed') return u.status === 'Completed';
    if (filterStatus === 'pending') return u.status !== 'Completed';
    return true;
  });

  return (
    <div className="w-full space-y-6 px-6 lg:px-8 pb-12">
      <PrintableReport
        ref={printRef}
        analytics={analytics}
        displayQuestionsAnalytics={displayQuestionsAnalytics}
        selectedFilter={selectedFilter}
        uniqueTargets={uniqueTargets}
        aiGoalEvaluation={{ goals: aiEvaluations }}
      />
      {/* Top Header Section (Unboxed for modern open layout) */}
      <div className="space-y-4 py-2 px-1">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/admin/campaigns')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition flex items-center gap-1.5"
          >
            ← Quay lại danh sách chiến dịch
          </button>
          <div className="flex items-center gap-2">
            {analytics?.assignment_file_url && (
              <button
                type="button"
                onClick={handleDownloadAssignmentFile}
                disabled={downloadingFile}
                className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 h-9 px-3 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                title="Tải về file Excel danh sách phân công gốc"
              >
                {downloadingFile ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-1.5"></span>
                    <span>Đang tải...</span>
                  </>
                ) : (
                  <>
                    <Paperclip size={16} className="currentColor" />
                    <span>Tải File Phân Công Gốc</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="bg-white hover:bg-slate-50 text-blue-700 font-medium text-xs px-3.5 py-2 rounded-md border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileText size={16} className="currentColor" />
              <span>Xuất Báo cáo PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs px-3.5 py-2 rounded-md border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download size={16} className="currentColor" />
              <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>

            {analytics?.is_anonymous && (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <Lock size={12} className="currentColor" /> Khảo sát Ẩn danh
              </span>
            )}
            {(() => {
              const now = new Date();
              const end = analytics?.end_date ? new Date(analytics.end_date) : null;
              if (end && now > end) {
                return (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">
                    ● Đã kết thúc
                  </span>
                );
              }
              return (
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border ${analytics?.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                >
                  {analytics?.is_active ? '● Đang diễn ra' : '○ Đã tạm dừng'}
                </span>
              );
            })()}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span>{analytics?.campaign_name}</span>
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Form khảo sát: <span className="font-semibold">{analytics?.survey_title}</span>
              {analytics?.start_date && analytics?.end_date && (
                <span className="ml-2 text-sm text-gray-500">
                  ({analytics.start_date} ~ {analytics.end_date})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 3 Metric Cards Grid (Seamless Stat Row) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-6 my-6 border-y border-gray-100">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">
              Tổng lượt giao đánh giá
            </span>
            <span className="text-5xl font-light text-slate-900 block">
              {analytics?.total_assigned || 0}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">
              Đã hoàn thành nộp bài
            </span>
            <span className="text-5xl font-light text-slate-900 block">
              {analytics?.total_completed || 0}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">
              Tỷ lệ hoàn thành
            </span>
            <span className="text-5xl font-light text-slate-900 block">
              {completionRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'results'
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          <BarChart2 size={16} className="currentColor" />
          <span>Thống kê Tổng quan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tracking')}
          className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'tracking'
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          <Users size={16} className="currentColor" />
          <span>Tiến độ Nộp bài</span>
          {trackingData?.pending_count > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium ml-1">
              {trackingData.pending_count} chưa nộp
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('responses')}
          className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'responses'
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          <FileText size={16} className="currentColor" />
          <span>Chi tiết Phiếu nộp</span>
          {analytics?.total_responses > 0 && (
            <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded-full font-medium ml-1">
              {analytics.total_responses} phiếu
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('anomalies')}
          className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'anomalies'
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
        >
          <Sparkles size={16} className="currentColor" />
          <span>Phân tích AI</span>
          <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ml-0.5">
            Mới
          </span>
          {responsesData?.anomaly_count > 0 && (
            <span className="bg-rose-50 text-rose-700 text-xs px-2 py-0.5 rounded-full font-medium ml-1">
              {responsesData.anomaly_count} bất thường
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: THỐNG KÊ TỔNG QUAN */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {responsesData?.survey_type === 'CANVAS_TEMPLATE' || analytics?.survey_type === 'CANVAS_TEMPLATE' || analytics?.theme_config?.surveyType === 'CANVAS_TEMPLATE' ? (
            <CanvasOverview analytics={analytics} responsesData={responsesData} />
          ) : (
            <>
              {/* 1. Leaderboard Table (Borderless) */}
              {isTargetedCampaign && (
            <div className="space-y-4 pt-2">
              <div className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Trophy size={20} className="text-slate-900" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Bảng So Sánh Tổng Quan Đối Tượng (Leaderboard)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tổng hợp so sánh lượt đánh giá và chỉ số trung bình của từng giảng viên / đối tượng
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span className="shrink-0 flex items-center gap-1"><ArrowUpDown size={14} className="currentColor" /> Sắp xếp:</span>
                    <select
                      value={leaderboardSortBy}
                      onChange={(e) => setLeaderboardSortBy(e.target.value)}
                      className="text-xs font-semibold bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-red-600 outline-none cursor-pointer"
                    >
                      <option value="count_desc">Tổng lượt đánh giá (Cao → Thấp)</option>
                      <option value="rating_desc">Chỉ số trung bình (Cao → Thấp)</option>
                      <option value="default">Theo danh sách gốc</option>
                    </select>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full shrink-0">
                    {uniqueTargets.length} đối tượng
                  </span>
                </div>
              </div>

              {sortedUniqueTargets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  Đang tổng hợp dữ liệu so sánh theo đối tượng...
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                      <tr className="bg-transparent text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-3 px-3 w-12 text-center bg-white">STT</th>
                        <th className="py-3 px-3 bg-white">Giảng viên / Đối tượng</th>
                        <th className="py-3 px-3 text-center bg-white">Tổng lượt đánh giá</th>
                        <th className="py-3 px-3 text-center bg-white">Chỉ số đánh giá trung bình</th>
                        <th className="py-3 px-3 text-right bg-white">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {sortedUniqueTargets.map((target, idx) => {
                        const count = target.actualCount;
                        const avg = target.avgRating;
                        return (
                          <tr key={target.compositeKey} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-400 text-xs">
                              #{idx + 1}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                  {target.target_name?.charAt(0) || 'G'}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{target.target_name}</p>
                                  {target.department && (
                                    <p className="text-xs text-slate-500 font-medium">{target.department}</p>
                                  )}
                                  {target.context_reference ? (
                                    <p className="text-xs text-slate-600 font-semibold mt-0.5 flex items-center gap-1">
                                      <span className="text-slate-400 flex items-center gap-1"><Book size={12} className="currentColor" /> Môn/Lớp:</span>
                                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-mono text-[11px]">
                                        {target.context_reference}
                                      </span>
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-slate-400 italic mt-0.5">Không chỉ định môn</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                {count} lượt nộp
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              {avg !== null ? (
                                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                                  <Star size={12} className="currentColor" />
                                  <span>{avg} / 5.0</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">Chưa có điểm</span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleSelectFilter(target.target_user_id, target.context_reference)}
                                className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                              >
                                Xem chi tiết →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 2. Target Filter Toolbar (Borderless) */}
          {isTargetedCampaign && (
            <div className="py-4 border-y border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Target size={20} className="currentColor text-slate-800" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Bộ Lọc Theo Đối Tượng Đánh Giá (Giảng viên / Học phần)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Lựa chọn đối tượng để lọc dữ liệu biểu đồ chi tiết bên dưới
                  </p>
                </div>
              </div>

              <select
                value={`${selectedFilter.targetId}:::${selectedFilter.context}`}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL:::ALL') {
                    setSelectedFilter({ targetId: 'ALL', context: 'ALL' });
                  } else {
                    const [tId, ctx] = val.split(':::');
                    setSelectedFilter({ targetId: tId, context: ctx });
                  }
                }}
                className="text-xs font-semibold border border-slate-200/80 rounded-lg px-3.5 py-2 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-red-600 outline-none cursor-pointer w-full sm:w-80"
              >
                <option value="ALL:::ALL">-- Tất cả Giảng viên & Môn học --</option>
                {uniqueTargets.map((t) => (
                  <option key={t.compositeKey} value={`${t.target_user_id}:::${t.context_reference}`}>
                    {t.target_name} {t.context_reference ? `[${t.context_reference}]` : ''} ({t.actualCount} lượt nộp)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2.5. Workflow Step Selector (Multi-level) */}
          {analytics?.workflow_steps?.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  <RefreshCw size={16} className="currentColor" /> Phân tích kết quả theo từng cấp độ (Workflow)
                </h3>
                <p className="text-xs text-indigo-700 mt-1">
                  Chọn một cấp duyệt để xem sự phân bổ điểm tương ứng của cấp đó trên biểu đồ bên dưới.
                </p>
              </div>
              <select
                value={selectedWorkflowStep}
                onChange={(e) => setSelectedWorkflowStep(e.target.value)}
                className="text-sm font-semibold border-2 border-indigo-200 rounded-lg px-4 py-2 bg-white text-indigo-900 focus:ring-2 focus:ring-indigo-600 outline-none cursor-pointer w-full sm:w-auto min-w-[200px]"
              >
                <option value="original">Gốc (Người nộp)</option>
                {analytics.workflow_steps.map((wf) => (
                  <option key={wf.step_order} value={wf.step_order}>
                    Bước {wf.step_order}: {wf.step_name} ({wf.reviewer_role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Detailed Questions Section Header */}
          <div id="questions-detailed-charts" className="flex items-center justify-between pt-4">
            <h2 className="text-xl font-light text-gray-900 flex items-center gap-2">
              <ClipboardList size={20} className="currentColor" />
              <span>
                Chi tiết kết quả theo từng câu hỏi ({displayQuestionsAnalytics.length})
                {selectedFilter.targetId !== 'ALL' && (
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 font-semibold px-2.5 py-0.5 rounded-full ml-2">
                    Đang lọc: {uniqueTargets.find((t) => String(t.target_user_id) === String(selectedFilter.targetId) && String(t.context_reference) === String(selectedFilter.context))?.target_name || selectedFilter.targetId}
                    {selectedFilter.context && selectedFilter.context !== 'ALL' && ` [${selectedFilter.context}]`}
                  </span>
                )}
              </span>
            </h2>
            {selectedFilter.targetId !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedFilter({ targetId: 'ALL', context: 'ALL' })}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1"
              >
                <X size={14} className="currentColor" /> Xóa bộ lọc chọn
              </button>
            )}
          </div>

          {!displayQuestionsAnalytics.length ? (
            <div className="py-16 text-center text-gray-400">
              Chiến dịch này chưa có câu hỏi nào hoặc chưa có dữ liệu cho bộ lọc được chọn.
            </div>
          ) : (
            displayQuestionsAnalytics.map((q, idx) => {
              return (
                <div
                  key={q.question_id || idx}
                  className="space-y-4 py-8 border-b border-gray-100 last:border-b-0"
                >
                  {/* Question Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                        {idx + 1}
                      </span>
                      <h3 className="font-bold text-gray-800 text-base">{q.question_text}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg uppercase">
                        {q.type}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
                        {q.total_answers} câu trả lời
                      </span>
                    </div>
                  </div>

                  {/* 1. RADIO (PieChart) */}
                  {q.type === 'radio' && (
                    <RadioAnalyticsCard breakdown={q.breakdown || {}} total={q.total_answers} />
                  )}

                  {/* 2. CHECKBOX (BarChart) */}
                  {q.type === 'checkbox' && (
                    <CheckboxAnalyticsCard breakdown={q.breakdown || {}} total={q.total_answers} />
                  )}

                  {/* 3. RATING (Amazon / Shopee Rating Style) */}
                  {q.type === 'rating' && (
                    <RatingAmazonStyleCard
                      averageRating={q.average_rating || 0}
                      maxStars={q.max_stars || 5}
                      ratingBreakdown={q.rating_breakdown || {}}
                      totalAnswers={q.total_answers || 0}
                    />
                  )}

                  {/* 4. SLIDER (Score Metrics) */}
                  {q.type === 'slider' && (
                    <SliderAnalyticsCard
                      avgScore={q.average_score || 0}
                      minScore={q.min_score || 0}
                      maxScore={q.max_score || 0}
                    />
                  )}

                  {/* 5. TEXT (Scrollable Responses List) */}
                  {q.type === 'text' && (
                    <TextAnalyticsCard responses={q.text_responses || []} />
                  )}

                  {/* 6. FILE UPLOAD (Document & Image Grid) */}
                  {q.type === 'file_upload' && (
                    <FileUploadDocumentGrid
                      fileUrls={q.file_responses || []}
                      onPreviewImage={(url) => setPreviewImage(url)}
                    />
                  )}

                  {/* 7. MATRIX RUBRIC (Visual Score KPI Cards, Rubric Breakdown Table & Comments) */}
                  {q.type === 'matrix' && (
                    <MatrixAnalyticsCard question={q} />
                  )}

                  {/* 8. PROOF FILE ATTACHMENTS (For any question type if files attached) */}
                  {q.attached_files && q.attached_files.length > 0 && q.type !== 'file_upload' && (
                    <div className="pt-3.5 border-t border-amber-200/80 bg-amber-50/50 p-4 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                        <Paperclip size={14} className="currentColor" />
                        <span>Danh sách tệp minh chứng đính kèm cho câu hỏi này ({q.attached_files.length} tệp):</span>
                      </div>
                      <FileUploadDocumentGrid
                        fileUrls={q.attached_files}
                        onPreviewImage={(url) => setPreviewImage(url)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: TIẾN ĐỘ NỘP BÀI */}
      {activeTab === 'tracking' && (
        <div className="space-y-6 pt-4">
          {/* Header Bar: Title, Filter, Search, Action Button */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Users size={20} className="currentColor" />
                <span>Danh sách Người dùng được Giao nhiệm vụ</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Theo dõi người dùng đã hoàn thành (`Completed`) hoặc chưa nộp bài (`Pending`).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Box */}
              <div className="relative w-full sm:w-56">
                <input
                  type="text"
                  value={trackingSearch}
                  onChange={(e) => setTrackingSearch(e.target.value)}
                  placeholder="Tìm theo tên/email..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm transition"
                />
                <Search size={14} className="absolute left-2.5 top-1.5 text-gray-400" />
                {trackingSearch && (
                  <button
                    onClick={() => setTrackingSearch('')}
                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 font-bold"
                  >
                    <X size={14} className="currentColor" />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${filterStatus === 'all'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                    }`}
                >
                  Tất cả ({trackingData?.total || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('pending')}
                  className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${filterStatus === 'pending'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-amber-700 hover:border-amber-200'
                    }`}
                >
                  Chưa nộp ({trackingData?.pending_count || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('completed')}
                  className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${filterStatus === 'completed'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-emerald-700 hover:border-emerald-200'
                    }`}
                >
                  Đã nộp ({trackingData?.completed_count || 0})
                </button>
              </div>

              {/* Reminder Action Button */}
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={!trackingData?.pending_count}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition flex items-center gap-1.5"
              >
                <Mail size={16} className="currentColor" />
                <span>Gửi Email Nhắc Nhở ({trackingData?.pending_count || 0})</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          {trackingLoading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3"></div>
              <p className="text-xs font-semibold">Đang tải danh sách tiến độ nộp bài...</p>
            </div>
          ) : trackingError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
              <X size={14} className="currentColor" /> {trackingError}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
              Không tìm thấy người dùng nào phù hợp với từ khóa/bộ lọc.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-transparent text-slate-400 text-xs uppercase font-semibold border-b border-gray-100">
                      <th className="py-3 px-3 w-12 text-center">STT</th>
                      <th className="py-3 px-3">Họ và Tên</th>
                      <th className="py-3 px-3">Email</th>
                      <th className="py-3 px-3">Phòng ban / Khoa</th>
                      <th className="py-3 px-3">Mục Tiêu (Giảng viên - Môn học)</th>
                      <th className="py-3 px-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredUsers.map((u, idx) => {
                      const isDone = u.status === 'Completed';
                      const stt = ((trackingData?.pagination?.page || 1) - 1) * (trackingData?.pagination?.limit || 10) + idx + 1;
                      return (
                        <tr key={u.assignment_id || idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-gray-400 text-xs">
                            {stt}
                          </td>
                          <td className="py-3.5 px-3 font-bold text-gray-800">{u.full_name}</td>
                          <td className="py-3.5 px-3 text-gray-600 text-xs font-medium">{u.email}</td>
                          <td className="py-3.5 px-3 text-gray-600 text-xs">{u.department}</td>
                          <td className="py-3.5 px-3">
                            {u.target_name || u.context_reference ? (
                              <div className="space-y-0.5">
                                {u.target_name && (
                                  <div className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                                    <GraduationCap size={16} className="text-gray-500" />
                                    <span>{u.target_name}</span>
                                  </div>
                                )}
                                {u.context_reference && (
                                  <div className="text-[11px] text-amber-800 font-mono flex items-center gap-1">
                                    <span className="text-slate-400 font-sans">Môn:</span>
                                    <span className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">{u.context_reference}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Đánh giá chung</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`inline-block text-xs px-3 py-0.5 rounded-full font-bold ${isDone
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                            >
                              {isDone ? '● Đã nộp bài' : '○ Chưa nộp bài'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <PaginationControl
                pagination={trackingData?.pagination}
                onPageChange={(p) => setTrackingPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHI TIẾT PHIẾU NỘP */}
      {activeTab === 'responses' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-xl font-light text-gray-900 flex items-center gap-2">
                <FileText size={20} className="currentColor" />
                <span>Danh sách Các Phiếu Nộp Bài Thực Tế</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Xem chi tiết danh sách từng phiếu khảo sát đã nộp kèm các câu trả lời cụ thể.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Box */}
              <div className="relative w-full sm:w-56">
                <input
                  type="text"
                  value={responsesSearch}
                  onChange={(e) => setResponsesSearch(e.target.value)}
                  placeholder="Tìm theo tên/email..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 transition"
                />
                <Search size={14} className="absolute left-2.5 top-1.5 text-gray-400" />
                {responsesSearch && (
                  <button
                    onClick={() => setResponsesSearch('')}
                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 font-bold"
                  >
                    <X size={14} className="currentColor" />
                  </button>
                )}
              </div>

              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200 shrink-0">
                Tổng cộng: {responsesData?.total_responses || 0} bài nộp
              </span>
            </div>
          </div>

          {responsesLoading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3"></div>
              <p className="text-xs font-semibold">Đang tải danh sách phiếu nộp...</p>
            </div>
          ) : responsesError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
              <X size={14} className="currentColor" /> {responsesError}
            </div>
          ) : !responsesData?.responses?.length ? (
            <div className="py-16 text-center text-gray-400">
              Không tìm thấy phiếu nộp bài nào phù hợp.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    {(() => {
                      const hasWorkflow = Boolean(
                        responsesData?.is_workflow_enabled ||
                        analytics?.is_workflow_enabled ||
                        responsesData?.responses?.some((r) => r.workflow_status)
                      );
                      return (
                        <tr className="bg-transparent text-slate-400 text-xs uppercase font-semibold border-b border-gray-100">
                          <th className="py-3.5 px-3 w-14 text-center">Mã Phiếu</th>
                          <th className="py-3.5 px-3">Người Nộp Bài</th>
                          <th className="py-3.5 px-3">Email</th>
                          <th className="py-3.5 px-3">Ngày Giờ Nộp</th>
                          {hasWorkflow && <th className="py-3.5 px-3">Trạng Thái Phê Duyệt</th>}
                          <th className="py-3.5 px-3 text-center">Số Câu Trả Lời</th>
                          <th className="py-3.5 px-3 text-right">Hành Động</th>
                        </tr>
                      );
                    })()}
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {(() => {
                      const hasWorkflow = Boolean(
                        responsesData?.is_workflow_enabled ||
                        analytics?.is_workflow_enabled ||
                        responsesData?.responses?.some((r) => r.workflow_status)
                      );

                      return responsesData.responses.map((resp) => {
                        const isAnonymous = resp.evaluator_name === 'Người dùng ẩn danh';
                        const isGuest = resp.is_guest !== undefined ? Boolean(resp.is_guest) : (!resp.evaluator_id && (resp.guest_name || resp.guest_email));
                        const roleName = resp.evaluator_role_name || (resp.evaluator_id ? 'Sinh viên' : null);

                        return (
                          <tr key={resp.response_id} className="hover:bg-slate-50/60 transition">
                            <td className="py-4 px-3 text-center font-mono font-bold text-gray-500 text-xs">
                              #{resp.response_id}
                            </td>
                            <td className="py-4 px-3 font-bold text-gray-800">
                              {isAnonymous ? (
                                <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs inline-flex items-center gap-1 font-semibold">
                                  <Lock size={12} className="currentColor" /> Người dùng ẩn danh
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-800 font-semibold">{resp.evaluator_name || resp.guest_name}</span>
                                  {isGuest ? (
                                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 shadow-xs">
                                      <Globe size={12} className="currentColor" /> Khách
                                    </span>
                                  ) : roleName ? (
                                    <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 shadow-2xs">
                                      <User size={12} className="currentColor" /> {roleName}
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-3 text-gray-600 text-xs font-medium">
                              {resp.evaluator_email || resp.guest_email || 'N/A'}
                            </td>
                            <td className="py-4 px-3 text-gray-500 text-xs">
                              {resp.submitted_at
                                ? new Date(resp.submitted_at).toLocaleString('vi-VN')
                                : 'N/A'}
                            </td>
                            {hasWorkflow && (
                              <td className="py-4 px-3">
                                {resp.workflow_status ? (
                                  <div className="flex flex-col gap-1 items-start">
                                    {resp.workflow_status.overall_status === 'COMPLETED' ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                        <CheckCircle size={14} className="currentColor" />
                                        <span>Đã hoàn tất ({resp.workflow_status.total_steps}/{resp.workflow_status.total_steps})</span>
                                      </span>
                                    ) : resp.workflow_status.overall_status === 'REJECTED' ? (
                                      <div className="space-y-0.5">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                          <XCircle size={14} className="currentColor" /> Bị từ chối
                                        </span>
                                        {resp.workflow_status.reviewer_role && (
                                          <div className="text-[11px] text-rose-600 font-medium pl-1">
                                            Bởi: {resp.workflow_status.reviewer_role} {resp.workflow_status.reviewer_name ? `(${resp.workflow_status.reviewer_name})` : ''}
                                          </div>
                                        )}
                                        {resp.workflow_status.note && (
                                          <div className="text-[10px] text-gray-500 italic max-w-xs truncate pl-1" title={resp.workflow_status.note}>
                                            "{resp.workflow_status.note}"
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-0.5">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                                          <Clock size={14} className="currentColor" />
                                          <span>Chờ {resp.workflow_status.reviewer_role || resp.workflow_status.step_name} duyệt</span>
                                        </span>
                                        <div className="text-[11px] text-gray-500 font-medium pl-1">
                                          Tiến trình: Bước {resp.workflow_status.step_order}/{resp.workflow_status.total_steps}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 font-medium">Đã nộp bài</span>
                                )}
                              </td>
                            )}
                            <td className="py-4 px-3 text-center">
                              <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md">
                                {resp.answers?.length || 0} câu
                              </span>
                            </td>
                            <td className="py-4 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedResponse(resp)}
                                className="text-blue-600 hover:text-blue-800 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition flex items-center gap-1.5 ml-auto"
                              >
                                <Eye size={16} className="currentColor" />
                                <span>Xem chi tiết</span>
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <PaginationControl
                pagination={responsesData?.pagination}
                onPageChange={(p) => setResponsesPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TRUNG TÂM PHÂN TÍCH AI (ĐÁNH GIÁ MỤC TIÊU + PHÁT HIỆN BẤT THƯỜNG) */}
      {activeTab === 'anomalies' && (
        <div className="space-y-8">
          {/* Section 1: Goal Analysis AI Component */}
          <GoalAnalysisAI
            campaignId={id}
            aiGoals={analytics?.ai_goals || []}
            responseCount={analytics?.total_responses || 0}
            onEvaluationsLoaded={setAiEvaluations}
          />

          <hr className="border-gray-200 my-6" />

          {/* Section 2: Anomaly Detection Component (Preserved Intact) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-gray-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-700" />
                  <h2 className="text-xl font-medium text-red-700">
                    Bảng Điều Khiển Bài Nộp Bất Thường (AI Detection)
                  </h2>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Hệ thống tự động phát hiện các bài nộp có điểm đánh giá mâu thuẫn với nội dung góp ý tự luận.
                </p>
              </div>
              <div className="shrink-0 bg-transparent text-red-600 font-medium text-sm px-4 py-2 border border-red-200 rounded-md">
                Tổng số bất thường: {anomalyData?.pagination?.total || 0}
              </div>
            </div>

            {anomalyLoading ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400 font-medium">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-600 border-t-transparent mb-2"></div>
                <p className="text-xs">Đang truy vấn danh sách phiếu nộp bất thường...</p>
              </div>
            ) : anomalyError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-semibold">
                ✕ {anomalyError}
              </div>
            ) : !anomalyData?.responses?.length ? (
              <div className="py-16 text-center space-y-2 text-gray-500">
                <PartyPopper size={48} className="mx-auto text-gray-400 mb-2" />
                <h3 className="font-medium text-gray-800 text-lg">Tuyệt vời! Không có bài nộp nào bị đánh dấu bất thường</h3>
                <p className="text-sm max-w-md mx-auto">
                  Tất cả dữ liệu phản hồi của chiến dịch này đều đồng nhất giữa điểm số đánh giá và nội dung tự luận.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4 w-24">Mã Phiếu</th>
                        <th className="py-3 px-4">Người nộp</th>
                        <th className="py-3 px-4">Ngày giờ nộp</th>
                        <th className="py-3 px-4">Lý do cảnh báo (AI)</th>
                        <th className="py-3 px-4 text-right w-32">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                      {anomalyData.responses.map((resp) => {
                        const isGuest = resp.is_guest !== undefined ? Boolean(resp.is_guest) : (!resp.evaluator_id && (resp.guest_name || resp.guest_email));
                        const roleName = resp.evaluator_role_name || (resp.evaluator_id ? 'Sinh viên' : null);
                        return (
                          <tr key={resp.response_id} className="hover:bg-red-50/30 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                              #{resp.response_id}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                <span>{resp.evaluator_name || resp.guest_name}</span>
                                {isGuest ? (
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                                    <Globe size={10} className="currentColor" /> Khách
                                  </span>
                                ) : roleName ? (
                                  <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                                    <User size={10} className="currentColor" /> {roleName}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-gray-500 font-normal">{resp.evaluator_email || resp.guest_email || 'N/A'}</div>
                            </td>
                            <td className="py-3.5 px-4 text-gray-600">
                              {resp.submitted_at ? new Date(resp.submitted_at).toLocaleString('vi-VN') : 'N/A'}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="inline-flex items-start gap-1.5 bg-red-50 text-red-800 border border-red-200 p-2.5 rounded-xl text-xs max-w-lg">
                                <AlertTriangle size={16} className="shrink-0 text-red-700 mt-0.5" />
                                <span className="leading-relaxed font-semibold">{resp.anomaly_reason || 'Phát hiện điểm số và nhận xét mâu thuẫn'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedResponse(resp)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-sm flex items-center gap-1.5"
                              >
                                <Eye size={14} className="currentColor" /> Xem chi tiết
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <PaginationControl
                  pagination={anomalyData?.pagination}
                  onPageChange={(p) => setAnomalyPage(p)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Response Detail Modal */}
      {selectedResponse && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedResponse(null)}
        >
          <div
            className="relative bg-white rounded-3xl overflow-hidden max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col my-auto border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <FileText size={16} className="currentColor" /> Chi Tiết Phiếu Nộp Bài #{selectedResponse.response_id}
                  </span>
                  {modalWorkflowStatus?.overall_status === 'COMPLETED' && (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle size={12} className="currentColor" /> Đã hoàn tất ({modalWorkflowStatus.total_steps || modalWorkflowStatus.timeline?.length || 0} bước)
                    </span>
                  )}
                  {modalWorkflowStatus?.overall_status === 'REJECTED' && (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                      <XCircle size={12} className="currentColor" /> Bị từ chối
                    </span>
                  )}
                  {modalWorkflowStatus?.overall_status === 'IN_PROGRESS' && (() => {
                    const currentStep = modalWorkflowStatus.timeline?.find(
                      (s) => s.status === 'CURRENT' || s.step_order === modalWorkflowStatus.current_step_order
                    );
                    const roleLabel = currentStep?.reviewer_role || currentStep?.step_name || 'cấp tiếp theo';
                    return (
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <Clock size={12} className="currentColor" /> Chờ {roleLabel} duyệt (Bước {modalWorkflowStatus.current_step_order}/{modalWorkflowStatus.total_steps || modalWorkflowStatus.timeline?.length})
                      </span>
                    );
                  })()}
                </div>

                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  <span>{selectedResponse.evaluator_name || selectedResponse.guest_name}</span>
                  {selectedResponse.is_guest ? (
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1">
                      <Globe size={12} className="currentColor" /> Khách
                    </span>
                  ) : (selectedResponse.evaluator_role_name || (selectedResponse.evaluator_id ? 'Sinh viên' : null)) ? (
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1">
                      <User size={12} className="currentColor" /> {selectedResponse.evaluator_role_name || 'Sinh viên'}
                    </span>
                  ) : null}
                </h3>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  {selectedResponse.evaluator_email && selectedResponse.evaluator_email !== 'N/A' && (
                    <span className="flex items-center gap-1"><Mail size={12} className="currentColor" /> {selectedResponse.evaluator_email}</span>
                  )}
                  {selectedResponse.target_user_name && (
                    <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                      <Target size={12} className="currentColor" /> Đối tượng được đánh giá: {selectedResponse.target_user_name}
                    </span>
                  )}
                  {selectedResponse.context_reference && (
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                      <Book size={12} className="currentColor" /> {selectedResponse.context_reference}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="currentColor" /> Ngày nộp:{' '}
                    {selectedResponse.submitted_at
                      ? new Date(selectedResponse.submitted_at).toLocaleString('vi-VN')
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedResponse(null)}
                className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition font-bold flex items-center justify-center text-base cursor-pointer shrink-0"
              >
                <X size={16} className="currentColor" />
              </button>
            </div>

            {/* Modal Content - List of Questions & Answers */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {modalLoading ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold">Đang tải đầy đủ dữ liệu bài nộp & tiến trình phê duyệt...</p>
                </div>
              ) : (
                <>
                  {/* Workflow Stepper Bar if multi-step workflow */}
                  {modalWorkflowStatus?.timeline && modalWorkflowStatus.timeline.length > 0 && (
                    <div className="mb-2">
                      <WorkflowStepperBar
                        timeline={modalWorkflowStatus.timeline}
                        overallStatus={modalWorkflowStatus.overall_status}
                      />
                    </div>
                  )}

                  {/* Anomaly Reason Warning */}
                  {selectedResponse.anomaly_reason && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 shadow-sm">
                      <AlertTriangle size={20} className="shrink-0 text-red-700" />
                      <div>
                        <span className="font-bold block text-red-900 mb-0.5">Cảnh báo Bất thường (AI Copilot):</span>
                        <span>{selectedResponse.anomaly_reason}</span>
                      </div>
                    </div>
                  )}

                  {/* List of Questions & Answers */}
                  {responsesData?.survey_type === 'CANVAS_TEMPLATE' || analytics?.theme_config?.surveyType === 'CANVAS_TEMPLATE' ? (
                    <div className="-mx-6">
                      <DynamicSurveyRenderer
                        surveyTitle={analytics?.survey_title || 'Bài khảo sát'}
                        surveyDescription={analytics?.survey_description || ''}
                        themeConfig={analytics?.theme_config || { surveyType: 'CANVAS_TEMPLATE' }}
                        questions={[]}
                        answers={displayModalAnswers.reduce((acc, ans) => ({ ...acc, [ans.question_id]: ans.answer_value }), {})}
                        onAnswerChange={() => {}}
                        readOnly={true}
                        isModal={true}
                        userRole={null}
                        reviewHistory={[]}
                      />
                    </div>
                  ) : displayModalAnswers.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs">
                      Không có câu trả lời nào trong phiếu này.
                    </div>
                  ) : (
                    displayModalAnswers.map((ans, idx) => (
                      <div
                        key={ans.answer_id || ans.question_id || idx}
                        className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="font-bold text-gray-800 text-sm leading-snug">
                              {ans.question_text}
                            </h4>
                            <span className="text-[10px] uppercase font-bold text-gray-400 inline-block mt-0.5">
                              Loại: {ans.question_type || ans.type}
                            </span>
                          </div>
                        </div>

                        {/* Answer Value Rendering */}
                        <div className="pl-8 pt-1">
                          <AnswerDetailRenderer
                            answer={{ ...ans, question_type: ans.question_type || ans.type }}
                            response={{
                              ...selectedResponse,
                              workflow_steps: modalWorkflowStatus?.timeline || selectedResponse.workflow_steps || [],
                              review_history: modalReviewData?.review_history || selectedResponse.review_history || [],
                            }}
                            onPreviewImage={(url) => setPreviewImage(url)}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3.5 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedResponse(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-2xl overflow-hidden max-w-3xl max-h-[90vh] shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-gray-900/80 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold hover:bg-black transition"
            >
              <X size={16} className="currentColor" />
            </button>
            <img
              src={previewImage}
              alt="Uploaded File Preview"
              className="max-h-[82vh] w-auto object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}

      {/* AI COPILOT CHATBOT (FAB & POPOVER) */}
      <CampaignCopilotChatbot campaignId={id} />
    </div>
  );
}

/* ====================================================================
   RENDERER FOR INDIVIDUAL ANSWER VALUES IN MODAL
   ==================================================================== */

function AnswerDetailRenderer({ answer, response, onPreviewImage }) {
  let rawVal = answer.answer_value;
  let attachedProof = null;

  if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal) && 'attachment' in rawVal) {
    attachedProof = rawVal.attachment;
    rawVal = rawVal.value;
  }

  const val = rawVal;
  const type = answer.question_type;

  const renderAttachmentSection = () => {
    if (!attachedProof) return null;
    let files = [];
    if (Array.isArray(attachedProof)) files = attachedProof.filter(Boolean);
    else if (typeof attachedProof === 'string') {
      const trimmed = attachedProof.trim();
      if (trimmed.startsWith('[')) {
        try {
          const p = JSON.parse(trimmed);
          if (Array.isArray(p)) files = p.filter(Boolean);
          else files = [trimmed];
        } catch (e) {
          files = [trimmed];
        }
      } else if (trimmed.includes(',')) {
        files = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        files = [trimmed];
      }
    }

    if (files.length === 0) return null;

    return (
      <div className="mt-3 pt-2.5 border-t border-amber-200/80 bg-amber-50/60 p-3 rounded-xl space-y-2">
        <span className="text-[11px] font-extrabold text-amber-900 flex items-center gap-1">
          <Paperclip size={12} className="currentColor" /> Tệp minh chứng đính kèm ({files.length} tệp):
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {files.map((fileUrl, fIdx) => {
            const fileName = fileUrl.split('/').pop() || `MinhChung_${fIdx + 1}`;
            const isImg = isImageFile(fileName);
            const icon = getFileIcon(fileName);

            return isImg ? (
              <div
                key={fIdx}
                onClick={() => onPreviewImage(fileUrl)}
                className="flex items-center gap-2 p-2 bg-white rounded-xl border border-amber-200 cursor-pointer hover:border-blue-500 transition shadow-sm"
              >
                <img
                  src={fileUrl}
                  alt={fileName}
                  className="w-10 h-10 object-cover rounded-lg shrink-0"
                />
                <span className="text-xs font-semibold text-gray-800 truncate">{fileName}</span>
              </div>
            ) : (
              <div
                key={fIdx}
                className="flex items-center justify-between p-2 bg-white rounded-xl border border-amber-200 text-xs shadow-sm"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span>{icon}</span>
                  <span className="font-semibold text-gray-800 truncate">{fileName}</span>
                </div>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 font-bold hover:underline shrink-0 ml-2"
                >
                  Tải về ↗
                </a>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (val === undefined || val === null || val === '') {
    return (
      <div>
        <span className="text-xs italic text-gray-400">(Chưa chọn đáp án)</span>
        {renderAttachmentSection()}
      </div>
    );
  }

  // Helper render wrapper with attachments
  const renderContent = (contentNode) => (
    <div className="space-y-2">
      {contentNode}
      {renderAttachmentSection()}
    </div>
  );

  // Text
  if (type === 'text') {
    return renderContent(
      <div className="bg-white p-3 rounded-xl border border-gray-200 text-xs text-gray-800 font-medium italic">
        "{String(val)}"
      </div>
    );
  }

  // Radio
  if (type === 'radio') {
    return renderContent(
      <span className="inline-block bg-blue-100 text-blue-900 font-bold text-xs px-3 py-1 rounded-lg border border-blue-200">
        ● {String(val)}
      </span>
    );
  }

  // Dropdown
  if (type === 'dropdown') {
    return renderContent(
      <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-900 font-bold text-xs px-3 py-1 rounded-lg border border-indigo-200">
        <ChevronDown size={14} className="currentColor" />
        <span>{String(val)}</span>
      </span>
    );
  }

  // Checkbox
  if (type === 'checkbox') {
    let choices = [];
    if (Array.isArray(val)) choices = val;
    else if (typeof val === 'string') {
      try {
        const p = JSON.parse(val);
        if (Array.isArray(p)) choices = p;
        else choices = [val];
      } catch (e) {
        choices = val.split(',');
      }
    }

    return renderContent(
      <div className="flex flex-wrap gap-1.5">
        {choices.map((c, idx) => (
          <span
            key={idx}
            className="flex items-center gap-1 bg-emerald-100 text-emerald-900 font-semibold text-xs px-2.5 py-1 rounded-lg border border-emerald-200"
          >
            <Check size={14} className="currentColor" /> {String(c).trim()}
          </span>
        ))}
      </div>
    );
  }

  // Rating
  if (type === 'rating') {
    const num = Number(val) || 0;
    const max = Number(answer.options?.max) || 5;
    return renderContent(
      <div className="flex items-center gap-2 text-xs font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 inline-block">
        <span className="text-amber-500 text-sm">{'★'.repeat(Math.round(num))}</span>
        <span>
          ({num} / {max} sao)
        </span>
      </div>
    );
  }

  // Slider
  if (type === 'slider') {
    return renderContent(
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 font-extrabold text-xs px-3 py-1 rounded-lg border border-blue-200">
        <SlidersHorizontal size={14} className="currentColor" /> {String(val)} điểm
      </span>
    );
  }

  // File Upload
  if (type === 'file_upload') {
    let files = [];
    if (Array.isArray(val)) files = val;
    else if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[')) {
        try {
          const p = JSON.parse(trimmed);
          if (Array.isArray(p)) files = p;
          else files = [trimmed];
        } catch (e) {
          files = [trimmed];
        }
      } else if (trimmed.includes(',')) {
        files = trimmed.split(',').map((s) => s.trim());
      } else {
        files = [trimmed];
      }
    }

    return renderContent(
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {files.map((fileUrl, fIdx) => {
          const fileName = fileUrl.split('/').pop() || `File_${fIdx + 1}`;
          const isImg = isImageFile(fileName);
          const icon = getFileIcon(fileName);

          return isImg ? (
            <div
              key={fIdx}
              onClick={() => onPreviewImage(fileUrl)}
              className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-blue-500 transition"
            >
              <img
                src={fileUrl}
                alt={fileName}
                className="w-10 h-10 object-cover rounded-lg shrink-0"
              />
              <span className="text-xs font-semibold text-gray-800 truncate">{fileName}</span>
            </div>
          ) : (
            <div
              key={fIdx}
              className="flex items-center justify-between p-2 bg-white rounded-xl border border-gray-200 text-xs"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span>{icon}</span>
                <span className="font-semibold text-gray-800 truncate">{fileName}</span>
              </div>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 font-bold hover:underline shrink-0 ml-2"
              >
                Tải về ↗
              </a>
            </div>
          );
        })}
      </div>
    );
  }

  // Matrix Form
  if (type === 'matrix') {
    let matrixOpts = answer.options || {};
    if (typeof matrixOpts === 'string') {
      try { matrixOpts = JSON.parse(matrixOpts); } catch (e) { matrixOpts = {}; }
    }
    let matrixVal = val;
    if (typeof matrixVal === 'string') {
      try { matrixVal = JSON.parse(matrixVal); } catch (e) { matrixVal = {}; }
    }

    const wfSteps = response?.workflow_steps || [];
    const revHistory = response?.review_history || [];

    return renderContent(
      <div className="w-full overflow-x-auto pt-1">
        <MatrixFormRenderer
          matrix={matrixOpts.matrix || matrixOpts}
          value={matrixVal}
          readOnly={true}
          workflowSteps={wfSteps}
          reviewHistory={revHistory}
        />
      </div>
    );
  }

  return renderContent(<span className="text-xs text-gray-800 font-medium">{JSON.stringify(val)}</span>);
}

/* ====================================================================
   SUB-COMPONENTS FOR SPECIFIC QUESTION TYPES
   ==================================================================== */

// 1. Radio Pie Chart Component
export function RadioAnalyticsCard({ breakdown, total }) {
  const chartData = Object.entries(breakdown).map(([choice, count]) => ({
    name: choice,
    value: count,
  }));

  const hasData = chartData.some((item) => item.value > 0);

  if (!hasData) {
    return <p className="text-xs italic text-gray-400 pt-2">Chưa có dữ liệu phản hồi.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={85}
              dataKey="value"
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} lượt`, 'Số lượng']} />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
          Chi tiết tỷ lệ lựa chọn
        </h4>
        {chartData.map((item, idx) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <span className="text-gray-700 truncate max-w-[200px]">{item.name}</span>
              </div>
              <span className="text-gray-600">
                {item.value} lượt <span className="text-blue-600">({percent}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 2. Checkbox Bar Chart Component
export function CheckboxAnalyticsCard({ breakdown, total }) {
  const chartData = Object.entries(breakdown).map(([choice, count]) => ({
    name: choice,
    count,
  }));

  const hasData = chartData.some((item) => item.count > 0);

  if (!hasData) {
    return <p className="text-xs italic text-gray-400 pt-2">Chưa có dữ liệu phản hồi.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4b5563' }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#4b5563' }} />
            <Tooltip formatter={(value) => [`${value} lượt`, 'Tần suất chọn']} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`bar-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
          Chi tiết lựa chọn
        </h4>
        {chartData.map((item, idx) => {
          const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div
              key={item.name}
              className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <span className="truncate text-gray-800">{item.name}</span>
              </div>
              <span className="font-bold text-blue-700 shrink-0 ml-2">
                {item.count} lượt ({percent}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 3. Rating Amazon / Shopee Review Style Component
export function RatingAmazonStyleCard({ averageRating, maxStars, ratingBreakdown, totalAnswers }) {
  const starsList = [];
  for (let i = maxStars; i >= 1; i--) {
    starsList.push(i);
  }

  return (
    <div className="bg-amber-50/40 border border-amber-200/80 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
      {/* Left Column: Big Average Score Display */}
      <div className="text-center md:border-r border-amber-200/80 pr-0 md:pr-4 space-y-1.5">
        <div className="text-4xl font-extrabold text-amber-900 tracking-tight">
          {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
          <span className="text-lg text-amber-700 font-normal"> / {maxStars}</span>
        </div>
        <div className="text-xl text-amber-500 tracking-wider">
          {'★'.repeat(Math.round(averageRating))}
          <span className="text-gray-300">
            {'★'.repeat(Math.max(0, maxStars - Math.round(averageRating)))}
          </span>
        </div>
        <p className="text-xs font-semibold text-amber-800">
          Dựa trên {totalAnswers} lượt đánh giá
        </p>
      </div>

      {/* Right Column: 5-Star Breakdown Progress Bars */}
      <div className="md:col-span-2 space-y-2">
        {starsList.map((starNum) => {
          const count = ratingBreakdown[String(starNum)] || 0;
          const percent = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;

          return (
            <div key={starNum} className="flex items-center gap-3 text-xs font-semibold">
              <div className="w-12 shrink-0 text-amber-900 flex items-center justify-end gap-1">
                <span>{starNum}</span>
                <span className="text-amber-500">★</span>
              </div>

              {/* Progress Bar */}
              <div className="flex-1 bg-amber-100/80 h-3 rounded-full overflow-hidden border border-amber-200/50">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="w-24 text-right text-gray-600 font-medium shrink-0">
                {count} lượt ({percent}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 4. Slider Score Component
export function SliderAnalyticsCard({ avgScore, minScore, maxScore }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-center">
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
        <span className="text-xs text-blue-700 font-semibold block mb-1">Điểm Trung Bình</span>
        <span className="text-3xl font-extrabold text-blue-900">{avgScore}</span>
      </div>
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <span className="text-xs text-gray-500 font-semibold block mb-1">Điểm Thấp Nhất</span>
        <span className="text-3xl font-bold text-gray-700">{minScore}</span>
      </div>
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <span className="text-xs text-gray-500 font-semibold block mb-1">Điểm Cao Nhất</span>
        <span className="text-3xl font-bold text-gray-700">{maxScore}</span>
      </div>
    </div>
  );
}

// 5. Text Responses Component
export function TextAnalyticsCard({ responses }) {
  if (!responses || responses.length === 0) {
    return <p className="text-xs italic text-gray-400 pt-1">Chưa có câu trả lời tự luận nào.</p>;
  }

  return (
    <div className="space-y-2 pt-1">
      <span className="text-xs font-bold text-gray-600 block">
        Danh sách ý kiến đóng góp ({responses.length}):
      </span>
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {responses.map((txt, idx) => (
          <div
            key={idx}
            className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-gray-800 leading-relaxed flex items-start gap-2.5"
          >
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
              #{idx + 1}
            </span>
            <p className="italic text-gray-700 font-medium">"{txt}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 6. File Upload Document Grid Component
export function FileUploadDocumentGrid({ fileUrls, onPreviewImage }) {
  if (!fileUrls || fileUrls.length === 0) {
    return <p className="text-xs italic text-gray-400 pt-1">Chưa có tệp minh chứng nào được nộp.</p>;
  }

  return (
    <div className="space-y-2 pt-1">
      <span className="text-xs font-bold text-gray-600 block mb-2">
        Danh sách tệp & minh chứng đã nộp ({fileUrls.length}):
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {fileUrls.map((url, idx) => {
          const fileName = url.split('/').pop() || `File_${idx + 1}`;
          const isImg = isImageFile(fileName);
          const icon = getFileIcon(fileName);

          return isImg ? (
            /* Image Thumbnail Card */
            <div
              key={`${url}_${idx}`}
              onClick={() => onPreviewImage(url)}
              className="group relative rounded-xl border border-gray-200 overflow-hidden bg-gray-900 cursor-pointer shadow-sm hover:shadow-md transition"
            >
              <div className="h-36 w-full overflow-hidden flex items-center justify-center bg-gray-100">
                <img
                  src={url}
                  alt={fileName}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <div className="p-2.5 bg-white border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-800 truncate max-w-[140px]">{fileName}</span>
                <span className="text-blue-600 font-bold text-[11px] group-hover:underline flex items-center gap-1">
                  <Search size={12} className="currentColor" /> Xem ảnh
                </span>
              </div>
            </div>
          ) : (
            /* Document Card */
            <div
              key={`${url}_${idx}`}
              className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 flex flex-col justify-between space-y-3 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-3xl p-2 bg-white rounded-lg border border-gray-200 shadow-sm shrink-0">
                  {icon}
                </span>
                <div className="truncate text-xs">
                  <span className="font-bold text-gray-800 block truncate">{fileName}</span>
                  <span className="text-[11px] text-gray-400 uppercase font-semibold">Tài liệu</span>
                </div>
              </div>

              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="w-full text-center bg-white hover:bg-blue-600 hover:text-white border border-blue-300 text-blue-700 font-bold text-xs py-1.5 rounded-lg transition inline-block shadow-sm"
              >
                Tải về / Xem tệp ↗
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ====================================================================
   PAGINATION CONTROL SUB-COMPONENT
   ==================================================================== */
function PaginationControl({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total, limit } = pagination;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const pages = [];
  const maxButtons = 5;
  let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100 text-xs">
      <div className="text-gray-500 font-medium">
        Hiển thị <span className="font-bold text-gray-800">{startItem} - {endItem}</span> trên tổng <span className="font-bold text-gray-800">{total}</span> kết quả
      </div>

      <div className="flex items-center gap-1.5 font-semibold">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white text-gray-700 transition"
        >
          ◄ Trước
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 rounded-lg font-bold transition flex items-center justify-center ${p === page
              ? 'bg-blue-600 text-white shadow-sm'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white text-gray-700 transition"
        >
          Sau ►
        </button>
      </div>
    </div>
  );
}

// 7. Matrix Analytics Visual Component
export function MatrixAnalyticsCard({ question }) {
  const analytics = question?.matrix_analytics;
  const options = question?.options || {};
  const matrix = analytics?.matrix || options.matrix || {};
  const groups = matrix.groups || [];
  const columns = matrix.columns || [];
  const evalColumns = columns.filter((c) => c.isInputColumn !== false && !c.isMaxScoreColumn);

  const avgByItem = analytics?.avgByItem || {};
  const avgByGroup = analytics?.avgByGroup || {};
  const avgByColumn = analytics?.avgByColumn || {};
  const comments = analytics?.comments || [];
  const grandTotalMax =
    Number(matrix.grandTotalMaxScore) ||
    groups.reduce((acc, g) => acc + (Number(g.maxScore) || 0), 0);

  const getScoreBadge = (avg, max) => {
    if (!max || max <= 0) return 'text-slate-700 bg-slate-100 border-slate-200';
    const pct = (avg / max) * 100;
    if (pct >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (pct >= 65) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (pct >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getProgressBarColor = (avg, max) => {
    if (!max || max <= 0) return 'bg-slate-400';
    const pct = (avg / max) * 100;
    if (pct >= 85) return 'bg-emerald-500';
    if (pct >= 65) return 'bg-blue-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const hasResponses = (question?.total_answers || 0) > 0;

  if (!hasResponses) {
    return (
      <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
        Chưa có dữ liệu phản hồi cho bảng ma trận đánh giá này.
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {/* 1. Header KPI Cards by Evaluation Level / Column */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {evalColumns.map((col, idx) => {
          const avgScore = avgByColumn[col.id] || 0;
          const pct = grandTotalMax > 0 ? Math.min(100, Math.round((avgScore / grandTotalMax) * 100)) : 0;
          return (
            <div
              key={col.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-2xs hover:shadow-xs transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-sm text-slate-800">{col.name}</span>
                </div>
                {col.role && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                    {col.role}
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-2xl font-black text-slate-900">{avgScore}</span>
                  <span className="text-xs text-slate-400 font-semibold ml-1.5">/ {grandTotalMax} điểm TB</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getScoreBadge(avgScore, grandTotalMax)}`}>
                  {pct}% Max
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(avgScore, grandTotalMax)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Visual Matrix Rubric Breakdown Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-xs">
        <div className="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="currentColor" />
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Bảng Tổng Hợp Điểm Trung Bình Theo Từng Tiêu Chí
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            Dựa trên {question?.total_answers || 0} lượt phản hồi
          </span>
        </div>

        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700">
              <th className="p-3.5 font-bold border-r border-slate-200 w-2/5 min-w-[240px]">Tiêu chí đánh giá</th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`p-3.5 font-bold text-center border-r border-slate-200 ${col.isMaxScoreColumn ? 'w-24 text-amber-700 bg-amber-50/30' : ''}`}
                >
                  <div className="text-xs">{col.name}</div>
                  {col.role && <div className="text-[10px] font-normal text-slate-500 uppercase mt-0.5">({col.role})</div>}
                  {!col.isMaxScoreColumn && col.isInputColumn !== false && (
                    <div className="text-[10px] font-semibold text-blue-600 mt-0.5">Điểm TB</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.id}>
                {/* Group Header */}
                <tr className="bg-emerald-50/70 border-b border-slate-200">
                  <td className="p-3.5 font-bold text-emerald-950 border-r border-slate-200">
                    {group.name}
                  </td>
                  {columns.map((col) => {
                    if (col.isMaxScoreColumn) {
                      return (
                        <td key={`g_${col.id}`} className="p-3.5 font-bold text-amber-800 text-center border-r border-slate-200 bg-amber-50/50">
                          {group.maxScore}
                        </td>
                      );
                    }
                    if (col.isInputColumn === false || col.inputType === 'text') {
                      return <td key={`g_${col.id}`} className="bg-emerald-50/30 border-r border-slate-200"></td>;
                    }
                    const avgG = avgByGroup[group.id]?.[col.id] ?? 0;
                    return (
                      <td key={`g_${col.id}`} className="p-3.5 font-bold text-center border-r border-slate-200 text-blue-800 bg-emerald-50/30">
                        <span className="text-sm">{avgG}</span>
                        {group.maxScore > 0 && (
                          <span className="text-[10px] text-slate-500 font-normal ml-1">/ {group.maxScore}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Group Items */}
                {group.items?.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition">
                    <td className="p-3 pl-8 text-slate-800 font-medium border-r border-slate-200">
                      {item.name}
                    </td>
                    {columns.map((col) => {
                      if (col.isMaxScoreColumn) {
                        return (
                          <td key={col.id} className="p-3 text-center text-slate-600 font-bold border-r border-slate-200">
                            {item.maxScore}
                          </td>
                        );
                      }
                      if (col.isInputColumn === false || col.inputType === 'text') {
                        return (
                          <td key={col.id} className="p-3 text-xs text-slate-500 text-center border-r border-slate-200 italic">
                            -
                          </td>
                        );
                      }
                      const avgItem = avgByItem[item.id]?.[col.id] ?? 0;
                      const itemPct = item.maxScore > 0 ? Math.min(100, Math.round((avgItem / item.maxScore) * 100)) : 0;
                      return (
                        <td key={col.id} className="p-3 text-center border-r border-slate-200 align-middle">
                          <div className="inline-flex flex-col items-center gap-1 min-w-[70px]">
                            <span className="font-extrabold text-slate-800 text-xs">{avgItem}</span>
                            <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getProgressBarColor(avgItem, item.maxScore)}`}
                                style={{ width: `${itemPct}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-semibold">{itemPct}%</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          {/* Footer Grand Totals */}
          {matrix?.showGrandTotal !== false && (
            <tfoot className="bg-slate-900 text-white font-bold text-sm">
              <tr>
                <td className="p-3.5 border-r border-slate-700 text-right uppercase tracking-wider">
                  TỔNG CỘNG ĐIỂM TRUNG BÌNH
                </td>
                {columns.map((col) => {
                  if (col.isMaxScoreColumn) {
                    return (
                      <td key={`gf_${col.id}`} className="p-3.5 text-center border-r border-slate-700 text-amber-300 text-base font-black">
                        {grandTotalMax}
                      </td>
                    );
                  }
                  if (col.isInputColumn === false || col.inputType === 'text') {
                    return <td key={`gf_${col.id}`} className="border-r border-slate-700"></td>;
                  }
                  const totalAvg = avgByColumn[col.id] || 0;
                  return (
                    <td key={`gf_${col.id}`} className="p-3.5 text-center border-r border-slate-700 text-amber-300 text-base font-black">
                      {totalAvg}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
