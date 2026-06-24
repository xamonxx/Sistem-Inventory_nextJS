"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const icons = {
    primary: <Info size={24} className="text-blue-500" />,
    danger: <AlertTriangle size={24} className="text-red-500" />,
    success: <CheckCircle size={24} className="text-emerald-500" />,
    warning: <AlertTriangle size={24} className="text-amber-500" />,
  };

  const buttonVariants = {
    primary: "primary",
    danger: "danger",
    success: "success",
    warning: "warning",
  } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 opacity-100"
        onClick={onClose}
      />

      {/* Dialog Box */}
      <div className="relative w-full max-w-md transform rounded-[20px] bg-white p-6 shadow-[var(--shadow-modal)] border border-border transition-all duration-300 scale-100 anim-rise">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Dialog Header */}
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-border">
            {icons[variant]}
          </div>
          <div className="space-y-1.5 pr-6">
            <h4 className="text-base font-bold text-slate-900 leading-tight">{title}</h4>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="mt-6 flex justify-end gap-2.5">
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
    </div>
  );
}
