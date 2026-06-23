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
