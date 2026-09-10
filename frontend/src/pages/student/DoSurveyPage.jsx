import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DynamicSurveyRenderer from '../../components/DynamicSurveyRenderer';
import { getAssignmentByIdApi } from '../../api/assignments.api';
import { submitResponseApi } from '../../api/responses.api';
import { getMyAssignmentsInCampaignApi } from '../../api/campaigns.api';
import { getUser } from '../../utils/auth.utils';

export default function DoSurveyPage() {
  const { assignmentId, campaignId: routeCampaignId } = useParams();
  const navigate = useNavigate();

  const queryAssignmentId = new URLSearchParams(window.location.search).get('assignment_id');
  const targetId = queryAssignmentId || assignmentId;

  const [assignment, setAssignment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [canvasAnswers, setCanvasAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isRestoredFromDraft, setIsRestoredFromDraft] = useState(false);

  const [campaignAssignments, setCampaignAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [showAssignmentPicker, setShowAssignmentPicker] = useState(false);

  const [forbiddenReason, setForbiddenReason] = useState('');

  const user = getUser();

  const activeAssignmentId = selectedAssignmentId || targetId || assignment?.assignment_id;
  const activeCampaignId = assignment?.campaign_id || routeCampaignId;
  const storageKey = activeCampaignId
    ? `draft_survey_${activeCampaignId}_${activeAssignmentId || 'public'}`
    : null;

  useEffect(() => {
    try {
      if (window.location.pathname.startsWith('/surveys/do/') || window.location.pathname.startsWith('/do-survey/')) {
        sessionStorage.setItem('last_survey_url', window.location.pathname + window.location.search);
      }
    } catch (e) { }

    const fetchAssignment = async () => {
      try {
        setLoading(true);
        setError('');

        let mainAssignment = null;
        if (targetId) {
          const res = await getAssignmentByIdApi(targetId);
          if (res.success) {
            mainAssignment = res.data;
          }
        }

        if (!mainAssignment && routeCampaignId) {
          const caRes = await getMyAssignmentsInCampaignApi(routeCampaignId, user?.id);
          if (caRes.success && caRes.data?.length > 0) {
            mainAssignment = caRes.data.find((a) => a.status === 'Pending') || caRes.data[0];
          }
        }

        if (mainAssignment && (!mainAssignment.questions || mainAssignment.questions.length === 0)) {
          const detailRes = await getAssignmentByIdApi(mainAssignment.assignment_id);
          if (detailRes.success && detailRes.data) {
            mainAssignment = {
              ...mainAssignment,
              ...detailRes.data,
              questions: detailRes.data.questions || mainAssignment.questions || [],
            };
          }
        }

        if (!mainAssignment) {
          setError('Không thể tải bài khảo sát');
          setLoading(false);
          return;
        }

        setAssignment(mainAssignment);
        setSelectedAssignmentId(mainAssignment.assignment_id);

        let initialAnswers = {};
        if (mainAssignment.existing_answers && Object.keys(mainAssignment.existing_answers).length > 0) {
          initialAnswers = mainAssignment.existing_answers;
        }

        if (mainAssignment.status === 'Completed') {
          setAnswers(initialAnswers);
          setIsSuccess(true);
          setIsReviewing(true);
          setLoading(false);
          return;
        }

        const cid = mainAssignment.campaign_id || routeCampaignId;
        const userId = user?.id;

        if (cid && userId) {
          try {
            const caRes = await getMyAssignmentsInCampaignApi(cid, userId);
            if (caRes.success) {
              setCampaignAssignments(caRes.data || []);
            }
          } catch (caughtErr) {
            console.warn('Không tải được danh sách assignment trong campaign:', caughtErr.message);
          }
        }

        // Restore draft from localStorage if available
        const currentKey = `draft_survey_${cid}_${mainAssignment.assignment_id || 'public'}`;
        const savedDraft = localStorage.getItem(currentKey);
        
        let finalAnswers = { ...initialAnswers };
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
              // Deep merge for matrix objects so we don't overwrite previous columns
              for (const [qId, val] of Object.entries(parsed)) {
                if (typeof val === 'object' && val !== null && !Array.isArray(val) && val.value !== 'other_custom' && !val.attachment) {
                  finalAnswers[qId] = { ...(finalAnswers[qId] || {}) };
                  for (const [itemId, itemCols] of Object.entries(val)) {
                    if (typeof itemCols === 'object' && itemCols !== null) {
                      finalAnswers[qId][itemId] = { ...(finalAnswers[qId][itemId] || {}), ...itemCols };
                    } else {
                      finalAnswers[qId][itemId] = itemCols;
                    }
                  }
                } else {
                  finalAnswers[qId] = val;
                }
              }
              setIsRestoredFromDraft(true);
            }
          } catch (err) {
            console.warn('Lỗi đọc bản nháp từ localStorage:', err);
          }
        }
        
        setAnswers(finalAnswers);

        setShowAssignmentPicker(false);
      } catch (err) {
        const msg = err.response?.data?.message || 'Lỗi khi tải bài khảo sát';
        setError(msg);
        if (err.response?.status === 403) {
          setForbiddenReason(msg);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, [targetId, routeCampaignId, user?.id]);

  // Auto-save answers to localStorage on change
  useEffect(() => {
    if (!storageKey || loading || isSuccess) return;
    if (answers && Object.keys(answers).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    }
  }, [answers, storageKey, loading, isSuccess]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleChooseAssignment = (id) => {
    setSelectedAssignmentId(id);
    setShowAssignmentPicker(false);
    setError('');
  };

  const handleBackToPicker = () => {
    setShowAssignmentPicker(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignment) return;

    const activeAssignmentId = selectedAssignmentId || assignmentId;

    const pendingList = campaignAssignments.filter(
      (a) => a.status === 'Pending' && a.target_user_id
    );
    const currentSel = campaignAssignments.find(
      (a) => a.assignment_id === activeAssignmentId
    );

    if (currentSel && currentSel.status === 'Completed') {
      alert('Nhiệm vụ này đã được hoàn thành. Vui lòng chọn nhiệm vụ khác.');
      setShowAssignmentPicker(pendingList.length > 0);
      return;
    }

    const getFileCount = (val) => {
      if (!val) return 0;
      if (Array.isArray(val)) return val.filter(Boolean).length;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return 0;
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.filter(Boolean).length;
          } catch (err) { }
        }
        if (trimmed.includes(',')) {
          return trimmed.split(',').map((s) => s.trim()).filter(Boolean).length;
        }
        return 1;
      }
      return 0;
    };

    for (const q of assignment.questions || []) {
      if (q.type === 'file_upload') {
        const minFiles =
          q.options?.min_files !== undefined
            ? Number(q.options.min_files)
            : q.is_required
              ? 1
              : 0;
        const maxFiles =
          q.options?.max_files !== undefined ? Number(q.options.max_files) : 5;
        const count = getFileCount(answers[q.id]);

        if (count < minFiles) {
          setError(
            minFiles === 1
              ? `Vui lòng tải lên tệp minh chứng cho câu hỏi: "${q.question_text}"`
              : `Câu hỏi "${q.question_text}" yêu cầu nộp tối thiểu ${minFiles} tệp (hiện tại bạn mới nộp ${count} tệp).`
          );
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        if (count > maxFiles) {
          setError(
            `Câu hỏi "${q.question_text}" chỉ cho phép nộp tối đa ${maxFiles} tệp (hiện tại bạn đã nộp ${count} tệp).`
          );
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      } else {
        const val = answers[q.id];

        // Validation for "other_custom" text input
        const isOtherObj = typeof val === 'object' && val !== null && val.value === 'other_custom';
        const isOtherStr = typeof val === 'string' && val === 'other_custom';
        if (isOtherObj || isOtherStr) {
          const customText = isOtherObj ? (val.text || '').trim() : '';
          if (!customText) {
            setError(`Vui lòng nhập chi tiết cho tùy chọn Khác ở câu hỏi: "${q.question_text}"`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
        }

        if (q.is_required) {
          if (
            val === undefined ||
            val === null ||
            val === '' ||
            (Array.isArray(val) && val.length === 0)
          ) {
            setError(`Vui lòng trả lời câu hỏi bắt buộc: "${q.question_text}"`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
        }
      }

      if (q.options?.enable_file_attachment) {
        const attachMin =
          q.options?.file_attachment_min !== undefined
            ? Number(q.options.file_attachment_min)
            : q.options?.file_attachment_required
              ? 1
              : 0;
        const attachMax =
          q.options?.file_attachment_max !== undefined
            ? Number(q.options.file_attachment_max)
            : 5;
        const attachCount = getFileCount(answers[`${q.id}_file`]);

        if (attachCount < attachMin) {
          setError(
            attachMin === 1
              ? `Vui lòng đính kèm tệp minh chứng cho câu hỏi: "${q.question_text}"`
              : `Mục đính kèm tệp ở câu hỏi "${q.question_text}" yêu cầu tối thiểu ${attachMin} tệp (hiện tại bạn mới nộp ${attachCount} tệp).`
          );
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        if (attachCount > attachMax) {
          setError(
            `Mục đính kèm tệp ở câu hỏi "${q.question_text}" vượt quá giới hạn tối đa ${attachMax} tệp.`
          );
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      setError('');

      const evaluatorId = user?.id || assignment.user_id;

      let formattedAnswers = [];
      const formType = assignment.survey_type || assignment.theme_config?.surveyType;

      if (formType === 'CANVAS_TEMPLATE') {
        // CHỈ xử lý dữ liệu cho Canvas ở đây
        formattedAnswers = Object.keys(canvasAnswers).map(id => ({
          question_id: id,
          answer_value: canvasAnswers[id]
        })).filter(ans => ans.answer_value !== undefined && ans.answer_value !== null && ans.answer_value !== '');
      } else {
        // GIỮ NGUYÊN 100% logic gom payload cũ của hệ thống ở đây
        formattedAnswers = (assignment.questions || [])
          .map((q) => {
            const val = answers[q.id];
            const attachedFile = answers[`${q.id}_file`];

            let finalAnswerVal = val;

            // If "other_custom" was selected, extract the user's custom input text directly for DB storage
            if (typeof val === 'object' && val !== null && val.value === 'other_custom') {
              finalAnswerVal = val.text?.trim() || '';
            }

            if (q.type !== 'file_upload' && attachedFile) {
              const hasFile = Array.isArray(attachedFile)
                ? attachedFile.filter(Boolean).length > 0
                : typeof attachedFile === 'string' && attachedFile.trim() !== '';

              if (hasFile) {
                finalAnswerVal = {
                  value: finalAnswerVal !== undefined ? finalAnswerVal : null,
                  attachment: attachedFile,
                };
              }
            }

            return {
              question_id: Number(q.id),
              answer_value: finalAnswerVal,
            };
          })
          .filter(
            (ans) =>
              ans.answer_value !== undefined &&
              ans.answer_value !== null &&
              ans.answer_value !== ''
          );
      }

      const pickedAssignment = campaignAssignments.find(
        (a) => String(a.assignment_id) === String(activeAssignmentId)
      );

      const rawAssignmentId = activeAssignmentId || assignment.assignment_id;
      const isPublicAssignment = typeof rawAssignmentId === 'string' && String(rawAssignmentId).startsWith('public_');
      const finalAssignmentId = isPublicAssignment ? String(rawAssignmentId) : Number(rawAssignmentId);

      const res = await submitResponseApi({
        assignment_id: finalAssignmentId,
        campaign_id: assignment.campaign_id || routeCampaignId,
        evaluator_id: evaluatorId,
        guest_name: user?.guest_name || user?.full_name || null,
        guest_email: user?.guest_email || user?.email || null,
        target_user_id: pickedAssignment?.target_user_id || assignment.target_user_id,
        context_reference: pickedAssignment?.context_reference || assignment.context_reference,
        answers: formattedAnswers,
      });

      if (res.success) {
        if (storageKey) {
          localStorage.removeItem(storageKey);
        }
        setIsRestoredFromDraft(false);

        setCampaignAssignments((prev) =>
          prev.map((a) =>
            String(a.assignment_id) === String(rawAssignmentId)
              ? { ...a, status: 'Completed' }
              : a
          )
        );

        setIsSuccess(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Nộp bài khảo sát thất bại';
      setError(msg);
      if (err.response?.status === 403 || err.response?.status === 404 || msg.includes('không tồn tại') || msg.includes('gỡ bỏ')) {
        setForbiddenReason(msg);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (forbiddenReason) {
    let icon = '🔒';
    let title = 'Không thể tham gia khảo sát';
    let bgColor = 'bg-amber-500';

    if (forbiddenReason.includes('không tồn tại') || forbiddenReason.includes('gỡ bỏ') || forbiddenReason.includes('404')) {
      icon = '🚫';
      title = 'Khảo sát không tồn tại hoặc đã bị đóng';
      bgColor = 'bg-rose-500';
    } else if (forbiddenReason.includes('tạm dừng')) {
      icon = '⏸️';
      title = 'Form khảo sát đang tạm dừng';
      bgColor = 'bg-gray-500';
    } else if (forbiddenReason.includes('chưa bắt đầu')) {
      icon = '⏳';
      title = 'Form khảo sát chưa bắt đầu';
      bgColor = 'bg-blue-500';
    } else if (forbiddenReason.includes('kết thúc')) {
      icon = '🏁';
      title = 'Form khảo sát đã kết thúc';
      bgColor = 'bg-red-500';
    }

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg border border-gray-200 shadow-xl text-center space-y-5">
          <div className={`w-20 h-20 ${bgColor} text-white rounded-full flex items-center justify-center text-4xl mx-auto shadow-md`}>
            {icon}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed font-medium">
              {forbiddenReason}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full bg-gray-900 hover:bg-black text-white font-bold text-sm py-3 rounded-lg shadow-sm transition"
            >
              Về Trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 max-w-xl mx-auto mt-10">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p className="text-sm font-medium">Đang tải câu hỏi khảo sát...</p>
      </div>
    );
  }

  if (isSuccess) {
    const isPublicGuest = user?.role_name === 'PublicGuest' || Boolean(assignment?.is_public);

    if (isPublicGuest) {
      return (
        <div className="max-w-lg mx-auto my-16 bg-white p-10 rounded-lg border border-gray-200 shadow-xl text-center space-y-5">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">
            ✓
          </div>
          <h2 className="text-3xl font-extrabold text-gray-800 tracking-tight">Cảm ơn bạn đã hoàn thành khảo sát!</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            Phản hồi của bạn đã được ghi nhận thành công. Bạn có thể đóng tab này.
          </p>
        </div>
      );
    }

    const cid = assignment?.campaign_id || routeCampaignId;
    const remainingPending = campaignAssignments.filter(
      (a) => a.status === 'Pending' && a.target_user_id
    );

    // Check if this is a Teacher Evaluation campaign (Sinh viên -> Giảng viên -> Môn học)
    const isTeacherEvaluation =
      Boolean(assignment?.target_user_id) ||
      (campaignAssignments && campaignAssignments.some((a) => Boolean(a.target_user_id)));

    if (isReviewing) {
      return (
        <div className="py-6 px-4">
          <DynamicSurveyRenderer
            surveyTitle={assignment?.title || 'Bài khảo sát'}
            surveyDescription={assignment?.description || ''}
            themeConfig={assignment?.theme_config || {}}
            questions={assignment?.questions || []}
            answers={answers}
            onAnswerChange={() => { }}
            readOnly={true}
            userRole={user}
            onCloseReview={() => navigate('/my-surveys')}
            reviewHistory={assignment?.review_history || []}
            workflowSteps={assignment?.workflow_steps || []}
            isWorkflowEnabled={assignment?.is_workflow_enabled || false}
          />
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-lg border border-gray-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Cảm ơn bạn đã nộp bài!</h2>

        <p className="text-xs text-gray-600 leading-relaxed px-2">
          Bài khảo sát của bạn đã được lưu thành công và một email xác nhận đã được gửi đến hòm thư của bạn. Ý kiến đóng góp của bạn rất quan trọng với chúng tôi.
        </p>

        {campaignAssignments.length > 0 && remainingPending.length > 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 font-semibold">
            ⚠️ Bạn vẫn còn <b>{remainingPending.length}</b> mục đánh giá chưa hoàn thành trong đợt này.
          </p>
        )}

        <div className="pt-4 space-y-3">
          <button
            type="button"
            onClick={() => setIsReviewing(true)}
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm py-3 rounded-lg border border-blue-200 shadow-sm transition flex items-center justify-center gap-2"
          >
            <span>🔍</span>
            <span>Xem lại bài khảo sát</span>
          </button>

          {cid && isTeacherEvaluation && (
            <button
              type="button"
              onClick={() => navigate(`/my-surveys/campaign/${cid}`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-lg shadow-sm transition"
            >
              Trở lại Danh sách Đánh giá Đợt này
            </button>
          )}

          {user?.role_name !== 'PublicGuest' && (
            <button
              type="button"
              onClick={() => navigate('/my-surveys')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm py-3 rounded-lg transition"
            >
              Về lại Dashboard Sinh viên
            </button>
          )}
        </div>
      </div>
    );
  }

  const pendingAssignments = campaignAssignments.filter(
    (a) => a.status === 'Pending' && a.target_user_id
  );
  const completedAssignments = campaignAssignments.filter(
    (a) => a.status === 'Completed' && a.target_user_id
  );

  if (showAssignmentPicker && pendingAssignments.length > 0) {
    return (
      <div className="pb-12">
        <div className="max-w-4xl mx-auto mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/my-surveys')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition flex items-center gap-1"
          >
            ← Trở lại danh sách
          </button>
          {assignment && (
            <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
              Form khảo sát: {assignment.campaign_name}
            </span>
          )}
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="space-y-1 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-700 rounded-full text-2xl mb-2">
              🎯
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              Chọn nhiệm vụ đánh giá của bạn
            </h1>
            <p className="text-sm text-gray-500">
              Form khảo sát này áp dụng <b>phân công chi tiết</b> theo Giảng viên và Môn học.
              Vui lòng chọn mục bạn muốn đánh giá trước:
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
              ✕ {error}
            </div>
          )}

          {pendingAssignments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700">
                  ⏳ Chưa hoàn thành ({pendingAssignments.length})
                </h2>
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-lg font-medium border border-amber-200">
                  Nhấn để bắt đầu đánh giá
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingAssignments.map((a, idx) => (
                  <button
                    key={a.assignment_id}
                    type="button"
                    onClick={() => handleChooseAssignment(a.assignment_id)}
                    className={`group text-left border-2 rounded-xl p-4 transition-all duration-200 hover:shadow-md ${selectedAssignmentId === a.assignment_id
                      ? 'border-blue-500 bg-blue-50/60 shadow-md'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-gray-900 text-sm truncate">
                            Thầy/Cô {a.target_user_name || 'Giảng viên'}
                          </h3>
                          <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            Chưa làm
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg px-2.5 py-1 text-xs font-semibold">
                          <span>📚</span>
                          <span>Môn: {a.context_reference || 'Môn học'}</span>
                        </div>
                        {a.target_user_department && (
                          <p className="text-[11px] text-gray-400 pt-0.5">
                            Khoa / Bộ môn: {a.target_user_department}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-800 flex items-center gap-1">
                        Bắt đầu đánh giá
                        <span>→</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {completedAssignments.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">
                ✓ Đã hoàn thành ({completedAssignments.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {completedAssignments.map((a) => (
                  <div
                    key={a.assignment_id}
                    className="border-2 border-emerald-200 bg-emerald-50/40 rounded-xl p-4 opacity-80"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        ✓
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-gray-900 text-sm truncate">
                            Thầy/Cô {a.target_user_name || 'Giảng viên'}
                          </h3>
                          <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                            Hoàn thành
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs font-semibold">
                          <span>📚</span>
                          <span>Môn: {a.context_reference || 'Môn học'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const displayAssignment =
    campaignAssignments.find((a) => a.assignment_id === selectedAssignmentId) || assignment;

  return (
    <div className="pb-12">
      {/* Top back bar */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pendingAssignments.length > 0 && (
            <button
              type="button"
              onClick={handleBackToPicker}
              className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
            >
              📋 Danh sách nhiệm vụ
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const cid = assignment?.campaign_id || routeCampaignId;
              if (cid && displayAssignment?.target_user_id) {
                navigate(`/my-surveys/campaign/${cid}`);
              } else {
                navigate('/my-surveys');
              }
            }}
            className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition flex items-center gap-1.5"
          >
            {displayAssignment?.target_user_id ? '← Trở lại danh sách giảng viên' : '← Trở lại Dashboard Sinh viên'}
          </button>
        </div>

        {assignment && (
          <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
            Form khảo sát: {assignment.campaign_name}
          </span>
        )}
      </div>

      {displayAssignment?.target_user_id && (
        <div className="max-w-3xl mx-auto mb-4 bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center text-lg flex-shrink-0">
            👨‍🏫
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
              Đánh giá Đối tượng
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-sm">
                Đánh giá: Thầy/Cô {displayAssignment.target_user_name || 'Giảng viên'} - Môn: {displayAssignment.context_reference || 'Môn học'}
              </h3>
            </div>
            {displayAssignment.target_user_department && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                Khoa / Bộ môn: {displayAssignment.target_user_department}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 hidden sm:block">
            {pendingAssignments.length > 0 && (
              <div className="text-right">
                <div className="text-[11px] text-slate-400 mb-1">Tiến độ khảo sát</div>
                <div className="text-xs font-semibold text-slate-700">
                  {completedAssignments.length}/{pendingAssignments.length + completedAssignments.length}
                </div>
                <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pendingAssignments.length + completedAssignments.length
                        ? Math.round(
                          (completedAssignments.length /
                            (pendingAssignments.length + completedAssignments.length)) *
                          100
                        )
                        : 0
                        }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isRestoredFromDraft && (
        <div className="max-w-3xl mx-auto mb-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-base">💡</span>
            <span>Hệ thống đã tự động khôi phục dữ liệu đang làm dở của bạn.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsRestoredFromDraft(false)}
            className="text-amber-700 hover:text-amber-950 font-bold text-xs px-2 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="max-w-3xl mx-auto mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          ✕ {error}
        </div>
      )}

      {assignment && (
        <DynamicSurveyRenderer
          surveyTitle={assignment.campaign_name || assignment.survey_title}
          surveyDescription={assignment.campaign_description || assignment.survey_description}
          themeConfig={{
            ...assignment.theme_config,
            surveyType: assignment.survey_type || assignment.theme_config?.surveyType
          }}
          questions={assignment.questions}
          answers={answers}
          onAnswerChange={handleAnswerChange}
          canvasAnswers={canvasAnswers}
          setCanvasAnswers={setCanvasAnswers}
          isSubmitting={submitting}
          onSubmit={handleSubmit}
          userRole={user}
        />
      )}
    </div>
  );
}
