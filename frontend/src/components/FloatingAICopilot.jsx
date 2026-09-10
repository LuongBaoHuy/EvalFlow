import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateFormApi } from '../api/ai.api';

const PROMPT_SUGGESTIONS = [
  { icon: '🌟', text: 'Tạo form đánh giá sự kiện' },
  { icon: '🍽️', text: 'Tạo khảo sát nhà ăn' },
  { icon: '🎓', text: 'Tạo form thu thập thông tin tân sinh viên' },
  { icon: '💬', text: 'Tạo khảo sát ý kiến giảng dạy môn Tiếng Anh' },
];

export default function FloatingAICopilot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Xin chào! Tôi là Trợ lý AI Form Copilot 🤖✨\n\nHãy nhập yêu cầu của bạn (hoặc chọn gợi ý bên dưới), tôi sẽ tự động thiết kế hoàn chỉnh mảng câu hỏi và chuyển bạn sang màn hình chỉnh sửa!',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendPrompt = async (e, customPrompt) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }

    const promptToSend = (typeof customPrompt === 'string' ? customPrompt : inputPrompt).trim();
    if (!promptToSend || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: promptToSend };
    setMessages((prev) => [...prev, userMsg]);
    if (typeof customPrompt !== 'string') setInputPrompt('');
    setLoading(true);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await generateFormApi({ prompt: promptToSend });

      if (res.success && res.data) {
        const formData = res.data;
        const qCount = formData.questions?.length || 0;

        const aiMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `🎉 Đã tạo thành công Form "${formData.title}" với ${qCount} câu hỏi!\n\nĐang tự động chuyển sang màn hình chỉnh sửa...`,
        };
        setMessages((prev) => [...prev, aiMsg]);

        // Save AI Draft to localStorage & Navigate to Form Builder
        localStorage.setItem('ai_draft_form', JSON.stringify(formData));

        setTimeout(() => {
          setIsOpen(false);
          navigate('/admin/surveys/create', { state: { aiDraft: formData } });
        }, 1200);
      } else {
        const errorMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: '❌ Khởi tạo Form bằng AI thất bại. Vui lòng thử lại với mô tả rõ ràng hơn.',
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: `✕ Lỗi khi sinh Form từ AI: ${err.response?.data?.message || err.message}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window Container */}
      {isOpen && (
        <div className="mb-4 w-[92vw] sm:w-[400px] h-[520px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden animate-fadeIn backdrop-blur-xs">
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg animate-pulse">
                🤖
              </div>
              <div>
                <h3 className="font-extrabold text-sm leading-tight flex items-center gap-1.5">
                  AI Form Copilot
                  <span className="bg-emerald-400/30 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300/30">
                    Online
                  </span>
                </h3>
                <p className="text-[11px] text-blue-100 font-medium">Tạo Form tự động bằng câu lệnh</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              title="Đóng Chatbot"
            >
              ✕
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
                    🤖
                  </div>
                )}

                <div
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white font-medium rounded-tr-xs shadow-sm'
                      : 'bg-white text-gray-800 border border-gray-200/80 rounded-tl-xs shadow-xs font-normal'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start items-center">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0 animate-spin">
                  ✨
                </div>
                <div className="bg-white p-3 rounded-2xl border border-gray-200 text-xs text-gray-500 font-semibold flex items-center gap-2 shadow-xs">
                  <span className="inline-block animate-bounce">⚡</span>
                  <span>AI đang thiết kế 100% cấu trúc Form...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions Bar */}
          <div className="p-2.5 bg-white border-t border-gray-100 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
              💡 Gợi ý lệnh nhanh:
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {PROMPT_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => handleSendPrompt(e, item.text)}
                  disabled={loading}
                  className="shrink-0 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] px-2.5 py-1 rounded-xl border border-blue-200 transition flex items-center gap-1 disabled:opacity-50"
                >
                  <span>{item.icon}</span>
                  <span className="truncate max-w-[180px]">{item.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Box Bar */}
          <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSendPrompt(e);
                }
              }}
              placeholder="Nhập yêu cầu tạo form (VD: Tạo khảo sát...)"
              disabled={loading}
              className="flex-1 bg-gray-100 border border-gray-300 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none transition disabled:opacity-50"
            />
            <button
              type="button"
              onClick={(e) => handleSendPrompt(e)}
              disabled={!inputPrompt.trim() || loading}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
            >
              Gửi ✨
            </button>
          </div>
        </div>
      )}

      {/* Floating Bubble Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative bg-amber-500 hover:bg-amber-600 text-white p-3.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2.5 border-2 border-white"
        title="Mở AI Form Generator Copilot"
      >
        <span className="text-2xl animate-bounce">🤖</span>
        <span className="hidden sm:inline font-bold text-xs tracking-wide pr-1">
          {isOpen ? 'Đóng AI Copilot' : 'Tạo Form bằng AI ✨'}
        </span>
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-400 border border-white"></span>
        </span>
      </button>
    </div>
  );
}
