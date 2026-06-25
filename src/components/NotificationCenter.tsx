"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, Info, BellRing, Sparkles, ChevronRight, X, RotateCw } from "lucide-react";
import { Drawer } from "./Drawer";
import { fetchSystemNotifications, type SystemNotification } from "./NotificationActions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isPending, startTransition] = useTransition();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

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

  const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  function loadNotifications() {
    startTransition(async () => {
      try {
        const data = await fetchSystemNotifications();
        setNotifications(data);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    });
  }

  // Load notifications initially
  useEffect(() => {
    loadNotifications();
    // Poll notifications every 60 seconds
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter out danger/warning alerts to count badges
  const alertCount = visibleNotifications.filter(
    (n) => n.type === "low_stock" || n.type === "negative_stock" || n.type === "overdue_invoice"
  ).length;

  const severityStyles = {
    danger: "border-red-100 bg-red-50/50 text-red-800 hover:bg-red-50 hover:border-red-200",
    warning: "border-amber-100 bg-amber-50/50 text-amber-800 hover:bg-amber-50 hover:border-amber-200",
    info: "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-50 hover:border-blue-200",
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
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
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
                  className="text-xs font-bold text-red-650 hover:text-red-800 transition cursor-pointer"
                >
                  Hapus Semua
                </button>
              )}
              {visibleNotifications.length > 0 && <span className="text-slate-200">|</span>}
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
            {visibleNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={cn(
                  "group relative w-full rounded-xl border p-4 flex items-start gap-3 text-xs leading-relaxed transition-all hover:shadow-sm cursor-pointer text-left",
                  severityStyles[notif.severity]
                )}
              >
                {icons[notif.severity]}
                <div className="space-y-1 flex-1 min-w-0 pr-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{notif.title}</span>
                    <span className="text-[10px] text-slate-455 font-medium font-mono shrink-0">
                      {notif.time}
                    </span>
                  </div>
                  <p className="text-slate-650">{notif.description}</p>
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
                    className="text-slate-400 hover:text-slate-755 p-1.5 rounded-lg transition hover:bg-slate-200/40 shrink-0 cursor-pointer"
                    title="Hapus notifikasi ini"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}

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

