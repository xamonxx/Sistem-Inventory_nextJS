"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, Info, BellRing, Sparkles, ChevronRight } from "lucide-react";
import { Drawer } from "./Drawer";
import { fetchSystemNotifications, type SystemNotification } from "./NotificationActions";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isPending, startTransition] = useTransition();

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
  const alertCount = notifications.filter(
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
              {notifications.length} pemberitahuan terdeteksi
            </p>
            <button
              onClick={loadNotifications}
              className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
              disabled={isPending}
            >
              {isPending ? "Memuat..." : "Refresh"}
            </button>
          </div>

          <div className="space-y-3">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={cn(
                  "group w-full rounded-xl border p-4 flex items-start gap-3 text-xs leading-relaxed transition-all cursor-pointer text-left",
                  severityStyles[notif.severity]
                )}
              >
                {icons[notif.severity]}
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{notif.title}</span>
                    <span className="text-[10px] text-slate-450 font-medium font-mono shrink-0">
                      {notif.time}
                    </span>
                  </div>
                  <p className="text-slate-600">{notif.description}</p>
                </div>
                <ChevronRight
                  size={16}
                  className={cn(
                    "shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5",
                    arrowColors[notif.severity]
                  )}
                />
              </button>
            ))}

            {notifications.length === 0 && (
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

