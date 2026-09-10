import React, { useState, useEffect, useRef } from 'react';
import { sendCopilotMessageApi } from '../api/campaigns.api';

export default function CampaignCopilotChatbot({ campaignId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '👋 **Xin chào Admin!** Tôi là **AI Copilot** - Trợ lý phân tích khảo sát của EvalFlow.\n\nTôi có thể giúp bạn phát hiện các bài nộp bất thường (mâu thuẫn giữa điểm số và ý kiến nhận xét) cũng như tóm tắt kết quả chiến dịch này.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e, textToSend) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }

    const text = typeof textToSend === 'string' ? textToSend : inputMessage;
    if (!text || typeof text !== 'string' || !text.trim() || loading) return;

    const userMsg = {
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (typeof textToSend !== 'string') setInputMessage('');
    setLoading(true);
    setTimeout(scrollToBottom, 50);

    try {
      // Build history for API
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          content: m.text,
        }));

      const res = await sendCopilotMessageApi(campaignId, userMsg.text, history);

      if (res.success && res.data) {
        const replyMsg = {
          role: 'assistant',
          text: res.data.reply || 'Không nhận được câu trả lời từ AI.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, replyMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `✕ **Lỗi**: ${res.message || 'Không thể kết nối tới Trợ lý AI Copilot.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `✕ **Lỗi**: ${err.response?.data?.message || 'Lỗi khi gửi yêu cầu tới AI Copilot.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    'Tóm tắt các bài nộp bất thường trong đợt này',
    'Có bài nộp nào mâu thuẫn điểm số và nhận xét không?',
    'Đánh giá tổng quan chất lượng bài nộp',
  ];

  // Helper to format basic markdown (bold, bullet points, headers, inline code)
  const formatMarkdown = (txt) => {
    if (!txt) return '';

    return txt.split('\n').map((line, i) => {
      let content = line;

      // Headers
      if (content.startsWith('### ')) {
        return (
          <h4 key={i} className="font-extrabold text-gray-900 text-sm mt-2 mb-1">
            {content.replace('### ', '')}
          </h4>
        );
      }
      if (content.startsWith('#### ')) {
        return (
          <h5 key={i} className="font-bold text-indigo-900 text-xs mt-2 mb-1">
            {content.replace('#### ', '')}
          </h5>
        );
      }

      // Bold formatting
      const parts = content.split(/(\*\*.*?\*\*|\`.*?\`)/g);

      return (
        <p key={i} className={`${line.trim().startsWith('-') ? 'pl-2 my-0.5' : 'my-1'} text-xs leading-relaxed`}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-extrabold text-gray-900">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={pIdx} className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <>
      {/* FLOATING ACTION BUTTON (FAB) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative group bg-amber-500 hover:bg-amber-600 text-white p-3.5 rounded-full shadow-lg transition-all duration-300 hover:scale-105 flex items-center gap-2 border-2 border-white/30"
          title="AI Copilot Trợ lý Phân tích Bất thường"
        >
          <span className="text-2xl animate-bounce">🤖</span>
          <span className="text-xs font-bold pr-2 hidden sm:inline-block">AI Copilot</span>
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-400"></span>
            </span>
          )}
        </button>
      </div>

      {/* CHATBOX POPOVER / SIDEBAR */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-w-[92vw] h-[520px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-purple-800 text-white p-4 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-xl border border-white/20">
                🤖
              </div>
              <div>
                <h3 className="font-black text-sm tracking-wide">AI Copilot</h3>
                <p className="text-[11px] text-indigo-100/90 font-medium">Trợ lý Phân tích Bất thường RAG</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold transition"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
                        : 'bg-white text-gray-800 border border-gray-200/80 rounded-bl-none'
                    }`}
                  >
                    {isUser ? <p className="leading-relaxed">{msg.text}</p> : formatMarkdown(msg.text)}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.timestamp}</span>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 p-3 rounded-2xl w-max">
                <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent"></div>
                <span>AI Copilot đang phân tích dữ liệu bất thường...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestion Pills */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            {quickQuestions.map((qText, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={(e) => handleSendMessage(e, qText)}
                disabled={loading}
                className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1 rounded-xl whitespace-nowrap transition shrink-0"
              >
                💡 {qText}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSendMessage(e);
                }
              }}
              placeholder="Hỏi AI Copilot về đợt khảo sát này..."
              disabled={loading}
              className="flex-1 px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition"
            />
            <button
              type="button"
              onClick={(e) => handleSendMessage(e)}
              disabled={loading || !inputMessage.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
