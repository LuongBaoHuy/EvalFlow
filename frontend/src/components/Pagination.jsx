import React from 'react';

export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.totalRecords === 0) return null;

  const { currentPage, totalPages, totalRecords, limit } = meta;
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalRecords);

  // Generate page numbers
  const pages = [];
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push('...');
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="px-5 py-3 border-t border-gray-200 bg-gray-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      <div className="text-gray-500">
        Hiển thị <span className="font-semibold text-gray-700">{startItem}</span> đến{' '}
        <span className="font-semibold text-gray-700">{endItem}</span> trong tổng số{' '}
        <span className="font-semibold text-gray-700">{totalRecords}</span> bản ghi
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Trước</span>
          </button>

          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400">
                  ...
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-1"
          >
            <span>Sau</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
