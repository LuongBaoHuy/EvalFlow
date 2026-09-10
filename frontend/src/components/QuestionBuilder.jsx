import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import ImageUploader from './ImageUploader';
import QuestionCopilotSidebar from './QuestionCopilotSidebar';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const QUESTION_TYPES = [
  { value: 'short_answer', label: 'Trả lời ngắn', icon: '📄' },
  { value: 'paragraph', label: 'Đoạn văn (Paragraph)', icon: '📋' },
  { value: 'text', label: 'Tự luận cũ (Text)', icon: '📝' },
  { value: 'radio', label: 'Trắc nghiệm (1 chọn)', icon: '🔘' },
  { value: 'checkbox', label: 'Hộp kiểm (Nhiều chọn)', icon: '☑️' },
  { value: 'dropdown', label: 'Danh sách thả xuống (Dropdown)', icon: '🔽' },
  { value: 'multiple_choice_grid', label: 'Lưới trắc nghiệm', icon: '🗂️' },
  { value: 'checkbox_grid', label: 'Lưới hộp kiểm', icon: '🗃️' },
  { value: 'slider', label: 'Thanh trượt (Slider)', icon: '🎚️' },
  { value: 'rating', label: 'Thang điểm / Đánh giá sao', icon: '⭐' },
  { value: 'date', label: 'Ngày (Date)', icon: '📅' },
  { value: 'time', label: 'Giờ (Time)', icon: '🕒' },
  { value: 'datetime', label: 'Ngày & Giờ', icon: '🗓️' },
  { value: 'file_upload', label: 'Tải lên tệp (File Upload)', icon: '📁' },
];

// ── Drag Handle Icon (6 dots) ──────────────────────────────────
function DragHandle({ listeners, attributes }) {
  return (
    <div
      {...listeners}
      {...attributes}
      className="flex items-center justify-center w-6 h-8 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
      title="Kéo để sắp xếp lại"
      onClick={(e) => e.stopPropagation()}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
      </svg>
    </div>
  );
}

// ── SortableQuestionWrapper: provides DnD sortable + drag handle ──
function SortableQuestionWrapper({ id, isActive, onActivate, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onActivate}
      className={`relative bg-white rounded-xl transition-all duration-150 cursor-pointer ${isActive
          ? 'border border-slate-200 border-l-[4px] border-l-blue-600 shadow-md'
          : 'border border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
    >
      {/* Drag handle bar at top of card */}
      <div className="flex justify-center py-1 border-b border-slate-100/80">
        <DragHandle listeners={listeners} attributes={attributes} />
      </div>
      {children}
    </div>
  );
}

// ── SortableSectionCard: Section Header block ─────────────────────
function SortableSectionCard({ id, q, idx, isActive, isLocked, onActivate, onTitleChange, onDescChange, onRemove, totalCount }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onActivate}
      className={`relative rounded-xl overflow-hidden transition-all duration-150 cursor-pointer ${isActive
          ? 'border-t-4 border-blue-600 border border-slate-200 shadow-md bg-white'
          : 'border-t-4 border-blue-400 border border-slate-200 bg-slate-50/70 hover:shadow-sm'
        }`}
    >
      {/* Drag handle */}
      <div className="flex justify-center py-1 border-b border-slate-100">
        <DragHandle listeners={listeners} attributes={attributes} />
      </div>

      <div className="px-5 py-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">
            📌 Ph\u1ea7n {idx + 1}
          </span>
        </div>

        {isActive ? (
          <>
            <input
              type="text"
              value={q.section_title || ''}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Ti\u00eau \u0111\u1ec1 ph\u1ea7n..."
              className="w-full text-xl font-bold text-slate-800 border-b-2 border-blue-300 focus:border-blue-600 outline-none bg-transparent pb-1 placeholder:text-slate-300 transition-colors"
              disabled={isLocked}
            />
            <textarea
              value={q.section_description || ''}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder="M\u00f4 t\u1ea3 ph\u1ea7n (t\u00f9y ch\u1ecdn)..."
              rows={2}
              className="w-full text-sm text-slate-600 border-b border-slate-200 focus:border-blue-400 outline-none bg-transparent resize-none placeholder:text-slate-300 transition-colors mt-1"
              disabled={isLocked}
            />
          </>
        ) : (
          <>
            <p className={`text-xl font-bold ${q.section_title ? 'text-slate-800' : 'text-slate-300'}`}>
              {q.section_title || 'Ti\u00eau \u0111\u1ec1 ph\u1ea7n (ch\u01b0a \u0111\u1eb7t t\u00ean)'}
            </p>
            {q.section_description && (
              <p className="text-sm text-slate-500">{q.section_description}</p>
            )}
          </>
        )}
      </div>

      {/* Footer — delete button, only when active */}
      {isActive && !isLocked && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex justify-end px-5 py-2 border-t border-slate-100"
        >
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            X\u00f3a ph\u1ea7n n\u00e0y
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuestionBuilder({ questions, setQuestions, onPreview, disabled = false, hasResponses = false, responseCount = 0, isEditMode = false, responsesCount = 0, isTemplateEntity = false, aiGoals = [] }) {
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const totalResponses = responsesCount || responseCount || (hasResponses ? 1 : 0);
  const isLocked = Boolean(!isTemplateEntity && isEditMode && (totalResponses > 0 || disabled));

  // ── DnD sensors: distance=8px prevents drag trigger on normal clicks ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setQuestions((prev) => {
      const oldIndex = prev.findIndex((q) => String(q.id || q.tempId) === String(active.id));
      const newIndex = prev.findIndex((q) => String(q.id || q.tempId) === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((q, i) => ({ ...q, order_index: i + 1 }));
    });
  };

  const handleAddSection = () => {
    if (isLocked) return;
    const newSection = {
      tempId: Date.now(),
      type: 'section_header',
      section_title: '',
      section_description: '',
      is_required: false,
    };
    setQuestions((prev) => {
      const activeIdx = prev.findIndex(q => (q.id || q.tempId) === activeQuestionId);
      if (activeIdx !== -1) {
        const newList = [...prev];
        newList.splice(activeIdx + 1, 0, newSection);
        return newList;
      }
      return [...prev, newSection];
    });
    setActiveQuestionId(newSection.tempId);
  };

  const formatCopilotQuestion = (q, fallbackIndex = 0) => {
    const type = ['text', 'short_answer', 'paragraph', 'radio', 'dropdown', 'checkbox', 'multiple_choice_grid', 'checkbox_grid', 'slider', 'rating', 'date', 'time', 'datetime', 'file_upload'].includes(q.type)
      ? q.type
      : 'radio';

    let choicesList = [];
    if (Array.isArray(q.options)) {
      choicesList = q.options.map((opt) => (typeof opt === 'string' ? opt : opt.label || 'Lựa chọn'));
    } else if (q.options && Array.isArray(q.options.choices)) {
      choicesList = q.options.choices;
    } else if (typeof q.options === 'string') {
      try {
        const parsed = JSON.parse(q.options);
        if (Array.isArray(parsed)) {
          choicesList = parsed.map((opt) => (typeof opt === 'string' ? opt : opt.label || 'Lựa chọn'));
        } else if (parsed && Array.isArray(parsed.choices)) {
          choicesList = parsed.choices;
        }
      } catch { }
    }

    if (choicesList.length === 0 && type !== 'text') {
      choicesList = ['Lựa chọn 1', 'Lựa chọn 2', 'Lựa chọn 3'];
    }

    return {
      tempId: Date.now() + fallbackIndex + Math.random(),
      question_text: q.question_text || `Câu hỏi ${fallbackIndex + 1}`,
      type,
      is_required: q.is_required !== undefined ? Boolean(q.is_required) : true,
      options: {
        choices: choicesList,
        allow_other: false,
        max_choices: type === 'radio' ? 1 : 0,
        imageUrl: '',
        enable_file_attachment: false,
      },
    };
  };

  const handleApplyCopilotMutations = (res) => {
    if (!res || isLocked) return;

    setQuestions((prev) => {
      let newList = [...prev];

      if (Array.isArray(res.update_questions) && res.update_questions.length > 0) {
        res.update_questions.forEach((item) => {
          if (typeof item.index === 'number' && newList[item.index]) {
            const formatted = formatCopilotQuestion(item.question, item.index);
            newList[item.index] = {
              ...newList[item.index],
              question_text: formatted.question_text,
              type: formatted.type,
              is_required: formatted.is_required,
              options: {
                ...newList[item.index].options,
                choices: formatted.options.choices,
              },
            };
          }
        });
      }

      if (Array.isArray(res.delete_indices) && res.delete_indices.length > 0) {
        const sortedIndices = [...res.delete_indices]
          .filter((idx) => typeof idx === 'number' && idx >= 0 && idx < newList.length)
          .sort((a, b) => b - a);

        sortedIndices.forEach((delIdx) => {
          newList.splice(delIdx, 1);
        });
      }

      if (Array.isArray(res.add_questions) && res.add_questions.length > 0) {
        const addedItems = res.add_questions.map((q, idx) =>
          formatCopilotQuestion(q, newList.length + idx)
        );
        newList = [...newList, ...addedItems];
      }

      return newList;
    });
  };

  const handleAddQuestion = () => {
    if (isLocked) return;
    const newQuestion = {
      tempId: Date.now(),
      question_text: '',
      type: 'short_answer',
      is_required: true,
      options: {
        choices: ['Tùy chọn 1', 'Tùy chọn 2'],
        allow_other: false,
        max_choices: 1,
        imageUrl: '',
        file_attachment_types: 'all',
        file_attachment_min: 1,
        file_attachment_max: 5,
      },
    };
    setQuestions((prev) => {
      const activeIdx = prev.findIndex(q => (q.id || q.tempId) === activeQuestionId);
      if (activeIdx !== -1) {
        const newList = [...prev];
        newList.splice(activeIdx + 1, 0, newQuestion);
        return newList;
      }
      return [...prev, newQuestion];
    });
    setActiveQuestionId(newQuestion.tempId);
  };

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    const prevOpt = updated[index].options || {};

    if (field === 'type') {
      if (value === 'radio') {
        updated[index].options = {
          ...prevOpt,
          choices: prevOpt.choices?.length ? prevOpt.choices : ['Lựa chọn 1', 'Lựa chọn 2'],
          allow_other: Boolean(prevOpt.allow_other),
          max_choices: 1,
        };
      } else if (value === 'checkbox') {
        updated[index].options = {
          ...prevOpt,
          choices: prevOpt.choices?.length ? prevOpt.choices : ['Lựa chọn 1', 'Lựa chọn 2'],
          allow_other: Boolean(prevOpt.allow_other),
          max_choices: prevOpt.max_choices > 1 ? prevOpt.max_choices : 0,
        };
      } else if (value === 'dropdown') {
        updated[index].options = {
          ...prevOpt,
          choices: prevOpt.choices?.length ? prevOpt.choices : ['Tùy chọn 1', 'Tùy chọn 2'],
          allow_other: Boolean(prevOpt.allow_other),
        };
      } else if (value === 'slider') {
        updated[index].options = { ...prevOpt, min: 0, max: 10, step: 1 };
      } else if (value === 'rating') {
        updated[index].options = { ...prevOpt, max: 5 };
      } else if (value === 'multiple_choice_grid') {
        const newOpts = {
          ...prevOpt,
          choices: prevOpt.choices?.length ? prevOpt.choices : ['Cột 1', 'Cột 2'],
        };
        if (!Array.isArray(newOpts.rows) || newOpts.rows.length === 0) {
          newOpts.rows = ['Hàng 1', 'Hàng 2'];
        }
        updated[index].options = newOpts;
      } else if (value === 'checkbox_grid') {
        const newOpts = {
          ...prevOpt,
          choices: prevOpt.choices?.length ? prevOpt.choices : ['Cột 1', 'Cột 2'],
        };
        if (!Array.isArray(newOpts.rows) || newOpts.rows.length === 0) {
          newOpts.rows = ['Hàng 1', 'Hàng 2'];
        }
        updated[index].options = newOpts;
      } else if (value === 'date' || value === 'time' || value === 'datetime') {
        updated[index].options = { ...prevOpt };
      } else if (value === 'file_upload') {
        updated[index].options = {
          ...prevOpt,
          allowed_file_types: prevOpt.allowed_file_types || 'all',
          min_files: prevOpt.min_files !== undefined ? prevOpt.min_files : 1,
          max_files: prevOpt.max_files !== undefined ? prevOpt.max_files : 5,
        };
      }
    }

    setQuestions(updated);
  };

  const handleRemoveQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    const reordered = updated.map((q, i) => ({ ...q, order_index: i + 1 }));
    setQuestions(reordered);
    if (activeQuestionId !== null) setActiveQuestionId(null);
  };

  const handleDuplicateQuestion = (index) => {
    if (isLocked) return;
    const q = questions[index];
    const copy = {
      ...q,
      id: undefined,
      tempId: Date.now() + Math.random(),
    };
    const updated = [
      ...questions.slice(0, index + 1),
      copy,
      ...questions.slice(index + 1),
    ].map((item, i) => ({ ...item, order_index: i + 1 }));
    setQuestions(updated);
    setActiveQuestionId(copy.tempId);
  };

  const handleMoveQuestion = (index, direction) => {
    if (
      (direction === -1 && index === 0) ||
      (direction === 1 && index === questions.length - 1)
    ) {
      return;
    }
    const updated = [...questions];
    const targetIdx = index + direction;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    const reordered = updated.map((q, i) => ({ ...q, order_index: i + 1 }));
    setQuestions(reordered);
  };

  const handleAddRow = (qIndex) => {
    const updated = [...questions];
    const q = updated[qIndex];
    const prevOpt = typeof q.options === 'object' && !Array.isArray(q.options) ? q.options : {};
    const rows = Array.isArray(prevOpt.rows) ? prevOpt.rows : [];
    updated[qIndex].options = { ...prevOpt, rows: [...rows, `Hàng ${rows.length + 1}`] };
    setQuestions(updated);
  };

  const handleRowChange = (qIndex, rIndex, text) => {
    const updated = [...questions];
    const q = updated[qIndex];
    const prevOpt = typeof q.options === 'object' && !Array.isArray(q.options) ? q.options : {};
    const rows = Array.isArray(prevOpt.rows) ? [...prevOpt.rows] : [];
    rows[rIndex] = text;
    updated[qIndex].options = { ...prevOpt, rows };
    setQuestions(updated);
  };

  const handleRemoveRow = (qIndex, rIndex) => {
    const updated = [...questions];
    const q = updated[qIndex];
    const prevOpt = typeof q.options === 'object' && !Array.isArray(q.options) ? q.options : {};
    const rows = (Array.isArray(prevOpt.rows) ? prevOpt.rows : []).filter((_, i) => i !== rIndex);
    updated[qIndex].options = { ...prevOpt, rows };
    setQuestions(updated);
  };

  const parseChoices = (opts, type) => {
    if (type === 'text' || type === 'short_answer' || type === 'paragraph' || type === 'date' || type === 'time' || type === 'datetime') return [];
    if (!opts) return ['Lựa chọn 1', 'Lựa chọn 2'];

    if (Array.isArray(opts.choices) && opts.choices.length > 0) {
      return opts.choices;
    }

    if (Array.isArray(opts) && opts.length > 0) {
      return opts.map((item) => (typeof item === 'string' ? item : item.label || 'Lựa chọn'));
    }

    if (typeof opts === 'string' && opts.trim() !== '') {
      try {
        const parsed = JSON.parse(opts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => (typeof item === 'string' ? item : item.label || 'Lựa chọn'));
        }
        if (parsed && Array.isArray(parsed.choices) && parsed.choices.length > 0) {
          return parsed.choices;
        }
      } catch { }
    }

    return ['Lựa chọn 1', 'Lựa chọn 2', 'Lựa chọn 3'];
  };

  const handleAddChoice = (qIndex) => {
    const updated = [...questions];
    const q = updated[qIndex];
    const currentOpts = typeof q.options === 'object' && !Array.isArray(q.options) ? q.options : {};
    const choices = parseChoices(q.options, q.type);
    updated[qIndex].options = {
      ...currentOpts,
      choices: [...choices, `Lựa chọn ${choices.length + 1}`],
    };
    setQuestions(updated);
  };

  const handleChoiceChange = (qIndex, cIndex, text) => {
    const updated = [...questions];
    const q = updated[qIndex];
    const currentOpts = typeof q.options === 'object' && !Array.isArray(q.options) ? q.options : {};
    const choices = [...parseChoices(q.options, q.type)];
    choices[cIndex] = text;
    updated[qIndex].options = { ...currentOpts, choices };
    setQuestions(updated);
  };

  const handleRemoveChoice = (qIndex, cIndex) => {
    const updated = [...questions];
    const q = updated[qIndex];
    const currentOpts = typeof q.options === 'object' && !Array.isArray(q.options) ? q.options : {};
    const choices = parseChoices(q.options, q.type).filter((_, i) => i !== cIndex);
    updated[qIndex].options = { ...currentOpts, choices };
    setQuestions(updated);
  };

  const handleOptionPropChange = (qIndex, propKey, value) => {
    const updated = [...questions];
    updated[qIndex].options = {
      ...updated[qIndex].options,
      [propKey]: value,
    };
    setQuestions(updated);
  };

  const handleDownloadDropdownTemplate = () => {
    const wsData = [
      ['Danh sách Tùy chọn'],
      ['Khoa Công nghệ thông tin'],
      ['Khoa Kinh tế'],
      ['Khoa Ngoại ngữ'],
      ['Khoa Điện - Điện tử'],
      ['Khoa Cơ khí'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Dropdown');
    XLSX.writeFile(wb, 'Mau_Tuy_Chon_Dropdown.xlsx');
  };

  const handleUploadDropdownExcel = (e, qIndex) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const importedChoices = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (Array.isArray(row) && row[0] !== undefined && row[0] !== null) {
            const valStr = String(row[0]).trim();
            if (valStr.length > 0) {
              importedChoices.push(valStr);
            }
          }
        }

        if (importedChoices.length === 0) {
          alert('File Excel không đúng định dạng hoặc không có dữ liệu tùy chọn ở Cột A từ dòng 2.');
          return;
        }

        const updated = [...questions];
        const existingChoices = updated[qIndex].options?.choices || [];
        updated[qIndex].options = {
          ...updated[qIndex].options,
          choices: [...existingChoices, ...importedChoices],
        };
        setQuestions(updated);
        alert(`Đã nhập thành công ${importedChoices.length} tùy chọn từ file Excel!`);
      } catch (err) {
        alert('Đã xảy ra lỗi khi đọc file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleSelectionLimitSelect = (qIndex, val) => {
    const updated = [...questions];
    if (val === '1') {
      updated[qIndex].type = 'radio';
      updated[qIndex].options = { ...updated[qIndex].options, max_choices: 1 };
    } else if (val === '2') {
      updated[qIndex].type = 'checkbox';
      updated[qIndex].options = { ...updated[qIndex].options, max_choices: 2 };
    } else if (val === '3') {
      updated[qIndex].type = 'checkbox';
      updated[qIndex].options = { ...updated[qIndex].options, max_choices: 3 };
    } else if (val === 'unlimited') {
      updated[qIndex].type = 'checkbox';
      updated[qIndex].options = { ...updated[qIndex].options, max_choices: 0 };
    } else if (val === 'custom') {
      updated[qIndex].type = 'checkbox';
      updated[qIndex].options = { ...updated[qIndex].options, max_choices: updated[qIndex].options?.max_choices || 4 };
    }
    setQuestions(updated);
  };

  return (
    <div className="space-y-4">
      {/* Header: tiêu đề + badge đếm câu hỏi */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-700">
          Danh sách câu hỏi
          <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {questions.length}
          </span>
        </h3>

        {/* Preview button still in header */}
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            title="Xem trước Form"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg transition-colors cursor-pointer"
          >
            👁️ Xem trước
          </button>
        )}
      </div>

      {/* ── GOOGLE FORMS LAYOUT: Main content + Floating Toolbar ── */}
      <div className="flex flex-row gap-4 items-start relative">

        {/* ── LEFT: Form Content Column ── */}
        <div className="flex-1 space-y-3 min-w-0">
          {questions.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 sm:p-10 text-center bg-white shadow-xs">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                📝
              </div>
              <p className="text-slate-700 font-semibold mb-1 text-sm">Chưa có câu hỏi nào</p>
              <p className="text-slate-400 text-xs mb-4">Bắt đầu bằng cách thêm câu hỏi thủ công hoặc sử dụng AI để tự động tạo bộ câu hỏi.</p>

              {!isLocked && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    <span>+</span> Thêm câu hỏi
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAiSidebar(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-amber-700 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>✨</span> AI tạo câu hỏi
                  </button>
                </div>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={questions.map((q) => String(q.id || q.tempId))}
                strategy={verticalListSortingStrategy}
              >
                {questions.map((q, idx) => {
                  const qKey = q.id || q.tempId || idx;
                  const sortableId = String(qKey);
                  const isActive = activeQuestionId === qKey;

                  // ── SECTION HEADER CARD ──────────────────────────────
                  if (q.type === 'section_header') {
                    return (
                      <SortableSectionCard
                        key={qKey}
                        id={sortableId}
                        q={q}
                        idx={idx}
                        isActive={isActive}
                        isLocked={isLocked}
                        onActivate={() => setActiveQuestionId(qKey)}
                        onTitleChange={(v) => {
                          const updated = [...questions];
                          updated[idx] = { ...updated[idx], section_title: v };
                          setQuestions(updated);
                        }}
                        onDescChange={(v) => {
                          const updated = [...questions];
                          updated[idx] = { ...updated[idx], section_description: v };
                          setQuestions(updated);
                        }}
                        onRemove={() => handleRemoveQuestion(idx)}
                        totalCount={questions.length}
                      />
                    );
                  }

                  // ── REGULAR QUESTION CARD ────────────────────────────
                  const isChoiceType = q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown';
                  const currentMax = q.options?.max_choices;
                  const currentSelectionPreset =
                    q.type === 'radio'
                      ? '1'
                      : currentMax === 1
                        ? '1'
                        : currentMax === 2
                          ? '2'
                          : currentMax === 3
                            ? '3'
                            : currentMax > 3
                              ? 'custom'
                              : 'unlimited';

                  return (
                    <SortableQuestionWrapper
                      key={qKey}
                      id={sortableId}
                      isActive={isActive}
                      onActivate={() => setActiveQuestionId(qKey)}
                    >
                      {/* ── CARD MAIN CONTENT ── */}
                      <div className="p-5 space-y-4">

                        {/* Question Header Row: số thứ tự + tiêu đề + type dropdown (khi active) */}
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-semibold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                            {idx + 1}
                          </span>

                          {/* Question text input — always visible */}
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              disabled={isLocked}
                              readOnly={isLocked}
                              value={q.question_text || ''}
                              onChange={(e) => handleUpdateQuestion(idx, 'question_text', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Nhập nội dung câu hỏi..."
                              className={`w-full text-sm font-medium border-b outline-none transition-colors bg-transparent placeholder:text-slate-300 pb-1 ${isActive
                                  ? 'border-blue-400 focus:border-blue-600 text-slate-800'
                                  : 'border-transparent text-slate-700 cursor-pointer'
                                } ${isLocked ? 'cursor-not-allowed opacity-75 text-slate-500' : ''}`}
                            />
                          </div>

                          {/* Type dropdown — ONLY visible when ACTIVE */}
                          {isActive && (
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <select
                                disabled={isLocked}
                                value={q.type || 'text'}
                                onChange={(e) => handleUpdateQuestion(idx, 'type', e.target.value)}
                                className={`text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none font-medium text-slate-700 shadow-sm ${isLocked ? 'bg-slate-100 cursor-not-allowed opacity-75' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-400 cursor-pointer'
                                  }`}
                              >
                                {QUESTION_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.icon} {t.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Inactive: show type label as muted badge */}
                          {!isActive && (
                            <span className="shrink-0 text-[11px] text-slate-400 font-medium">
                              {QUESTION_TYPES.find(t => t.value === q.type)?.icon}{' '}
                              {QUESTION_TYPES.find(t => t.value === q.type)?.label}
                            </span>
                          )}
                        </div>

                        {/* ── ACTIVE-ONLY CONTROLS ── */}
                        {isActive && (
                          <div className="space-y-3 pl-9" onClick={(e) => e.stopPropagation()}>

                            {/* ── DATE / TIME / DATETIME disabled preview (Active) ── */}
                            {(q.type === 'date' || q.type === 'time' || q.type === 'datetime') && (
                              <div className="pointer-events-none select-none">
                                {(q.type === 'date' || q.type === 'datetime') && (
                                  <input
                                    type="date"
                                    disabled
                                    placeholder="Ngày / Tháng / Năm"
                                    className="w-48 text-sm border border-dashed border-slate-300 rounded-lg px-3 py-2 text-slate-400 bg-slate-50 cursor-not-allowed"
                                  />
                                )}
                                {q.type === 'datetime' && <span className="mx-2 text-slate-300 text-sm">+</span>}
                                {(q.type === 'time' || q.type === 'datetime') && (
                                  <input
                                    type="time"
                                    disabled
                                    placeholder="Giờ : Phút"
                                    className="w-36 text-sm border border-dashed border-slate-300 rounded-lg px-3 py-2 text-slate-400 bg-slate-50 cursor-not-allowed ml-1"
                                  />
                                )}
                              </div>
                            )}

                            {/* ── GRID EDITOR (Active) ── */}
                            {(q.type === 'multiple_choice_grid' || q.type === 'checkbox_grid') && (
                              <div className="border border-slate-100 rounded-lg p-3.5 space-y-3">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                  {q.type === 'multiple_choice_grid' ? '🗂️ Lưới trắc nghiệm' : '🗃️ Lưới hộp kiểm'} — Chỉnh sửa hàng và cột
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                  {/* LEFT: Rows */}
                                  <div className="space-y-2">
                                    <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">↕️ Hàng</p>
                                    {(Array.isArray(q.options?.rows) ? q.options.rows : ['Hàng 1', 'Hàng 2']).map((row, rIdx) => (
                                      <div key={rIdx} className="flex items-center gap-1.5">
                                        <span className="text-slate-300 text-xs shrink-0 w-4 text-center">{rIdx + 1}.</span>
                                        <input
                                          type="text"
                                          disabled={isLocked}
                                          value={row}
                                          onChange={(e) => handleRowChange(idx, rIdx, e.target.value)}
                                          className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                        />
                                        {!isLocked && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveRow(idx, rIdx)}
                                            className="text-slate-300 hover:text-red-500 transition text-sm leading-none shrink-0"
                                            title="Xóa hàng"
                                          >×</button>
                                        )}
                                      </div>
                                    ))}
                                    {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => handleAddRow(idx)}
                                        className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline transition-colors"
                                      >+ Thêm hàng</button>
                                    )}
                                  </div>

                                  {/* RIGHT: Columns (choices) */}
                                  <div className="space-y-2">
                                    <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">⇔️ Cột</p>
                                    {parseChoices(q.options, 'radio').map((col, cIdx) => (
                                      <div key={cIdx} className="flex items-center gap-1.5">
                                        <span className="text-slate-300 text-xs shrink-0 w-4 text-center">{cIdx + 1}.</span>
                                        <input
                                          type="text"
                                          disabled={isLocked}
                                          value={col}
                                          onChange={(e) => handleChoiceChange(idx, cIdx, e.target.value)}
                                          className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                        />
                                        {!isLocked && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveChoice(idx, cIdx)}
                                            className="text-slate-300 hover:text-red-500 transition text-sm leading-none shrink-0"
                                            title="Xóa cột"
                                          >×</button>
                                        )}
                                      </div>
                                    ))}
                                    {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => handleAddChoice(idx)}
                                        className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline transition-colors"
                                      >+ Thêm cột</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── SHORT ANSWER placeholder (Active) ── */}
                            {q.type === 'short_answer' && (
                              <div className="pointer-events-none select-none py-2">
                                <p className="text-sm text-slate-400 mb-2">Văn bản câu trả lời ngắn</p>
                                <div className="border-b border-dotted border-slate-300 w-1/2" />
                              </div>
                            )}

                            {/* ── PARAGRAPH placeholder (Active) ── */}
                            {q.type === 'paragraph' && (
                              <div className="pointer-events-none select-none py-2 space-y-4">
                                <p className="text-sm text-slate-400">Văn bản trả lời dài</p>
                                <div className="border-b border-dotted border-slate-300 w-full" />
                                <div className="border-b border-dotted border-slate-300 w-3/4" />
                                <div className="border-b border-dotted border-slate-300 w-2/4" />
                              </div>
                            )}

                            {/* Image Illustration Attachment */}
                            <div className={`border border-slate-100 rounded-lg p-3 ${isLocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
                              <ImageUploader
                                label="Đính kèm ảnh minh họa cho câu hỏi (Tùy chọn)"
                                placeholder="Chọn ảnh minh họa cho câu hỏi này (.jpg, .png)"
                                value={q.options?.imageUrl || ''}
                                onChange={(url) => handleOptionPropChange(idx, 'imageUrl', url)}
                                compact={true}
                              />
                            </div>

                            {/* Selection Limit Selector Bar */}
                            {(q.type === 'radio' || q.type === 'checkbox') && (
                              <div className="border border-slate-100 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                  🎯 Số lượng đáp án được chọn:
                                </label>
                                <div className="flex items-center gap-2">
                                  <select
                                    disabled={isLocked}
                                    value={currentSelectionPreset}
                                    onChange={(e) => handleSelectionLimitSelect(idx, e.target.value)}
                                    className={`text-xs font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 outline-none shadow-sm ${isLocked ? 'cursor-not-allowed opacity-75' : 'focus:ring-2 focus:ring-blue-500'}`}
                                  >
                                    <option value="1">Chỉ chọn 1 đáp án</option>
                                    <option value="2">Tối đa 2 đáp án</option>
                                    <option value="3">Tối đa 3 đáp án</option>
                                    <option value="unlimited">Nhiều đáp án (Không giới hạn)</option>
                                    <option value="custom">Tùy chỉnh số lượng khác...</option>
                                  </select>
                                  {currentSelectionPreset === 'custom' && (
                                    <input
                                      type="number"
                                      min={1}
                                      value={q.options?.max_choices || 4}
                                      onChange={(e) =>
                                        handleOptionPropChange(idx, 'max_choices', Math.max(1, Number(e.target.value)))
                                      }
                                      className="w-20 text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-center"
                                    />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Dynamic Options Editor based on type */}
                            {isChoiceType && (
                              <div className="border border-slate-100 rounded-lg p-3.5 space-y-3">
                                {/* Dropdown Excel Import Toolbar */}
                                {q.type === 'dropdown' && (
                                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg mb-1">
                                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                      <span>📊</span>
                                      <span>Nhập tùy chọn từ Excel:</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={handleDownloadDropdownTemplate}
                                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-[11px] px-2.5 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1"
                                      >
                                        <span>📥</span>
                                        <span>Tải file mẫu (.xlsx)</span>
                                      </button>
                                      <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] px-2.5 py-1.5 rounded-lg transition shadow-sm cursor-pointer flex items-center gap-1">
                                        <span>📤</span>
                                        <span>Nhập từ Excel</span>
                                        <input
                                          type="file"
                                          accept=".xlsx, .xls"
                                          onChange={(e) => handleUploadDropdownExcel(e, idx)}
                                          className="hidden"
                                        />
                                      </label>
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                                    Danh sách các phương án lựa chọn ({q.type === 'radio' ? 'Trắc nghiệm 1 chọn' : q.type === 'checkbox' ? 'Hộp kiểm nhiều chọn' : 'Danh sách thả xuống'})
                                  </label>
                                  <div className="space-y-2">
                                    {parseChoices(q.options, q.type).map((choice, cIdx) => (
                                      <div key={cIdx} className="flex items-center gap-2 group">
                                        <span className="text-slate-400 text-xs w-4 text-center shrink-0">
                                          {q.type === 'radio' ? '○' : q.type === 'checkbox' ? '□' : '🔽'}
                                        </span>
                                        <input
                                          type="text"
                                          disabled={isLocked}
                                          readOnly={isLocked}
                                          value={choice}
                                          onChange={(e) => handleChoiceChange(idx, cIdx, e.target.value)}
                                          className={`flex-1 text-xs border-b border-slate-200 outline-none px-0 py-1 bg-transparent transition-colors ${isLocked
                                              ? 'cursor-not-allowed opacity-75 text-slate-500'
                                              : 'focus:border-blue-500 text-slate-700 placeholder:text-slate-300'
                                            }`}
                                          placeholder={`Đáp án ${cIdx + 1}`}
                                        />
                                        {!isLocked && parseChoices(q.options, q.type).length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveChoice(idx, cIdx)}
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs px-1 font-bold transition-opacity"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    ))}

                                    {/* Pinned Read-Only "Khác..." Option */}
                                    {Boolean(q.options?.allow_other) && (
                                      <div className="flex items-center gap-2 py-1 pl-6">
                                        <span className="text-slate-400 text-xs">
                                          {q.type === 'radio' ? '○' : q.type === 'checkbox' ? '□' : '🔽'}
                                        </span>
                                        <span className="flex-1 text-xs font-semibold text-purple-700 border-b border-dashed border-purple-200 pb-0.5">Khác...</span>
                                        <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-md">
                                          Tự do gõ
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {!isLocked && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddChoice(idx)}
                                      className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline transition-colors"
                                    >
                                      + Thêm phương án
                                    </button>
                                  )}
                                </div>

                                {/* Option for custom text "Other..." */}
                                <div className={`pt-2.5 border-t border-slate-100 text-xs ${isLocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
                                  <label className={`flex items-center gap-2 select-none font-medium text-slate-600 ${isLocked ? 'cursor-not-allowed opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                    <input
                                      type="checkbox"
                                      disabled={isLocked}
                                      checked={Boolean(q.options?.allow_other)}
                                      onChange={(e) => handleOptionPropChange(idx, 'allow_other', e.target.checked)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Thêm tùy chọn "Khác..." (Cho phép người dùng gõ văn bản tự do)</span>
                                  </label>
                                </div>
                              </div>
                            )}

                            {/* Slider config */}
                            {q.type === 'slider' && (
                              <div className={`border border-slate-100 rounded-lg p-3 grid grid-cols-3 gap-2 ${isLocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Giá trị nhỏ nhất (Min)</label>
                                  <input
                                    type="number"
                                    disabled={isLocked}
                                    value={q.options?.min ?? 0}
                                    onChange={(e) => handleOptionPropChange(idx, 'min', Number(e.target.value))}
                                    className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Giá trị lớn nhất (Max)</label>
                                  <input
                                    type="number"
                                    disabled={isLocked}
                                    value={q.options?.max ?? 10}
                                    onChange={(e) => handleOptionPropChange(idx, 'max', Number(e.target.value))}
                                    className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bước nhảy (Step)</label>
                                  <input
                                    type="number"
                                    disabled={isLocked}
                                    value={q.options?.step ?? 1}
                                    onChange={(e) => handleOptionPropChange(idx, 'step', Number(e.target.value))}
                                    className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Rating config */}
                            {q.type === 'rating' && (
                              <div className={`border border-slate-100 rounded-lg p-3 ${isLocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
                                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Thang điểm tối đa (Số sao)</label>
                                <select
                                  disabled={isLocked}
                                  value={q.options?.max ?? 5}
                                  onChange={(e) => handleOptionPropChange(idx, 'max', Number(e.target.value))}
                                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-400 text-slate-700"
                                >
                                  <option value={3}>3 sao (Thấp - Trung bình - Cao)</option>
                                  <option value={5}>5 sao (Chuẩn)</option>
                                  <option value={10}>10 sao (Chi tiết)</option>
                                </select>
                              </div>
                            )}

                            {/* File Upload config */}
                            {q.type === 'file_upload' && (
                              <div className={`border border-slate-100 rounded-xl p-3.5 space-y-3 text-xs ${isLocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
                                <div>
                                  <label className="block font-semibold text-slate-600 mb-1">
                                    📁 Chọn loại file cho phép tải lên cho câu hỏi này:
                                  </label>
                                  <select
                                    disabled={isLocked}
                                    value={q.options?.allowed_file_types || 'all'}
                                    onChange={(e) => handleOptionPropChange(idx, 'allowed_file_types', e.target.value)}
                                    className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none"
                                  >
                                    <option value="all">Mọi loại tệp (.txt, .docx, .pdf, .xlsx, .zip, ảnh... max 5MB)</option>
                                    <option value="document">Chỉ chấp nhận Văn bản & Tài liệu (.txt, .doc, .docx, .pdf)</option>
                                    <option value="spreadsheet">Chỉ chấp nhận Bảng tính (.xlsx, .xls, .csv)</option>
                                    <option value="image">Chỉ chấp nhận Hình ảnh (.jpg, .jpeg, .png, .webp)</option>
                                  </select>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Số tệp tối thiểu (Min):</label>
                                    <input
                                      type="number"
                                      disabled={isLocked}
                                      min={0}
                                      max={Number(q.options?.max_files || 10)}
                                      value={q.options?.min_files !== undefined ? q.options.min_files : 1}
                                      onChange={(e) =>
                                        handleOptionPropChange(idx, 'min_files', Math.max(0, parseInt(e.target.value, 10) || 0))
                                      }
                                      className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400 block mt-0.5">(Nhập 0 nếu không bắt buộc nộp tệp)</span>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Số tệp tối đa (Max):</label>
                                    <input
                                      type="number"
                                      disabled={isLocked}
                                      min={Math.max(1, Number(q.options?.min_files || 1))}
                                      max={20}
                                      value={q.options?.max_files !== undefined ? q.options.max_files : 5}
                                      onChange={(e) =>
                                        handleOptionPropChange(idx, 'max_files', Math.max(1, parseInt(e.target.value, 10) || 1))
                                      }
                                      className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400 block mt-0.5">(Giới hạn tối đa số tệp người dùng nộp)</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Universal File Attachment option */}
                            <div className={`border border-slate-100 rounded-xl p-3 space-y-2 text-xs ${isLocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
                              <label className={`flex items-center gap-2 select-none font-medium text-slate-600 ${isLocked ? 'cursor-not-allowed opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  disabled={isLocked}
                                  checked={Boolean(q.options?.enable_file_attachment)}
                                  onChange={(e) => handleOptionPropChange(idx, 'enable_file_attachment', e.target.checked)}
                                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                                />
                                <span>📎 Yêu cầu / Cho phép người dùng đính kèm tệp minh chứng ở câu hỏi này</span>
                              </label>

                              {q.options?.enable_file_attachment && (
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mức độ đính kèm tệp</label>
                                      <select
                                        disabled={isLocked}
                                        value={Boolean(q.options?.file_attachment_required)}
                                        onChange={(e) => handleOptionPropChange(idx, 'file_attachment_required', e.target.value === 'true')}
                                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium outline-none"
                                      >
                                        <option value="false">Tùy chọn (Không bắt buộc đính kèm)</option>
                                        <option value="true">⚠️ BẮT BUỘC phải đính kèm tệp</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Loại tệp đính kèm cho phép</label>
                                      <select
                                        disabled={isLocked}
                                        value={q.options?.file_attachment_types || 'all'}
                                        onChange={(e) => handleOptionPropChange(idx, 'file_attachment_types', e.target.value)}
                                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium outline-none"
                                      >
                                        <option value="all">Mọi loại tệp (.txt, .docx, .pdf, .xlsx, ảnh... max 5MB)</option>
                                        <option value="document">Chỉ Văn bản (.txt, .docx, .pdf)</option>
                                        <option value="spreadsheet">Chỉ Bảng tính (.xlsx, .csv)</option>
                                        <option value="image">Chỉ Hình ảnh (.jpg, .png)</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Số tệp đính kèm tối thiểu (Min):</label>
                                      <input
                                        type="number"
                                        disabled={isLocked}
                                        min={0}
                                        max={Number(q.options?.file_attachment_max || 10)}
                                        value={q.options?.file_attachment_min !== undefined ? q.options.file_attachment_min : 1}
                                        onChange={(e) =>
                                          handleOptionPropChange(idx, 'file_attachment_min', Math.max(0, parseInt(e.target.value, 10) || 0))
                                        }
                                        className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Số tệp đính kèm tối đa (Max):</label>
                                      <input
                                        type="number"
                                        disabled={isLocked}
                                        min={Math.max(1, Number(q.options?.file_attachment_min || 1))}
                                        max={20}
                                        value={q.options?.file_attachment_max !== undefined ? q.options.file_attachment_max : 5}
                                        onChange={(e) =>
                                          handleOptionPropChange(idx, 'file_attachment_max', Math.max(1, parseInt(e.target.value, 10) || 1))
                                        }
                                        className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ── INACTIVE: Read-only answer preview ── */}
                        {!isActive && (
                          <div className="pl-9 space-y-1.5">

                            {/* Date / Time / Datetime inactive preview */}
                            {(q.type === 'date' || q.type === 'time' || q.type === 'datetime') && (
                              <div className="flex items-center gap-2 text-slate-400 text-xs pointer-events-none select-none">
                                {(q.type === 'date' || q.type === 'datetime') && (
                                  <span className="inline-flex items-center gap-1 border border-dashed border-slate-300 rounded px-2 py-1">
                                    📅 Ngày / Tháng / Năm
                                  </span>
                                )}
                                {q.type === 'datetime' && <span className="text-slate-300">+</span>}
                                {(q.type === 'time' || q.type === 'datetime') && (
                                  <span className="inline-flex items-center gap-1 border border-dashed border-slate-300 rounded px-2 py-1">
                                    🕒 Giờ : Phút
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Grid inactive preview — mini table skeleton */}
                            {(q.type === 'multiple_choice_grid' || q.type === 'checkbox_grid') && (() => {
                              const rows = Array.isArray(q.options?.rows) && q.options.rows.length ? q.options.rows.slice(0, 2) : ['Hàng 1', 'Hàng 2'];
                              const cols = parseChoices(q.options, 'radio').slice(0, 3);
                              return (
                                <div className="pointer-events-none select-none overflow-x-auto">
                                  <table className="text-[11px] border-collapse w-full">
                                    <thead>
                                      <tr>
                                        <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left text-slate-400 font-normal w-28"></th>
                                        {cols.map((c, ci) => (
                                          <th key={ci} className="border border-slate-200 bg-slate-50 px-2 py-1 text-slate-500 font-semibold text-center">{c}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map((r, ri) => (
                                        <tr key={ri}>
                                          <td className="border border-slate-200 px-2 py-1 text-slate-500 font-medium">{r}</td>
                                          {cols.map((_, ci) => (
                                            <td key={ci} className="border border-slate-200 px-2 py-1 text-center text-slate-300">
                                              {q.type === 'multiple_choice_grid' ? '○' : '□'}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {(Array.isArray(q.rows) && q.rows.length > 2 || parseChoices(q.options, 'radio').length > 3) && (
                                    <p className="text-[10px] text-slate-400 mt-1">… và nhiều hàng/cột khác</p>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Short Answer — 1 dotted underline, w-1/2 */}
                            {q.type === 'short_answer' && (
                              <div className="pointer-events-none select-none">
                                <p className="text-xs text-slate-400 mb-2">Văn bản câu trả lời ngắn</p>
                                <div className="border-b border-dotted border-slate-300 w-1/2" />
                              </div>
                            )}

                            {/* Paragraph — 3 stacked dotted underlines */}
                            {q.type === 'paragraph' && (
                              <div className="pointer-events-none select-none space-y-3">
                                <p className="text-xs text-slate-400">Văn bản trả lời dài</p>
                                <div className="border-b border-dotted border-slate-300 w-full" />
                                <div className="border-b border-dotted border-slate-300 w-3/4" />
                                <div className="border-b border-dotted border-slate-300 w-2/4" />
                              </div>
                            )}

                            {/* Text (legacy) — single line */}
                            {q.type === 'text' && (
                              <div className="h-px bg-slate-200 w-3/4 rounded" />
                            )}

                            {(q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown') && (
                              <div className="space-y-1.5">
                                {parseChoices(q.options, q.type).slice(0, 3).map((choice, cIdx) => (
                                  <div key={cIdx} className="flex items-center gap-2">
                                    <span className="text-slate-300 text-xs w-4 text-center shrink-0">
                                      {q.type === 'radio' ? '○' : q.type === 'checkbox' ? '□' : '—'}
                                    </span>
                                    <span className="text-xs text-slate-400">{choice}</span>
                                  </div>
                                ))}
                                {parseChoices(q.options, q.type).length > 3 && (
                                  <span className="text-[11px] text-slate-400 pl-6">
                                    +{parseChoices(q.options, q.type).length - 3} lựa chọn khác...
                                  </span>
                                )}
                              </div>
                            )}
                            {q.type === 'slider' && (
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-slate-400">{q.options?.min ?? 0}</span>
                                <div className="flex-1 h-1 bg-slate-200 rounded-full" />
                                <span className="text-[11px] text-slate-400">{q.options?.max ?? 10}</span>
                              </div>
                            )}
                            {q.type === 'rating' && (
                              <div className="flex items-center gap-1">
                                {Array.from({ length: q.options?.max ?? 5 }).map((_, i) => (
                                  <span key={i} className="text-slate-300 text-sm">★</span>
                                ))}
                              </div>
                            )}
                            {q.type === 'file_upload' && (
                              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                                <span>📁</span>
                                <span>Tải lên tệp</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── CARD FOOTER: Action bar — only when ACTIVE ── */}
                      {isActive && !isLocked && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-100"
                        >
                          {/* Move buttons */}
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, -1)}
                            disabled={idx === 0}
                            title="Di chuyển lên"
                            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 transition-colors text-sm"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 1)}
                            disabled={idx === questions.length - 1}
                            title="Di chuyển xuống"
                            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 transition-colors text-sm"
                          >
                            ↓
                          </button>

                          {/* Divider */}
                          <div className="w-px h-5 bg-slate-200 mx-1" />

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicateQuestion(idx)}
                            title="Nhân bản câu hỏi"
                            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx)}
                            title="Xóa câu hỏi"
                            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                            </svg>
                          </button>

                          {/* Divider */}
                          <div className="w-px h-5 bg-slate-200 mx-1" />

                          {/* Required toggle */}
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <span className="text-xs text-slate-600 font-medium">Bắt buộc</span>
                            <span className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${q.is_required !== false ? 'bg-blue-600' : 'bg-slate-300'
                              }`}>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={q.is_required !== false}
                                onChange={(e) => handleUpdateQuestion(idx, 'is_required', e.target.checked)}
                              />
                              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${q.is_required !== false ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </span>
                          </label>
                        </div>
                      )}
                    </SortableQuestionWrapper>
                  );
                })}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {!isLocked && (
          <div className="sticky top-20 flex flex-col gap-2 bg-white shadow-md rounded-xl p-2 border border-slate-200 shrink-0">
            {/* Add Question */}
            <div className="relative group">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                title="Thêm câu hỏi mới"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-800 text-white text-[11px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Thêm câu hỏi
              </span>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 mx-1" />

            {/* Add Section */}
            <div className="relative group">
              <button
                type="button"
                onClick={handleAddSection}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                title="Thêm phần mới (Section)"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="11" y2="18" />
                  <line x1="16" y1="15" x2="16" y2="21" />
                  <line x1="13" y1="18" x2="19" y2="18" />
                </svg>
              </button>
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-800 text-white text-[11px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Thêm phần mới
              </span>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 mx-1" />

            {/* AI Generate */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setShowAiSidebar(true)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-amber-50 hover:text-amber-600 transition-colors cursor-pointer"
                title="AI tạo câu hỏi"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
                </svg>
              </button>
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-800 text-white text-[11px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                AI tạo câu hỏi
              </span>
            </div>
          </div>
        )}
      </div>

      <QuestionCopilotSidebar
        isOpen={showAiSidebar}
        onClose={() => setShowAiSidebar(false)}
        currentQuestions={questions}
        onApplyMutations={handleApplyCopilotMutations}
        aiGoals={aiGoals}
      />
    </div>
  );
}
