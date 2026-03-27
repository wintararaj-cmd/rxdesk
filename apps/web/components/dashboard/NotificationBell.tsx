'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationApi } from '../../lib/apiClient';
import { Bell, Check, Info, AlertTriangle, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../store/authStore';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace('/api/v1', '');

function timeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type Notification = {
  id: string;
  title: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const { accessToken } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const socketRef = useRef<Socket | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await notificationApi.getAll();
      setNotifications(res.data.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time socket for notifications
  useEffect(() => {
    if (!accessToken) return;

    const socket = io(WS_URL, {
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
    });

    socketRef.current = socket;
    
    socket.on('new_notification', () => {
      // Play a subtle sound or just refetch
      fetchNotifications();
      // Optional: Show a temporary toast if we have a toast system
    });

    return () => { socket.disconnect(); };
  }, [accessToken, fetchNotifications]);

  const markAllRead = async () => {
    try {
      await notificationApi.readAll();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl transition-all hover:bg-white/5 active:scale-95 group"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-rose-500 animate-bounce' : 'text-gray-400 group-hover:text-gray-200'}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-600 border-2 border-[#0d1117] rounded-full text-[9px] font-bold text-white flex items-center justify-center -translate-y-0.5 translate-x-0.5 shadow-lg shadow-rose-600/20">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 max-h-[480px] bg-[#0d1117] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-white font-bold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-400 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80 custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-400">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-gray-700" />
                </div>
                <p className="text-sm font-semibold text-white">No notifications</p>
                <p className="text-xs text-gray-500 mt-1">We&apos;ll notify you here.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={`p-4 transition-colors cursor-pointer group hover:bg-white/[0.02] ${!n.is_read ? 'bg-rose-500/[0.03]' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-rose-600/20 text-rose-400' : 'bg-white/[0.05] text-gray-600'}`}>
                        <Info className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={`text-xs font-bold truncate ${!n.is_read ? 'text-white' : 'text-gray-400'}`}>
                            {n.title || 'Notification'}
                          </p>
                          <span className="text-[10px] text-gray-600 whitespace-nowrap">
                            {timeAgo(new Date(n.created_at))}
                          </span>
                        </div>
                        <p className={`text-[12px] leading-relaxed mb-2 ${!n.is_read ? 'text-gray-300' : 'text-gray-500'}`}>
                          {n.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-white/[0.02] border-t border-white/[0.06] text-center">
            <button
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-gray-500 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-[90]" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
