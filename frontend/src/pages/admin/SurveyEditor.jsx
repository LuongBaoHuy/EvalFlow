import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import QuestionBuilder from '../../components/QuestionBuilder';
import MatrixWysiwygEditor from '../../components/matrix/MatrixWysiwygEditor';
import CanvasBuilder from '../../components/CanvasBuilder';
import SurveyLivePreview from '../../components/SurveyLivePreview';
import ImageUploader from '../../components/ImageUploader';
import ConflictWarningModal from '../../components/ConflictWarningModal';
import AiGoalsInput from '../../components/AiGoalsInput';
import { ClipboardList, Palette, HelpCircle, FileText, Eye, Columns, RefreshCw, AlertTriangle, Table, Check } from 'lucide-react';
import {
  getSurveyByIdApi,
  createSurveyApi,
  updateSurveyApi,
} from '../../api/surveys.api';
import {
  getSurveyQuestionsApi,
  replaceQuestionsBatchApi,
} from '../../api/questions.api';

const COLOR_PRESETS = [
  { name: 'Xanh Dương', color: '#2563eb' },
  { name: 'Xanh Lá', color: '#059669' },
  { name: 'Tím', color: '#7c3aed' },
  { name: 'Cam', color: '#ea580c' },
  { name: 'Đỏ', color: '#dc2626' },
  { name: 'Xám Đen', color: '#374151' },
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Hiện đại - Chuẩn UI)' },
  { value: 'Roboto', label: 'Roboto (Thanh lịch - Dễ đọc)' },
  { value: 'Merriweather', label: 'Merriweather (Có chân - Cổ điển)' },
];

export default function SurveyEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#dc2626');
  const [aiGoals, setAiGoals] = useState([]);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [surveyType, setSurveyType] = useState('STANDARD'); // 'STANDARD' | 'MATRIX_RUBRIC' | 'CANVAS_TEMPLATE'
  const [questions, setQuestions] = useState([]);
  const [canvasHtml, setCanvasHtml] = useState('');

  // Mode Switch Confirmation Modal State
  const [showModeSwitchModal, setShowModeSwitchModal] = useState(false);
  const [pendingSurveyType, setPendingSurveyType] = useState(null);

  const [version, setVersion] = useState(1);
  const [responsesCount, setResponsesCount] = useState(0);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Layout View Mode: 'edit' (Full width editor) | 'preview' (Full width live preview) | 'split' (Side-by-side)
  const [viewMode, setViewMode] = useState('edit');

  // Auto-Save Draft State (Key: admin_draft_form)
  const DRAFT_KEY = 'admin_draft_form';
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [pendingDraftData, setPendingDraftData] = useState(null);

  // AI Form Generator Draft Auto-fill on mount
  useEffect(() => {
    const aiData =
      location.state?.aiDraft ||
      (() => {
        const raw = localStorage.getItem('ai_draft_form');
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })();

    if (aiData && aiData.title && Array.isArray(aiData.questions)) {
      if (aiData.title) setTitle(aiData.title);
      if (aiData.description) setDescription(aiData.description);
      if (aiData.theme_color) setPrimaryColor(aiData.theme_color);

      const formattedQs = (aiData.questions || []).map((q, idx) => {
        const type = ['text', 'radio', 'dropdown', 'checkbox', 'slider', 'rating', 'file_upload'].includes(q.type)
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
          id: Date.now() + idx,
          tempId: Date.now() + idx,
          question_text: q.question_text || `Câu hỏi ${idx + 1}`,
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
      });

      setQuestions(formattedQs);
      localStorage.removeItem('ai_draft_form');
    }
  }, [location.state]);

  // 1. Check for saved draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && (parsed.title || parsed.description || (parsed.questions && parsed.questions.length > 0))) {
          setPendingDraftData(parsed);
          setDraftPromptOpen(true);
        }
      } catch (err) {
        console.error('Lỗi khi đọc bản nháp', err);
      }
    }
  }, []);

  const handleApplyDraft = () => {
    if (pendingDraftData) {
      if (pendingDraftData.title) setTitle(pendingDraftData.title);
      if (pendingDraftData.description) setDescription(pendingDraftData.description);
      if (pendingDraftData.primaryColor) setPrimaryColor(pendingDraftData.primaryColor);
      if (pendingDraftData.fontFamily) setFontFamily(pendingDraftData.fontFamily);
      if (pendingDraftData.logoUrl) setLogoUrl(pendingDraftData.logoUrl);
      if (pendingDraftData.coverImageUrl) setCoverImageUrl(pendingDraftData.coverImageUrl);
      if (pendingDraftData.surveyType) setSurveyType(pendingDraftData.surveyType);
      if (pendingDraftData.canvasHtml) setCanvasHtml(pendingDraftData.canvasHtml);
      if (Array.isArray(pendingDraftData.questions)) setQuestions(pendingDraftData.questions);
    }
    setDraftPromptOpen(false);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftPromptOpen(false);
    setPendingDraftData(null);
  };

  // 2. Auto-save effect with 1 second debounce
  useEffect(() => {
    if (loading || draftPromptOpen) return;
    if (!title && !description && questions.length === 0) return;

    const timer = setTimeout(() => {
      const draftObj = {
        title,
        description,
        primaryColor,
        fontFamily,
        logoUrl,
        coverImageUrl,
        surveyType,
        canvasHtml,
        questions,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftObj));
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, description, primaryColor, fontFamily, logoUrl, coverImageUrl, surveyType, canvasHtml, questions, loading, draftPromptOpen]);

  useEffect(() => {
    if (isEdit) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const [surveyRes, qRes] = await Promise.all([
            getSurveyByIdApi(id),
            getSurveyQuestionsApi(id),
          ]);

          if (surveyRes.success) {
            setTitle(surveyRes.data.title || '');
            setDescription(surveyRes.data.description || '');
            setPrimaryColor(surveyRes.data.theme_config?.primaryColor || '#2563eb');
            setFontFamily(surveyRes.data.theme_config?.fontFamily || 'Inter');
            setLogoUrl(surveyRes.data.theme_config?.logoUrl || '');
            setCoverImageUrl(surveyRes.data.theme_config?.coverImageUrl || '');
            setSurveyType(surveyRes.data.theme_config?.surveyType || 'STANDARD');
            setCanvasHtml(surveyRes.data.theme_config?.canvasHtml || '');
            if (surveyRes.data.version) setVersion(surveyRes.data.version);
            if (Array.isArray(surveyRes.data.ai_goals)) setAiGoals(surveyRes.data.ai_goals);
            if (surveyRes.data.response_count !== undefined) {
              setResponsesCount(parseInt(surveyRes.data.response_count, 10) || 0);
            }
          }

          if (qRes.success && Array.isArray(qRes.data)) {
            setQuestions(qRes.data);
          }
        } catch (err) {
          setError(err.response?.data?.message || 'Lỗi khi tải dữ liệu Form khảo sát');
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [id, isEdit]);

  // Mode Switching Logic with Data-loss Warning Confirmation
  const handleRequestModeSwitch = (targetType) => {
    if (targetType === surveyType) return;
    const hasData = (questions && questions.length > 0) || (canvasHtml && canvasHtml.trim() !== '' && canvasHtml !== '<p></p>');
    if (hasData) {
      setPendingSurveyType(targetType);
      setShowModeSwitchModal(true);
    } else {
      setSurveyType(targetType);
      setQuestions([]);
    }
  };

  const handleConfirmModeSwitch = () => {
    if (pendingSurveyType) {
      setSurveyType(pendingSurveyType);
      setQuestions([]);
      setCanvasHtml('');
    }
    setShowModeSwitchModal(false);
    setPendingSurveyType(null);
  };

  const handleCancelModeSwitch = () => {
    setShowModeSwitchModal(false);
    setPendingSurveyType(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập Tên Form khảo sát');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const theme_config = {
        primaryColor,
        fontFamily,
        logoUrl,
        coverImageUrl,
        surveyType,
        canvasHtml,
        updatedAt: new Date().toISOString(),
      };

      let surveyId = id;
      if (isEdit) {
        await updateSurveyApi(id, {
          title: title.trim(),
          description: description.trim(),
          theme_config,
          version,
          ai_goals: aiGoals,
        });
      } else {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : {};
        const created_by = user.id || 1;

        const res = await createSurveyApi({
          title: title.trim(),
          description: description.trim(),
          theme_config,
          created_by,
          ai_goals: aiGoals,
        });
        surveyId = res.data.id;
      }

      await replaceQuestionsBatchApi(surveyId, questions);
      localStorage.removeItem(DRAFT_KEY);
      navigate('/admin/surveys');
    } catch (err) {
      if (err.response?.status === 409 || err.statusCode === 409) {
        setShowConflictModal(true);
      } else {
        setError(err.response?.data?.message || 'Lưu Form khảo sát thất bại');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3"></div>
        <p className="text-sm">Đang tải dữ liệu Form...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Top Header Bar & View Mode Switcher (Unboxed layout) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 py-2 pb-6 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/surveys')}
              className="text-gray-400 hover:text-gray-900 text-sm font-medium transition-colors cursor-pointer"
            >
              ← Trở về
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isEdit ? 'Chỉnh sửa Form Khảo sát' : 'Tạo Form Khảo sát Mới'}
            </h1>
          </div>
          <p className="text-sm text-gray-500 mb-6 max-w-2xl">
            Thiết kế giao diện, logo, ảnh bìa và xây dựng bộ câu hỏi động linh hoạt.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border-r border-gray-200 shrink-0">
            <button
              onClick={() => handleRequestModeSwitch('STANDARD')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${surveyType === 'STANDARD'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'bg-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Giao diện Chuẩn
            </button>
            <button
              onClick={() => handleRequestModeSwitch('MATRIX_RUBRIC')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${surveyType === 'MATRIX_RUBRIC'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'bg-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Bảng Đánh Giá
            </button>
            <button
              onClick={() => handleRequestModeSwitch('CANVAS_TEMPLATE')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${surveyType === 'CANVAS_TEMPLATE'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'bg-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Canvas Template
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${viewMode === 'edit'
                ? 'bg-gray-100 text-gray-900'
                : 'bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <FileText size={16} className="currentColor" /> Toàn màn hình
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${viewMode === 'preview'
                ? 'bg-gray-100 text-gray-900'
                : 'bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Eye size={16} className="currentColor" /> Xem trước
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${viewMode === 'split'
                ? 'bg-gray-100 text-gray-900'
                : 'bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Columns size={16} className="currentColor" /> Song song
            </button>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/admin/surveys')}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 bg-transparent rounded-md transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-6 py-2 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Đang lưu...' : 'Lưu Form Khảo sát'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm font-medium">
          ✕ {error}
        </div>
      )}

      {/* VIEW MODE 1: FULL WIDTH EDIT MODE */}
      {viewMode === 'edit' && (
        <div className="w-full space-y-8">
          {/* Section 1: Thông tin cơ bản (Borderless) */}
          <div className="space-y-6 pb-8 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-medium text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                <ClipboardList size={24} className="text-gray-900" /> Thông tin chung Form khảo sát
              </h2>
              <p className="text-sm text-gray-500 mt-1">Đặt tiêu đề và mô tả giải thích mục đích của khảo sát.</p>
            </div>

            <div className="space-y-6 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tên Form khảo sát <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Khảo sát ý kiến sinh viên về chất lượng giảng dạy..."
                  className="w-full text-lg border-b border-gray-300 rounded-none py-2 outline-none focus:border-gray-900 bg-transparent text-gray-900 placeholder:text-gray-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả Form khảo sát</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả chi tiết mục đích, lời cảm ơn hoặc hướng dẫn sinh viên nộp bài..."
                  className="w-full text-base border-b border-gray-300 rounded-none py-2 outline-none focus:border-gray-900 bg-transparent text-gray-900 placeholder:text-gray-400 transition-colors resize-y"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Cấu hình Giao diện & Nhận diện thương hiệu (Borderless) */}
          <div className="space-y-6 pb-8 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-medium text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                <Palette size={24} className="text-gray-900" /> Cài đặt Giao diện & Thương hiệu
              </h2>
              <p className="text-sm text-gray-500 mt-1">Tùy chỉnh màu sắc chủ đạo, phông chữ hiển thị, logo và banner ảnh bìa.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-2">
              {/* Left Column: Color & Font */}
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Màu chủ đạo (Theme Color)</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() => setPrimaryColor(preset.color)}
                          className={`w-8 h-8 rounded-full transition-all ${primaryColor === preset.color
                            ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                            : 'hover:scale-110'
                            }`}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer shrink-0 border-0 p-0 bg-transparent"
                      />
                      <span className="text-sm font-mono font-medium uppercase text-gray-600">{primaryColor}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phông chữ (Font Family)</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full text-base border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-900 bg-transparent cursor-pointer transition-colors"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Column: Upload Images */}
              <div className="space-y-4 md:border-l md:border-gray-100 md:pl-8">
                <ImageUploader
                  label="Logo Form"
                  placeholder="Tải logo (.png)"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  compact={true}
                />

                <ImageUploader
                  label="Ảnh bìa (Cover Banner)"
                  placeholder="Tải banner (.jpg)"
                  value={coverImageUrl}
                  onChange={setCoverImageUrl}
                  compact={true}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Mục tiêu đánh giá AI */}
          <AiGoalsInput aiGoals={aiGoals} setAiGoals={setAiGoals} />

          {/* Section 4: Bộ câu hỏi khảo sát (Borderless) */}
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-medium text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                  <HelpCircle size={24} className="text-gray-900" /> {surveyType === 'MATRIX_RUBRIC' ? 'Xây dựng Bảng Đánh Giá' : surveyType === 'CANVAS_TEMPLATE' ? 'Thiết kế Biểu mẫu Hành chính' : 'Danh sách Câu hỏi Khảo sát'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {surveyType === 'MATRIX_RUBRIC'
                    ? 'Nhấp trực tiếp vào bảng để sửa tên, cột, mục tiêu và điểm tối đa.'
                    : surveyType === 'CANVAS_TEMPLATE'
                    ? 'Sử dụng khung soạn thảo để kẻ bảng, gộp ô và tự do chèn các ô nhập liệu vào văn bản.'
                    : 'Xây dựng nội dung câu hỏi, lựa chọn đáp án và gắn ảnh minh họa.'}
                </p>
              </div>
            </div>

            {surveyType === 'MATRIX_RUBRIC' ? (
              <MatrixWysiwygEditor
                questions={questions}
                onChange={setQuestions}
                isLocked={false}
              />
            ) : surveyType === 'CANVAS_TEMPLATE' ? (
              <CanvasBuilder
                canvasHtml={canvasHtml}
                setCanvasHtml={setCanvasHtml}
              />
            ) : (
              <QuestionBuilder
                questions={questions}
                setQuestions={setQuestions}
                onPreview={() => setViewMode('preview')}
                isEditMode={isEdit}
                responsesCount={responsesCount}
                isTemplateEntity={true}
                aiGoals={aiGoals}
              />
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: FULL WIDTH PREVIEW MODE */}
      {viewMode === 'preview' && (
        <div className="space-y-4">
          <SurveyLivePreview
            title={title}
            description={description}
            primaryColor={primaryColor}
            fontFamily={fontFamily}
            logoUrl={logoUrl}
            coverImageUrl={coverImageUrl}
            surveyType={surveyType}
            canvasHtml={canvasHtml}
            questions={questions}
            onClose={() => setViewMode('edit')}
          />
        </div>
      )}

      {/* VIEW MODE 3: SIDE-BY-SIDE SPLIT MODE */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pt-6">
          {/* Left Column: Full Configuration Inputs (Title, Description, Font, Color, Logo, Cover) */}
          <div className="lg:col-span-6 space-y-12">
            <div className="space-y-6">
              <h3 className="text-sm font-medium uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
                1. Thông tin chung
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tên Form khảo sát <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tên Form..."
                    className="w-full text-base border-b border-gray-300 rounded-none py-2 outline-none focus:border-gray-900 bg-transparent text-gray-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả Form</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Nhập mô tả..."
                    className="w-full text-base border-b border-gray-300 rounded-none py-2 outline-none focus:border-gray-900 bg-transparent text-gray-900 transition-colors resize-y"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-medium uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
                2. Giao diện & Hình ảnh
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phông chữ (Font)</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full text-sm border-b border-gray-300 py-2 outline-none focus:border-gray-900 bg-transparent text-gray-900 cursor-pointer transition-colors"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Màu chủ đạo</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                    />
                    <span className="text-sm font-mono font-medium uppercase text-gray-600">{primaryColor}</span>
                  </div>
                </div>
              </div>

              {/* Upload Logo & Cover Image directly inside Split View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                <ImageUploader
                  label="Tải lên Logo Form"
                  placeholder="Tải logo (.png)"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  compact={true}
                />

                <ImageUploader
                  label="Tải lên Ảnh bìa (Cover Banner)"
                  placeholder="Tải ảnh bìa (.jpg)"
                  value={coverImageUrl}
                  onChange={setCoverImageUrl}
                  compact={true}
                />
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-medium uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
                3. Mục tiêu AI & Câu hỏi
              </h3>

              <AiGoalsInput aiGoals={aiGoals} setAiGoals={setAiGoals} />

              <div className="pt-4">
                {surveyType === 'MATRIX_RUBRIC' ? (
                  <MatrixWysiwygEditor
                    questions={questions}
                    onChange={setQuestions}
                    isLocked={false}
                  />
                ) : surveyType === 'CANVAS_TEMPLATE' ? (
                  <CanvasBuilder
                    canvasHtml={canvasHtml}
                    setCanvasHtml={setCanvasHtml}
                  />
                ) : (
                  <QuestionBuilder
                    questions={questions}
                    setQuestions={setQuestions}
                    onPreview={() => setViewMode('preview')}
                    isEditMode={isEdit}
                    responsesCount={responsesCount}
                    isTemplateEntity={true}
                    aiGoals={aiGoals}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Live Preview Window updating in real-time */}
          <div className="lg:col-span-6 sticky top-20">
            <SurveyLivePreview
              title={title}
              description={description}
              primaryColor={primaryColor}
              fontFamily={fontFamily}
              logoUrl={logoUrl}
              coverImageUrl={coverImageUrl}
              surveyType={surveyType}
              canvasHtml={canvasHtml}
              questions={questions}
              onClose={() => setViewMode('edit')}
            />
          </div>
        </div>
      )}

      {/* Draft Restore Confirmation Modal */}
      {draftPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <FileText size={28} className="currentColor" />
              <h3 className="text-base font-bold text-gray-800">
                Tìm thấy bản nháp chưa lưu
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Hệ thống phát hiện một bản nháp Form Khảo sát chưa được lưu từ lần thao tác trước (thời gian:{' '}
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
                className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <Check size={14} className="currentColor" /> Khôi phục bản nháp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 409 Conflict Warning Modal */}
      <ConflictWarningModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        draftContent={`Tên form: ${title}\nMô tả: ${description}\nSố câu hỏi: ${questions.length}`}
      />

      {/* Mode Switch Warning Confirmation Modal */}
      {showModeSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle size={24} className="currentColor" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Xác nhận đổi Chế độ Form
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Lưu ý về dữ liệu câu hỏi / bảng tiêu chí khi chuyển đổi
                </p>
              </div>
            </div>

            {/* Mode Visual Transition Badge */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Chế độ hiện tại</span>
                <span className="font-bold text-gray-700 mt-0.5 flex items-center gap-1">
                  {surveyType === 'MATRIX_RUBRIC' ? (
                    <><Table size={14} className="currentColor" /> Form Ma Trận</>
                  ) : (
                    <><FileText size={14} className="currentColor" /> Form Thường</>
                  )}
                </span>
              </div>
              <div className="text-gray-400 font-extrabold text-sm">➔</div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Chuyển sang</span>
                <span className="font-bold text-amber-700 mt-0.5 flex items-center justify-end gap-1">
                  {pendingSurveyType === 'MATRIX_RUBRIC' ? (
                    <><Table size={14} className="currentColor" /> Form Ma Trận</>
                  ) : (
                    <><FileText size={14} className="currentColor" /> Form Thường</>
                  )}
                </span>
              </div>
            </div>

            {/* Warning Message Content */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 space-y-2.5">
              <p className="text-xs text-amber-950 font-bold leading-relaxed">
                {pendingSurveyType === 'MATRIX_RUBRIC'
                  ? 'Khi chuyển sang "Form Ma Trận (MATRIX)", các câu hỏi hiện tại sẽ bị xóa để khởi tạo Bảng Ma Trận Đánh Giá (Rubric).'
                  : 'Khi chuyển sang "Form Thường (STANDARD)", toàn bộ bảng tiêu chí và cột điểm Ma Trận đã cấu hình sẽ bị xóa.'}
              </p>
              <div className="text-[11px] text-amber-800 space-y-1 bg-white/60 p-2.5 rounded-lg border border-amber-200/50">
                <p className="flex items-start gap-1.5">
                  <span className="text-red-500 font-bold">•</span>
                  <span>Dữ liệu câu hỏi / ma trận trước đó <b>sẽ bị mất và không thể hoàn tác</b>.</span>
                </p>
                <p className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>Tên Form, Mô tả, Màu sắc, Logo, Ảnh bìa <b>vẫn được giữ nguyên</b>.</span>
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCancelModeSwitch}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ (Giữ nguyên)
              </button>
              <button
                type="button"
                onClick={handleConfirmModeSwitch}
                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle size={14} className="currentColor" /> Tôi hiểu & Chuyển đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
