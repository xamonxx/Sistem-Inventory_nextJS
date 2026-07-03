"use client";

import { useState } from "react";
import { Select } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { cn } from "@/lib/utils";

export type PeriodPreset = "all" | "week" | "month" | "year" | "custom";

/** Rentang hasil resolusi filter periode. from/to = "YYYY-MM-DD" ("" = terbuka). */
export interface ResolvedPeriodRange {
  preset: PeriodPreset;
  from: string;
  to: string;
  /** Label ramah untuk metadata export / tampilan. */
  label: string;
}

const PRESET_LABEL: Record<PeriodPreset, string> = {
  all: "Semua Waktu",
  week: "Minggu Ini",
  month: "Bulan Ini",
  year: "Tahun Ini",
  custom: "Rentang Custom",
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtId(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Hitung rentang tanggal (from/to YYYY-MM-DD) untuk sebuah preset.
 * Fungsi murni — mudah diuji. "week" = Senin s/d Minggu pekan berjalan.
 */
export function computePresetRange(preset: PeriodPreset, now = new Date()): { from: string; to: string } {
  if (preset === "week") {
    const day = now.getDay(); // 0 = Minggu
    const diffToMonday = (day + 6) % 7; // jumlah hari mundur ke Senin
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { from: toYmd(monday), to: toYmd(sunday) };
  }
  if (preset === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toYmd(first), to: toYmd(last) };
  }
  if (preset === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  return { from: "", to: "" }; // all / custom (custom diisi manual)
}

function buildLabel(preset: PeriodPreset, from: string, to: string): string {
  if (preset === "all") return "Semua Waktu";
  const range = from || to ? `${fmtId(from) || "…"} – ${fmtId(to) || "…"}` : "";
  return range ? `${PRESET_LABEL[preset]} (${range})` : PRESET_LABEL[preset];
}

interface PeriodFilterProps {
  /** Preset awal (default "all"). */
  defaultPreset?: PeriodPreset;
  /** Tanggal awal/akhir awal untuk mode custom (YYYY-MM-DD). */
  defaultFrom?: string;
  defaultTo?: string;
  /** Dipanggil setiap rentang berubah. */
  onChange: (range: ResolvedPeriodRange) => void;
  align?: "left" | "right";
  className?: string;
}

export function PeriodFilter({
  defaultPreset = "all",
  defaultFrom = "",
  defaultTo = "",
  onChange,
  align = "left",
  className,
}: PeriodFilterProps) {
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState<string>(defaultFrom);
  const [customTo, setCustomTo] = useState<string>(defaultTo);

  function emit(next: PeriodPreset, from: string, to: string) {
    onChange({ preset: next, from, to, label: buildLabel(next, from, to) });
  }

  function handlePresetChange(next: PeriodPreset) {
    setPreset(next);
    if (next === "custom") {
      emit(next, customFrom, customTo);
    } else {
      const r = computePresetRange(next);
      emit(next, r.from, r.to);
    }
  }

  function handleCustomFrom(v: string) {
    setCustomFrom(v);
    emit("custom", v, customTo);
  }
  function handleCustomTo(v: string) {
    setCustomTo(v);
    emit("custom", customFrom, v);
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <Select
          value={preset}
          onChange={(e) => handlePresetChange(e.target.value as PeriodPreset)}
          className="h-10 w-full rounded-xl text-xs font-bold sm:w-40"
          aria-label="Filter periode"
        >
          <option value="all">Semua Waktu</option>
          <option value="week">Minggu Ini</option>
          <option value="month">Bulan Ini</option>
          <option value="year">Tahun Ini</option>
          <option value="custom">Rentang Custom…</option>
        </Select>

        {preset === "custom" && (
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <DatePicker
              value={customFrom}
              onChange={handleCustomFrom}
              placeholder="Tanggal awal"
              align={align}
              className="h-10 w-full rounded-xl sm:w-40"
            />
            <span className="hidden text-xs font-semibold text-slate-400 sm:inline">s/d</span>
            <DatePicker
              value={customTo}
              onChange={handleCustomTo}
              placeholder="Tanggal akhir"
              align={align}
              className="h-10 w-full rounded-xl sm:w-40"
            />
          </div>
        )}
      </div>
    </div>
  );
}
