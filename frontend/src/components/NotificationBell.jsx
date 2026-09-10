import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  deleteNotificationApi,
  clearReadNotificationsApi,
} from '../api/notifications.api';
import { getUser } from '../utils/auth.utils';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifs = async () => {
    const user = getUser();
    const userId = user?.id || 1;
    try {
      const res = await getNotificationsApi(userId);
      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch {
      // Silent error fallback
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    const user = getUser();
    const userId = user?.id || 1;
    try {
      await markAllNotificationsReadApi(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  const handleClearRead = async () => {
    const user = getUser();
    const userId = user?.id || 1;
    try {
      await clearReadNotificationsApi(userId);
      setNotifications((prev) => prev.filter((n) => !n.is_read));
    } catch {
      // Silent fail
    }
  };

  const handleDeleteSingle = async (e, notifId, isRead) => {
    e.stopPropagation(); // Stop triggering parent click
    const user = getUser();
    const userId = user?.id || 1;
    try {
      await deleteNotificationApi(notifId, userId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      if (!isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Silent fail
    }
  };

  const handleNotificationClick = async (notif) => {
    const user = getUser();
    const userId = user?.id || 1;
    if (!notif.is_read) {
      try {
        await markNotificationReadApi(notif.id, userId);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silent fail
      }
    }
    setIsOpen(false);
    if (notif.action_link) {
      navigate(notif.action_link);
    }
  };

  const readCount = notifications.filter((n) => n.is_read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition focus:outline-none"
        title="Thông báo"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Red Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover with z-[100] */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3.5 bg-gray-50 border-b border-gray-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>🔔</span>
                <span>Thông báo ({notifications.length})</span>
              </h4>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold transition"
                >
                  Đánh dấu tất cả đã đọc
                </button>
              )}
            </div>

            {readCount > 0 && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleClearRead}
                  className="text-[11px] text-red-600 hover:text-red-800 font-semibold transition flex items-center gap-1"
                >
                  <span>🗑️</span>
                  <span>Xóa tất cả thông báo đã đọc</span>
                </button>
              </div>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium">
                🎉 Không có thông báo nào
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 hover:bg-gray-50 transition cursor-pointer flex gap-3 items-start relative group ${
                    !n.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">📢</span>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className={`text-xs text-gray-800 leading-relaxed ${!n.is_read ? 'font-bold' : 'font-normal'}`}>
                      {n.message}
                    </p>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {n.created_at ? new Date(n.created_at).toLocaleString('vi-VN') : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!n.is_read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" title="Chưa đọc" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSingle(e, n.id, n.is_read)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition text-xs font-bold"
                      title="Xóa thông báo này"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
