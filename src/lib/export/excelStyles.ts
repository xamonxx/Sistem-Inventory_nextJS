/**
 * Helper styling & format bersama untuk semua fitur export Excel (ExcelJS).
 * Dipakai ulang oleh exportAnalyticExcel, exportInvoiceExcel, dan exportNgExcel
 * supaya tampilan konsisten dan tidak ada duplikasi logika.
 *
 * Konvensi tampilan:
 * - Blok judul (nama laporan + perusahaan) dan metadata di atas setiap sheet.
 * - Header tabel gelap dengan teks putih, baris data zebra, baris TOTAL tebal
 *   dengan garis atas tegas.
 * - Gridline Excel disembunyikan; siap cetak A4 (fit lebar, header diulang,
 *   nomor halaman) lewat `finalizeWorkbook`.
 */

import type { Workbook, Worksheet, Borders } from "exceljs";

// ===================== PALET WARNA (ARGB) =====================

export const COLOR = {
  titleBg: "FF0F2A44", // navy brand
  titleText: "FFFFFFFF",
  subtitleText: "FF94A3B8", // slate-400
  metaText: "FF475569", // slate-600
  metaLabel: "FF0F172A", // slate-900
  sectionText: "FF0F2A44",
  headerBg: "FF1E3A5F", // navy-700
  headerText: "FFFFFFFF",
  border: "FFD9E2EC",
  borderStrong: "FF1E3A5F",
  zebra: "FFF6F9FC",
  green: "FFDCFCE7", // green-100
  blue: "FFDBEAFE", // blue-100
  yellow: "FFFEF9C3", // yellow-100
  orange: "FFFFEDD5", // orange-100
  red: "FFFEE2E2", // red-100
  slate: "FFF1F5F9", // slate-100
  totalBg: "FFE0F2FE", // sky-100
};

const COMPANY_LINE = "PUTRA CORPORATION · Sistem Inventory & Kasir";

// ===================== FORMAT ANGKA =====================

export const FMT_RUPIAH = '"Rp"\\ #,##0;[Red]-"Rp"\\ #,##0';
export const FMT_PERCENT = "0.00%";
export const FMT_DATE = "dd/mm/yyyy";
export const FMT_DATETIME = "dd/mm/yyyy hh:mm";
export const FMT_INT = "#,##0";

export const PERCENT_NA = "Tidak tersedia";
export const TEXT_NA = "Tidak tersedia";

/** Jatuh tempo standar aplikasi (invoice + 30 hari), dipakai semua export. */
export const DUE_DAYS = 30;
export const MS_PER_DAY = 86_400_000;

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

// ===================== STATE PER SHEET =====================

/** Baris pertama konten (setelah blok judul) per sheet, agar auto-fit mengabaikan judul. */
const contentStartRow = new WeakMap<Worksheet, number>();
/** Nama laporan per sheet, untuk footer cetak. */
const sheetReportName = new WeakMap<Worksheet, string>();
/** Baris header tabel utama per sheet; diulang di setiap halaman cetak. */
const printHeaderRow = new WeakMap<Worksheet, number>();

/**
 * Tandai header tabel utama sheet. Hanya untuk cetak (diulang tiap halaman);
 * sengaja tidak memakai freeze pane agar tampilan di Excel tidak terkunci.
 */
export function setPrintHeaderRow(ws: Worksheet, row: number) {
  printHeaderRow.set(ws, row);
}

/** Date yang sudah digeser ke waktu lokal (finalisasi idempoten). */
const localShifted = new WeakSet<Date>();
/** Baris judul bagian / pemberitahuan merge yang diabaikan saat auto-fit. */
const autoFitSkipRows = new WeakMap<Worksheet, Set<number>>();

function skipAutoFit(ws: Worksheet, row: number) {
  const set = autoFitSkipRows.get(ws) ?? new Set<number>();
  set.add(row);
  autoFitSkipRows.set(ws, set);
}

// ===================== HELPER STYLE =====================

export const thinBorder: Partial<Borders> = {
  top: { style: "thin", color: { argb: COLOR.border } },
  left: { style: "thin", color: { argb: COLOR.border } },
  bottom: { style: "thin", color: { argb: COLOR.border } },
  right: { style: "thin", color: { argb: COLOR.border } },
};

function fillArgb(ws: Worksheet, r: number, c: number): string | undefined {
  const fill = ws.getCell(r, c).fill;
  if (fill && fill.type === "pattern" && fill.pattern === "solid") {
    return (fill.fgColor as { argb?: string } | undefined)?.argb;
  }
  return undefined;
}

/**
 * Rapikan satu blok tabel: border tipis, zebra pada baris data yang belum
 * berwarna, rata tengah vertikal, dan penegasan baris TOTAL (baris yang diisi
 * `COLOR.totalBg`): huruf tebal + garis atas tegas.
 */
export function applyBorder(ws: Worksheet, topRow: number, bottomRow: number, lastCol: number) {
  for (let r = topRow; r <= bottomRow; r++) {
    const isTotal = fillArgb(ws, r, 1) === COLOR.totalBg || fillArgb(ws, r, lastCol) === COLOR.totalBg;
    const isHeader = fillArgb(ws, r, 1) === COLOR.headerBg;
    const zebra = !isHeader && !isTotal && (r - topRow) % 2 === 0;

    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      cell.border = isTotal
        ? { ...thinBorder, top: { style: "medium", color: { argb: COLOR.borderStrong } } }
        : thinBorder;
      if (zebra && !fillArgb(ws, r, c)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.zebra } };
      }
      if (isTotal) cell.font = { ...(cell.font ?? {}), bold: true };
      if (!isHeader) {
        // Placeholder kosong ("-") ditaruh di tengah agar kolom angka tetap rapi.
        const placeholder = cell.value === "-" ? { horizontal: "center" as const } : {};
        cell.alignment = { vertical: "middle", ...(cell.alignment ?? {}), ...placeholder };
      }
    }
    if (!isHeader) ws.getRow(r).height = isTotal ? 22 : 20;
  }
}

export function applyTitleStyle(ws: Worksheet, row: number, lastCol: number, title: string) {
  ws.mergeCells(row, 1, row, lastCol);
  const cell = ws.getCell(row, 1);
  cell.value = title;
  cell.font = { name: "Calibri", size: 16, bold: true, color: { argb: COLOR.titleText } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.titleBg } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 30;
}

export function applyHeaderStyle(ws: Worksheet, row: number, lastCol: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= lastCol; c++) {
    const cell = r.getCell(c);
    cell.font = { bold: true, color: { argb: COLOR.headerText }, size: 10.5 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  }
  r.height = 30;
}

/** Judul bagian di dalam sheet (mis. "Rincian per Status"). */
export function writeSectionTitle(ws: Worksheet, row: number, text: string, lastCol = 1) {
  skipAutoFit(ws, row);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: true, size: 12, color: { argb: COLOR.sectionText } };
  cell.alignment = { vertical: "bottom" };
  for (let c = 1; c <= lastCol; c++) {
    ws.getCell(row, c).border = { bottom: { style: "medium", color: { argb: COLOR.borderStrong } } };
  }
  ws.getRow(row).height = 22;
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

/**
 * Auto width berbasis panjang konten tiap kolom. Blok judul/metadata diabaikan
 * agar kolom A tidak melebar mengikuti judul yang di-merge.
 */
export function autoFitColumns(ws: Worksheet, lastCol: number, min = 10, max = 48) {
  const fromRow = contentStartRow.get(ws) ?? 1;
  const skip = autoFitSkipRows.get(ws);
  for (let c = 1; c <= lastCol; c++) {
    let widest = min;
    ws.getColumn(c).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber < fromRow || skip?.has(rowNumber)) return;
      let text = "";
      if (cell.value instanceof Date) text = "00/00/0000";
      else if (typeof cell.value === "number") {
        const fmt = cell.numFmt ?? "";
        text = fmt.includes("%") ? "100,00%" : Math.round(cell.value).toLocaleString("id-ID") + (fmt.includes("Rp") ? "__Rp_" : "_");
      } else if (cell.value != null) text = String(cell.value);
      const longest = text.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
      // Header dibungkus (wrapText); sisakan ruang untuk tombol filter di kanan.
      const isHeader = fillArgb(ws, rowNumber, c) === COLOR.headerBg;
      widest = Math.max(widest, isHeader ? Math.min(longest + 6, 24) : longest + 3);
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
  sheetReportName.set(ws, meta.reportName);
  const span = Math.max(lastCol, 2);
  applyTitleStyle(ws, 1, span, `${meta.reportName} — ${ws.name}`);

  ws.mergeCells(2, 1, 2, span);
  const sub = ws.getCell(2, 1);
  sub.value = COMPANY_LINE;
  sub.font = { size: 9.5, italic: true, color: { argb: COLOR.subtitleText } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.titleBg } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;

  const metaRows: [string, string | Date][] = [
    ["Periode / Filter", meta.period],
    ["Tanggal Unduh", meta.exportDate],
    ["Diekspor oleh", meta.userName],
  ];

  let row = 4;
  for (const [label, val] of metaRows) {
    const labelCell = ws.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10, color: { argb: COLOR.metaLabel } };
    if (span > 2) ws.mergeCells(row, 2, row, span);
    const valCell = ws.getCell(row, 2);
    valCell.value = val;
    valCell.font = { size: 10, color: { argb: COLOR.metaText } };
    valCell.alignment = { horizontal: "left" };
    if (val instanceof Date) valCell.numFmt = FMT_DATETIME;
    row++;
  }
  const start = row + 1; // satu baris kosong sebagai pemisah
  contentStartRow.set(ws, start);
  return start;
}

/** Tulis baris "Data tidak tersedia" yang merentang seluruh kolom tabel. */
export function writeEmptyNotice(ws: Worksheet, row: number, lastCol: number) {
  skipAutoFit(ws, row);
  ws.mergeCells(row, 1, row, lastCol);
  const cell = ws.getCell(row, 1);
  cell.value = "Data tidak tersedia";
  cell.font = { italic: true, color: { argb: COLOR.metaText } };
  cell.alignment = { horizontal: "center" };
  cell.border = thinBorder;
}

// ===================== FINALISASI & UNDUH =====================

/**
 * Sentuhan akhir untuk setiap sheet: sembunyikan gridline, pengaturan cetak A4
 * (landscape untuk tabel lebar, muat 1 halaman lebar), header tabel berulang
 * di setiap halaman, dan footer nama laporan + nomor halaman.
 */
export function finalizeWorkbook(wb: Workbook) {
  for (const ws of wb.worksheets) {
    // ExcelJS menulis Date sebagai UTC, sehingga di Excel jam/tanggal bergeser
    // (WIB: transaksi 00:00–06:59 tampil sebagai tanggal kemarin). Geser ke
    // waktu lokal pembuat file agar sama dengan yang tampil di aplikasi.
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value instanceof Date && !localShifted.has(cell.value)) {
          const d = cell.value;
          const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
          localShifted.add(shifted);
          cell.value = shifted;
        }
      });
    });

    // Tanpa freeze pane: judul & header ikut bergulir seperti sheet biasa.
    ws.views = [{ state: "normal", showGridLines: false }];

    const cols = ws.columnCount;
    ws.pageSetup = {
      ...ws.pageSetup,
      paperSize: 9, // A4
      orientation: cols > 6 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    };
    // Ulangi header tabel utama di setiap halaman cetak.
    const headerRow = printHeaderRow.get(ws);
    if (headerRow) ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

    const name = sheetReportName.get(ws) ?? "Laporan";
    ws.headerFooter.oddFooter = `&L&8${name} — ${ws.name}&R&8Halaman &P dari &N`;
  }
}

/** Nama file seragam: `<Prefix>_YYYY-MM-DD_HHmm.xlsx`. */
export function buildExportFileName(prefix: string, date = new Date()): string {
  const d = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const t = `${pad2(date.getHours())}${pad2(date.getMinutes())}`;
  return `${prefix}_${d}_${t}.xlsx`;
}

/** Finalisasi workbook lalu picu unduhan di browser. */
export async function downloadWorkbook(wb: Workbook, fileName: string): Promise<void> {
  finalizeWorkbook(wb);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
