'use client';

import React, { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Notification } from '@/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: string;
}

// Play a subtle, clean synthetic chime sound using Web Audio API
function playSubtleChime() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5 note

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Audio context might be blocked by browser autoplay policy if no user interaction yet
  }
}

// Helper for human-readable relative time
function formatTimeAgo(dateString: string | Date | null) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 30) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [mounted, setMounted] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([]);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SWR polling every 5 seconds
  const { data, mutate } = useSWR('/api/notifications', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const notificationsList: Notification[] = data?.data || [];
  const unreadCount = notificationsList.filter((n) => !n.isRead).length;

  // Real-time Toast detection for new unread notifications
  useEffect(() => {
    if (!data?.data || !Array.isArray(data.data)) return;

    const currentList: Notification[] = data.data;

    if (isInitialLoadRef.current) {
      // Record all existing notification IDs on first load without triggering toasts
      currentList.forEach((n) => seenIdsRef.current.add(n.id));
      isInitialLoadRef.current = false;
      return;
    }

    const newUnread: Notification[] = [];
    currentList.forEach((n) => {
      if (!seenIdsRef.current.has(n.id)) {
        seenIdsRef.current.add(n.id);
        if (!n.isRead) {
          newUnread.push(n);
        }
      }
    });

    if (newUnread.length > 0) {
      playSubtleChime();
      const toastsToAdd: ToastItem[] = newUnread.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type || 'info',
      }));

      setActiveToasts((prev) => [...toastsToAdd, ...prev].slice(0, 3));

      // Auto dismiss after 4.5 seconds
      toastsToAdd.forEach((t) => {
        setTimeout(() => {
          setActiveToasts((prev) => prev.filter((item) => item.id !== t.id));
        }, 4500);
      });
    }
  }, [data]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      mutate();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      mutate();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Clear all notifications from DB
  const handleClearAll = async () => {
    try {
      await fetch('/api/notifications', { method: 'DELETE' });
      seenIdsRef.current.clear();
      mutate();
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };


  // Quick helper to send a test notification
  const handleSendTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'System Activity Detected',
          message: `Test alert triggered at ${new Date().toLocaleTimeString()}`,
          type: ['info', 'success', 'warning', 'error'][Math.floor(Math.random() * 4)],
        }),
      });
      mutate();
    } catch (err) {
      console.error('Failed to send test notification:', err);
    }
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  const renderTypeStyle = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
      case 'warning':
        return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
      case 'error':
        return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
      default:
        return 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300';
    }
  };

  if (!mounted) {
    return (
      <button className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all outline-none group cursor-pointer" suppressHydrationWarning>
        <Bell className="w-4 h-4" />
      </button>
    );
  }

  return (
    <>
      {/* REALTIME TOAST CONTAINER (Fixed at top right) */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {activeToasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-2xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${renderTypeStyle(
              toast.type
            )}`}
          >
            <div className="mt-0.5">{renderTypeIcon(toast.type)}</div>
            <div className="flex-1 min-w-0 font-sans">
              <h4 className="text-xs font-semibold text-white tracking-wide leading-tight">
                {toast.title}
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setActiveToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* DROPDOWN MENU FOR BELL ICON */}
      <DropdownMenu>
        <DropdownMenuTrigger className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all outline-none group cursor-pointer">
          <Bell className="w-4 h-4 transition-transform group-hover:rotate-12" />

          {/* Glowing Dot & Unread Badge Indicator */}
          {unreadCount > 0 && (
            <>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold font-mono bg-indigo-600 text-white rounded-full border border-indigo-400/50 shadow-md">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-80 sm:w-96 bg-[#121018]/95 border border-white/15 text-slate-200 rounded-2xl p-0 shadow-2xl backdrop-blur-2xl font-mono text-xs overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white tracking-wide">Notifications</span>
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                  {unreadCount} new
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 rounded-full">
                  All caught up
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleSendTest}
                title="Trigger test notification"
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  title="Mark all as read"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors border border-indigo-500/20 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark read</span>
                </button>
              )}
              {notificationsList.length > 0 && (
                <button
                  onClick={() => setIsConfirmOpen(true)}
                  title="Clear all notifications from database"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

          {/* List of Notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
            {notificationsList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-sans">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-medium">No notifications yet</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  You are all set! New system updates will appear here.
                </p>
              </div>
            ) : (
              notificationsList.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={(e) => handleMarkAsRead(item.id, e)}
                  className={`flex items-start gap-3 p-3.5 cursor-pointer font-sans transition-colors focus:bg-white/5 ${
                    !item.isRead ? 'bg-indigo-500/[0.06]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                    {renderTypeIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h5
                        className={`text-xs leading-snug truncate ${
                          !item.isRead ? 'font-bold text-white' : 'font-medium text-slate-300'
                        }`}
                      >
                        {item.title}
                      </h5>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_#6366f1] shrink-0 mt-1.5" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* CONFIRMATION DIALOG MODAL FOR CLEAR ALL */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-[#14121c] border-white/15 text-slate-100 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl font-mono">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-rose-400 font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Clear All Notifications?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
              Are you sure you want to permanently delete all notification history from the database? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2.5 mt-5">
            <Button
              variant="ghost"
              onClick={() => setIsConfirmOpen(false)}
              className="px-4 py-2 text-xs font-mono text-slate-300 hover:bg-white/10 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsConfirmOpen(false);
                handleClearAll();
              }}
              className="px-4 py-2 text-xs font-mono bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              Yes, Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

