import React from 'react';

export default function AiGoalsInput({ aiGoals = [], setAiGoals }) {
  const handleAddGoal = () => {
    setAiGoals([...aiGoals, '']);
  };

  const handleGoalChange = (index, value) => {
    const updated = [...aiGoals];
    updated[index] = value;
    setAiGoals(updated);
  };

  const handleRemoveGoal = (index) => {
    const updated = aiGoals.filter((_, idx) => idx !== index);
    setAiGoals(updated);
  };

  return (
    <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-bold text-indigo-900 flex items-center gap-1.5">
          <span>🎯</span>
          <span>Mục tiêu phân tích cho AI (Tùy chọn)</span>
        </label>
        <button
          type="button"
          onClick={handleAddGoal}
          className="text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer"
        >
          <span>+</span>
          <span>Thêm mục tiêu phân tích</span>
        </button>
      </div>

      <p className="text-[11px] text-indigo-600/80 leading-relaxed">
        Nhập các mục tiêu cụ thể để AI Copilot bám sát khi tự động tư vấn, sinh câu hỏi và tổng hợp báo cáo sau này.
      </p>

      {aiGoals.length > 0 && (
        <div className="space-y-2 pt-1">
          {aiGoals.map((goal, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={goal}
                onChange={(e) => handleGoalChange(index, e.target.value)}
                placeholder={`Mục tiêu ${index + 1} (VD: Đánh giá mức độ hài lòng về cơ sở vật chất...)`}
                className="flex-1 text-xs border border-indigo-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800"
              />
              <button
                type="button"
                onClick={() => handleRemoveGoal(index)}
                className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl border border-transparent hover:border-rose-200 transition font-bold text-xs shrink-0 cursor-pointer"
                title="Xóa mục tiêu này"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
