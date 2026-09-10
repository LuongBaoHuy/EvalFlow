import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WorkflowStepperBar from '../components/WorkflowStepperBar';
import MatrixFormRenderer from '../components/matrix/MatrixFormRenderer';
import DynamicSurveyRenderer from '../components/DynamicSurveyRenderer';
import { getUser } from '../utils/auth.utils';
import { getWorkflowStatusApi, getResponseAnswersForReviewApi, submitReviewApi } from '../api/workflow.api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAnswerDisplay(type, value) {
  if (value === null || value === undefined || value === '') return '(Không có câu trả lời)';
  if (type === 'matrix') return null; // Handled separately by MatrixFormRenderer
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value.value !== undefined) return getAnswerDisplay(type, value.value);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return value.join(', ');
  if (type === 'slider' || type === 'rating') return `${value} điểm`;
  return String(value);
}

function getReviewedValueForQuestion(reviewedData, questionId) {
  if (!Array.isArray(reviewedData)) return undefined;
  const found = reviewedData.find(r => String(r.question_id) === String(questionId));
  return found?.answer_value;
}

function renderReviewInput(type, options, value, onChange, questionId) {
  if (type === 'slider') {
    const min = options?.min ?? 0;
    const max = options?.max ?? 100;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Điểm reviewer</span>
          <span style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff',
            borderRadius: '8px',
            padding: '2px 10px',
            fontSize: '13px',
            fontWeight: 700,
          }}>{value ?? min} điểm</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value ?? min}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          style={{ width: '100%', accentColor: '#6366f1' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
          <span>{min}</span><span>{max}</span>
        </div>
      </div>
    );
  }
  if (type === 'rating') {
    const max = options?.max ?? 5;
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(star => (
          <button
            key={star}
            onClick={() => onChange(star)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '28px',
              color: star <= (value ?? 0) ? '#f59e0b' : '#475569',
              transition: 'transform 0.1s, color 0.15s',
              transform: star <= (value ?? 0) ? 'scale(1.1)' : 'scale(1)',
            }}
          >★</button>
        ))}
      </div>
    );
  }
  if (type === 'radio') {
    const choices = options?.choices || [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {choices.map((choice, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="radio"
              name={`review_radio_${questionId}_${i}`}
              checked={value === choice}
              onChange={() => onChange(choice)}
              style={{ accentColor: '#2563eb' }}
            />
            <span style={{ color: '#334155', fontSize: '14px' }}>{choice}</span>
          </label>
        ))}
      </div>
    );
  }
  if (type === 'dropdown') {
    const choices = options?.choices || [];
    return (
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '10px 14px',
          color: '#1e293b',
          fontSize: '14px',
          outline: 'none',
        }}
      >
        <option value="" disabled>Chọn một đáp án...</option>
        {choices.map((choice, i) => (
          <option key={i} value={choice}>{choice}</option>
        ))}
      </select>
    );
  }
  if (type === 'checkbox') {
    const choices = options?.choices || [];
    const currentValue = Array.isArray(value) ? value : [];
    
    const handleCheckboxChange = (choice) => {
      if (currentValue.includes(choice)) {
        onChange(currentValue.filter(c => c !== choice));
      } else {
        onChange([...currentValue, choice]);
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {choices.map((choice, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={currentValue.includes(choice)}
              onChange={() => handleCheckboxChange(choice)}
              style={{ accentColor: '#2563eb' }}
            />
            <span style={{ color: '#334155', fontSize: '14px' }}>{choice}</span>
          </label>
        ))}
      </div>
    );
  }
  // Default: text
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      rows={3}
      style={{
        width: '100%',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        padding: '10px 14px',
        color: '#1e293b',
        fontSize: '14px',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
      placeholder="Nhập nhận xét của bạn..."
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WorkflowReviewPage() {
  const { responseId } = useParams();
  const navigate = useNavigate();

  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [reviewValues, setReviewValues] = useState({});
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitAction, setSubmitAction] = useState(null); // 'APPROVED' | 'REJECTED'
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const currentUser = getUser();

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, dataRes] = await Promise.all([
        getWorkflowStatusApi(responseId),
        getResponseAnswersForReviewApi(responseId),
      ]);
      setWorkflowStatus(statusRes.data);
      setReviewData(dataRes.data);

      // Pre-fill từ original_answers
      const prefill = {};
      dataRes.data?.original_answers?.forEach(r => {
        prefill[r.question_id] = r.answer_value;
      });

      // Ghi đè bằng review mới nhất nếu có
      const latestHistory = dataRes.data?.review_history;
      if (Array.isArray(latestHistory) && latestHistory.length > 0) {
        const last = latestHistory[latestHistory.length - 1];
        if (Array.isArray(last?.reviewed_data)) {
          last.reviewed_data.forEach(r => {
            if (r.answer_value !== undefined) {
              prefill[r.question_id] = r.answer_value;
            }
          });
        }
      }
      setReviewValues(prefill);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể tải dữ liệu phiếu');
    } finally {
      setLoading(false);
    }
  }, [responseId]);

  useEffect(() => { load(); }, [load]);

  const handleValueChange = (questionId, value) => {
    setReviewValues(prev => ({ ...prev, [questionId]: value }));
  };

  const wf = workflowStatus;
  const isStandardForm = !wf?.survey_type || wf?.survey_type !== 'CANVAS_TEMPLATE';

  const handleSubmit = async (action) => {
    setSubmitAction(action);
    setSubmitting(true);
    try {
      let reviewed_data;
      if (!isStandardForm) {
        reviewed_data = Object.keys(reviewValues).map(k => ({
          question_id: k,
          answer_value: reviewValues[k]
        }));
      } else {
        reviewed_data = (reviewData?.original_answers || []).map(q => ({
          question_id: q.question_id,
          answer_value: reviewValues[q.question_id] ?? q.answer_value,
        }));
      }

      await submitReviewApi(responseId, { reviewed_data, note, action });

      showToast(
        action === 'APPROVED' ? '✅ Đã duyệt thành công!' : '❌ Đã từ chối phiếu này',
        action === 'APPROVED' ? 'success' : 'error'
      );

      setTimeout(() => navigate('/my-pending-reviews'), 1800);
    } catch (err) {
      showToast(err.response?.data?.message || 'Có lỗi xảy ra khi chấm điểm', 'error');
    } finally {
      setSubmitting(false);
      setSubmitAction(null);
    }
  };

  // ── Render ──
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onBack={() => navigate('/my-pending-reviews')} />;

  const answers = reviewData?.original_answers || [];
  const reviewHistory = reviewData?.review_history || [];

  // Xác định bước hiện tại
  const currentStep = wf?.timeline?.find(s => s.status === 'CURRENT' || s.status === 'PENDING');
  const canReview = !!currentStep && wf?.overall_status === 'IN_PROGRESS';
  const canEdit = currentStep?.can_edit_answers !== false;

  return (
    <div className="bg-white min-h-screen py-6 px-4 md:px-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: toast.type === 'success' ? '#064e3b' : '#450a0a',
          color: toast.type === 'success' ? '#34d399' : '#f87171',
          border: `1px solid ${toast.type === 'success' ? '#059669' : '#dc2626'}`,
          borderRadius: '12px', padding: '14px 20px',
          fontSize: '14px', fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.3s ease',
        }}>{toast.msg}</div>
      )}

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/my-pending-reviews')}
          style={{
            background: 'none',
            border: 'none',
            borderRadius: '0',
            color: '#2563eb',
            padding: '0 0 20px 0',
            fontSize: '13px',
            cursor: 'pointer',
            marginBottom: '4px',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontWeight: 600,
          }}
        >
          ← Quay lại danh sách
        </button>

        {/* Header info */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ color: '#1e293b', fontSize: '22px', fontWeight: 800, margin: '0 0 6px' }}>
            📋 Chấm điểm Phiếu #{responseId}
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Chiến dịch: <strong style={{ color: '#334155' }}>{wf?.campaign_name}</strong>
            {wf?.submitter_name && (
              <> · Người nộp: <strong style={{ color: '#334155' }}>{wf.submitter_name}</strong></>
            )}
          </p>
        </div>

        {/* Stepper */}
        {wf?.timeline && (
          <WorkflowStepperBar
            timeline={wf.timeline}
            overallStatus={wf.overall_status}
          />
        )}

        {/* Completed / Rejected state */}
        {wf?.overall_status === 'COMPLETED' && (
          <StatusBanner type="success" message="✅ Quy trình đã hoàn tất. Tất cả các bước đã được duyệt." />
        )}
        {wf?.overall_status === 'REJECTED' && (
          <StatusBanner type="error" message="❌ Phiếu này đã bị từ chối. Quy trình kết thúc." />
        )}

        {/* Review pane */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
          marginTop: '24px',
        }}>
            {/* Pane header */}
            <div style={{
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              padding: '18px 28px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <span style={{ fontSize: '18px' }}>✏️</span>
              <div>
                <div style={{ color: '#1e293b', fontWeight: 700, fontSize: '15px' }}>
                  {currentStep?.step_name || 'Chi tiết phiếu khảo sát'} — {canReview ? 'Nhập điểm của bạn' : 'Chế độ xem'}
                </div>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                  {canEdit && canReview
                    ? 'Bạn chỉ có thể chỉnh sửa cột thuộc quyền của mình, các cột khác sẽ bị khóa tự động'
                    : 'Chỉ được xem, không chỉnh sửa điểm cấp dưới'}
                </div>
              </div>
            </div>

            {/* Questions */}
            <div style={{ padding: '28px', background: 'white' }}>
              {!isStandardForm ? (
                <div>
                  <DynamicSurveyRenderer
                    surveyTitle=""
                    surveyDescription=""
                    themeConfig={wf?.theme_config || {}}
                    canvasAnswers={reviewValues}
                    setCanvasAnswers={(canEdit && canReview) ? setReviewValues : undefined}
                    readOnly={!(canEdit && canReview)}
                    isModal={true}
                    onAnswerChange={() => {}}
                  />
                </div>
              ) : answers.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
                  Không có câu hỏi nào trong phiếu này
                </div>
              ) : answers.every(q => q.type !== 'matrix') ? (
                <div>
                  <DynamicSurveyRenderer
                    surveyTitle=""
                    surveyDescription=""
                    themeConfig={{ surveyType: 'STANDARD' }}
                    questions={answers.map(a => ({
                      id: a.question_id,
                      type: a.type,
                      text: a.question_text,
                      options: typeof a.options === 'string' ? JSON.parse(a.options || '{}') : (a.options || {})
                    }))}
                    answers={Object.fromEntries(answers.map(a => [a.question_id, a.answer_value]))}
                    readOnly={true}
                    isModal={true}
                    onAnswerChange={() => {}}
                  />
                </div>
              ) : answers.map((q, idx) => {
                  const opts = typeof q.options === 'string' ? JSON.parse(q.options || '{}') : q.options || {};
                const originalValue = q.answer_value;
                const isMatrix = q.type === 'matrix';

                // Tìm giá trị từ lịch sử review các cấp
                const historyByStep = reviewHistory.map(h => ({
                  step_name: h.step_name,
                  step_order: h.step_order,
                  value: getReviewedValueForQuestion(h.reviewed_data, q.question_id),
                })).filter(h => h.value !== undefined);

                const myValue = reviewValues[q.question_id];

                // Parse matrix answer value (could be JSON string)
                const parseMatrixValue = (val) => {
                  if (!val) return {};
                  if (typeof val === 'object') return val;
                  try { return JSON.parse(val); } catch { return {}; }
                };

                return (
                  <div
                    key={q.question_id}
                    style={{
                      marginBottom: idx < answers.length - 1 ? '28px' : '0',
                      paddingBottom: idx < answers.length - 1 ? '28px' : '0',
                      borderBottom: idx < answers.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    {/* Question text */}
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        marginRight: '8px',
                      }}>Câu {idx + 1}</span>
                      <span style={{ color: '#1e293b', fontSize: '14px', fontWeight: 600 }}>
                        {q.question_text}
                      </span>
                    </div>

                    {/* MATRIX TYPE: Single unified form, reviewer's role-locked columns */}
                    <div>
                      <MatrixFormRenderer
                        matrix={opts.matrix}
                        userRole={currentUser}
                        value={myValue !== undefined
                          ? parseMatrixValue(myValue)
                          : parseMatrixValue(historyByStep.length > 0
                              ? historyByStep[historyByStep.length - 1].value
                              : originalValue
                            )
                        }
                        reviewHistory={reviewHistory}
                        workflowSteps={wf?.timeline || []}
                        currentStepOrder={currentStep?.step_order ?? null}
                        onChange={(canEdit && canReview) ? (newVal) => handleValueChange(q.question_id, newVal) : undefined}
                        readOnly={!(canEdit && canReview)}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Lịch sử nhận xét chung từ các cấp trước (Cho dạng Chuẩn) */}
              {answers.every(q => q.type !== 'matrix') && wf?.timeline && wf.timeline.some(t => t.review?.note) && (
                <div style={{
                  marginTop: '28px',
                  paddingTop: '24px',
                  borderTop: '1px solid #e2e8f0',
                }}>
                  <h4 style={{ color: '#334155', fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>
                    📋 Lịch sử nhận xét từ các cấp trước
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {wf.timeline.filter(t => t.review?.note).map((t, idx) => (
                      <div key={idx} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                          📌 {t.step_name} - {t.review.reviewer_name}
                        </div>
                        <div style={{ fontSize: '14px', color: '#1e293b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {t.review.note}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Note field */}
              {canReview && (
                <div style={{
                  marginTop: '28px',
                  paddingTop: '24px',
                  borderTop: '1px solid #e2e8f0',
                }}>
                  <label style={{ color: '#334155', fontSize: '14px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                    💬 Ghi chú phê duyệt / Từ chối (tùy chọn)
                  </label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                    placeholder="Nhập nhận xét chung, lý do duyệt hoặc từ chối phiếu..."
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      color: '#1e293b',
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Action buttons */}
              {canReview && (
                <div style={{
                display: 'flex',
                gap: '14px',
                marginTop: '24px',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => handleSubmit('REJECTED')}
                  disabled={submitting}
                  style={{
                    background: submitting && submitAction === 'REJECTED'
                      ? '#450a0a'
                      : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 28px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(239,68,68,0.3)',
                  }}
                >
                  {submitting && submitAction === 'REJECTED' ? '⏳ Đang xử lý...' : '❌ Từ chối'}
                </button>

                <button
                  onClick={() => handleSubmit('APPROVED')}
                  disabled={submitting}
                  style={{
                    background: submitting && submitAction === 'APPROVED'
                      ? '#064e3b'
                      : 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 32px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                  }}
                >
                  {submitting && submitAction === 'APPROVED' ? '⏳ Đang xử lý...' : '✅ Duyệt & Chốt điểm'}
                </button>
              </div>
              )}
            </div>
          </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="py-24 text-center bg-white flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu phiếu...</p>
    </div>
  );
}

function ErrorState({ message, onBack }) {
  return (
    <div className="py-24 flex items-center justify-center p-6 bg-white">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-md w-full">
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-base font-bold text-red-800 mb-2">
          Không thể tải phiếu
        </h3>
        <p className="text-sm text-red-600 mb-6">{message}</p>
        <button
          type="button"
          onClick={onBack}
          className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer"
        >
          ← Quay lại
        </button>
      </div>
    </div>
  );
}

function StatusBanner({ type, message }) {
  const styles = {
    success: { bg: '#064e3b', border: '#059669', color: '#34d399' },
    error:   { bg: '#450a0a', border: '#dc2626', color: '#f87171' },
  };
  const s = styles[type];
  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: '12px',
      padding: '16px 20px',
      color: s.color,
      fontSize: '14px',
      fontWeight: 600,
      marginBottom: '24px',
    }}>{message}</div>
  );
}
