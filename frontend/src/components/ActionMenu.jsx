import React, { useState, useRef, useEffect } from 'react';
import { Pencil, BarChart, MoreVertical, Copy, Trash2 } from 'lucide-react';

const ActionMenu = ({ onEdit, onResults, onCopyLink, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center justify-end gap-1" ref={dropdownRef}>
      <button
        onClick={onEdit}
        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
        title="Sửa"
      >
        <Pencil size={18} />
      </button>
      
      <button
        onClick={onResults}
        className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
        title="Kết quả"
      >
        <BarChart size={18} />
      </button>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            isOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
          title="Thêm thao tác"
        >
          <MoreVertical size={18} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
            <button
              onClick={() => {
                onCopyLink();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Copy size={16} />
              Copy Link
            </button>
            <button
              onClick={() => {
                onDelete();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 size={16} />
              Xóa
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionMenu;
