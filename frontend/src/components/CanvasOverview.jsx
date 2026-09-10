import React from 'react';
import { Sparkles, Clock, User, MessageSquare } from 'lucide-react';

export default function CanvasOverview({ analytics, responsesData }) {
  // Extract all unique question IDs from responses to form columns
  const responses = responsesData?.responses || [];
  
  // Get all unique question IDs
  const uniqueQuestionIds = new Set();
  responses.forEach(r => {
    if (r.answers && Array.isArray(r.answers)) {
      r.answers.forEach(a => uniqueQuestionIds.add(a.question_id));
    }
  });
  
  const questionIds = Array.from(uniqueQuestionIds);

  // Recent Submissions (Max 5)
  const recentResponses = [...responses].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)).slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Header & AI Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Thống kê Dữ liệu Biểu mẫu (Canvas)</h2>
          <p className="text-sm text-gray-500 mt-1">Dữ liệu thô được trích xuất từ các ô nhập liệu trong biểu mẫu hành chính.</p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 opacity-60 cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold shadow text-sm transition"
          title="Tính năng đang được phát triển"
        >
          <Sparkles size={18} />
          Tóm tắt dữ liệu bằng AI
        </button>
      </div>

      {/* 2. Raw Data Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            Lưới Dữ liệu Thô (Raw Data Grid)
          </h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          {responses.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm font-medium">
              Chưa có dữ liệu nộp bài nào.
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-gray-50">
                <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="py-3 px-4 sticky left-0 bg-gray-50 border-r border-gray-200 z-10">Người nộp</th>
                  <th className="py-3 px-4 border-r border-gray-200">Thời gian nộp</th>
                  {questionIds.map((qId, idx) => (
                    <th key={qId} className="py-3 px-4 border-r border-gray-200 min-w-[150px]">
                      Trường dữ liệu {idx + 1}
                      <div className="text-[10px] text-gray-400 normal-case mt-0.5">ID: {qId}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {responses.map((resp, idx) => {
                  const answerMap = {};
                  if (resp.answers && Array.isArray(resp.answers)) {
                    resp.answers.forEach(a => {
                      answerMap[a.question_id] = a.answer_value;
                    });
                  }
                  
                  return (
                    <tr key={resp.response_id || idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4 sticky left-0 bg-white border-r border-gray-200 z-10 font-medium text-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {resp.evaluator_name || resp.guest_name || 'Khách'}
                      </td>
                      <td className="py-3 px-4 border-r border-gray-200 text-gray-500 text-xs">
                        {new Date(resp.submitted_at).toLocaleString('vi-VN')}
                      </td>
                      {questionIds.map(qId => (
                        <td key={qId} className="py-3 px-4 border-r border-gray-200 text-gray-700">
                          <div className="truncate max-w-[300px]" title={answerMap[qId] || ''}>
                            {answerMap[qId] || <span className="text-gray-300 italic text-xs">Trống</span>}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 3. Recent Submissions Feed */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-6">
          <Clock size={18} className="text-emerald-600" />
          Luồng Phản hồi Mới nhất
        </h3>
        
        {recentResponses.length === 0 ? (
          <div className="text-center text-gray-400 text-sm font-medium py-8">
            Chưa có phản hồi nào.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentResponses.map((resp, idx) => {
              const previewAnswers = (resp.answers || []).filter(a => a.answer_value).slice(0, 3);
              
              return (
                <div key={resp.response_id || idx} className="border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition bg-gradient-to-br from-white to-gray-50/50">
                  <div className="flex items-center gap-3 mb-3 border-b border-gray-100 pb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <User size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{resp.evaluator_name || resp.guest_name || 'Khách'}</h4>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock size={12} />
                        {new Date(resp.submitted_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {previewAnswers.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Biểu mẫu trống.</p>
                    ) : (
                      previewAnswers.map((ans, aIdx) => (
                        <div key={aIdx} className="text-xs bg-white p-2 rounded border border-gray-100">
                          <span className="font-semibold text-gray-600 block mb-0.5 text-[10px] uppercase">
                            Trường {questionIds.indexOf(ans.question_id) + 1}
                          </span>
                          <span className="text-gray-800 line-clamp-2" title={ans.answer_value}>{ans.answer_value}</span>
                        </div>
                      ))
                    )}
                    {(resp.answers || []).length > 3 && (
                      <p className="text-[10px] text-blue-500 font-semibold italic text-center pt-1">
                        + {(resp.answers || []).length - 3} trường dữ liệu khác...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
