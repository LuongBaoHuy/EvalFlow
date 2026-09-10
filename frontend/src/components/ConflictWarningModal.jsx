import React, { useState } from 'react';

export default function ConflictWarningModal({ isOpen, onClose, draftContent = '' }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyContent = () => {
    const textToCopy = typeof draftContent === 'string' && draftContent.trim() !== ''
      ? draftContent
      : 'Nội dung đang soạn thảo trên Form';
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border-2 border-amber-300 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3.5 border-b border-amber-100 pb-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl shrink-0 shadow-sm">
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-amber-900 leading-tight">
              Xung đột Dữ liệu (409 Conflict)
            </h3>
            <p className="text-xs text-amber-700 font-semibold mt-0.5">
              Phát hiện ghi đè dữ liệu trùng lặp từ Quản trị viên khác
            </p>
          </div>
        </div>

        {/* Warning Content */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-950 leading-relaxed font-medium space-y-2">
          <p>
            Dữ liệu đã bị thay đổi bởi một Quản trị viên khác trong lúc bạn đang soạn thảo.
          </p>
          <p className="font-bold text-amber-900">
            Để tránh mất dữ liệu, vui lòng sao chép lại các nội dung bạn vừa viết, sau đó Tải lại trang (F5) để nhận bản cập nhật mới nhất trước khi lưu.
          </p>
        </div>

        {/* User Content Preview Box if available */}
        {draftContent && draftContent.trim() !== '' && (
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              📝 Nội dung bản nháp vừa nhập (có thể sao chép):
            </label>
            <textarea
              readOnly
              rows={3}
              value={draftContent}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-700 outline-none select-all font-mono"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-gray-100">
          <button
            type="button"
            onClick={handleCopyContent}
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-xs"
          >
            <span>{copied ? '✅ Đã sao chép!' : '📋 Sao chép nội dung vừa viết'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Đóng cảnh báo
            </button>

            <button
              type="button"
              onClick={handleRefreshPage}
              className="bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔄 Tải lại trang (F5)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
