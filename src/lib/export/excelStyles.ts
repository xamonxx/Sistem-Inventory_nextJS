/**
 * Helper styling & format bersama untuk semua fitur export Excel (ExcelJS).
 * Dipakai ulang oleh exportAnalyticExcel dan exportInvoiceExcel supaya tampilan
 * konsisten dan tidak ada duplikasi logika.
 */

import type { Worksheet, Borders } from "exceljs";

// ===================== PALET WARNA (ARGB) =====================

export const COLOR = {
  titleBg: "FF1E293B", // slate-800
  titleText: "FFFFFFFF",
  metaText: "FF475569", // slate-600
  headerBg: "FFF1F5F9", // slate-100
  headerText: "FF0F172A", // slate-900
  border: "FFE2E8F0", // slate-200
  green: "FFD1FAE5", // emerald-100
  blue: "FFDBEAFE", // blue-100
  yellow: "FFFEF9C3", // yellow-100
  orange: "FFFFEDD5", // orange-100
  red: "FFFEE2E2", // red-100
  slate: "FFF1F5F9", // slate-100
  totalBg: "FFF8FAFC", // slate-50
};

// ===================== FORMAT ANGKA =====================

export const FMT_RUPIAH = '"Rp"\\ #,##0;[Red]-"Rp"\\ #,##0';
export const FMT_PERCENT = "0.00%";
export const FMT_DATE = "dd/mm/yyyy";
export const FMT_INT = "#,##0";

export const PERCENT_NA = "Tidak tersedia";
export const TEXT_NA = "Tidak tersedia";

// ===================== HELPER VALIDASI / SAFE =====================

export function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function safeText(v: unknown): string {
  if (v === null || v === undefined) return "-";
  const s = String(v).trim();
  return s.length > 0 ? s : "-";
}

/** Persentase aman → pecahan (0..1) untuk FMT_PERCENT, atau null bila pembagi <= 0. */
export function safePercent(numerator: number, denominator: number): number | null {
  const num = safeNumber(numerator);
  const den = safeNumber(denominator);
  if (den <= 0) return null;
  const r = num / den;
  return Number.isFinite(r) ? r : null;
}

export function safeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ===================== HELPER STYLE =====================

export const thinBorder: Partial<Borders> = {
  top: { style: "thin", color: { argb: COLOR.border } },
  left: { style: "thin", color: { argb: COLOR.border } },
  bottom: { style: "thin", color: { argb: COLOR.border } },
  right: { style: "thin", color: { argb: COLOR.border } },
};

export function applyBorder(ws: Worksheet, topRow: number, bottomRow: number, lastCol: number) {
  for (let r = topRow; r <= bottomRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      ws.getCell(r, c).border = thinBorder;
    }
  }
}

export function applyTitleStyle(ws: Worksheet, row: number, lastCol: number, title: string) {
  ws.mergeCells(row, 1, row, lastCol);
  const cell = ws.getCell(row, 1);
  cell.value = title;
  cell.font = { name: "Calibri", size: 16, bold: true, color: { argb: COLOR.titleText } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.titleBg } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(row).height = 26;
}

export function applyHeaderStyle(ws: Worksheet, row: number, lastCol: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= lastCol; c++) {
    const cell = r.getCell(c);
    cell.font = { bold: true, color: { argb: COLOR.headerText }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  }
  r.height = 22;
}

export function applyCurrencyFormat(ws: Worksheet, col: number, fromRow: number, toRow: number) {
  for (let r = fromRow; r <= toRow; r++) ws.getCell(r, col).numFmt = FMT_RUPIAH;
}

export function applyPercentFormat(ws: Worksheet, col: number, fromRow: number, toRow: number) {
  for (let r = fromRow; r <= toRow; r++) {
    const cell = ws.getCell(r, col);
    if (typeof cell.value === "number") cell.numFmt = FMT_PERCENT;
  }
}

export function applyDateFormat(ws: Worksheet, col: number, fromRow: number, toRow: number) {
  for (let r = fromRow; r <= toRow; r++) {
    const cell = ws.getCell(r, col);
    if (cell.value instanceof Date) cell.numFmt = FMT_DATE;
  }
}

/** Auto width sederhana berbasis panjang konten teks tiap kolom. */
export function autoFitColumns(ws: Worksheet, lastCol: number, min = 10, max = 48) {
  for (let c = 1; c <= lastCol; c++) {
    let widest = min;
    ws.getColumn(c).eachCell({ includeEmpty: false }, (cell) => {
      let text = "";
      if (cell.value instanceof Date) text = "00/00/0000";
      else if (typeof cell.value === "number") text = Math.round(cell.value).toLocaleString("id-ID") + "____";
      else if (cell.value != null) text = String(cell.value);
      const longest = text.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
      widest = Math.max(widest, longest + 2);
    });
    ws.getColumn(c).width = Math.min(widest, max);
  }
}

export function fillRow(ws: Worksheet, row: number, fromCol: number, toCol: number, argb: string) {
  for (let c = fromCol; c <= toCol; c++) {
    ws.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  }
}

// ===================== HELPER LAYOUT META =====================

export interface MetaInfo {
  reportName: string;
  period: string;
  exportDate: Date;
  userName: string;
}

/**
 * Tulis blok judul + metadata di atas setiap sheet.
 * Mengembalikan nomor baris pertama yang bebas dipakai (untuk tabel/konten).
 */
export function writeSheetHeader(ws: Worksheet, lastCol: number, meta: MetaInfo): number {
  applyTitleStyle(ws, 1, lastCol, meta.reportName);

  const metaRows: [string, string | Date][] = [
    ["Periode", meta.period],
    ["Tanggal Export", meta.exportDate],
    ["Diekspor oleh", meta.userName],
  ];

  let row = 2;
  for (const [label, val] of metaRows) {
    const labelCell = ws.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10, color: { argb: COLOR.metaText } };
    const valCell = ws.getCell(row, 2);
    valCell.value = val;
    valCell.font = { size: 10, color: { argb: COLOR.metaText } };
    if (val instanceof Date) valCell.numFmt = FMT_DATE;
    row++;
  }
  return row + 1; // satu baris kosong sebagai pemisah
}

/** Tulis baris "Data tidak tersedia" yang merentang seluruh kolom tabel. */
export function writeEmptyNotice(ws: Worksheet, row: number, lastCol: number) {
  ws.mergeCells(row, 1, row, lastCol);
  const cell = ws.getCell(row, 1);
  cell.value = "Data tidak tersedia";
  cell.font = { italic: true, color: { argb: COLOR.metaText } };
  cell.alignment = { horizontal: "center" };
  cell.border = thinBorder;
}
