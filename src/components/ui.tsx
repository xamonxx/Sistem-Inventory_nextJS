"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger" | "success" | "warning";
  size?: "sm" | "md";
}) {
  const variants = {
    primary: "btn-liquid-primary",
    outline: "btn-liquid-outline",
    ghost: "border border-transparent text-[var(--text-soft)] hover:border-sky-200/80 hover:bg-sky-50/70 hover:text-foreground dark:hover:border-sky-300/18 dark:hover:bg-sky-400/10 dark:hover:text-white",
    danger: "btn-liquid-danger",
    success: "btn-liquid-success",
    warning: "btn-liquid-warning",
  };
  const sizes = {
    sm: "h-11 min-h-11 px-4 text-xs font-bold rounded-lg sm:h-9 sm:min-h-9",
    md: "h-11 px-5 text-sm font-bold rounded-lg",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 outline-none select-none whitespace-nowrap",
        "transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 active:scale-[0.98]",
        "focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-lg border border-border bg-white/86 px-4 text-sm font-semibold text-foreground outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition-[background-color,border-color,color,box-shadow]",
          "focus:border-[var(--primary)] focus:bg-white focus:ring-4 focus:ring-[var(--primary)]/12 dark:bg-slate-950/45 dark:focus:bg-slate-950/70",
          "disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted-2)] placeholder:text-[var(--text-muted-2)]",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

function normalizeCurrencyInput(value: string | number | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return String(Number(digits));
}

function formatCurrencyDisplay(value: string | number | null | undefined): string {
  const normalized = normalizeCurrencyInput(value);
  return normalized ? Number(normalized).toLocaleString("id-ID") : "";
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string | number | null;
  defaultValue?: string | number | null;
  onValueChange?: (value: string) => void;
}>(({ className, name, value, defaultValue, onValueChange, max, ...props }, ref) => {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(() => normalizeCurrencyInput(defaultValue));
  const rawValue = isControlled ? normalizeCurrencyInput(value) : internalValue;

  function commit(nextValue: string) {
    let next = normalizeCurrencyInput(nextValue);
    const maxNumber = max == null ? null : Number(max);
    if (next && Number.isFinite(maxNumber) && maxNumber !== null && Number(next) > maxNumber) {
      next = String(Math.trunc(maxNumber));
    }
    if (!isControlled) setInternalValue(next);
    onValueChange?.(next);
  }

  return (
    <div className="relative">
      {name ? <input type="hidden" name={name} value={rawValue} /> : null}
      <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm font-extrabold text-[var(--text-soft)]">
        Rp
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={formatCurrencyDisplay(rawValue)}
        onChange={(e) => commit(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "h-11 w-full rounded-lg border border-border bg-white/86 px-4 pl-12 text-sm font-semibold text-foreground outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition-[background-color,border-color,color,box-shadow]",
          "focus:border-[var(--primary)] focus:bg-white focus:ring-4 focus:ring-[var(--primary)]/12 dark:bg-slate-950/45 dark:focus:bg-slate-950/70",
          "disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted-2)] placeholder:text-[var(--text-muted-2)]",
          className
        )}
        {...props}
      />
    </div>
  );
});
CurrencyInput.displayName = "CurrencyInput";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-border bg-white/86 px-4 py-2.5 text-sm font-semibold text-foreground outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition-[background-color,border-color,color,box-shadow] resize-y",
          "focus:border-[var(--primary)] focus:bg-white focus:ring-4 focus:ring-[var(--primary)]/12 dark:bg-slate-950/45 dark:focus:bg-slate-950/70",
          "disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted-2)] placeholder:text-[var(--text-muted-2)]",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

/**
 * Indikator batas karakter (mis. 12/60). Berubah kuning saat mendekati batas
 * (>=90%) dan merah saat batas tercapai sebagai peringatan ke pengguna.
 */
export function CharCounter({
  value,
  max,
  className,
}: {
  value: string | null | undefined;
  max: number;
  className?: string;
}) {
  const len = (value ?? "").length;
  const ratio = max > 0 ? len / max : 0;
  const tone =
    len >= max ? "text-rose-500" : ratio >= 0.9 ? "text-amber-500" : "text-slate-400";
  return (
    <span
      aria-live="polite"
      className={cn("text-[10px] font-semibold tabular-nums select-none", tone, className)}
    >
      {len}/{max}
    </span>
  );
}

/**
 * Label + counter dalam satu baris. Memudahkan pasang indikator batas karakter
 * di atas input secara konsisten.
 */
export function LabelWithCounter({
  children,
  value,
  max,
  className,
}: {
  children: React.ReactNode;
  value: string | null | undefined;
  max: number;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className={cn("mb-0", className)}>{children}</Label>
      <CharCounter value={value} max={max} />
    </div>
  );
}

// Helper to extract plain text string from React node
function getLabelFromNode(node: React.ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getLabelFromNode).join("");
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<any>;
    return getLabelFromNode(el.props.children);
  }
  return "";
}

function splitClasses(className?: string) {
  if (!className) {
    return {
      wrapperClasses: "w-full",
      buttonClasses: "h-11 rounded-md",
    };
  }

  const words = className.split(/\s+/).filter(Boolean);
  const wrapperWords: string[] = [];
  const buttonWords: string[] = [];

  let hasHeight = false;
  let hasRounded = false;

  words.forEach((word) => {
    if (
      word.startsWith("w-") ||
      word.startsWith("flex-") ||
      word.startsWith("grid-") ||
      word.startsWith("col-") ||
      word.startsWith("row-") ||
      word.startsWith("m-") ||
      word.startsWith("mx-") ||
      word.startsWith("my-") ||
      word.startsWith("mt-") ||
      word.startsWith("mr-") ||
      word.startsWith("mb-") ||
      word.startsWith("ml-") ||
      word === "flex" ||
      word === "grid" ||
      word === "grow" ||
      word === "shrink"
    ) {
      wrapperWords.push(word);
    } else {
      buttonWords.push(word);
      if (word.startsWith("h-")) hasHeight = true;
      if (word.startsWith("rounded-")) hasRounded = true;
    }
  });

  if (!wrapperWords.some(w => w.startsWith("w-") || w === "flex-1" || w === "grow")) {
    wrapperWords.push("w-full");
  }

  if (!hasHeight) buttonWords.push("h-11");
  if (!hasRounded) buttonWords.push("rounded-md");

  return {
    wrapperClasses: wrapperWords.join(" "),
    buttonClasses: buttonWords.join(" "),
  };
}

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  hideChevron,
  displayValue,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  hideChevron?: boolean;
  displayValue?: React.ReactNode;
}) {
  const options = React.useMemo(() => {
    return React.Children.toArray(children)
      .filter((child): child is React.ReactElement => React.isValidElement(child) && child.type === "option")
      .map((child) => {
        const el = child as React.ReactElement<any>;
        return {
          value: el.props.value !== undefined ? String(el.props.value) : "",
          label: getLabelFromNode(el.props.children),
          disabled: !!el.props.disabled,
        };
      });
  }, [children]);

  const [internalValue, setInternalValue] = React.useState<string>(() => {
    if (value !== undefined) return String(value);
    if (defaultValue !== undefined) return String(defaultValue);
    return options[0]?.value || "";
  });

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(String(value));
    }
  }, [value]);

  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const hiddenSelectRef = React.useRef<HTMLSelectElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (val: string) => {
    setInternalValue(val);
    setIsOpen(false);

    if (onChange && hiddenSelectRef.current) {
      hiddenSelectRef.current.value = val;
      const event = new Event("change", { bubbles: true });
      Object.defineProperty(event, "target", {
        writable: true,
        value: hiddenSelectRef.current,
      });
      onChange(event as unknown as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  const selectedOption = options.find((opt) => opt.value === internalValue);
  const displayLabel = selectedOption ? selectedOption.label : (options[0]?.label || "Pilih...");

  const { wrapperClasses, buttonClasses } = splitClasses(className);

  const hasBg = buttonClasses.split(/\s+/).some((w) => w.startsWith("bg-"));
  const hasBorder = buttonClasses.split(/\s+/).some((w) => w.startsWith("border-"));
  const hasText = buttonClasses.split(/\s+/).some((w) => w.startsWith("text-"));

  return (
    <div ref={containerRef} className={cn("relative inline-block", isOpen ? "z-[45]" : "z-0", wrapperClasses)}>
      <select
        ref={hiddenSelectRef}
        name={name}
        required={required}
        value={internalValue}
        onChange={(e) => {
          setInternalValue(e.target.value);
          if (onChange) onChange(e);
        }}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center px-4 text-sm font-bold text-left outline-none cursor-pointer select-none",
          "transition-[background-color,border-color,color,box-shadow,transform] shadow-[0_12px_28px_-24px_rgba(8,47,73,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl",
          hideChevron ? "justify-center" : "justify-between",
          !hasBorder && "border border-slate-200/90 hover:border-sky-300/90 dark:border-sky-300/18 dark:hover:border-sky-300/34",
          !hasBg && "bg-white/86 hover:bg-sky-50/88 dark:bg-slate-900/72 dark:hover:bg-slate-900/90",
          "focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/14 active:scale-[0.99]",
          isOpen && "border-[var(--primary)] ring-4 ring-[var(--primary)]/12",
          buttonClasses
        )}
      >
        <span className={cn("truncate", !hasText && "text-foreground")}>{displayValue ?? displayLabel}</span>
        {!hideChevron && (
          <ChevronDown size={16} className={cn("text-[var(--text-muted-2)] transition-transform duration-200 ml-2 flex-shrink-0", isOpen && "rotate-180")} />
        )}
      </button>

      {isOpen && (
          <div className="absolute left-0 z-[46] mt-2 max-h-60 w-max min-w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-slate-200/90 bg-white/96 p-1.5 shadow-[0_22px_55px_-24px_rgba(15,23,42,0.24)] backdrop-blur-2xl animate-in fade-in duration-100 ease-out dark:border-sky-300/18 dark:bg-slate-900/95">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 text-center">Tidak ada pilihan</div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === internalValue;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  disabled={opt.disabled}
                  className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-bold text-[var(--text-soft)] transition-[background-color,color] select-none hover:bg-sky-50/80 hover:text-foreground cursor-pointer disabled:opacity-50 disabled:pointer-events-none dark:hover:bg-sky-400/10 dark:hover:text-white",
                    isSelected && "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15 hover:text-[var(--primary)] dark:text-sky-200"
                  )}
                >
                  <span className="whitespace-nowrap pr-3">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-[var(--primary)] flex-shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium text-[var(--text-muted-2)]", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white/86 p-6 shadow-[var(--shadow-card)] backdrop-blur-xl dark:bg-[var(--card)]",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "slate",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "slate" | "green" | "red" | "amber" | "blue" | "indigo";
}) {
  // Soft status pill for dense dashboard rows.
  const tones = {
    slate: "border-slate-300/70 bg-slate-100/80 text-slate-700 dark:border-slate-600/35 dark:bg-slate-800/55 dark:text-slate-300",
    green: "border-emerald-300/70 bg-emerald-50/90 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/12 dark:text-emerald-300",
    red: "border-rose-300/70 bg-rose-50/90 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/12 dark:text-rose-300",
    amber: "border-amber-300/70 bg-amber-50/90 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/12 dark:text-amber-300",
    blue: "border-sky-300/70 bg-sky-50/90 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/12 dark:text-sky-300",
    indigo: "border-indigo-300/70 bg-indigo-50/90 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/12 dark:text-indigo-300",
  };
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold leading-none whitespace-nowrap",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function Table({
  children,
  className,
  tableClassName,
  variant = "card",
}: {
  children: React.ReactNode;
  className?: string;
  tableClassName?: string;
  variant?: "card" | "plain";
}) {
  const wrapperClass =
    variant === "plain"
      ? "max-w-full min-w-0 overflow-hidden"
      : [
          "max-w-full min-w-0 overflow-hidden rounded-xl border border-sky-200/70 bg-white/82",
          "shadow-[0_18px_55px_-42px_rgba(8,47,73,0.52)] backdrop-blur-xl",
          "dark:border-sky-300/15 dark:bg-slate-950/52 dark:shadow-[0_22px_70px_-42px_rgba(0,0,0,0.75)]",
        ].join(" ");

  return (
    <div className={cn(wrapperClass, className)}>
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <table
          className={cn(
            "w-full min-w-full border-collapse text-[13px] md:text-sm",
            "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10",
            "[&_tbody_tr]:transition-[background-color] [&_tbody_tr]:duration-150",
            "[&_tbody_tr:hover]:bg-sky-50/75 dark:[&_tbody_tr:hover]:bg-cyan-400/[0.06]",
            "[&_tbody_tr[data-selected=true]]:bg-sky-100/70 dark:[&_tbody_tr[data-selected=true]]:bg-cyan-400/[0.1]",
            "[&_tbody_tr:last-child_td]:border-b-0",
            tableClassName
          )}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        [
          "h-12 border-b border-slate-300/80 bg-slate-100/90 px-5 py-3 text-left font-sans",
          "text-[11px] font-black uppercase tracking-[0.08em] text-slate-600",
          "dark:border-slate-700/55 dark:bg-slate-800/72 dark:text-slate-300",
        ].join(" "),
        className
      )}
      scope={props.scope ?? "col"}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        [
          "h-[60px] border-b border-slate-200/85 px-5 py-3 align-middle font-sans",
          "text-[13px] font-medium text-slate-800 dark:border-slate-800/70 dark:text-slate-200",
        ].join(" "),
        className
      )}
      {...props}
    />
  );
}

export function TableActionButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-slate-300/80 bg-white/70 text-slate-600",
        "shadow-[0_10px_24px_-20px_rgba(8,47,73,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-cyan-400/50 hover:bg-cyan-50/90 hover:text-cyan-700 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45",
        "dark:border-slate-600/40 dark:bg-slate-900/42 dark:text-slate-300 dark:hover:border-cyan-300/45 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200",
        className
      )}
      {...props}
    />
  );
}
