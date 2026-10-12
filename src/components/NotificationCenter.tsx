"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  BellRing,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  RotateCw,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { Drawer } from "./Drawer";
import type { SystemNotification } from "./NotificationActions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NotificationCenterProps {
  role?: string;
}

type Severity = SystemNotification["severity"];

type StockLine = { name: string; stock: number; min?: number };

type ParsedStockText = {
  items: StockLine[];
  more: number;
  note: string | null;
};

/**
 * Parses stock-alert descriptions produced by `fetchSystemNotifications`
 * ("- Nama -> sisa 0 (min: 10)" / "- Nama -> -3 unit") into structured rows.
 * Returns null when the text does not follow that format, so the caller can
 * fall back to plain text.
 */
function parseStockText(text: string): ParsedStockText | null {
  const items: StockLine[] = [];
  let more = 0;
  const notes: string[] = [];

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const low = line.match(/^-\s+(.+?)\s+->\s+sisa\s+(-?\d+)\s+\(min:\s*(\d+)\)$/);
    if (low) {
      items.push({ name: low[1], stock: Number(low[2]), min: Number(low[3]) });
      continue;
    }

    const neg = line.match(/^-\s+(.+?)\s+->\s+(-?\d+)\s+unit$/);
    if (neg) {
      items.push({ name: neg[1], stock: Number(neg[2]) });
      continue;
    }

    const rest = line.match(/^\.\.\.dan\s+(\d+)\s+barang lainnya$/);
    if (rest) {
      more = Number(rest[1]);
      continue;
    }

    notes.push(line);
  }

  if (items.length === 0) return null;
  return { items, more, note: notes.length ? notes.join(" ") : null };
}

const SEVERITY_UI: Record<
  Severity,
  { tile: string; icon: string; accent: string; bar: string; pill: string; link: string; label: string }
> = {
  danger: {
    tile: "bg-rose-500/12 ring-1 ring-inset ring-rose-500/25",
    icon: "text-rose-500 dark:text-rose-400",
    accent: "before:bg-rose-500",
    bar: "bg-rose-500",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    link: "text-rose-700 hover:bg-rose-500/10 dark:text-rose-300",
    label: "Kritis",
  },
  warning: {
    tile: "bg-amber-500/12 ring-1 ring-inset ring-amber-500/25",
    icon: "text-amber-500 dark:text-amber-400",
    accent: "before:bg-amber-500",
    bar: "bg-amber-500",
    pill: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    link: "text-amber-700 hover:bg-amber-500/10 dark:text-amber-300",
    label: "Perhatian",
  },
  info: {
    tile: "bg-sky-500/12 ring-1 ring-inset ring-sky-500/25",
    icon: "text-sky-500 dark:text-sky-400",
    accent: "before:bg-sky-500",
    bar: "bg-sky-500",
    pill: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    link: "text-sky-700 hover:bg-sky-500/10 dark:text-sky-300",
    label: "Info",
  },
};

/** Strips the "Perhatian:" / "Kritis:" prefix; severity is shown by the badge instead. */
function cleanTitle(title: string) {
  return title.replace(/^(Perhatian|Kritis):\s*/i, "");
}

function DismissButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-500/10 hover:text-foreground"
      aria-label={label}
      title={label}
    >
      <X size={15} />
    </button>
  );
}

export function NotificationCenter({ role }: NotificationCenterProps) {
  // Only warehouse admins receive notifications (stock alerts); other roles skip fetching/polling.
  const canReceive = role === "ADMIN_GUDANG";
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
    if (!canReceive) return;
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
  }, [canReceive]);

  // Load notifications initially
  useEffect(() => {
    if (!canReceive) return;
    loadNotifications();
    // Poll notifications every 60 seconds
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [canReceive, loadNotifications]);

  // Filter out danger/warning alerts to count badges
  const alertCount = visibleNotifications.filter(
    (n) => n.type === "low_stock" || n.type === "negative_stock" || n.type === "overdue_invoice"
  ).length;

  const alerts = visibleNotifications.filter((n) => n.severity !== "info");

  function handleNotifClick(notif: SystemNotification) {
    setIsOpen(false);
    router.push(notif.link);
  }

  function renderAlert(notif: SystemNotification) {
    const ui = SEVERITY_UI[notif.severity];
    const isExpanded = expandedIds.includes(notif.id);
    const hasExpanded = !!notif.expandedDescription;
    const text = isExpanded && notif.expandedDescription ? notif.expandedDescription : notif.description;
    const parsed = parseStockText(text);
    const Icon = notif.severity === "danger" ? AlertOctagon : AlertTriangle;

    return (
      <article
        key={notif.id}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(255,255,255,0.03)]",
          "before:absolute before:inset-y-0 before:left-0 before:w-1",
          ui.accent
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-3 pl-5">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", ui.tile)}>
            <Icon size={18} className={ui.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", ui.pill)}>{ui.label}</span>
              <span className="text-[11px] font-medium text-slate-500">{notif.time}</span>
            </div>
            <h3 className="mt-1 text-sm font-bold leading-snug text-foreground">{cleanTitle(notif.title)}</h3>
          </div>
          <DismissButton onClick={() => handleDismiss(notif.id)} label="Tutup notifikasi ini" />
        </div>

        {/* Body */}
        <div className="px-4 pl-5">
          {parsed ? (
            <>
              <ul
                className={cn(
                  "divide-y divide-border overflow-hidden rounded-xl border border-border bg-slate-500/[0.04]",
                  isExpanded && "max-h-80 overflow-y-auto overscroll-contain"
                )}
              >
                {parsed.items.map((item, idx) => {
                  const ratio = item.min ? Math.max(0, Math.min(1, item.stock / item.min)) : 0;
                  return (
                    <li key={`${item.name}-${idx}`} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground" title={item.name}>
                          {item.name}
                        </p>
                        {item.min !== undefined && (
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-500/15">
                            <div className={cn("h-full rounded-full", ui.bar)} style={{ width: `${Math.max(ratio * 100, 4)}%` }} />
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-right font-mono text-xs tabular-nums">
                        <span className={cn("font-bold", item.stock <= 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                          {item.stock}
                        </span>
                        {item.min !== undefined ? (
                          <span className="text-slate-500"> / {item.min}</span>
                        ) : (
                          <span className="text-slate-500"> unit</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {parsed.note && <p className="mt-3 text-xs leading-relaxed text-slate-500">{parsed.note}</p>}
            </>
          ) : (
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border px-3 py-2 pl-4">
          {hasExpanded ? (
            <button
              type="button"
              onClick={() => toggleExpand(notif.id)}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-500/10 hover:text-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={14} /> Ringkas
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Tampilkan {parsed?.more ? `${parsed.more} lainnya` : "semua"}
                </>
              )}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => handleNotifClick(notif)}
            className={cn("inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition", ui.link)}
          >
            {notif.link.startsWith("/stok") ? "Buka Stok" : "Buka"} <ArrowRight size={14} />
          </button>
        </div>
      </article>
    );
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
      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Pusat Notifikasi" size="small">
        <div className="space-y-5">
          {/* Summary + toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                {alerts.length} perlu tindakan
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={loadNotifications}
                disabled={isPending}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-500/10 hover:text-foreground disabled:opacity-60"
                aria-label="Segarkan notifikasi"
                title="Segarkan"
              >
                <RotateCw size={16} className={cn(isPending && "animate-spin")} />
              </button>
              {visibleNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
                >
                  <Trash2 size={14} /> Hapus semua
                </button>
              )}
            </div>
          </div>

          {alerts.length > 0 && (
            <section className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Perlu Tindakan</h4>
              {alerts.map(renderAlert)}
            </section>
          )}

          {visibleNotifications.length === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center">
                <span className="absolute -inset-3 rounded-3xl bg-emerald-500/10 blur-xl" />
                <span className="absolute inset-0 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5" />
                <ShieldCheck size={28} strokeWidth={1.75} className="relative text-emerald-500" />
              </div>
              <p className="font-semibold text-slate-650">Sistem Bersih & Aman</p>
              <p className="text-xs">Tidak ada peringatan saat ini.</p>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
