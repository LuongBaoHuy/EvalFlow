import React, { useState } from 'react';
import { uploadImageApi } from '../api/uploads.api';

export default function ImageUploader({
  value,
  onChange,
  label = 'Tải lên ảnh',
  placeholder = 'Chọn hoặc kéo thả ảnh vào đây (.jpg, .png, max 5MB)',
  compact = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      const res = await uploadImageApi(file);
      if (res.success && res.data?.url) {
        onChange(res.data.url);
      } else {
        setError(res.message || 'Tải ảnh thất bại');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải ảnh lên server');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    setError('');
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold text-gray-700">{label}</label>}

      {value ? (
        /* Image Preview Box */
        <div className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-between p-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src={value}
              alt="Uploaded preview"
              className="w-12 h-12 rounded-lg object-cover border border-gray-300 shrink-0 bg-white"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/150?text=Image+Error';
              }}
            />
            <div className="text-xs truncate max-w-[200px]">
              <span className="font-semibold text-gray-800 block truncate">{value.split('/').pop()}</span>
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline text-[11px]"
              >
                Xem ảnh gốc ↗
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-500 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 transition font-medium"
          >
            ✕ Xóa ảnh
          </button>
        </div>
      ) : (
        /* File Input Dropzone */
        <div className="relative">
          <label
            className={`border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl ${
              compact ? 'p-2' : 'p-3'
            } text-center cursor-pointer transition flex items-center justify-center gap-2 bg-gray-50/50`}
          >
            {uploading ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                Đang tải ảnh lên...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-base">🖼️</span>
                <span className="font-medium text-gray-700">{placeholder}</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 font-medium">✕ {error}</p>}
    </div>
  );
}
