import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
}) {
  const variants = {
    primary:
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)] shadow-[0_1px_0_rgba(0,0,0,0.15)]",
    outline: "border border-[var(--line-strong)] bg-white hover:bg-[var(--paper-2)] text-foreground",
    ghost: "hover:bg-[var(--paper-2)] text-foreground",
    danger: "bg-[var(--danger)] text-white hover:brightness-110",
    success: "bg-[var(--success)] text-white hover:brightness-110",
  };
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[4px] font-semibold transition-colors duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 disabled:opacity-50 disabled:pointer-events-none",
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
          "h-10 w-full rounded-[4px] border border-[var(--line-strong)] bg-white px-3 text-sm outline-none transition",
          "focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15",
          "disabled:bg-[var(--paper-2)] disabled:text-muted placeholder:text-muted/70",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-[4px] border border-[var(--line-strong)] bg-white px-3 text-sm outline-none transition",
        "focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[6px] border border-border bg-card p-5 shadow-[var(--shadow-card)]",
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
  tone?: "slate" | "green" | "red" | "amber" | "blue";
}) {
  const tones = {
    slate: "bg-[var(--paper-2)] text-slate-700 border-[var(--line-strong)]",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    red: "bg-red-50 text-red-800 border-red-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    blue: "bg-[#eaf1f4] text-[var(--steel)] border-[#cdddE3]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[6px] border border-border bg-card shadow-[var(--shadow-card)]", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border bg-[var(--paper-2)]/60 px-3 py-2.5 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border/70 px-3 py-2.5", className)} {...props} />;
}
