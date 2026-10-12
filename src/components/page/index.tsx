import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Primitif halaman bersama (header, kartu statistik, panel, status) dengan
 * bahasa visual bento yang sama seperti dashboard & laporan gudang.
 * Memakai kelas di globals.css: .bento-card, .bento-tone, .bento-icon.
 */

export const TONE_HEX = {
  sky: "#0ea5e9",
  emerald: "#10b981",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#94a3b8",
} as const;

export type Tone = keyof typeof TONE_HEX;

const toneStyle = (tone: Tone) => ({ "--tone": TONE_HEX[tone] }) as CSSProperties;

// ===================== Header halaman =====================

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--primary)] dark:text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0 lg:justify-end">{actions}</div>}
    </header>
  );
}

// ===================== Kartu statistik =====================

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "sky",
  badge,
  valueClassName,
}: {
  icon: ElementType;
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: Tone;
  /** Angka pendamping kecil di samping nilai (mis. persen margin). */
  badge?: string;
  valueClassName?: string;
}) {
  return (
    <div className="bento-card bento-tone min-w-0 p-3.5 sm:p-5" style={toneStyle(tone)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase leading-tight tracking-wider text-[var(--text-soft)] sm:text-[11px]">{label}</p>
        <span className="bento-icon !h-8 !w-8 !rounded-[10px] sm:!h-9 sm:!w-9 sm:!rounded-[11px]">
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 flex min-w-0 items-baseline gap-2">
        <p
          className={cn(
            "tnum min-w-0 truncate pb-0.5 font-display text-[15px] font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-lg xl:text-xl",
            valueClassName
          )}
          title={value}
        >
          {value}
        </p>
        {badge && (
          <span
            className="tnum shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: "color-mix(in srgb, var(--tone) 14%, transparent)", color: "var(--tone)" }}
          >
            {badge}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 truncate text-[11px] text-[var(--text-muted-2)]">{hint}</p>}
    </div>
  );
}

/** Grid kartu statistik responsif (2 kolom di HP, n kolom di desktop). */
export function StatGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 3 | 4 | 5; className?: string }) {
  // 5 kartu: kartu ke-5 melebar 2 kolom di bawah lg agar tidak ada kartu yatim.
  const lg = {
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-3 xl:grid-cols-5 [&>*:nth-child(5)]:col-span-2 lg:[&>*:nth-child(5)]:col-span-1",
  }[cols];
  return <section className={cn("grid grid-cols-2 gap-3 sm:gap-4", lg, className)}>{children}</section>;
}

// ===================== Panel =====================

export function IconChip({ icon: Icon, tone = "sky", size = 17 }: { icon: ElementType; tone?: Tone; size?: number }) {
  return (
    <span className="bento-icon !h-9 !w-9 !rounded-[11px]" style={toneStyle(tone)}>
      <Icon size={size} />
    </span>
  );
}

export function Panel({
  title,
  description,
  icon,
  tone = "sky",
  action,
  children,
  flush = false,
  className,
  bodyClassName,
}: {
  title: string;
  description?: ReactNode;
  icon?: ElementType;
  tone?: Tone;
  action?: ReactNode;
  children: ReactNode;
  /** Tanpa padding isi (untuk tabel penuh lebar). */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("bento-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <IconChip icon={icon} tone={tone} />}
          <div className="min-w-0">
            {/* !text-sm: globals.css punya aturan h2 tanpa layer (24px) yang menimpa utilitas biasa. */}
            <h2 className="truncate font-display !text-sm font-bold !leading-tight text-foreground">{title}</h2>
            {description && <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted-2)]">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={cn(flush ? "" : "p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

// ===================== Status & nilai =====================

const STATUS_TONE = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  rose: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
  amber: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  sky: { dot: "bg-sky-500", text: "text-sky-700 dark:text-sky-300" },
  slate: { dot: "bg-slate-400", text: "text-[var(--text-muted-2)]" },
} as const;

export function StatusDot({ tone, children, className }: { tone: keyof typeof STATUS_TONE; children: ReactNode; className?: string }) {
  const t = STATUS_TONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold", t.text, className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

/** Pil persentase margin: ≥20% hijau, ≥15% biru, selain itu kuning. */
export function TonePill({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const cls =
    value >= 20
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : value >= 15
        ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
        : "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  return (
    <span className={cn("tnum inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-[11px] font-bold", cls)}>
      {value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
      {suffix}
    </span>
  );
}

/** Tombol ikon tanpa border (32px) — tooltip lewat atribut title (GlobalTooltip). */
export function IconAction({
  title,
  onClick,
  children,
  tone = "default",
  disabled,
  className,
}: {
  title: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted-2)] transition",
        "hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40",
        "disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger" ? "hover:text-rose-600 dark:hover:text-rose-300" : "hover:text-[var(--primary)] dark:hover:text-sky-300",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Kartu filter/toolbar ringkas di atas tabel. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bento-card relative z-20 !overflow-visible p-3 sm:p-3.5", className)}>{children}</div>;
}
