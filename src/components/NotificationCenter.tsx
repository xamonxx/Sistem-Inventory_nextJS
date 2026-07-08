"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, Info, BellRing, Sparkles, ChevronRight, ChevronDown, ChevronUp, X, RotateCw } from "lucide-react";
import { Drawer } from "./Drawer";
import type { SystemNotification } from "./NotificationActions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NotificationCenterProps {
  role?: string;
}

export function NotificationCenter({ role: _role }: NotificationCenterProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isPending, startTransition] = useTransition();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("si_dismissed_notifications");
    if (saved) {
      try {
        setDismissedIds(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  function handleDismiss(id: string) {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    localStorage.setItem("si_dismissed_notifications", JSON.stringify(updated));
    toast.success("Notifikasi dihapus");
  }

  function handleClearAll() {
    const visibleIds = notifications.map(n => n.id);
    const updated = Array.from(new Set([...dismissedIds, ...visibleIds]));
    setDismissedIds(updated);
    localStorage.setItem("si_dismissed_notifications", JSON.stringify(updated));
    toast.success("Semua notifikasi dibersihkan");
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  const loadNotifications = useCallback(() => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          throw new Error(`Notification request failed: ${response.status}`);
        }
        const data = (await response.json()) as { notifications?: SystemNotification[] };
        setNotifications(data.notifications ?? []);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    });
  }, []);

  // Load notifications initially
  useEffect(() => {
    loadNotifications();
    // Poll notifications every 60 seconds
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Filter out danger/warning alerts to count badges
  const alertCount = visibleNotifications.filter(
    (n) => n.type === "low_stock" || n.type === "negative_stock" || n.type === "overdue_invoice"
  ).length;

  const severityStyles = {
    danger: "border-red-100 dark:border-red-950/40 bg-red-50/50 dark:bg-red-950/25 text-red-800 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950/35 hover:border-red-200 dark:hover:border-red-900/50",
    warning: "border-amber-100 dark:border-amber-950/40 bg-amber-50/50 dark:bg-amber-950/25 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/35 hover:border-amber-200 dark:hover:border-amber-900/50",
    info: "border-blue-100 dark:border-blue-950/40 bg-blue-50/50 dark:bg-blue-950/25 text-blue-800 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/35 hover:border-blue-200 dark:hover:border-blue-900/50",
  };

  const icons = {
    danger: <AlertTriangle size={16} className="text-red-500 shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-500 shrink-0" />,
    info: <Info size={16} className="text-blue-500 shrink-0" />,
  };

  const arrowColors = {
    danger: "text-red-400 group-hover:text-red-600",
    warning: "text-amber-400 group-hover:text-amber-600",
    info: "text-blue-400 group-hover:text-blue-600",
  };

  const toggleColors = {
    danger: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100/60 dark:hover:bg-red-950/45",
    warning: "text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/45",
    info: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100/60 dark:hover:bg-blue-950/45",
  };

  function handleNotifClick(notif: SystemNotification) {
    setIsOpen(false);
    router.push(notif.link);
  }

  return (
    <>
      {/* Bell Button trigger */}
      <button
        onClick={() => {
          setIsOpen(true);
          loadNotifications();
        }}
        className="chrome-icon-button relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl backdrop-blur-xl backdrop-saturate-150 transition"
        title="Pusat Notifikasi"
      >
        {alertCount > 0 ? (
          <BellRing size={20} className="text-[var(--primary)] animate-pulse" />
        ) : (
          <Bell size={20} />
        )}
        {alertCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-black text-white shadow-sm">
            {alertCount}
          </span>
        )}
      </button>

      {/* Notification List Drawer */}
      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Notification Center" size="small">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              {visibleNotifications.length} pemberitahuan terdeteksi
            </p>
            <div className="flex items-center gap-3">
              {visibleNotifications.length > 0 && (
                <button
                   onClick={handleClearAll}
                   className="text-xs font-bold text-red-650 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition cursor-pointer"
                >
                  Hapus Semua
                </button>
              )}
              {visibleNotifications.length > 0 && <span className="text-slate-200 dark:text-foreground">|</span>}
              <button
                onClick={loadNotifications}
                className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1.5"
                disabled={isPending}
              >
                <RotateCw size={11} className={cn("shrink-0", isPending && "animate-spin")} />
                {isPending ? "Memuat..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {visibleNotifications.map((notif) => {
              const isExpanded = expandedIds.includes(notif.id);
              const hasExpanded = !!notif.expandedDescription;
              const displayText = isExpanded && notif.expandedDescription
                ? notif.expandedDescription
                : notif.description;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={cn(
                    "group relative flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left text-xs leading-relaxed transition-[background-color,border-color,box-shadow,transform] hover:shadow-sm",
                    severityStyles[notif.severity]
                  )}
                >
                  {icons[notif.severity]}
                  <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground dark:text-slate-100">{notif.title}</span>
                      <span className="text-[10px] text-slate-455 dark:text-slate-500 font-medium font-mono shrink-0">
                        {notif.time}
                      </span>
                    </div>
                    <p className="text-slate-650 dark:text-slate-350 whitespace-pre-line">{displayText}</p>
                    {hasExpanded && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(notif.id);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md transition cursor-pointer mt-1",
                          toggleColors[notif.severity]
                        )}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={12} /> Sembunyikan
                          </>
                        ) : (
                          <>
                            <ChevronDown size={12} /> Lihat Semua
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <ChevronRight
                      size={16}
                      className={cn(
                        "transition-transform group-hover:translate-x-0.5",
                        arrowColors[notif.severity]
                      )}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(notif.id);
                      }}
                      className="text-slate-400 hover:text-slate-755 dark:hover:text-slate-200 p-1.5 rounded-lg transition hover:bg-slate-200/40 dark:hover:bg-slate-800/40 shrink-0 cursor-pointer"
                      title="Hapus notifikasi ini"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            {visibleNotifications.length === 0 && (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Sparkles size={36} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-650">Sistem Bersih & Aman</p>
                <p className="text-xs">Tidak ada peringatan kritis terdeteksi saat ini.</p>
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </>
  );
}
