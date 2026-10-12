"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Phone, X } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Normalisasi nomor WhatsApp Indonesia ke format internasional tanpa "+".
 * "0812..." / "812..." / "+62 812-..." → "62812...". Null bila tidak valid.
 */
export function normalizeWhatsAppNumber(raw: string): string | null {
  let no = raw.replace(/[^0-9]/g, "");
  if (no.startsWith("0")) no = "62" + no.slice(1);
  else if (no.startsWith("8")) no = "62" + no;
  return /^62\d{8,13}$/.test(no) ? no : null;
}

interface WhatsAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Dipanggil dengan nomor yang sudah dinormalisasi (mis. "628123456789"). */
  onSubmit: (number: string) => void;
  title?: string;
  description?: string;
  defaultValue?: string;
}

/** Pengganti `window.prompt` untuk meminta nomor WhatsApp pelanggan. */
export function WhatsAppDialog({
  isOpen,
  onClose,
  onSubmit,
  title = "Kirim via WhatsApp",
  description = "Masukkan nomor WhatsApp pelanggan. Pesan akan dibuka di WhatsApp untuk Anda kirim.",
  defaultValue = "",
}: WhatsAppDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Reset isian setiap kali dialog dibuka.
  useEffect(() => {
    if (!isOpen) return;
    setValue(defaultValue);
    setError("");
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;
    // Fase capture + stopPropagation: Escape hanya menutup dialog ini,
    // bukan Drawer/modal di belakangnya yang juga mendengarkan keydown.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const normalized = normalizeWhatsAppNumber(value);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) {
      setError("Nomor tidak valid. Contoh: 08123456789");
      inputRef.current?.focus();
      return;
    }
    onSubmit(normalized);
    onClose();
  }

  return createPortal(
    // Sama dengan ModernDialog: di atas Drawer/modal nota.
    <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ zIndex: 2147483002 }}>
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-xs" onClick={onClose} />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-dialog-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-[20px] border border-border bg-card shadow-[var(--shadow-modal)] anim-rise sm:rounded-[20px]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/12 to-transparent" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={18} />
        </button>

        <div className="relative p-5 sm:p-6">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
              <MessageCircle size={22} strokeWidth={2.2} />
            </div>
            <div className="space-y-1 pr-6">
              <h4 id="wa-dialog-title" className="text-base font-bold leading-tight text-foreground">
                {title}
              </h4>
              <p className="text-sm leading-relaxed text-[var(--text-muted-2)]">{description}</p>
            </div>
          </div>

          <label htmlFor="wa-number" className="mt-5 block text-xs font-bold uppercase tracking-wider text-[var(--text-soft)]">
            Nomor WhatsApp
          </label>
          <div
            className={`mt-2 flex h-12 items-center overflow-hidden rounded-xl border bg-white/86 transition-[border-color,box-shadow] focus-within:ring-4 dark:bg-slate-950/45 ${
              error
                ? "border-rose-500 focus-within:ring-rose-500/15"
                : "border-border focus-within:border-emerald-500 focus-within:ring-emerald-500/15"
            }`}
          >
            <span className="flex h-full items-center border-r border-border bg-[var(--surface-2)]/70 px-3.5 text-[var(--text-soft)]">
              <Phone size={15} />
            </span>
            <input
              ref={inputRef}
              id="wa-number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08123456789"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError("");
              }}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold tracking-wide text-foreground outline-none placeholder:font-medium placeholder:text-[var(--text-muted-2)]"
            />
          </div>
          <p className={`mt-2 min-h-4 text-xs ${error ? "font-semibold text-rose-600 dark:text-rose-400" : "text-[var(--text-muted-2)]"}`}>
            {error || (normalized ? `Akan dikirim ke +${normalized}` : "Format 08… atau 62… diterima.")}
          </p>

          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="success" disabled={!value.trim()}>
              <MessageCircle size={16} /> Buka WhatsApp
            </Button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}
