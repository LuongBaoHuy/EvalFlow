import React, { useState } from 'react';
import DynamicSurveyRenderer from './DynamicSurveyRenderer';

export default function SurveyLivePreview({
  title,
  description,
  primaryColor = '#2563eb',
  fontFamily = 'Inter',
  logoUrl = '',
  coverImageUrl = '',
  surveyType = 'STANDARD',
  canvasHtml = '',
  questions = [],
  onClose,
}) {
  const [answers, setAnswers] = useState({});
  const [deviceView, setDeviceView] = useState('desktop'); // 'desktop' | 'mobile'

  const handleAnswerChange = (qId, val) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const themeConfig = {
    primaryColor,
    fontFamily,
    logoUrl,
    coverImageUrl,
    surveyType,
    canvasHtml,
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden transition-all flex flex-col h-full max-h-[92vh]">
      {/* Top Preview Control Header Bar */}
      <div className="bg-gray-50 text-gray-800 px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600 ml-2">
            👁️ Xem trước Form Khảo sát (Live Preview)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Device Switcher Pills */}
          <div className="bg-gray-200 p-1 rounded-xl flex items-center text-xs border border-gray-300">
            <button
              type="button"
              onClick={() => setDeviceView('desktop')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                deviceView === 'desktop'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              💻 Máy tính (Desktop)
            </button>
            <button
              type="button"
              onClick={() => setDeviceView('mobile')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                deviceView === 'mobile'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📱 Điện thoại (Mobile)
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 font-bold text-lg px-2 py-0.5 rounded hover:bg-gray-200 transition"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Preview Screen Container */}
      <div className="bg-gray-100 p-6 flex-1 overflow-y-auto flex items-center justify-center relative">
        {deviceView === 'mobile' ? (
          /* Realistic Smartphone Shell Wrapper */
          <div className="relative mx-auto my-2 w-[375px] h-[660px] bg-gray-900 rounded-[44px] p-3 shadow-2xl border-4 border-gray-800 flex flex-col shrink-0">
            {/* Speaker / Camera Notch */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-4 bg-gray-900 rounded-full z-20 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-gray-800 mr-2"></div>
              <div className="w-10 h-1.5 rounded-full bg-gray-800"></div>
            </div>

            {/* Inner Mobile Screen Display Viewport with scroll inside the phone */}
            <div className="w-full h-full bg-white rounded-[34px] overflow-y-auto overflow-x-hidden pt-5 pb-4 px-3 border border-gray-800/40 text-left">
              <DynamicSurveyRenderer
                surveyTitle={title || 'Tiêu đề khảo sát mẫu'}
                surveyDescription={description}
                themeConfig={themeConfig}
                questions={questions}
                answers={answers}
                onAnswerChange={handleAnswerChange}
                isSubmitting={false}
                onSubmit={(e) => {
                  e.preventDefault();
                  alert('Đây là chế độ xem trước! Dữ liệu không được gửi.');
                }}
              />
            </div>
          </div>
        ) : (
          /* Full Desktop View Container */
          <div className="w-full max-w-3xl my-auto">
            <DynamicSurveyRenderer
              surveyTitle={title || 'Tiêu đề khảo sát mẫu'}
              surveyDescription={description}
              themeConfig={themeConfig}
              questions={questions}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              isSubmitting={false}
              onSubmit={(e) => {
                e.preventDefault();
                alert('Đây là chế độ xem trước! Dữ liệu không được gửi.');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
