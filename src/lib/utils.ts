import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format angka ke Rupiah, mis. 1500000 -> "Rp1.500.000". Menerima number, string, atau Prisma Decimal. */
export function formatRupiah(value: number | string | { toString(): string } | null | undefined): string {
  const n = value == null ? 0 : Number(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format Rupiah ringkas untuk KPI / card. Mis. 241318673500 -> "Rp 241,3 M", 1500000 -> "Rp 1,5 Jt" */
export function formatRupiahCompact(value: number | string | { toString(): string } | null | undefined): string {
  const n = value == null ? 0 : Number(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs >= 1_000_000_000_000) {
    // Triliun
    const val = abs / 1_000_000_000_000;
    return `${sign}Rp ${val.toFixed(val >= 100 ? 0 : 1).replace(".", ",")} T`;
  }
  if (abs >= 1_000_000_000) {
    // Miliar
    const val = abs / 1_000_000_000;
    return `${sign}Rp ${val.toFixed(val >= 100 ? 0 : 1).replace(".", ",")} M`;
  }
  if (abs >= 1_000_000) {
    // Juta
    const val = abs / 1_000_000;
    return `${sign}Rp ${val.toFixed(val >= 100 ? 0 : 1).replace(".", ",")} Jt`;
  }
  if (abs >= 1_000) {
    // Ribu
    const val = abs / 1_000;
    return `${sign}Rp ${val.toFixed(val >= 100 ? 0 : 1).replace(".", ",")} Rb`;
  }
  return formatRupiah(n);
}

/** Format tanggal Indonesia, mis. 23 Jun 2026 */
export function formatTanggal(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Konversi serial Excel (mis. 46196) menjadi Date */
export function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}
