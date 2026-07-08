"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModernDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "danger" | "success" | "warning";
}

export function ModernDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  variant = "primary",
}: ModernDialogProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  const icons = {
    primary: <Info size={24} className="text-blue-500" />,
    danger: <AlertTriangle size={24} className="text-red-500" />,
    success: <CheckCircle size={24} className="text-primary-500" />,
    warning: <AlertTriangle size={24} className="text-amber-500" />,
  };

  const buttonVariants = {
    primary: "primary",
    danger: "danger",
    success: "success",
    warning: "warning",
  } as const;

  return createPortal(
    // zIndex sedikit di atas Drawer (2147483000) supaya dialog konfirmasi yang
    // dibuka dari dalam drawer tidak tertutup panel drawer.
    <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ zIndex: 2147483002 }}>
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 opacity-100"
        onClick={onClose}
      />

      {/* Dialog Box */}
      <div className="relative max-h-[90dvh] w-full max-w-md scale-100 transform overflow-y-auto rounded-t-[20px] border border-border bg-card p-5 shadow-[var(--shadow-modal)] transition-[opacity,transform] duration-300 anim-rise sm:rounded-[20px] sm:p-6 dark:bg-card">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Dialog Header */}
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
            {icons[variant]}
          </div>
          <div className="space-y-1.5 pr-6">
            <h4 className="text-base font-bold text-foreground dark:text-slate-100 leading-tight">{title}</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={buttonVariants[variant]}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
