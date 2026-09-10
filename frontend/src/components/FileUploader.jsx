import React, { useState } from 'react';
import { uploadFileApi } from '../api/uploads.api';

// Helper to determine file icon based on extension
function getFileIcon(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📑';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '💻';
  if (['zip', 'rar', '7z'].includes(ext)) return '📦';
  return '📁';
}

// Helper to normalize value into array of file URLs
function getFileList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {}
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

export default function FileUploader({
  value,
  onChange,
  label = 'Đính kèm tệp / minh chứng',
  placeholder = 'Chọn tệp (.txt, .docx, .pdf, .xlsx, ảnh, max 5MB)',
  allowedCategory = 'all', // 'all' | 'document' | 'spreadsheet' | 'image'
  minFiles = 0,
  maxFiles = 5,
  compact = false,
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fileList = getFileList(value);
  const effectiveMax = Math.max(1, Number(maxFiles) || 1);
  const effectiveMin = Math.max(0, Number(minFiles) || 0);

  // Map category to file input accept attribute
  const getAcceptString = () => {
    switch (allowedCategory) {
      case 'document':
        return '.txt,.doc,.docx,.pdf';
      case 'spreadsheet':
        return '.xls,.xlsx,.csv';
      case 'image':
        return 'image/*,.jpg,.jpeg,.png,.webp';
      case 'all':
      default:
        return '.txt,.doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.csv,.zip,.rar,image/*';
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset target value so re-selecting same file triggers event
    e.target.value = '';
    if (!file) return;

    if (fileList.length >= effectiveMax) {
      setError(`Bạn chỉ được nộp tối đa ${effectiveMax} tệp.`);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Dung lượng tệp vượt quá 5MB. Vui lòng chọn tệp nhỏ hơn 5MB.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      const res = await uploadFileApi(file);
      if (res.success && res.data?.url) {
        const updated = [...fileList, res.data.url];
        onChange(updated);
      } else {
        setError(res.message || 'Tải tệp lên thất bại');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải tệp lên server (Tối đa 5MB)');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (indexToRemove) => {
    const updated = fileList.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
    setError('');
  };

  const reachedMax = fileList.length >= effectiveMax;

  return (
    <div className="space-y-2">
      {/* Label and Badge section */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label && <label className="block text-xs font-bold text-gray-700">{label}</label>}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span
            className={`px-2 py-0.5 rounded-md ${
              fileList.length < effectiveMin
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}
          >
            Đã nộp: {fileList.length} / tối đa {effectiveMax} tệp
          </span>
          {effectiveMin > 0 && (
            <span className="text-gray-500 font-medium">
              (Tối thiểu {effectiveMin} tệp)
            </span>
          )}
        </div>
      </div>

      {/* List of uploaded files */}
      {fileList.length > 0 && (
        <div className="space-y-2">
          {fileList.map((url, idx) => {
            const fileName = url ? url.split('/').pop() : `Tệp ${idx + 1}`;
            const fileIcon = getFileIcon(fileName);

            return (
              <div
                key={`${url}_${idx}`}
                className="relative group rounded-xl border border-blue-200 overflow-hidden bg-blue-50/40 flex items-center justify-between p-2.5 transition hover:bg-blue-50"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="text-xl p-1.5 bg-white rounded-lg border border-gray-200 shadow-sm shrink-0">
                    {fileIcon}
                  </span>
                  <div className="text-xs truncate max-w-[260px] sm:max-w-[360px]">
                    <span className="font-bold text-gray-800 block truncate">{fileName}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 font-semibold hover:underline text-[11px] inline-flex items-center gap-1 mt-0.5"
                    >
                      Tải về / Xem tệp ↗
                    </a>
                  </div>
                </div>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-xs text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 transition font-semibold shrink-0 ml-2"
                  >
                    ✕ Xóa
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* File Dropzone Input */}
      {!disabled && !reachedMax ? (
        <div className="relative">
          <label
            className={`border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl ${
              compact ? 'p-2.5' : 'p-3.5'
            } text-center cursor-pointer transition flex items-center justify-center gap-2 bg-gray-50/50`}
          >
            {uploading ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                Đang tải tệp lên (Max 5MB)...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-base">📁</span>
                <span className="font-medium text-gray-700">
                  {fileList.length > 0
                    ? `+ Nhấn để tải thêm tệp mới (tối đa ${effectiveMax} tệp)`
                    : placeholder}
                </span>
              </div>
            )}
            <input
              type="file"
              accept={getAcceptString()}
              disabled={uploading}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-800 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
          <span>✓</span>
          <span>Đã nộp đủ số lượng tệp tối đa ({effectiveMax}/{effectiveMax} tệp). Để chọn tệp mới, vui lòng xóa tệp đã nộp.</span>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 font-semibold">✕ {error}</p>}
    </div>
  );
}
