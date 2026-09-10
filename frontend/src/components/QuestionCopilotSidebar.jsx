import React, { useState, useRef, useEffect } from 'react';
import { copilotChatApi } from '../api/ai.api';

const COPILOT_PROMPT_SUGGESTIONS = [
  { icon: '🔍', text: 'Kiểm tra lỗi chính tả & văn phong form này' },
  { icon: '💡', text: 'Gợi ý cải thiện bộ câu hỏi hiện tại' },
  { icon: '⚡', text: 'Tạo thêm 3 câu hỏi trắc nghiệm wifi & cơ sở vật chất' },
  { icon: '📝', text: 'Tạo thêm 2 câu hỏi tự luận góp ý' },
];

export default function QuestionCopilotSidebar({
  isOpen,
  onClose,
  currentQuestions = [],
  onApplyMutations,
  onAppendQuestions,
  isLocked = false,
  aiGoals = [],
}) {
  const [inputMsg, setInputMsg] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Xin chào! Tôi là Trợ lý AI Copilot thiết kế Form khảo sát. 🤖✨\n\nTôi có thể giúp bạn:\n• Thảo luận cấu trúc & tư vấn nội dung\n• Sửa lỗi chính tả & điều chỉnh câu hỏi cũ\n• Xóa bỏ các câu hỏi dư thừa\n• Sinh thêm các câu hỏi mới chèn vào form!',
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
  }, [chatHistory, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (e, customPrompt) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }

    const messageToSend = (typeof customPrompt === 'string' ? customPrompt : inputMsg).trim();
    if (!messageToSend || loading) return;

    const userMsgObj = {
      id: Date.now().toString(),
      role: 'user',
      text: messageToSend,
    };

    setChatHistory((prev) => [...prev, userMsgObj]);
    if (typeof customPrompt !== 'string') setInputMsg('');
    setLoading(true);
    setTimeout(scrollToBottom, 50);

    try {
      // Prepare history array for backend API (user & model roles)
      const historyPayload = chatHistory
        .filter((item) => item.id !== 'welcome')
        .map((item) => ({
          role: item.role === 'user' ? 'user' : 'model',
          content: item.text,
        }));

      // Bổ sung ngữ cảnh: Map original_index vào từng câu hỏi
      const currentQuestionsPayload = (currentQuestions || []).map((q, index) => ({
        original_index: index,
        type: q.type || 'radio',
        question_text: q.question_text || '',
        is_required: Boolean(q.is_required),
        options: q.options,
      }));

      const res = await copilotChatApi({
        message: messageToSend,
        history: historyPayload,
        current_questions: currentQuestionsPayload,
        ai_goals: aiGoals,
      });

      if (res.success && res.data) {
        const { chat_message, add_questions, update_questions, delete_indices } = res.data;

        const addCount = Array.isArray(add_questions) ? add_questions.length : 0;
        const updateCount = Array.isArray(update_questions) ? update_questions.length : 0;
        const deleteCount = Array.isArray(delete_indices) ? delete_indices.length : 0;

        const aiMsgObj = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: chat_message || 'Tôi đã tiếp nhận yêu cầu của bạn.',
          addCount,
          updateCount,
          deleteCount,
        };

        setChatHistory((prev) => [...prev, aiMsgObj]);

        // Apply CRUD mutations to parent component
        if (typeof onApplyMutations === 'function') {
          onApplyMutations({
            add_questions: add_questions || [],
            update_questions: update_questions || [],
            delete_indices: delete_indices || [],
          });
        } else if (addCount > 0 && typeof onAppendQuestions === 'function') {
          onAppendQuestions(add_questions);
        }
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: '❌ Rất tiếc, AI Copilot chưa thể xử lý tin nhắn này. Vui lòng thử lại!',
          },
        ]);
      }
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `✕ Lỗi kết nối AI Copilot: ${err.response?.data?.message || err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 pointer-events-none flex max-w-full pl-4 sm:pl-10 animate-fadeIn">
      {/* Floating Non-Modal Drawer Box */}
      <div className="w-screen max-w-md bg-white shadow-2xl border-l border-purple-200 flex flex-col pointer-events-auto h-full">
          {/* Drawer Header */}
          <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-xl shadow-xs animate-pulse">
                🤖
              </div>
              <div>
                <h3 className="font-extrabold text-sm leading-tight flex items-center gap-2">
                  AI Form Copilot
                  <span className="bg-emerald-400/30 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300/30">
                    Multi-turn Active
                  </span>
                </h3>
                <p className="text-[11px] text-purple-200 font-medium">Trợ lý trò chuyện & tạo câu hỏi tự động</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
              title="Đóng Copilot Sidebar"
            >
              ✕
            </button>
          </div>

          {/* Current Form Context Header Bar */}
          <div className="bg-purple-50/80 px-4 py-2 border-b border-purple-100 flex items-center justify-between text-xs text-purple-900 font-semibold">
            <span className="flex items-center gap-1.5">
              <span>📋 Ngữ cảnh Form:</span>
              <span className="font-extrabold text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                {currentQuestions.length} câu hỏi
              </span>
            </span>
            <span className="text-[11px] text-purple-600 font-normal">AI đọc trực tiếp Form</span>
          </div>

          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/60">
            {chatHistory.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-xs">
                    🤖
                  </div>
                )}

                <div className="max-w-[85%] space-y-1.5">
                  <div
                    className={`px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-purple-600 text-white font-medium rounded-tr-xs shadow-sm'
                        : 'bg-white text-gray-800 border border-gray-200/80 rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {m.text}
                  </div>

                  {/* CRUD Mutations Action Badge */}
                  {(m.addCount > 0 || m.updateCount > 0 || m.deleteCount > 0) && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold px-3 py-2 rounded-xl flex flex-wrap items-center gap-2 shadow-2xs animate-fadeIn">
                      {m.addCount > 0 && (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300/40">
                          ✨ +{m.addCount} câu mới
                        </span>
                      )}
                      {m.updateCount > 0 && (
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-300/40">
                          ✏️ Sửa {m.updateCount} câu
                        </span>
                      )}
                      {m.deleteCount > 0 && (
                        <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md border border-rose-300/40">
                          🗑️ Xóa {m.deleteCount} câu
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-8 h-8 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-sm shrink-0 animate-spin">
                  ✨
                </div>
                <div className="bg-white p-3 rounded-2xl border border-purple-200 text-xs text-purple-700 font-semibold flex items-center gap-2 shadow-xs">
                  <span className="inline-block animate-bounce">⚡</span>
                  <span>AI Copilot đang phân tích & phản hồi...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions Bar */}
          <div className="p-3 bg-white border-t border-gray-100 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
              💡 Gợi ý lệnh trò chuyện nhanh:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COPILOT_PROMPT_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => handleSendMessage(e, item.text)}
                  disabled={loading}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-semibold px-2.5 py-1 rounded-xl transition text-left disabled:opacity-50 flex items-center gap-1"
                >
                  <span>{item.icon}</span>
                  <span className="truncate max-w-[320px]">{item.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSendMessage(e);
                }
              }}
              placeholder="Hỏi AI, rà soát chính tả hoặc nhờ tạo câu hỏi..."
              disabled={loading}
              className="flex-1 bg-gray-100 border border-gray-300 focus:bg-white focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none transition disabled:opacity-50"
            />
            <button
              type="button"
              onClick={(e) => handleSendMessage(e)}
              disabled={!inputMsg.trim() || loading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition disabled:opacity-40 shrink-0 cursor-pointer"
            >
              Gửi ✨
            </button>
          </div>
        </div>
      </div>
    );
  }
