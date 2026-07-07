/**
 * Export "Analisa Margin Non-Gudang" ke Excel (.xlsx) memakai ExcelJS.
 * Client-side; ExcelJS di-import dinamis. Reuse excelStyles agar tampilan
 * konsisten, rapi, dan mudah dibaca (judul, meta, header berwarna, format
 * Rupiah & persen, border, auto-fit kolom, baris TOTAL).
 *
 * Data 100% dari agregasi halaman (NgAnalisa) — tidak ada angka dikarang.
 */

import type { Workbook, Worksheet } from "exceljs";
import type { NgAnalisa, NgSummary, NgTokoRow, NgProdukRow, NgTrenRow } from "@/lib/ngReports";
import {
  COLOR,
  FMT_RUPIAH,
  FMT_PERCENT,
  FMT_INT,
  type MetaInfo,
  safeNumber,
  safeText,
  applyBorder,
  applyHeaderStyle,
  autoFitColumns,
  writeSheetHeader,
  writeEmptyNotice,
  fillRow,
} from "./excelStyles";

export interface ExportNgPayload {
  userName?: string;
  period?: string;
  analisa: NgAnalisa;
}

/** Persen (mis. 9.09) → pecahan (0.0909) untuk FMT_PERCENT. */
function toFraction(percentValue: number): number {
  return safeNumber(percentValue) / 100;
}

function sectionTitle(ws: Worksheet, row: number, text: string) {
  ws.getCell(row, 1).value = text;
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
}

// ===================== SHEET 1: RINGKASAN =====================

function addRingkasanSheet(wb: Workbook, s: NgSummary, meta: MetaInfo) {
  const ws = wb.addWorksheet("Ringkasan");
  const lastCol = 3;
  let row = writeSheetHeader(ws, lastCol, meta);

  sectionTitle(ws, row, "Ringkasan Analisa Margin");
  row += 1;

  const headerRow = row;
  ["Metrik", "Nilai", "Keterangan"].forEach((h, i) => (ws.getCell(headerRow, i + 1).value = h));
  applyHeaderStyle(ws, headerRow, lastCol);
  row += 1;

  const metrics: { label: string; value: number; fmt: string; note: string; fill?: string }[] = [
    { label: "Total Pembelian (Seluruh Toko)", value: s.totalPembelian, fmt: FMT_RUPIAH, note: "Modal beli dari semua toko sumber", fill: COLOR.blue },
    { label: "Total Omzet (Penjualan)", value: s.totalOmzet, fmt: FMT_RUPIAH, note: "Nilai jual ke konsumen", fill: COLOR.green },
    { label: "Total Profit", value: s.totalProfit, fmt: FMT_RUPIAH, note: "Omzet - Pembelian", fill: COLOR.green },
    { label: "Margin", value: toFraction(s.margin), fmt: FMT_PERCENT, note: "Profit / Omzet", fill: COLOR.yellow },
    { label: "Markup", value: toFraction(s.markup), fmt: FMT_PERCENT, note: "Profit / Pembelian", fill: COLOR.yellow },
    { label: "Jumlah Invoice", value: s.jumlahInvoice, fmt: FMT_INT, note: "Total invoice pada periode" },
    { label: "Total Diterima", value: s.totalDibayar, fmt: FMT_RUPIAH, note: "Pembayaran konsumen masuk" },
    { label: "Sisa Piutang", value: s.totalPiutang, fmt: FMT_RUPIAH, note: "Tagihan belum lunas", fill: COLOR.orange },
  ];
  const firstMetricRow = row;
  for (const m of metrics) {
    ws.getCell(row, 1).value = m.label;
    ws.getCell(row, 1).font = { bold: true };
    const v = ws.getCell(row, 2);
    v.value = m.value;
    v.numFmt = m.fmt;
    v.font = { bold: true };
    ws.getCell(row, 3).value = m.note;
    if (m.fill) fillRow(ws, row, 1, lastCol, m.fill);
    row += 1;
  }
  applyBorder(ws, headerRow, row - 1, lastCol);
  void firstMetricRow;

  // Blok status invoice
  row += 1;
  sectionTitle(ws, row, "Status Invoice");
  row += 1;
  const stHeader = row;
  ["Status", "Jumlah", "Keterangan"].forEach((h, i) => (ws.getCell(stHeader, i + 1).value = h));
  applyHeaderStyle(ws, stHeader, lastCol);
  row += 1;

  const statuses: { label: string; value: number; note: string; fill?: string }[] = [
    { label: "Lunas", value: s.jumlahLunas, note: "Sudah dibayar penuh", fill: COLOR.green },
    { label: "Tempo (Belum Bayar)", value: s.jumlahTempo, note: "Piutang penuh", fill: COLOR.yellow },
    { label: "Sebagian (Partial)", value: s.jumlahPartial, note: "Dibayar sebagian", fill: COLOR.blue },
    { label: "Terlambat", value: s.jumlahTerlambat, note: "Belum lunas & lewat jatuh tempo", fill: COLOR.red },
  ];
  for (const st of statuses) {
    ws.getCell(row, 1).value = st.label;
    ws.getCell(row, 1).font = { bold: true };
    ws.getCell(row, 2).value = st.value;
    ws.getCell(row, 2).numFmt = FMT_INT;
    ws.getCell(row, 3).value = st.note;
    if (st.fill) fillRow(ws, row, 1, lastCol, st.fill);
    row += 1;
  }
  applyBorder(ws, stHeader, row - 1, lastCol);

  autoFitColumns(ws, lastCol, 14, 52);
}

// ===================== SHEET 2: PEMBELIAN PER TOKO =====================

function addPerTokoSheet(wb: Workbook, rows: NgTokoRow[], meta: MetaInfo) {
  const ws = wb.addWorksheet("Pembelian per Toko");
  const lastCol = 7;
  let row = writeSheetHeader(ws, lastCol, meta);

  sectionTitle(ws, row, "Ranking Pembelian per Toko Sumber");
  row += 1;

  const headerRow = row;
  ["Ranking", "Toko Sumber", "Jml Invoice", "Total Qty", "Total Pembelian", "Total Omzet", "Margin"].forEach(
    (h, i) => (ws.getCell(headerRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, headerRow, lastCol);
  row += 1;

  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    let rank = 1;
    let tPembelian = 0;
    let tOmzet = 0;
    let tQty = 0;
    let tInv = 0;
    for (const t of rows) {
      ws.getCell(row, 1).value = rank++;
      ws.getCell(row, 1).alignment = { horizontal: "center" };
      ws.getCell(row, 2).value = safeText(t.namaToko);
      ws.getCell(row, 3).value = t.jumlahInvoice;
      ws.getCell(row, 3).numFmt = FMT_INT;
      ws.getCell(row, 4).value = t.totalQty;
      ws.getCell(row, 4).numFmt = FMT_INT;
      ws.getCell(row, 5).value = safeNumber(t.totalPembelian);
      ws.getCell(row, 5).numFmt = FMT_RUPIAH;
      ws.getCell(row, 6).value = safeNumber(t.totalOmzet);
      ws.getCell(row, 6).numFmt = FMT_RUPIAH;
      ws.getCell(row, 7).value = toFraction(t.margin);
      ws.getCell(row, 7).numFmt = FMT_PERCENT;
      tPembelian += safeNumber(t.totalPembelian);
      tOmzet += safeNumber(t.totalOmzet);
      tQty += t.totalQty;
      tInv += t.jumlahInvoice;
      row += 1;
    }
    // TOTAL
    ws.getCell(row, 2).value = "TOTAL";
    ws.getCell(row, 2).font = { bold: true };
    ws.getCell(row, 3).value = tInv;
    ws.getCell(row, 3).numFmt = FMT_INT;
    ws.getCell(row, 4).value = tQty;
    ws.getCell(row, 4).numFmt = FMT_INT;
    ws.getCell(row, 5).value = tPembelian;
    ws.getCell(row, 5).numFmt = FMT_RUPIAH;
    ws.getCell(row, 6).value = tOmzet;
    ws.getCell(row, 6).numFmt = FMT_RUPIAH;
    for (let c = 1; c <= lastCol; c++) ws.getCell(row, c).font = { bold: true };
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row += 1;
  }
  applyBorder(ws, headerRow, row - 1, lastCol);
  autoFitColumns(ws, lastCol, 10, 44);
}

// ===================== SHEET 3: TOP PRODUK =====================

function addTopProdukSheet(wb: Workbook, rows: NgProdukRow[], meta: MetaInfo) {
  const ws = wb.addWorksheet("Top Produk");
  const lastCol = 7;
  let row = writeSheetHeader(ws, lastCol, meta);

  sectionTitle(ws, row, "Top Produk (berdasarkan Omzet)");
  row += 1;

  const headerRow = row;
  ["Ranking", "Nama Barang", "Qty Terjual", "Pembelian", "Omzet", "Profit", "Margin"].forEach(
    (h, i) => (ws.getCell(headerRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, headerRow, lastCol);
  row += 1;

  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    let rank = 1;
    for (const p of rows) {
      ws.getCell(row, 1).value = rank++;
      ws.getCell(row, 1).alignment = { horizontal: "center" };
      ws.getCell(row, 2).value = safeText(p.nama);
      ws.getCell(row, 3).value = p.qty;
      ws.getCell(row, 3).numFmt = FMT_INT;
      ws.getCell(row, 4).value = safeNumber(p.pembelian);
      ws.getCell(row, 4).numFmt = FMT_RUPIAH;
      ws.getCell(row, 5).value = safeNumber(p.omzet);
      ws.getCell(row, 5).numFmt = FMT_RUPIAH;
      ws.getCell(row, 6).value = safeNumber(p.profit);
      ws.getCell(row, 6).numFmt = FMT_RUPIAH;
      ws.getCell(row, 7).value = toFraction(p.margin);
      ws.getCell(row, 7).numFmt = FMT_PERCENT;
      row += 1;
    }
  }
  applyBorder(ws, headerRow, row - 1, lastCol);
  autoFitColumns(ws, lastCol, 10, 44);
}

// ===================== SHEET 4: TREN BULANAN =====================

function addTrenSheet(wb: Workbook, rows: NgTrenRow[], meta: MetaInfo) {
  const ws = wb.addWorksheet("Tren Bulanan");
  const lastCol = 5;
  let row = writeSheetHeader(ws, lastCol, meta);

  sectionTitle(ws, row, "Tren Pembelian, Omzet & Profit per Bulan");
  row += 1;

  const headerRow = row;
  ["Periode", "Pembelian", "Omzet", "Profit", "Margin"].forEach((h, i) => (ws.getCell(headerRow, i + 1).value = h));
  applyHeaderStyle(ws, headerRow, lastCol);
  row += 1;

  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    let tPembelian = 0;
    let tOmzet = 0;
    let tProfit = 0;
    for (const t of rows) {
      ws.getCell(row, 1).value = safeText(t.periode);
      ws.getCell(row, 2).value = safeNumber(t.pembelian);
      ws.getCell(row, 2).numFmt = FMT_RUPIAH;
      ws.getCell(row, 3).value = safeNumber(t.omzet);
      ws.getCell(row, 3).numFmt = FMT_RUPIAH;
      ws.getCell(row, 4).value = safeNumber(t.profit);
      ws.getCell(row, 4).numFmt = FMT_RUPIAH;
      ws.getCell(row, 5).value = t.omzet > 0 ? t.profit / t.omzet : 0;
      ws.getCell(row, 5).numFmt = FMT_PERCENT;
      tPembelian += safeNumber(t.pembelian);
      tOmzet += safeNumber(t.omzet);
      tProfit += safeNumber(t.profit);
      row += 1;
    }
    ws.getCell(row, 1).value = "TOTAL";
    ws.getCell(row, 1).font = { bold: true };
    ws.getCell(row, 2).value = tPembelian;
    ws.getCell(row, 2).numFmt = FMT_RUPIAH;
    ws.getCell(row, 3).value = tOmzet;
    ws.getCell(row, 3).numFmt = FMT_RUPIAH;
    ws.getCell(row, 4).value = tProfit;
    ws.getCell(row, 4).numFmt = FMT_RUPIAH;
    ws.getCell(row, 5).value = tOmzet > 0 ? tProfit / tOmzet : 0;
    ws.getCell(row, 5).numFmt = FMT_PERCENT;
    for (let c = 1; c <= lastCol; c++) ws.getCell(row, c).font = { bold: true };
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row += 1;
  }
  applyBorder(ws, headerRow, row - 1, lastCol);
  autoFitColumns(ws, lastCol, 12, 40);
}

// ===================== ORCHESTRATOR =====================

function buildFileName(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `Analisa-NonGudang_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}.xlsx`;
}

export async function buildNgWorkbook(payload: ExportNgPayload): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Sistem Inventory ERP";
  wb.created = new Date();

  const meta: MetaInfo = {
    reportName: "Analisa Margin Non-Gudang",
    period: payload.period && payload.period.trim().length > 0 ? payload.period : "Keseluruhan (semua data tercatat)",
    exportDate: new Date(),
    userName: safeText(payload.userName),
  };

  addRingkasanSheet(wb, payload.analisa.summary, meta);
  addPerTokoSheet(wb, payload.analisa.perToko, meta);
  addTopProdukSheet(wb, payload.analisa.topProduk, meta);
  addTrenSheet(wb, payload.analisa.tren, meta);

  return wb;
}

export async function exportNgExcel(payload: ExportNgPayload): Promise<string> {
  const wb = await buildNgWorkbook(payload);
  const fileName = buildFileName();

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

  return fileName;
}
