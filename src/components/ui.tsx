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
    primary:
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)] shadow-sm transition-transform active:scale-[0.98]",
    outline: "border border-border bg-white hover:bg-slate-50 text-foreground shadow-xs active:scale-[0.98]",
    ghost: "hover:bg-slate-150/50 text-slate-700 hover:text-slate-900",
    danger: "bg-[var(--danger)] text-white hover:brightness-105 shadow-sm active:scale-[0.98]",
    success: "bg-[var(--success)] text-white hover:brightness-105 shadow-sm active:scale-[0.98]",
    warning: "bg-[var(--warning)] text-white hover:brightness-105 shadow-sm active:scale-[0.98]",
  };
  const sizes = { 
    sm: "h-9 px-4 text-xs font-medium rounded-[10px]", 
    md: "h-11 px-5 text-sm font-semibold rounded-[12px]" 
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-all duration-150 outline-none select-none whitespace-nowrap",
        "focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
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
          "h-11 w-full rounded-[12px] border border-border bg-white px-4 text-sm outline-none transition-all",
          "focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10",
          "disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400/80",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-[12px] border border-border bg-white px-4 py-2.5 text-sm outline-none transition-all resize-y",
          "focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10",
          "disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400/80",
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
      buttonClasses: "h-11 rounded-[12px]",
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
  if (!hasRounded) buttonWords.push("rounded-[12px]");

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
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
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
    <div ref={containerRef} className={cn("relative inline-block", wrapperClasses)}>
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
          "flex w-full items-center justify-between px-4 text-sm font-medium text-left outline-none transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)] select-none",
          !hasBorder && "border border-border hover:border-slate-300",
          !hasBg && "bg-white hover:bg-slate-50/50",
          "focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10",
          isOpen && "border-[var(--primary)] ring-4 ring-[var(--primary)]/10",
          buttonClasses
        )}
      >
        <span className={cn("truncate", !hasText && "text-slate-800")}>{displayLabel}</span>
        <ChevronDown size={16} className={cn("text-slate-500 transition-transform duration-200 ml-2 flex-shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[9999] mt-2 max-h-60 overflow-y-auto rounded-[12px] border border-border bg-white p-1.5 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] animate-in fade-in duration-100 ease-out">
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
                    "flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-all select-none hover:bg-slate-50 hover:text-slate-900 cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
                    isSelected && "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
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
      className={cn("mb-1.5 block text-xs font-medium text-slate-500", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-[var(--card)] p-6 shadow-[var(--shadow-card)]",
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
  // Pill SaaS premium — solid soft fill, no border (Stripe/Linear style)
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-[#DCFCE7] text-[#166534]",
    red: "bg-[#FEE2E2] text-[#991B1B]",
    amber: "bg-[#FEF3C7] text-[#92400E]",
    blue: "bg-[#DBEAFE] text-[#1E40AF]",
    indigo: "bg-[#E0E7FF] text-[#3730A3]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold leading-none whitespace-nowrap",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-[var(--card)] shadow-[var(--shadow-card)]", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10">
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
        "h-[52px] border-b border-border bg-[#f4f8f6] px-5 text-left text-xs font-semibold uppercase tracking-[0.05em] text-[#60736f] font-sans",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "h-16 border-b border-slate-100 px-5 align-middle text-sm font-medium text-slate-900 font-sans",
        className
      )}
      {...props}
    />
  );
}
