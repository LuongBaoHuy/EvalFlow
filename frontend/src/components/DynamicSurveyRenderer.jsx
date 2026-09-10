import React, { useState } from 'react';
import parse from 'html-react-parser';
import ImageUploader from './ImageUploader';
import FileUploader from './FileUploader';
import MatrixFormRenderer from './matrix/MatrixFormRenderer';

export default function DynamicSurveyRenderer({
  surveyTitle,
  surveyDescription,
  themeConfig = {},
  questions = [],
  answers = {},
  onAnswerChange,
  canvasAnswers = {},
  setCanvasAnswers,
  isSubmitting = false,
  onSubmit,
  readOnly = false,
  onCloseReview,
  userRole,
  reviewHistory = [],
  workflowSteps = [],
  isWorkflowEnabled = false,
  isModal = false,
}) {
  const primaryColor = themeConfig.primaryColor || '#2563eb';
  const fontFamily = themeConfig.fontFamily || 'Inter';
  const logoUrl = themeConfig.logoUrl || '';
  const coverImageUrl = themeConfig.coverImageUrl || '';

  // Font family CSS class map
  const fontFamilyStyle =
    fontFamily === 'Merriweather'
      ? { fontFamily: "'Merriweather', Georgia, serif" }
      : fontFamily === 'Roboto'
        ? { fontFamily: "'Roboto', sans-serif" }
        : { fontFamily: "'Inter', sans-serif" };

  // State to hold transient "Other..." text input values per question
  const [otherTexts, setOtherTexts] = useState({});

  const handleOtherTextChange = (questionId, text, isRadio, currentAns) => {
    setOtherTexts((prev) => ({ ...prev, [questionId]: text }));
    const formatted = text.trim() ? `Khác: ${text.trim()}` : 'Khác';

    if (isRadio) {
      onAnswerChange(questionId, formatted);
    } else {
      const currentList = Array.isArray(currentAns) ? currentAns : [];
      const nonOtherList = currentList.filter((item) => !item.startsWith('Khác'));
      onAnswerChange(questionId, [...nonOtherList, formatted]);
    }
  };

  const renderCanvasTemplate = () => {
    const rawHtml = themeConfig?.canvasHtml || '';
    if (!rawHtml || rawHtml === '<p></p>') return <p className="text-gray-400 italic text-center">Biểu mẫu hành chính đang trống.</p>;

    const options = {
      replace: (domNode) => {
        if (domNode.attribs && domNode.attribs.class && domNode.attribs.class.includes('fillable-input')) {
          const inputId = domNode.attribs['data-id'];
          const inputType = domNode.attribs['data-type'] || 'text';
          const inputWidth = domNode.attribs['data-width'] || '150px';
          let answerVal = '';
          if (readOnly) {
             answerVal = answers[inputId] || canvasAnswers?.[inputId] || '';
          } else {
             answerVal = canvasAnswers?.[inputId] || '';
          }
          
          return (
            <input
              type={inputType === 'number' ? 'number' : inputType === 'date' ? 'date' : 'text'}
              value={answerVal}
              onChange={(e) => {
                if (!readOnly && setCanvasAnswers) {
                  setCanvasAnswers({ ...canvasAnswers, [inputId]: e.target.value });
                }
              }}
              readOnly={readOnly}
              disabled={isSubmitting}
              style={{ width: inputWidth, maxWidth: '100%' }}
              className={`bg-transparent border-b border-dashed border-slate-600 outline-none px-2 inline-block text-slate-800 transition-colors focus:border-slate-800 focus:border-solid`}
              placeholder="..."
            />
          );
        }
      },
    };

    return parse(rawHtml, options);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" style={fontFamilyStyle}>
      {readOnly && !isModal && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👁️</span>
            <div>
              <h4 className="font-extrabold text-sm">Chế độ xem lại bài khảo sát</h4>
              <p className="text-xs text-amber-700 font-medium">Dưới đây là các đáp án bạn đã chọn và gửi cho hệ thống (Chế độ chỉ xem - Read Only).</p>
            </div>
          </div>
          {onCloseReview && (
            <button
              type="button"
              onClick={onCloseReview}
              className="px-4 py-2 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl shadow-sm transition shrink-0 flex items-center gap-1"
            >
              <span>◄</span>
              <span>Quay lại</span>
            </button>
          )}
        </div>
      )}

      {/* Cover Image Banner (only if uploaded by Admin) */}
      {!isModal && coverImageUrl && coverImageUrl.trim() !== '' && (
        <div className="w-full h-44 rounded-2xl overflow-hidden shadow-md border border-gray-200 bg-gray-100">
          <img
            src={coverImageUrl}
            alt="Survey Cover"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Dynamic Header Card */}
      {!isModal && (
        <div
          className="p-8 rounded-2xl text-white shadow-lg relative overflow-hidden transition-all"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColorBrightness(primaryColor, -25)} 100%)`,
          }}
        >
        <div className="relative z-10 flex items-start gap-4">
          {/* Logo (if available) */}
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className="w-16 h-16 rounded-xl object-contain bg-white/90 p-1.5 shadow-md shrink-0"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}

          <div>
            <div className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm mb-3">
              📋 Khảo sát Động
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">
              {surveyTitle || 'Khảo sát chất lượng'}
            </h1>
            {surveyDescription && (
              <p className="text-sm opacity-90 leading-relaxed max-w-2xl">{surveyDescription}</p>
            )}
          </div>
        </div>

        {/* Decorative circle background */}
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-xl pointer-events-none" />
      </div>
      )}

      {/* Questions Form */}
      <form onSubmit={onSubmit} className="space-y-5">
        {themeConfig?.surveyType === 'CANVAS_TEMPLATE' ? (
          <div className="bg-white shadow-xl max-w-[1000px] mx-auto p-12 min-h-[1056px] text-justify leading-relaxed text-[16px] text-slate-900 border border-gray-200">
            <style>{`
              .canvas-renderer-container table {
                border-collapse: collapse;
                table-layout: fixed;
                width: 100%;
                margin: 1em 0;
                overflow: hidden;
              }
              .canvas-renderer-container table td,
              .canvas-renderer-container table th {
                min-width: 1em;
                border: 1px solid #000;
                padding: 8px;
                vertical-align: top;
                box-sizing: border-box;
                position: relative;
              }
              .canvas-renderer-container table th {
                font-weight: bold;
                text-align: center;
              }
              .canvas-renderer-container p {
                margin-top: 0.5em;
                margin-bottom: 0.5em;
              }
            `}</style>
            <div className="canvas-renderer-container prose max-w-none prose-table:border-collapse">
              {renderCanvasTemplate()}
            </div>
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-500">
            Khảo sát này chưa có câu hỏi nào.
          </div>
        ) : (
          questions.map((q, idx) => {
            let opts = q.options || {};
            if (typeof opts === 'string') {
              try {
                opts = JSON.parse(opts);
              } catch (e) {
                opts = {};
              }
            }
            const answerVal = answers[q.id];
            const attachedFileVal = answers[`${q.id}_file`];
            const maxChoices = Number(opts?.max_choices) || 0;
            const allowOther = Boolean(opts?.allow_other);
            const questionImageUrl = opts?.imageUrl || '';

            const isMatrixRubricMode = themeConfig?.surveyType === 'MATRIX_RUBRIC';

            if (isMatrixRubricMode && q.type === 'matrix') {
              return (
                <div key={q.id || idx} className="w-full">
                  <MatrixFormRenderer
                    matrix={opts?.matrix}
                    userRole={userRole}
                    value={answerVal}
                    onChange={(newVal) => onAnswerChange(q.id, newVal)}
                    readOnly={readOnly}
                    reviewHistory={reviewHistory}
                    workflowSteps={workflowSteps}
                    isWorkflowEnabled={isWorkflowEnabled}
                  />
                </div>
              );
            }

            // ── SECTION HEADER: visual divider, not a question ──
            if (q.type === 'section_header') {
              return (
                <div
                  key={q.id || q.tempId || idx}
                  className="border-t-4 border-blue-500 bg-white rounded-2xl px-6 py-5 shadow-sm"
                >
                  {q.section_title && (
                    <h2 className="text-xl font-bold text-gray-800 mb-1">{q.section_title}</h2>
                  )}
                  {q.section_description && (
                    <p className="text-sm text-gray-500">{q.section_description}</p>
                  )}
                  {!q.section_title && !q.section_description && (
                    <p className="text-sm text-gray-400 italic">— Phần mới —</p>
                  )}
                </div>
              );
            }

            return (
              <div
                key={q.id || idx}
                className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition space-y-4"
                style={{ borderLeft: `5px solid ${primaryColor}` }}
              >
                {/* Question Label */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-gray-800 leading-snug">
                        {q.question_text}
                        {q.is_required && <span className="text-red-500 ml-1">*</span>}
                      </h3>
                      {q.type === 'checkbox' && maxChoices > 0 && (
                        <p className="text-xs text-blue-600 font-medium mt-0.5">
                          (Được chọn tối đa {maxChoices} đáp án)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Question Illustration Image (if attached) */}
                {questionImageUrl && (
                  <div className="my-2 rounded-xl overflow-hidden border border-gray-200 max-h-72 max-w-md bg-gray-50">
                    <img
                      src={questionImageUrl}
                      alt="Illustration"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Question Input Types */}
                <div className="pt-1">
                  {/* MATRIX FORM */}
                  {q.type === 'matrix' && (
                    <MatrixFormRenderer
                      matrix={opts?.matrix}
                      userRole={userRole}
                      value={answerVal}
                      onChange={(newVal) => onAnswerChange(q.id, newVal)}
                      readOnly={readOnly}
                      reviewHistory={reviewHistory}
                      workflowSteps={workflowSteps}
                      isWorkflowEnabled={isWorkflowEnabled}
                    />
                  )}

                  {/* TEXT AREA (legacy 'text' type) */}
                  {q.type === 'text' && (
                    <textarea
                      rows={3}
                      value={answerVal || ''}
                      onChange={(e) => onAnswerChange(q.id, e.target.value)}
                      placeholder="Nhập câu trả lời của bạn..."
                      className="w-full text-sm border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition"
                      style={{ focusRingColor: primaryColor }}
                      disabled={readOnly}
                    />
                  )}

                  {/* SHORT ANSWER */}
                  {q.type === 'short_answer' && (
                    <input
                      type="text"
                      value={answerVal || ''}
                      onChange={(e) => onAnswerChange(q.id, e.target.value)}
                      placeholder="Nhập câu trả lời ngắn..."
                      className="w-full text-sm border-0 border-b border-gray-300 px-0 py-2 focus:outline-none focus:border-blue-500 transition bg-transparent"
                      style={{ borderBottomColor: answerVal ? primaryColor : undefined }}
                      disabled={readOnly}
                    />
                  )}

                  {/* PARAGRAPH */}
                  {q.type === 'paragraph' && (
                    <textarea
                      rows={4}
                      value={answerVal || ''}
                      onChange={(e) => onAnswerChange(q.id, e.target.value)}
                      placeholder="Nhập câu trả lời dài của bạn..."
                      className="w-full text-sm border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition resize-none"
                      style={{ focusRingColor: primaryColor }}
                      disabled={readOnly}
                    />
                  )}

                  {/* DROPDOWN (Select) */}
                  {q.type === 'dropdown' && (() => {
                    const choices = opts?.choices || [];
                    const isOtherObj = typeof answerVal === 'object' && answerVal !== null && answerVal.value === 'other_custom';
                    const isOtherStr = typeof answerVal === 'string' && (answerVal === 'other_custom' || (answerVal.trim() !== '' && !choices.includes(answerVal)));
                    const isOtherActive = isOtherObj || (allowOther && isOtherStr);

                    const selectVal = isOtherActive
                      ? 'other_custom'
                      : typeof answerVal === 'object' && answerVal !== null
                        ? answerVal.value || ''
                        : answerVal || '';

                    const customInputVal = isOtherObj
                      ? answerVal.text || ''
                      : otherTexts[q.id] ?? (isOtherStr && answerVal !== 'other_custom' ? answerVal : '');

                    return (
                      <div className="space-y-3">
                        <div className="relative">
                          <select
                            value={selectVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'other_custom') {
                                const currentText = otherTexts[q.id] || '';
                                onAnswerChange(q.id, { value: 'other_custom', text: currentText });
                              } else {
                                onAnswerChange(q.id, val);
                              }
                            }}
                            disabled={readOnly}
                            className="w-full text-sm border border-gray-300 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 appearance-none cursor-pointer transition pr-10 shadow-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                            style={{ focusRingColor: primaryColor }}
                          >
                            <option value="">-- Vui lòng chọn --</option>
                            {choices.map((choice, cIdx) => (
                              <option key={cIdx} value={choice}>
                                {choice}
                              </option>
                            ))}
                            {allowOther && (
                              <option value="other_custom">Khác...</option>
                            )}
                          </select>
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                            ▼
                          </div>
                        </div>

                        {/* Slide-down Dynamic Text Input when "Khác..." is selected */}
                        {(isOtherActive || selectVal === 'other_custom') && (
                          <div className="pt-1 transition-all duration-300 ease-in-out">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Chi tiết cho tùy chọn Khác: <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={customInputVal}
                              onChange={(e) => {
                                const text = e.target.value;
                                setOtherTexts((prev) => ({ ...prev, [q.id]: text }));
                                onAnswerChange(q.id, { value: 'other_custom', text });
                              }}
                              disabled={readOnly}
                              placeholder="Vui lòng nhập câu trả lời của bạn..."
                              className="w-full text-sm border border-blue-300 rounded-xl px-4 py-2.5 bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner disabled:bg-gray-100"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* RADIO (Single Choice) */}
                  {q.type === 'radio' && (
                    <div className="space-y-2.5">
                      {(q.options?.choices || []).map((choice, cIdx) => {
                        const isChecked = answerVal === choice;
                        return (
                          <label
                            key={cIdx}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${isChecked
                              ? 'bg-blue-50/50 border-blue-300 font-medium'
                              : 'border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            <input
                              type="radio"
                              name={`question_${q.id}`}
                              checked={isChecked}
                              onChange={() => onAnswerChange(q.id, choice)}
                              className="w-4 h-4"
                              style={{ accentColor: primaryColor }}
                            />
                            <span className="text-sm text-gray-700">{choice}</span>
                          </label>
                        );
                      })}

                      {/* Option "Other..." for Radio */}
                      {allowOther && (
                        <div
                          className={`p-3 rounded-xl border transition ${typeof answerVal === 'string' && answerVal.startsWith('Khác')
                            ? 'bg-blue-50/50 border-blue-300 font-medium'
                            : 'border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer select-none mb-2">
                            <input
                              type="radio"
                              name={`question_${q.id}`}
                              checked={typeof answerVal === 'string' && answerVal.startsWith('Khác')}
                              onChange={() => {
                                const currentText = otherTexts[q.id] || '';
                                onAnswerChange(q.id, currentText.trim() ? `Khác: ${currentText.trim()}` : 'Khác');
                              }}
                              className="w-4 h-4"
                              style={{ accentColor: primaryColor }}
                            />
                            <span className="text-sm text-gray-700 font-medium">Khác:</span>
                          </label>

                          {typeof answerVal === 'string' && answerVal.startsWith('Khác') && (
                            <input
                              type="text"
                              value={otherTexts[q.id] ?? (answerVal.startsWith('Khác: ') ? answerVal.replace('Khác: ', '') : '')}
                              onChange={(e) => handleOtherTextChange(q.id, e.target.value, true, answerVal)}
                              placeholder="Nhập câu trả lời khác của bạn..."
                              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CHECKBOX (Multiple Choice) */}
                  {q.type === 'checkbox' && (
                    <div className="space-y-2.5">
                      {(q.options?.choices || []).map((choice, cIdx) => {
                        const currentList = Array.isArray(answerVal) ? answerVal : [];
                        const isChecked = currentList.includes(choice);

                        const handleCheckboxToggle = () => {
                          if (isChecked) {
                            onAnswerChange(
                              q.id,
                              currentList.filter((item) => item !== choice)
                            );
                          } else {
                            if (maxChoices > 0 && currentList.length >= maxChoices) {
                              alert(`Bạn chỉ được chọn tối đa ${maxChoices} đáp án cho câu hỏi này.`);
                              return;
                            }
                            onAnswerChange(q.id, [...currentList, choice]);
                          }
                        };

                        return (
                          <label
                            key={cIdx}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${isChecked
                              ? 'bg-blue-50/50 border-blue-300 font-medium'
                              : 'border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={handleCheckboxToggle}
                              className="w-4 h-4 rounded"
                              style={{ accentColor: primaryColor }}
                            />
                            <span className="text-sm text-gray-700">{choice}</span>
                          </label>
                        );
                      })}

                      {/* Option "Other..." for Checkbox */}
                      {allowOther && (
                        <div
                          className={`p-3 rounded-xl border transition ${Array.isArray(answerVal) && answerVal.some((item) => item.startsWith('Khác'))
                            ? 'bg-blue-50/50 border-blue-300 font-medium'
                            : 'border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                          {(() => {
                            const currentList = Array.isArray(answerVal) ? answerVal : [];
                            const isOtherChecked = currentList.some((item) => item.startsWith('Khác'));

                            const handleOtherCheckboxToggle = () => {
                              if (isOtherChecked) {
                                onAnswerChange(
                                  q.id,
                                  currentList.filter((item) => !item.startsWith('Khác'))
                                );
                              } else {
                                if (maxChoices > 0 && currentList.length >= maxChoices) {
                                  alert(`Bạn chỉ được chọn tối đa ${maxChoices} đáp án cho câu hỏi này.`);
                                  return;
                                }
                                const currentText = otherTexts[q.id] || '';
                                const formatted = currentText.trim() ? `Khác: ${currentText.trim()}` : 'Khác';
                                onAnswerChange(q.id, [...currentList, formatted]);
                              }
                            };

                            return (
                              <>
                                <label className="flex items-center gap-3 cursor-pointer select-none mb-2">
                                  <input
                                    type="checkbox"
                                    checked={isOtherChecked}
                                    onChange={handleOtherCheckboxToggle}
                                    className="w-4 h-4 rounded"
                                    style={{ accentColor: primaryColor }}
                                  />
                                  <span className="text-sm text-gray-700 font-medium">Khác:</span>
                                </label>

                                {isOtherChecked && (
                                  <input
                                    type="text"
                                    value={
                                      otherTexts[q.id] ??
                                      (currentList.find((item) => item.startsWith('Khác: '))?.replace('Khác: ', '') || '')
                                    }
                                    onChange={(e) => handleOtherTextChange(q.id, e.target.value, false, answerVal)}
                                    placeholder="Nhập câu trả lời khác của bạn..."
                                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SLIDER */}
                  {q.type === 'slider' && (
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                        <span>Min: {q.options?.min ?? 0}</span>
                        <span
                          className="text-base font-bold text-gray-800 px-3 py-1 bg-white rounded-lg border shadow-sm"
                          style={{ color: primaryColor }}
                        >
                          {answerVal ?? q.options?.min ?? 0}
                        </span>
                        <span>Max: {q.options?.max ?? 10}</span>
                      </div>
                      <input
                        type="range"
                        min={q.options?.min ?? 0}
                        max={q.options?.max ?? 10}
                        step={q.options?.step ?? 1}
                        value={answerVal ?? q.options?.min ?? 0}
                        onChange={(e) => onAnswerChange(q.id, Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
                        style={{ accentColor: primaryColor }}
                      />
                    </div>
                  )}

                  {/* RATING STARS */}
                  {q.type === 'rating' && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: q.options?.max || 5 }).map((_, sIdx) => {
                          const starValue = sIdx + 1;
                          const isFilled = (answerVal || 0) >= starValue;

                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => onAnswerChange(q.id, starValue)}
                              className="text-2xl transition hover:scale-125 focus:outline-none"
                            >
                              {isFilled ? '⭐' : '☆'}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        {answerVal ? `${answerVal} / ${q.options?.max || 5} sao` : 'Chưa đánh giá'}
                      </span>
                    </div>
                  )}

                  {/* FILE UPLOAD (Document / Image proof upload by Student) */}
                  {q.type === 'file_upload' && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                      <FileUploader
                        label="Tải lên tệp / minh chứng"
                        placeholder="Nhấn để chọn tệp minh chứng của bạn (max 5MB)"
                        allowedCategory={q.options?.allowed_file_types || 'all'}
                        minFiles={q.options?.min_files !== undefined ? q.options.min_files : (q.is_required ? 1 : 0)}
                        maxFiles={q.options?.max_files !== undefined ? q.options.max_files : 5}
                        value={answerVal || ''}
                        disabled={readOnly}
                        onChange={(urls) => onAnswerChange(q.id, urls)}
                      />
                    </div>
                  )}

                  {/* DATE */}
                  {q.type === 'date' && (
                    <input
                      type="date"
                      value={answerVal || ''}
                      onChange={(e) => onAnswerChange(q.id, e.target.value)}
                      className="text-sm border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition bg-white disabled:bg-gray-50"
                      style={{ accentColor: primaryColor }}
                      disabled={readOnly}
                    />
                  )}

                  {/* TIME */}
                  {q.type === 'time' && (
                    <input
                      type="time"
                      value={answerVal || ''}
                      onChange={(e) => onAnswerChange(q.id, e.target.value)}
                      className="text-sm border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition bg-white disabled:bg-gray-50"
                      style={{ accentColor: primaryColor }}
                      disabled={readOnly}
                    />
                  )}

                  {/* DATETIME */}
                  {q.type === 'datetime' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="date"
                        value={(answerVal || '').split('T')[0] || ''}
                        onChange={(e) => {
                          const timePart = (answerVal || '').split('T')[1] || '';
                          onAnswerChange(q.id, `${e.target.value}T${timePart}`);
                        }}
                        className="text-sm border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition bg-white disabled:bg-gray-50"
                        disabled={readOnly}
                      />
                      <span className="text-gray-400 text-sm font-medium">lúc</span>
                      <input
                        type="time"
                        value={(answerVal || '').split('T')[1] || ''}
                        onChange={(e) => {
                          const datePart = (answerVal || '').split('T')[0] || '';
                          onAnswerChange(q.id, `${datePart}T${e.target.value}`);
                        }}
                        className="text-sm border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition bg-white disabled:bg-gray-50"
                        disabled={readOnly}
                      />
                    </div>
                  )}

                  {/* MULTIPLE CHOICE GRID */}
                  {q.type === 'multiple_choice_grid' && (() => {
                    const rows = Array.isArray(q.options?.rows) && q.options.rows.length ? q.options.rows : ['Hàng 1'];
                    const cols = Array.isArray(q.options?.choices) && q.options.choices.length ? q.options.choices : ['Cột 1'];
                    const gridVal = (typeof answerVal === 'object' && answerVal !== null) ? answerVal : {};
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-gray-500 font-normal min-w-[120px]"></th>
                              {cols.map((col, ci) => (
                                <th key={ci} className="border border-gray-200 bg-gray-50 px-3 py-2 text-center text-gray-700 font-semibold text-sm">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, ri) => (
                              <tr key={ri} className="hover:bg-blue-50/30 transition">
                                <td className="border border-gray-200 px-3 py-2.5 text-gray-700 font-medium">{row}</td>
                                {cols.map((col, ci) => (
                                  <td key={ci} className="border border-gray-200 px-3 py-2.5 text-center">
                                    <input
                                      type="radio"
                                      name={`grid_${q.id}_row_${ri}`}
                                      checked={gridVal[row] === col}
                                      onChange={() => {
                                        const updated = { ...gridVal, [row]: col };
                                        onAnswerChange(q.id, updated);
                                      }}
                                      disabled={readOnly}
                                      className="w-4 h-4 cursor-pointer"
                                      style={{ accentColor: primaryColor }}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* CHECKBOX GRID */}
                  {q.type === 'checkbox_grid' && (() => {
                    const rows = Array.isArray(q.options?.rows) && q.options.rows.length ? q.options.rows : ['Hàng 1'];
                    const cols = Array.isArray(q.options?.choices) && q.options.choices.length ? q.options.choices : ['Cột 1'];
                    const gridVal = (typeof answerVal === 'object' && answerVal !== null) ? answerVal : {};
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-gray-500 font-normal min-w-[120px]"></th>
                              {cols.map((col, ci) => (
                                <th key={ci} className="border border-gray-200 bg-gray-50 px-3 py-2 text-center text-gray-700 font-semibold text-sm">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, ri) => (
                              <tr key={ri} className="hover:bg-blue-50/30 transition">
                                <td className="border border-gray-200 px-3 py-2.5 text-gray-700 font-medium">{row}</td>
                                {cols.map((col, ci) => {
                                  const rowChecked = Array.isArray(gridVal[row]) ? gridVal[row] : [];
                                  const isChecked = rowChecked.includes(col);
                                  return (
                                    <td key={ci} className="border border-gray-200 px-3 py-2.5 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          const next = isChecked
                                            ? rowChecked.filter((v) => v !== col)
                                            : [...rowChecked, col];
                                          onAnswerChange(q.id, { ...gridVal, [row]: next });
                                        }}
                                        disabled={readOnly}
                                        className="w-4 h-4 rounded cursor-pointer"
                                        style={{ accentColor: primaryColor }}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* UNIVERSAL FILE ATTACHMENT FOR ANY QUESTION TYPE */}
                {q.options?.enable_file_attachment && (
                  <div className="mt-3 pt-3 border-t border-amber-200/80 bg-amber-50/50 p-3 rounded-xl space-y-2">
                    <FileUploader
                      label={`📎 Tệp đính kèm minh chứng ${q.options?.file_attachment_required || (q.options?.file_attachment_min > 0)
                        ? '* (BẮT BUỘC ĐÍNH KÈM FILE MỚI ĐƯỢC NỘP)'
                        : '(Tùy chọn đính kèm file)'
                        }`}
                      placeholder="Chọn tệp đính kèm cho câu hỏi này (max 5MB)..."
                      allowedCategory={q.options?.file_attachment_types || 'all'}
                      minFiles={
                        q.options?.file_attachment_min !== undefined
                          ? q.options.file_attachment_min
                          : (q.options?.file_attachment_required ? 1 : 0)
                      }
                      maxFiles={q.options?.file_attachment_max !== undefined ? q.options.file_attachment_max : 5}
                      value={attachedFileVal || ''}
                      disabled={readOnly}
                      onChange={(urls) => onAnswerChange(`${q.id}_file`, urls)}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Submit / Back Button */}
        {!isModal && (
          <div className="pt-4 flex justify-end">
            {readOnly ? (
              <button
                type="button"
                onClick={onCloseReview}
                className="w-full sm:w-auto px-8 py-3.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md transition"
              >
                ◄ Quay lại màn hình hoàn thành
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || (themeConfig?.surveyType !== 'CANVAS_TEMPLATE' && questions.length === 0)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 text-base"
                style={{ backgroundColor: primaryColor }}
              >
                {isSubmitting ? 'Đang gửi nộp bài...' : '✓ Nộp bài khảo sát'}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

// Utility helper to adjust color hex brightness
function adjustColorBrightness(hex, percent) {
  let num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;
  let amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let G = ((num >> 8) & 0x00ff) + amt;
  let B = (num & 0x0000ff) + amt;
  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}
