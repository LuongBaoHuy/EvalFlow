import React from 'react';
import { getUser } from '../../utils/auth.utils';

const normalizeCode = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();
};

/**
 * MatrixFormRenderer
 *
 * Props:
 *  matrix           - matrix config { groups, columns, showGrandTotal, showLevelComments, ... }
 *  userRole         - current user's role (string or { role_id, role_name })
 *  value            - current answer object  { [itemId]: { [colId]: score }, _stepComments: { [stepOrder]: {...} } }
 *  onChange         - (newValue) => void
 *  readOnly         - boolean
 *  reviewHistory    - array of past review records from backend
 *  workflowSteps    - array of ALL workflow steps from WorkflowReviewPage
 *                     [{ step_order, step_name, reviewer_role, reviewer_name, status, note, reviewed_at }, ...]
 *  currentStepOrder - step_order of the step the current user is acting on (number or null)
 */
export default function MatrixFormRenderer({
  matrix,
  userRole,
  value,
  onChange,
  readOnly,
  reviewHistory = [],
  workflowSteps = [],
  currentStepOrder = null,
}) {
  const groups = matrix?.groups || [];
  const columns = matrix?.columns || [];
  const currentUser = getUser();

  // ── Score change ──────────────────────────────────────────────────────────
  const handleScoreChange = (itemId, colId, maxScore, newValue, isText = false) => {
    if (readOnly) return;

    let validValue = newValue;
    if (!isText) {
      const numericValue = newValue === '' ? '' : Number(newValue);
      if (numericValue !== '' && (isNaN(numericValue) || numericValue < 0)) return;
      validValue = numericValue;
    }

    const currentAnswers = value || {};
    const itemAnswers = currentAnswers[itemId] || {};

    const updatedValue = {
      ...currentAnswers,
      [itemId]: {
        ...itemAnswers,
        [colId]: validValue,
      },
    };

    if (onChange) onChange(updatedValue);
  };

  // ── Step-comment change ───────────────────────────────────────────────────
  // Comments are keyed by step_order so every workflow level gets its own slot.
  const handleStepCommentChange = (stepOrder, newText) => {
    if (readOnly) return;

    const authorName =
      currentUser?.full_name ||
      currentUser?.name ||
      (typeof userRole === 'string' ? userRole : userRole?.role_name) ||
      'Người đánh giá';
    const authorRole =
      currentUser?.role_name ||
      (typeof userRole === 'string' ? userRole : userRole?.role_name) ||
      '';

    const currentAnswers = value || {};
    const currentStepComments = currentAnswers._stepComments || {};

    const updatedStepComments = {
      ...currentStepComments,
      [stepOrder]: {
        text: newText,
        authorName,
        authorRole,
        updatedAt: new Date().toISOString(),
      },
    };

    const updatedValue = {
      ...currentAnswers,
      _stepComments: updatedStepComments,
    };

    if (onChange) onChange(updatedValue);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const calculateGroupSum = (group, colId) => {
    if (!value || !group.items) return 0;
    return group.items.reduce((sum, item) => {
      const cellValue = value[item.id]?.[colId];
      const numericVal = cellValue === '' || cellValue === undefined ? 0 : Number(cellValue);
      return sum + (isNaN(numericVal) ? 0 : numericVal);
    }, 0);
  };

  const grandTotalMax =
    matrix?.grandTotalMaxScore !== undefined && matrix?.grandTotalMaxScore !== ''
      ? Number(matrix.grandTotalMaxScore)
      : groups.reduce((acc, g) => acc + (Number(g.maxScore) || 0), 0);

  const evalColumns = columns.filter((col) => col.isInputColumn !== false && !col.isMaxScoreColumn);

  const checkRoleMatch = (colRole) => {
    const colRoleStr = colRole ? String(colRole).trim() : '';
    let uId = '';
    let uName = '';
    if (typeof userRole === 'object' && userRole !== null) {
      uId = userRole.role_id ? String(userRole.role_id).trim() : '';
      uName = userRole.role_name ? String(userRole.role_name).trim() : '';
    } else if (userRole !== undefined && userRole !== null) {
      uId = String(userRole).trim();
      uName = String(userRole).trim();
    }
    return (
      !colRoleStr ||
      colRoleStr === uId ||
      colRoleStr === uName ||
      normalizeCode(colRoleStr) === normalizeCode(uName) ||
      colRoleStr === 'ROLE_NEW'
    );
  };

  // ── Build comment slots ───────────────────────────────────────────────────
  // When workflowSteps provided (WorkflowReviewPage context): one slot per step.
  // Fallback to evalColumns (DoSurveyPage / standalone form context).
  const showComments = matrix?.showLevelComments !== false;
  const stepComments = value?._stepComments || {};
  const legacyComments = value?._comments || value?.comments || {};

  const commentSlotsRaw = workflowSteps.length > 0
    ? workflowSteps.map((step) => {
        const histEntry = reviewHistory.find((h) => h.step_order === step.step_order);
        return {
          key: `step_${step.step_order}`,
          order: step.step_order,
          label: step.step_name || `Cấp ${step.step_order}`,
          roleName: step.reviewer_role || '',
          isCurrentStep: step.step_order === currentStepOrder,
          savedComment: stepComments[step.step_order] || null,
          historyNote: histEntry?.note || step.note || '',
          historyReviewerName: histEntry?.reviewer_name || step.reviewer_name || '',
          historyReviewedAt: histEntry?.created_at || step.reviewed_at || null,
          stepStatus: histEntry?.status || step.status,
        };
      })
    : evalColumns.map((col, idx) => ({
        key: `col_${col.id}`,
        order: idx + 1,
        label: col.name,
        roleName: col.role || '',
        isCurrentStep: !readOnly && checkRoleMatch(col.role),
        savedComment: legacyComments[col.id]
          ? typeof legacyComments[col.id] === 'string'
            ? { text: legacyComments[col.id], authorName: '', authorRole: col.role, updatedAt: null }
            : legacyComments[col.id]
          : null,
        historyNote: '',
        historyReviewerName: '',
        historyReviewedAt: null,
        stepStatus: null,
      }));

  const commentSlots = commentSlotsRaw.filter((slot) => slot.order > 1);

  return (
    <div className="w-full mt-4 space-y-6">
      {/* ── Desktop Table ─────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-700">
              <th className="p-4 font-semibold border-r border-gray-200 w-1/3 min-w-[200px]">Nội dung đánh giá</th>
              {columns.map((col) => (
                <th key={col.id} className={`p-4 font-semibold text-center border-r border-gray-200 ${col.isMaxScoreColumn ? 'w-24 text-amber-700' : ''}`}>
                  {col.name}
                  {col.role && <div className="text-[10px] font-normal text-gray-500 uppercase mt-1">({col.role})</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.id}>
                <tr className="bg-emerald-50 border-b border-gray-200">
                  <td className="p-4 font-bold text-emerald-900 border-r border-gray-200">
                    {group.name}
                  </td>
                  {columns.map((col) => {
                    if (col.isMaxScoreColumn) {
                      return (
                        <td key={`group_col_${col.id}`} className="p-4 font-bold text-amber-700 text-center border-r border-gray-200 bg-amber-50/30">
                          {group.maxScore}
                        </td>
                      );
                    }
                    if (col.isInputColumn === false) {
                      return (
                        <td key={`group_col_${col.id}`} className="p-3 text-sm text-gray-700 bg-emerald-50/50 border-r border-gray-200 align-middle whitespace-pre-line">
                          {group.adminContent?.[col.id] || ''}
                        </td>
                      );
                    }
                    if (col.inputType === 'text') {
                      return <td key={`group_col_${col.id}`} className="bg-emerald-50/50 border-r border-gray-200"></td>;
                    }
                    const rawSum = calculateGroupSum(group, col.id);
                    const isExceed = group.maxScore > 0 && rawSum > group.maxScore;
                    const displaySum = group.maxScore > 0 ? Math.min(rawSum, group.maxScore) : rawSum;
                    return (
                      <td key={`group_col_${col.id}`} className={`border-r border-gray-200 text-center font-bold align-middle ${isExceed ? 'bg-red-50 text-red-600' : 'bg-emerald-50/50 text-blue-700'}`}>
                        {displaySum}
                        {isExceed && <div className="text-[10px] text-red-500 font-medium">Bị giới hạn ở {group.maxScore}</div>}
                      </td>
                    );
                  })}
                </tr>
                {group.items?.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-800 border-r border-gray-200 pl-8">{item.name}</td>
                    {columns.map((col) => {
                      if (col.isMaxScoreColumn) {
                        return (
                          <td key={col.id} className="p-4 text-center text-gray-600 font-medium border-r border-gray-200">
                            {item.maxScore}
                          </td>
                        );
                      }
                      if (col.isInputColumn === false) {
                        return (
                          <td key={col.id} className="p-3 text-sm text-gray-700 border-r border-gray-200 align-middle bg-gray-50/30 whitespace-pre-line">
                            {item.adminContent?.[col.id] || '-'}
                          </td>
                        );
                      }
                      const isRoleMatch = checkRoleMatch(col.role);
                      const isDisabled = readOnly || (!isRoleMatch && col.role);
                      const cellValue = value?.[item.id]?.[col.id] ?? '';
                      const isError = col.inputType !== 'text' && cellValue !== '' && Number(cellValue) > item.maxScore;
                      return (
                        <td key={col.id} className="p-3 text-center border-r border-gray-200 align-middle">
                          {col.inputType === 'text' ? (
                            <textarea
                              disabled={isDisabled}
                              value={cellValue}
                              onChange={(e) => handleScoreChange(item.id, col.id, item.maxScore, e.target.value, true)}
                              placeholder={isDisabled ? '-' : 'Nhận xét...'}
                              rows={1}
                              className={`w-full text-sm px-2 py-1.5 border rounded-lg outline-none transition resize-y ${isDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={item.maxScore}
                              disabled={isDisabled}
                              value={cellValue}
                              onChange={(e) => handleScoreChange(item.id, col.id, item.maxScore, e.target.value, false)}
                              placeholder={isDisabled ? '-' : 'Điểm'}
                              className={`w-20 text-center text-sm px-2 py-1.5 border rounded-lg outline-none transition ${isDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : isError ? 'bg-red-50 border-red-500 text-red-700 focus:ring-2 focus:ring-red-200' : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
                            />
                          )}
                          {isError && <div className="text-[10px] text-red-500 font-medium mt-1">Vượt max!</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          {matrix?.showGrandTotal !== false && (
            <tfoot className="bg-slate-800 text-white font-bold text-base shadow-inner">
              <tr>
                <td className="p-4 border-r border-gray-600 text-right uppercase tracking-wider">Tổng cộng</td>
                {columns.map((col) => {
                  if (col.isMaxScoreColumn) {
                    return (
                      <td key={`grand_${col.id}`} className="p-4 text-center border-r border-gray-600 text-yellow-300 text-lg">
                        {grandTotalMax}
                      </td>
                    );
                  }
                  if (col.isInputColumn === false || col.inputType === 'text') {
                    return <td key={`grand_${col.id}`} className="border-r border-gray-600"></td>;
                  }
                  const sumOfGroupSums = groups.reduce((acc, g) => acc + (g.maxScore > 0 ? Math.min(calculateGroupSum(g, col.id), g.maxScore) : calculateGroupSum(g, col.id)), 0);
                  const grandTotal = grandTotalMax > 0 ? Math.min(sumOfGroupSums, grandTotalMax) : sumOfGroupSums;
                  return (
                    <td key={`grand_${col.id}`} className="p-4 text-center border-r border-gray-600 text-yellow-300 text-lg">
                      {grandTotal}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Mobile Cards ──────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-emerald-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h4 className="font-bold text-emerald-900 text-sm">{group.name}</h4>
              {columns.some((c) => c.isMaxScoreColumn) && (
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-md">Max: {group.maxScore}</span>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {group.items?.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="font-medium text-gray-800 text-sm">{item.name}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {columns.map((col) => {
                      if (col.isMaxScoreColumn) return null;
                      if (col.isInputColumn === false) {
                        return (
                          <div key={col.id} className="bg-gray-50 p-2.5 rounded-lg text-xs text-gray-700">
                            <span className="font-semibold text-gray-500">{col.name}: </span>
                            {item.adminContent?.[col.id] || '-'}
                          </div>
                        );
                      }
                      const isRoleMatch = checkRoleMatch(col.role);
                      const isDisabled = readOnly || (!isRoleMatch && col.role);
                      const cellValue = value?.[item.id]?.[col.id] ?? '';
                      const isError = col.inputType !== 'text' && cellValue !== '' && Number(cellValue) > item.maxScore;
                      return (
                        <div key={col.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="text-xs font-medium text-slate-700">{col.name}</span>
                          <div>
                            {col.inputType === 'text' ? (
                              <textarea
                                disabled={isDisabled}
                                value={cellValue}
                                onChange={(e) => handleScoreChange(item.id, col.id, item.maxScore, e.target.value, true)}
                                className="w-32 text-xs p-1 border rounded bg-white"
                              />
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={item.maxScore}
                                disabled={isDisabled}
                                value={cellValue}
                                onChange={(e) => handleScoreChange(item.id, col.id, item.maxScore, e.target.value, false)}
                                className={`w-16 text-center text-xs p-1 border rounded ${isError ? 'border-red-500 bg-red-50' : 'bg-white'}`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {matrix?.showGrandTotal !== false && (
          <div className="bg-slate-800 text-white border border-gray-700 rounded-xl overflow-hidden shadow-lg mt-6">
            <div className="bg-slate-900 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
              <h4 className="font-bold text-sm tracking-wider uppercase">TỔNG CỘNG</h4>
              {columns.some((c) => c.isMaxScoreColumn) && <span className="text-yellow-300 text-sm font-bold">Max: {grandTotalMax}</span>}
            </div>
            <div className="p-4 space-y-3">
              {columns.map((col) => {
                if (col.isInputColumn === false || col.inputType === 'text' || col.isMaxScoreColumn) return null;
                const sumOfGroupSums = groups.reduce((acc, g) => acc + (g.maxScore > 0 ? Math.min(calculateGroupSum(g, col.id), g.maxScore) : calculateGroupSum(g, col.id)), 0);
                const grandTotal = grandTotalMax > 0 ? Math.min(sumOfGroupSums, grandTotalMax) : sumOfGroupSums;
                return (
                  <div key={`mobile_grand_${col.id}`} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                    <span className="text-sm font-medium text-gray-200">{col.name}</span>
                    <span className="text-xl font-bold text-yellow-300">{grandTotal}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Level Comments Section ────────────────────────────────── */}
      {showComments && commentSlots.length > 0 && (
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {/* Header */}
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💬</span>
              <div>
                <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wide">Ý kiến nhận xét theo từng cấp duyệt</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Mỗi cấp có thể để lại nhận xét riêng. Người duyệt sau có thể xem nhận xét của cấp trước.
                </p>
              </div>
            </div>
          </div>

          {/* Comment cards — one per workflow step (arranged vertically) */}
          <div className="p-6 flex flex-col space-y-4">
            {commentSlots.map((slot) => {
              const saved = slot.savedComment;
              const commentText = saved?.text ?? '';
              const authorName  = saved?.authorName  || slot.historyReviewerName || '';
              const authorRole  = saved?.authorRole  || slot.roleName || '';
              const updatedAt   = saved?.updatedAt   || slot.historyReviewedAt   || null;

              // Fallback to history note for APPROVED steps with no _stepComment yet
              const displayText   = commentText || (slot.stepStatus === 'APPROVED' ? slot.historyNote : '');
              const displayAuthor = authorName  || (slot.stepStatus === 'APPROVED' ? slot.historyReviewerName : '');

              const isCurrentEditable = slot.isCurrentStep && !readOnly;

              // Card styling
              let cardClass = 'rounded-xl border p-4 flex flex-col gap-3 transition-all ';
              if (isCurrentEditable) {
                cardClass += 'bg-blue-50/40 border-blue-300 ring-2 ring-blue-100';
              } else if (displayText) {
                cardClass += 'bg-slate-50 border-slate-200';
              } else if (slot.stepStatus === 'APPROVED') {
                cardClass += 'bg-gray-50 border-gray-200';
              } else {
                cardClass += 'bg-gray-50/40 border-dashed border-gray-200';
              }

              // Step status badge
              let statusBadge = null;
              if (slot.stepStatus === 'APPROVED') {
                statusBadge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✅ Đã duyệt</span>;
              } else if (slot.stepStatus === 'REJECTED') {
                statusBadge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">❌ Từ chối</span>;
              } else if (isCurrentEditable) {
                statusBadge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">✏️ Của bạn</span>;
              } else if (slot.stepStatus === 'PENDING' || slot.stepStatus === null) {
                statusBadge = <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">⏳ Chờ duyệt</span>;
              }

              return (
                <div key={slot.key} className={cardClass}>
                  {/* Card header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {slot.order}
                      </span>
                      <span className="font-bold text-sm text-slate-900 truncate">{slot.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {slot.roleName && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          {slot.roleName}
                        </span>
                      )}
                      {statusBadge}
                    </div>
                  </div>

                  {/* Reviewer info */}
                  {(displayAuthor || updatedAt) && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pb-2 border-b border-slate-200/70">
                      {displayAuthor && (
                        <div className="flex items-center gap-1 font-semibold text-slate-700">
                          <span>👤</span>{displayAuthor}
                          {authorRole && <span className="font-normal text-slate-400">({authorRole})</span>}
                        </div>
                      )}
                      {updatedAt && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <span>🕐</span>{new Date(updatedAt).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Editable textarea for current step */}
                  {isCurrentEditable ? (
                    <div className="space-y-1.5">
                      <textarea
                        rows={3}
                        value={commentText}
                        onChange={(e) => handleStepCommentChange(slot.order, e.target.value)}
                        placeholder={`Nhập ý kiến nhận xét cho cấp "${slot.label}"... (tùy chọn)`}
                        className="w-full text-sm p-3 bg-white border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 transition resize-y text-slate-800 placeholder-slate-400"
                      />
                      <p className="text-[11px] text-blue-600 font-medium">
                        Nhận xét này sẽ hiển thị cho các cấp duyệt tiếp theo.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {displayText ? (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          &ldquo;{displayText}&rdquo;
                        </div>
                      ) : slot.stepStatus === 'PENDING' || slot.stepStatus === null ? (
                        <div className="p-3 bg-slate-100/60 rounded-lg text-xs text-slate-400 italic border border-dashed border-slate-200">
                          Chưa đến lượt — chờ cấp trước duyệt xong.
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-100/60 rounded-lg text-xs text-slate-400 italic border border-dashed border-slate-200">
                          Không có ý kiến nhận xét từ cấp này.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
