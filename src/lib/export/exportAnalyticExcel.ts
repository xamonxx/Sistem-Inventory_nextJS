/**
 * Export "Analitik & Laporan ERP" ke Excel (.xlsx) memakai ExcelJS.
 *
 * Modul ini dipakai sisi-klien (browser). ExcelJS di-import secara dinamis
 * supaya tidak membebani bundle awal halaman. Tidak ada CDN, tidak ada data
 * dummy: seluruh angka diturunkan dari data asli halaman (props LaporanClient).
 *
 * Catatan kejujuran data:
 * - Data omset & margin pada halaman bersifat AGREGAT PER BARANG (bukan per
 *   transaksi), jadi sheet Penjualan/Margin tidak punya kolom tanggal/invoice/
 *   pelanggan. Field semacam itu ditandai "Tidak tersedia" — tidak dikarang.
 * - HPP (modal) per barang diturunkan dari: HPP = Omset - Laba Kotor (margin).
 */

import type { Workbook, Cell } from "exceljs";
import type { StokKeluarRow } from "@/lib/reports";
import {
  COLOR,
  FMT_RUPIAH,
  FMT_PERCENT,
  FMT_INT,
  FMT_DATE,
  FMT_DATETIME,
  PERCENT_NA,
  TEXT_NA,
  type MetaInfo,
  safeNumber,
  safeText,
  safePercent,
  safeDate,
  applyBorder,
  applyHeaderStyle,
  autoFitColumns,
  writeSheetHeader,
  writeEmptyNotice,
  setPrintHeaderRow,
  writeSectionTitle,
  fillRow,
  DUE_DAYS,
  MS_PER_DAY,
  buildExportFileName,
  downloadWorkbook,
} from "./excelStyles";

// ===================== TIPE DATA INPUT (sesuai props halaman) =====================

export interface MarginRow {
  kode: string;
  nama: string;
  qtyTerjual: number;
  omset: number;
  margin: number;
}

export interface TerlarisRow {
  kode: string;
  nama: string;
  qtyTerjual: number;
  omset: number;
}

export interface StokRow {
  kode: string;
  nama: string;
  kategori?: string | null;
  /** Mutasi sepanjang waktu: stokAwal + stokMasuk - stokKeluar = stokAkhir. */
  stokAwal?: number;
  stokMasuk?: number;
  stokKeluar?: number;
  stokAkhir: number;
  minStok: number;
  hargaBeli: number;
  hargaJual: number;
  nilaiAset: number;
  status: string;
}

export interface PiutangRow {
  noInvoice: string;
  tanggal: string;
  client: string;
  total: number;
  dibayar: number;
  sisa: number;
  status: string;
}

export interface ExportAnalyticPayload {
  role: string;
  userName?: string;
  /** Label periode aktif (mis. "Bulan Ini (01/07/2026 – 31/07/2026)"). */
  period?: string;
  marginData: MarginRow[];
  terlaris: TerlarisRow[];
  stokData: StokRow[];
  piutangData: PiutangRow[];
  /** Riwayat stok keluar (ledger KELUAR + koreksi minus) dalam periode aktif. */
  stokKeluar?: { rows: StokKeluarRow[]; truncated: boolean };
}

// ===================== KONSTANTA THRESHOLD (mudah diubah) =====================

/** Ambang analisis. Semua dalam bentuk pecahan (0.30 = 30%). */
export const THRESHOLDS = {
  /** Margin keuntungan per item terhadap omset item. */
  margin: { bagus: 0.3, cukup: 0.15 },
  /** Rasio total outstanding piutang terhadap total omset. */
  piutangRatio: { aman: 0.2, pantau: 0.4 },
  /** Rasio total nilai aset persediaan terhadap total omset. */
  asetRatio: { normal: 0.5, tinggi: 0.8 },
};

// ===================== ANALISIS / STATUS =====================

function statusMargin(pct: number | null): { status: string; fill?: string } {
  if (pct === null) return { status: "Tidak tersedia" };
  if (pct <= 0) return { status: "Rugi", fill: COLOR.red };
  if (pct < THRESHOLDS.margin.cukup) return { status: "Tipis", fill: COLOR.yellow };
  if (pct < THRESHOLDS.margin.bagus) return { status: "Cukup", fill: COLOR.blue };
  return { status: "Bagus", fill: COLOR.green };
}

function agingBucket(diffDays: number): { kategori: string; risiko: string; fill: string } {
  if (diffDays > 90) return { kategori: ">90 Hari", risiko: "Risiko Tinggi", fill: COLOR.red };
  if (diffDays > 60) return { kategori: "61-90 Hari", risiko: "Risiko Sedang", fill: COLOR.orange };
  if (diffDays > 30) return { kategori: "31-60 Hari", risiko: "Perlu Dipantau", fill: COLOR.yellow };
  return { kategori: "0-30 Hari", risiko: "Aman", fill: COLOR.green };
}

// ===================== SHEET 1: RINGKASAN =====================

function addRingkasanSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Ringkasan");
  const isGudang = payload.role === "ADMIN_GUDANG";
  const lastCol = 5; // KPI | Nilai | Persentase | Status | Keterangan

  const totalOmset = payload.marginData.reduce((a, r) => a + safeNumber(r.omset), 0);
  const totalMargin = isGudang ? payload.marginData.reduce((a, r) => a + safeNumber(r.margin), 0) : 0;
  const totalPiutang = payload.piutangData
    .filter((p) => p.status !== "LUNAS")
    .reduce((a, p) => a + safeNumber(p.sisa), 0);
  const totalAset = payload.stokData.reduce((a, s) => a + safeNumber(s.nilaiAset), 0);

  const startRow = writeSheetHeader(ws, lastCol, meta);

  // Header tabel
  const headerRow = startRow;
  const headers = ["KPI", "Nilai", "Persentase Acuan", "Status Analisis", "Keterangan"];
  headers.forEach((h, i) => (ws.getCell(headerRow, i + 1).value = h));
  applyHeaderStyle(ws, headerRow, lastCol);

  const pctMargin = safePercent(totalMargin, totalOmset);
  const pctPiutang = safePercent(totalPiutang, totalOmset);
  const pctAset = safePercent(totalAset, totalOmset);

  // Status acuan
  const sMargin = statusMargin(pctMargin);
  const sPiutang =
    pctPiutang === null
      ? { status: "Tidak tersedia", fill: undefined as string | undefined }
      : pctPiutang <= THRESHOLDS.piutangRatio.aman
      ? { status: "Aman", fill: COLOR.green }
      : pctPiutang <= THRESHOLDS.piutangRatio.pantau
      ? { status: "Perlu Dipantau", fill: COLOR.yellow }
      : { status: "Risiko Tinggi", fill: COLOR.red };
  const sAset =
    pctAset === null
      ? { status: "Tidak tersedia", fill: undefined as string | undefined }
      : pctAset <= THRESHOLDS.asetRatio.normal
      ? { status: "Normal", fill: COLOR.green }
      : pctAset <= THRESHOLDS.asetRatio.tinggi
      ? { status: "Tinggi", fill: COLOR.yellow }
      : { status: "Perlu Evaluasi Stok", fill: COLOR.orange };

  type KpiLine = {
    kpi: string;
    value: number | string;
    pct: number | null | "skip";
    status: string;
    fill?: string;
    note: string;
  };

  const lines: KpiLine[] = [
    { kpi: "Total Pendapatan", value: totalOmset, pct: "skip", status: "-", note: "Akumulasi omset penjualan" },
    {
      kpi: "Margin Keuntungan",
      value: isGudang ? totalMargin : TEXT_NA,
      pct: isGudang ? pctMargin : "skip",
      status: isGudang ? sMargin.status : TEXT_NA,
      fill: isGudang ? sMargin.fill : undefined,
      note: "Laba kotor setelah modal (Margin / Omzet)",
    },
    {
      kpi: "Piutang Belum Dibayar",
      value: totalPiutang,
      pct: pctPiutang,
      status: sPiutang.status,
      fill: sPiutang.fill,
      note: "Tagihan belum tertagih (Piutang / Omzet)",
    },
    {
      kpi: "Nilai Aset Persediaan",
      value: isGudang ? totalAset : TEXT_NA,
      pct: isGudang ? pctAset : "skip",
      status: isGudang ? sAset.status : TEXT_NA,
      fill: isGudang ? sAset.fill : undefined,
      note: "Valuasi stok gudang (Aset / Omzet)",
    },
  ];

  let r = headerRow + 1;
  const firstDataRow = r;
  for (const ln of lines) {
    ws.getCell(r, 1).value = ln.kpi;
    ws.getCell(r, 1).font = { bold: true };
    const valCell = ws.getCell(r, 2);
    if (typeof ln.value === "number") {
      valCell.value = ln.value;
      valCell.numFmt = FMT_RUPIAH;
    } else {
      valCell.value = ln.value;
    }
    const pctCell = ws.getCell(r, 3);
    if (ln.pct === "skip") pctCell.value = "-";
    else if (ln.pct === null) pctCell.value = PERCENT_NA;
    else {
      pctCell.value = ln.pct;
      pctCell.numFmt = FMT_PERCENT;
    }
    const statusCell = ws.getCell(r, 4);
    statusCell.value = ln.status;
    statusCell.alignment = { horizontal: "center" };
    if (ln.fill) statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ln.fill } };
    ws.getCell(r, 5).value = ln.note;
    r++;
  }
  const lastDataRow = r - 1;

  applyBorder(ws, headerRow, lastDataRow, lastCol);
  autoFitColumns(ws, lastCol);
  ws.getColumn(5).width = 42;
  setPrintHeaderRow(ws, headerRow);
  void firstDataRow;
}

// ===================== SHEET 2: PENJUALAN =====================

function kontribusiLabel(pct: number | null): { status: string; note: string } {
  if (pct !== null && pct >= 0.2) return { status: "Produk Utama", note: "Kontribusi >= 20% omzet" };
  if (pct !== null && pct >= 0.1) return { status: "Produk Potensial", note: "Kontribusi 10% - 19% omzet" };
  return { status: "Produk Pendukung", note: "Kontribusi < 10% omzet" };
}

function addPenjualanSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Penjualan");
  const lastCol = 8;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const rows = [...payload.marginData].sort((a, b) => safeNumber(b.omset) - safeNumber(a.omset));
  const totalOmset = rows.reduce((a, x) => a + safeNumber(x.omset), 0);
  const totalQty = rows.reduce((a, x) => a + safeNumber(x.qtyTerjual), 0);

  // ---- Tabel utama: omzet per barang (agregat periode) ----
  let row = startRow;
  writeSectionTitle(ws, row, "Omzet per Barang (urut omzet terbesar)", lastCol);
  row += 1;

  const headerRow = row;
  ["No", "Kode Barang", "Nama Barang", "Jumlah Terjual", "Total Penjualan", "Kontribusi Omzet", "Kategori Kontribusi", "Keterangan"].forEach(
    (h, i) => (ws.getCell(headerRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, headerRow, lastCol);

  row = headerRow + 1;
  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    rows.forEach((it, idx) => {
      const omset = safeNumber(it.omset);
      const pct = safePercent(omset, totalOmset);
      const k = kontribusiLabel(pct);
      ws.getCell(row, 1).value = idx + 1;
      ws.getCell(row, 1).alignment = { horizontal: "center" };
      ws.getCell(row, 2).value = safeText(it.kode);
      ws.getCell(row, 3).value = safeText(it.nama);
      ws.getCell(row, 4).value = safeNumber(it.qtyTerjual);
      ws.getCell(row, 4).numFmt = FMT_INT;
      ws.getCell(row, 5).value = omset;
      ws.getCell(row, 5).numFmt = FMT_RUPIAH;
      const pctCell = ws.getCell(row, 6);
      if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      ws.getCell(row, 7).value = k.status;
      ws.getCell(row, 7).alignment = { horizontal: "center" };
      if (k.status === "Produk Utama") fillRow(ws, row, 7, 7, COLOR.green);
      else if (k.status === "Produk Potensial") fillRow(ws, row, 7, 7, COLOR.blue);
      ws.getCell(row, 8).value = k.note;
      row++;
    });
    ws.getCell(row, 3).value = "TOTAL PENJUALAN";
    ws.getCell(row, 4).value = totalQty;
    ws.getCell(row, 4).numFmt = FMT_INT;
    ws.getCell(row, 5).value = totalOmset;
    ws.getCell(row, 5).numFmt = FMT_RUPIAH;
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const mainLastRow = row - 1;
  applyBorder(ws, headerRow, mainLastRow, lastCol);

  // ---- Top 10 barang terlaris (volume) ----
  row += 1;
  writeSectionTitle(ws, row, "Top 10 Barang Terlaris (berdasarkan jumlah)", 7);
  row += 1;

  const topHeaderRow = row;
  ["Ranking", "Kode Barang", "Nama Barang", "Total Jumlah", "Total Omzet", "Kontribusi Omzet", "Keterangan Analisis"].forEach(
    (h, i) => (ws.getCell(topHeaderRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, topHeaderRow, 7);

  row = topHeaderRow + 1;
  const top = [...payload.terlaris].slice(0, 10);
  if (top.length === 0) {
    writeEmptyNotice(ws, row, 7);
    row += 1;
  } else {
    top.forEach((t, i) => {
      const omset = safeNumber(t.omset);
      const pct = safePercent(omset, totalOmset);
      ws.getCell(row, 1).value = i + 1;
      ws.getCell(row, 1).alignment = { horizontal: "center" };
      ws.getCell(row, 2).value = safeText(t.kode);
      ws.getCell(row, 3).value = safeText(t.nama);
      ws.getCell(row, 4).value = safeNumber(t.qtyTerjual);
      ws.getCell(row, 4).numFmt = FMT_INT;
      ws.getCell(row, 5).value = omset;
      ws.getCell(row, 5).numFmt = FMT_RUPIAH;
      const pctCell = ws.getCell(row, 6);
      if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      ws.getCell(row, 7).value = kontribusiLabel(pct).status;
      row++;
    });
  }
  applyBorder(ws, topHeaderRow, row - 1, 7);

  autoFitColumns(ws, lastCol);
  ws.getColumn(1).width = 8;
  setPrintHeaderRow(ws, headerRow);
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: mainLastRow, column: lastCol } };
}

// ===================== SHEET 3: MARGIN =====================

function addMarginSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Margin");
  const isGudang = payload.role === "ADMIN_GUDANG";
  const lastCol = 9;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  if (!isGudang) {
    ws.mergeCells(startRow, 1, startRow, lastCol);
    ws.getCell(startRow, 1).value = "Data margin tidak tersedia untuk peran ini.";
    ws.getCell(startRow, 1).font = { italic: true, color: { argb: COLOR.metaText } };
    autoFitColumns(ws, lastCol);
    return;
  }

  const rows = [...payload.marginData].sort((a, b) => safeNumber(b.omset) - safeNumber(a.omset));

  const headerRow = startRow;
  ["Kode Barang", "Nama Barang", "Jumlah Terjual", "Omzet", "Modal / HPP", "Laba Kotor", "Persentase Margin", "Status Margin", "Keterangan"].forEach(
    (h, i) => (ws.getCell(headerRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, headerRow, lastCol);

  let row = headerRow + 1;
  let totOmset = 0;
  let totHpp = 0;
  let totLaba = 0;
  let cntRugi = 0;
  let cntTipis = 0;
  let cntBagus = 0;
  let sumPct = 0;
  let cntPct = 0;

  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    for (const it of rows) {
      const omset = safeNumber(it.omset);
      const laba = safeNumber(it.margin);
      const hpp = omset - laba; // HPP diturunkan: Omzet - Laba Kotor
      const pct = safePercent(laba, omset);
      const s = statusMargin(pct);

      totOmset += omset;
      totHpp += hpp;
      totLaba += laba;
      if (pct !== null) {
        sumPct += pct;
        cntPct++;
        if (pct <= 0) cntRugi++;
        else if (pct < THRESHOLDS.margin.cukup) cntTipis++;
        else if (pct >= THRESHOLDS.margin.bagus) cntBagus++;
      }

      ws.getCell(row, 1).value = safeText(it.kode);
      ws.getCell(row, 2).value = safeText(it.nama);
      ws.getCell(row, 3).value = safeNumber(it.qtyTerjual);
      ws.getCell(row, 3).numFmt = FMT_INT;
      ws.getCell(row, 4).value = omset;
      ws.getCell(row, 4).numFmt = FMT_RUPIAH;
      ws.getCell(row, 5).value = hpp;
      ws.getCell(row, 5).numFmt = FMT_RUPIAH;
      ws.getCell(row, 6).value = laba;
      ws.getCell(row, 6).numFmt = FMT_RUPIAH;
      const pctCell = ws.getCell(row, 7);
      if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      ws.getCell(row, 8).value = s.status;
      ws.getCell(row, 8).alignment = { horizontal: "center" };
      ws.getCell(row, 9).value =
        s.status === "Bagus"
          ? "Margin >= 30%"
          : s.status === "Cukup"
          ? "Margin 15% - 29%"
          : s.status === "Tipis"
          ? "Margin 1% - 14%"
          : s.status === "Rugi"
          ? "Margin <= 0%"
          : "-";
      if (s.fill) fillRow(ws, row, 8, 8, s.fill);
      row++;
    }
    // baris total
    ws.getCell(row, 2).value = "TOTAL";
    ws.getCell(row, 4).value = totOmset;
    ws.getCell(row, 4).numFmt = FMT_RUPIAH;
    ws.getCell(row, 5).value = totHpp;
    ws.getCell(row, 5).numFmt = FMT_RUPIAH;
    ws.getCell(row, 6).value = totLaba;
    ws.getCell(row, 6).numFmt = FMT_RUPIAH;
    const totPctCell = ws.getCell(row, 7);
    const totPct = safePercent(totLaba, totOmset);
    if (totPct !== null) {
      totPctCell.value = totPct;
      totPctCell.numFmt = FMT_PERCENT;
    }
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  // ---- Ringkasan margin ----
  row += 1;
  writeSectionTitle(ws, row, "Ringkasan Margin", 2);
  row += 1;

  const totalItem = rows.length;
  const avgPct = cntPct > 0 ? sumPct / cntPct : null;
  const summary: [string, number | string, boolean][] = [
    ["Total Omzet", totOmset, true],
    ["Total HPP", totHpp, true],
    ["Total Laba Kotor", totLaba, true],
    ["Rata-rata Margin", avgPct === null ? PERCENT_NA : avgPct, false],
    ["Persentase Item Rugi", safePercent(cntRugi, totalItem) ?? PERCENT_NA, false],
    ["Persentase Item Margin Tipis", safePercent(cntTipis, totalItem) ?? PERCENT_NA, false],
    ["Persentase Item Margin Bagus", safePercent(cntBagus, totalItem) ?? PERCENT_NA, false],
  ];
  const sumStart = row;
  for (const [label, val, isCurrency] of summary) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { bold: true };
    const cell = ws.getCell(row, 2);
    cell.value = val;
    if (typeof val === "number") {
      if (isCurrency) cell.numFmt = FMT_RUPIAH;
      else cell.numFmt = FMT_PERCENT;
    }
    row++;
  }
  applyBorder(ws, sumStart, row - 1, 2);

  autoFitColumns(ws, lastCol);
  ws.getColumn(9).width = 22;
  setPrintHeaderRow(ws, headerRow);
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== SHEET 4: PIUTANG & AGING =====================

function addPiutangAgingSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Piutang & Umur Piutang");
  const lastCol = 11;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const now = new Date();
  const enriched = payload.piutangData.map((p) => {
    const inv = safeDate(p.tanggal);
    const diffDays = inv ? Math.max(0, Math.ceil((now.getTime() - inv.getTime()) / MS_PER_DAY)) : 0;
    const due = inv ? new Date(inv.getTime() + DUE_DAYS * MS_PER_DAY) : null;
    const bucket = agingBucket(diffDays);
    const isLunas = p.status === "LUNAS";
    return { ...p, inv, due, diffDays, bucket, isLunas, outstanding: isLunas ? 0 : safeNumber(p.sisa) };
  });

  const totalOutstanding = enriched.reduce((a, e) => a + e.outstanding, 0);
  const bucketSum = { c0: 0, c30: 0, c60: 0, c90: 0 };
  for (const e of enriched) {
    if (e.isLunas) continue;
    if (e.diffDays > 90) bucketSum.c90 += e.outstanding;
    else if (e.diffDays > 60) bucketSum.c60 += e.outstanding;
    else if (e.diffDays > 30) bucketSum.c30 += e.outstanding;
    else bucketSum.c0 += e.outstanding;
  }

  // ---- Ringkasan aging (atas) ----
  let row = startRow;
  writeSectionTitle(ws, row, "Ringkasan Umur Piutang", 4);
  row += 1;

  const sumHeaderRow = row;
  ["Kelompok Umur Piutang", "Total Belum Dibayar", "Persentase dari Total", "Status Risiko"].forEach(
    (h, i) => (ws.getCell(sumHeaderRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, sumHeaderRow, 4);
  row += 1;

  const sumStart = row;
  const buckets: [string, number, string, string][] = [
    ["0 - 30 Hari", bucketSum.c0, "Aman", COLOR.green],
    ["31 - 60 Hari", bucketSum.c30, "Perlu Dipantau", COLOR.yellow],
    ["61 - 90 Hari", bucketSum.c60, "Risiko Sedang", COLOR.orange],
    ["> 90 Hari", bucketSum.c90, "Risiko Tinggi", COLOR.red],
  ];
  for (const [label, val, risk, fill] of buckets) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 2).value = val;
    ws.getCell(row, 2).numFmt = FMT_RUPIAH;
    const pct = safePercent(val, totalOutstanding);
    const pctCell = ws.getCell(row, 3);
    if (pct === null) pctCell.value = PERCENT_NA;
    else {
      pctCell.value = pct;
      pctCell.numFmt = FMT_PERCENT;
    }
    ws.getCell(row, 4).value = risk;
    ws.getCell(row, 4).alignment = { horizontal: "center" };
    fillRow(ws, row, 4, 4, fill);
    row++;
  }
  // total outstanding
  ws.getCell(row, 1).value = "Total Piutang Belum Dibayar";
  ws.getCell(row, 2).value = totalOutstanding;
  ws.getCell(row, 2).numFmt = FMT_RUPIAH;
  fillRow(ws, row, 1, 4, COLOR.totalBg);
  applyBorder(ws, sumHeaderRow, row, 4);
  row += 2;

  // ---- Tabel detail aging ----
  writeSectionTitle(ws, row, "Rincian Piutang per Invoice", lastCol);
  row += 1;
  const headerRow = row;
  [
    "No. Invoice",
    "Tanggal Invoice",
    "Jatuh Tempo",
    "Pelanggan",
    "Total Tagihan",
    "Sudah Dibayar",
    "Belum Dibayar",
    "Umur (Hari)",
    "Kelompok Umur Piutang",
    "% dari Total Piutang",
    "Status Risiko",
  ].forEach((h, i) => (ws.getCell(headerRow, i + 1).value = h));
  applyHeaderStyle(ws, headerRow, lastCol);

  row = headerRow + 1;
  if (enriched.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    for (const e of enriched) {
      ws.getCell(row, 1).value = safeText(e.noInvoice);
      const dCell = ws.getCell(row, 2);
      if (e.inv) {
        dCell.value = e.inv;
        dCell.numFmt = FMT_DATE;
      } else dCell.value = "-";
      const dueCell = ws.getCell(row, 3);
      if (e.due) {
        dueCell.value = e.due;
        dueCell.numFmt = FMT_DATE;
      } else dueCell.value = "-";
      ws.getCell(row, 4).value = safeText(e.client);
      ws.getCell(row, 5).value = safeNumber(e.total);
      ws.getCell(row, 5).numFmt = FMT_RUPIAH;
      ws.getCell(row, 6).value = safeNumber(e.dibayar);
      ws.getCell(row, 6).numFmt = FMT_RUPIAH;
      ws.getCell(row, 7).value = e.outstanding;
      ws.getCell(row, 7).numFmt = FMT_RUPIAH;
      ws.getCell(row, 8).value = e.diffDays;
      ws.getCell(row, 8).numFmt = FMT_INT;
      ws.getCell(row, 8).alignment = { horizontal: "center" };
      ws.getCell(row, 9).value = e.isLunas ? "LUNAS" : e.bucket.kategori;
      ws.getCell(row, 9).alignment = { horizontal: "center" };
      const pct = safePercent(e.outstanding, totalOutstanding);
      const pctCell = ws.getCell(row, 10);
      if (e.isLunas) pctCell.value = "-";
      else if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      ws.getCell(row, 11).value = e.isLunas ? "Lunas" : e.bucket.risiko;
      ws.getCell(row, 11).alignment = { horizontal: "center" };
      if (e.isLunas) fillRow(ws, row, 11, 11, COLOR.green);
      else fillRow(ws, row, 11, 11, e.bucket.fill);
      row++;
    }
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  autoFitColumns(ws, lastCol);
  setPrintHeaderRow(ws, headerRow);
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== SHEET 5: STOK & ASET =====================

/** Warna lembut per kelompok kolom mutasi stok (kolom 4..7) agar mudah dibedakan. */
const STOCK_TONE: Record<number, { bg: string; text: string }> = {
  4: { bg: "FFF8FAFC", text: "FF475569" }, // Stok Awal  — slate
  5: { bg: "FFF0FDF4", text: "FF15803D" }, // Stok Masuk — hijau
  6: { bg: "FFFFF1F2", text: "FFBE123C" }, // Stok Keluar — rose
  7: { bg: "FFEFF6FF", text: "FF1E3A8A" }, // Sisa Stok  — biru
};
const STOCK_ZERO_TEXT = "FFB6C2CF";

/** Tone tambahan untuk sheet Stok Keluar (selaras dengan STOCK_TONE). */
const TONE = {
  keluar: STOCK_TONE[6],
  netral: STOCK_TONE[4],
  koreksi: { bg: "FFFFF7ED", text: "FFC2410C" }, // orange-50 / orange-700
  penjualan: { bg: "FFEFF6FF", text: "FF1D4ED8" }, // blue-50 / blue-700
};

/** Beri latar lembut + warna teks kelompok; angka 0 diredupkan. */
function toneCell(cell: Cell, tone: { bg: string; text: string }, bold = false) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone.bg } };
  const isZero = cell.value === 0;
  cell.font = { bold: bold && !isZero, color: { argb: isZero ? STOCK_ZERO_TEXT : tone.text } };
}

function addStokAsetSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Stok & Aset");
  const isGudang = payload.role === "ADMIN_GUDANG";
  const lastCol = 14;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const rows = [...payload.stokData];
  const totalAset = rows.reduce((a, s) => a + safeNumber(s.nilaiAset), 0);
  const totalStok = rows.reduce((a, s) => a + safeNumber(s.stokAkhir), 0);
  const totalAwal = rows.reduce((a, s) => a + safeNumber(s.stokAwal), 0);
  const totalMasuk = rows.reduce((a, s) => a + safeNumber(s.stokMasuk), 0);
  const totalKeluar = rows.reduce((a, s) => a + safeNumber(s.stokKeluar), 0);

  // Mutasi sepanjang waktu: Stok Awal + Masuk - Keluar = Sisa Stok.
  const headerRow = startRow;
  [
    "Kode Barang",
    "Nama Barang",
    "Kategori",
    "Stok Awal",
    "Stok Masuk",
    "Stok Keluar",
    "Sisa Stok",
    "Min. Stok",
    "Harga Modal",
    "Harga Jual",
    "Nilai Aset",
    "Kontribusi Aset",
    "Status Stok",
    "Keterangan",
  ].forEach((h, i) => (ws.getCell(headerRow, i + 1).value = h));
  applyHeaderStyle(ws, headerRow, lastCol);

  let row = headerRow + 1;
  let cntKosong = 0;
  let cntRendah = 0;
  let topAsetNama = "-";
  let topAsetNilai = -1;

  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    for (const s of rows) {
      const sisa = safeNumber(s.stokAkhir);
      const minStok = safeNumber(s.minStok);
      const nilaiAset = safeNumber(s.nilaiAset);
      const pct = safePercent(nilaiAset, totalAset);

      // Sama dengan aplikasi & notifikasi: menipis bila sisa < minimum.
      let stokStatus = "Aman";
      let fill: string | undefined = COLOR.green;
      let note = "Di atas batas minimum";
      if (sisa <= 0) {
        stokStatus = "Kosong";
        fill = COLOR.red;
        note = "Stok habis / minus — segera restock";
        cntKosong++;
      } else if (sisa < minStok) {
        stokStatus = "Menipis";
        fill = COLOR.yellow;
        note = `Kurang ${minStok - sisa} dari minimum`;
        cntRendah++;
      }
      if (nilaiAset > topAsetNilai) {
        topAsetNilai = nilaiAset;
        topAsetNama = safeText(s.nama);
      }

      ws.getCell(row, 1).value = safeText(s.kode);
      ws.getCell(row, 2).value = safeText(s.nama);
      ws.getCell(row, 3).value = safeText(s.kategori);
      const qtyCols: [number, number][] = [
        [4, safeNumber(s.stokAwal)],
        [5, safeNumber(s.stokMasuk)],
        [6, safeNumber(s.stokKeluar)],
        [7, sisa],
        [8, minStok],
      ];
      for (const [col, val] of qtyCols) {
        const cell = ws.getCell(row, col);
        cell.value = val;
        cell.numFmt = FMT_INT;
        cell.alignment = { horizontal: "center" };
        const tone = STOCK_TONE[col];
        if (tone) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone.bg } };
          // Angka 0 diredupkan agar kolom tidak ramai; nilai berarti memakai warna kelompoknya.
          cell.font = { color: { argb: val === 0 ? STOCK_ZERO_TEXT : tone.text } };
        }
      }
      ws.getCell(row, 7).font = { bold: true, color: { argb: sisa <= 0 ? "FFDC2626" : STOCK_TONE[7].text } };
      const moneyCols: [number, number][] = [
        [9, safeNumber(s.hargaBeli)],
        [10, safeNumber(s.hargaJual)],
        [11, nilaiAset],
      ];
      for (const [col, val] of moneyCols) {
        const cell = ws.getCell(row, col);
        if (isGudang) {
          cell.value = val;
          cell.numFmt = FMT_RUPIAH;
        } else cell.value = TEXT_NA;
      }
      const pctCell = ws.getCell(row, 12);
      if (!isGudang) pctCell.value = TEXT_NA;
      else if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      if (isGudang && nilaiAset === 0) {
        ws.getCell(row, 11).font = { color: { argb: STOCK_ZERO_TEXT } };
        pctCell.font = { color: { argb: STOCK_ZERO_TEXT } };
      }
      ws.getCell(row, 13).value = stokStatus;
      ws.getCell(row, 13).alignment = { horizontal: "center" };
      if (fill) fillRow(ws, row, 13, 13, fill);
      ws.getCell(row, 14).value = note;
      row++;
    }
    ws.getCell(row, 2).value = "TOTAL";
    const totalQty: [number, number][] = [
      [4, totalAwal],
      [5, totalMasuk],
      [6, totalKeluar],
      [7, totalStok],
    ];
    for (const [col, val] of totalQty) {
      ws.getCell(row, col).value = val;
      ws.getCell(row, col).numFmt = FMT_INT;
      ws.getCell(row, col).alignment = { horizontal: "center" };
    }
    if (isGudang) {
      ws.getCell(row, 11).value = totalAset;
      ws.getCell(row, 11).numFmt = FMT_RUPIAH;
    } else {
      ws.getCell(row, 11).value = TEXT_NA;
    }
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  // ---- Ringkasan stok ----
  row += 1;
  writeSectionTitle(ws, row, "Ringkasan Stok & Aset", 2);
  row += 1;

  const totalSku = rows.length;
  const summary: [string, number | string, "rp" | "pct" | "int" | "text"][] = [
    ["Total Nilai Aset", isGudang ? totalAset : TEXT_NA, isGudang ? "rp" : "text"],
    ["Total Jenis Barang", totalSku, "int"],
    ["Total Stok Masuk (semua waktu)", totalMasuk, "int"],
    ["Total Stok Keluar (semua waktu)", totalKeluar, "int"],
    ["Total Sisa Stok", totalStok, "int"],
    ["Barang Stok Kosong", cntKosong, "int"],
    ["Persentase Stok Kosong", safePercent(cntKosong, totalSku) ?? PERCENT_NA, "pct"],
    ["Barang Stok Menipis", cntRendah, "int"],
    ["Persentase Stok Menipis", safePercent(cntRendah, totalSku) ?? PERCENT_NA, "pct"],
    ["Barang Kontribusi Aset Terbesar", totalSku > 0 ? topAsetNama : "-", "text"],
  ];
  const sumStart = row;
  for (const [label, val, kind] of summary) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { bold: true };
    const cell = ws.getCell(row, 2);
    cell.value = val;
    if (typeof val === "number") {
      if (kind === "rp") cell.numFmt = FMT_RUPIAH;
      else if (kind === "pct") cell.numFmt = FMT_PERCENT;
      else if (kind === "int") cell.numFmt = FMT_INT;
    }
    row++;
  }
  applyBorder(ws, sumStart, row - 1, 2);

  autoFitColumns(ws, lastCol);
  ws.getColumn(14).width = 34;
  setPrintHeaderRow(ws, headerRow);
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== SHEET 6: STOK KELUAR =====================

function addStokKeluarSheet(wb: Workbook, data: { rows: StokKeluarRow[]; truncated: boolean }, meta: MetaInfo) {
  const ws = wb.addWorksheet("Stok Keluar");
  const lastCol = 12;
  let row = writeSheetHeader(ws, lastCol, meta);
  const rows = data.rows;

  // ---- Rekap per barang ----
  type Rekap = { kode: string; nama: string; kategori: string | null; qty: number; nilai: number; transaksi: Set<string>; koreksi: number };
  const rekapMap = new Map<string, Rekap>();
  for (const r of rows) {
    const cur = rekapMap.get(r.kode) ?? { kode: r.kode, nama: r.nama, kategori: r.kategori, qty: 0, nilai: 0, transaksi: new Set<string>(), koreksi: 0 };
    cur.qty += safeNumber(r.qty);
    cur.nilai += safeNumber(r.nilai);
    if (r.noRef) cur.transaksi.add(r.noRef);
    if (r.jenis === "Koreksi") cur.koreksi += safeNumber(r.qty);
    rekapMap.set(r.kode, cur);
  }
  const rekap = [...rekapMap.values()].sort((a, b) => b.qty - a.qty);
  const totalQty = rekap.reduce((a, r) => a + r.qty, 0);

  writeSectionTitle(ws, row, "Rekap Stok Keluar per Barang (urut jumlah terbanyak)", 8);
  row += 1;
  const rekapHeader = row;
  ["No", "Kode Barang", "Nama Barang", "Kategori", "Jumlah Keluar", "Dari Koreksi", "Jumlah Transaksi", "Nilai Penjualan"].forEach(
    (h, i) => (ws.getCell(rekapHeader, i + 1).value = h)
  );
  applyHeaderStyle(ws, rekapHeader, 8);
  row += 1;
  if (rekap.length === 0) {
    writeEmptyNotice(ws, row, 8);
    row += 1;
  } else {
    rekap.forEach((r, idx) => {
      ws.getCell(row, 1).value = idx + 1;
      ws.getCell(row, 1).alignment = { horizontal: "center" };
      ws.getCell(row, 2).value = safeText(r.kode);
      ws.getCell(row, 3).value = safeText(r.nama);
      ws.getCell(row, 4).value = safeText(r.kategori);
      ws.getCell(row, 5).value = r.qty;
      ws.getCell(row, 5).numFmt = FMT_INT;
      ws.getCell(row, 5).alignment = { horizontal: "center" };
      ws.getCell(row, 6).value = r.koreksi;
      ws.getCell(row, 6).numFmt = FMT_INT;
      ws.getCell(row, 6).alignment = { horizontal: "center" };
      ws.getCell(row, 7).value = r.transaksi.size;
      ws.getCell(row, 7).numFmt = FMT_INT;
      ws.getCell(row, 7).alignment = { horizontal: "center" };
      ws.getCell(row, 8).value = r.nilai;
      ws.getCell(row, 8).numFmt = FMT_RUPIAH;
      toneCell(ws.getCell(row, 5), TONE.keluar, true);
      toneCell(ws.getCell(row, 6), TONE.koreksi);
      toneCell(ws.getCell(row, 7), TONE.netral);
      row++;
    });
    ws.getCell(row, 3).value = "TOTAL";
    ws.getCell(row, 5).value = totalQty;
    ws.getCell(row, 5).numFmt = FMT_INT;
    ws.getCell(row, 5).alignment = { horizontal: "center" };
    ws.getCell(row, 8).value = rekap.reduce((a, r) => a + r.nilai, 0);
    ws.getCell(row, 8).numFmt = FMT_RUPIAH;
    fillRow(ws, row, 1, 8, COLOR.totalBg);
    row++;
  }
  applyBorder(ws, rekapHeader, row - 1, 8);
  row += 1;

  // ---- Riwayat detail ----
  writeSectionTitle(ws, row, "Riwayat Stok Keluar (terbaru di atas)", lastCol);
  row += 1;
  if (data.truncated) {
    ws.getCell(row, 1).value = `Catatan: hanya ${rows.length.toLocaleString("id-ID")} mutasi terbaru yang dimuat. Persempit periode untuk data lengkap.`;
    ws.getCell(row, 1).font = { italic: true, color: { argb: "FFB45309" } };
    row += 1;
  }
  const headerRow = row;
  ["Tanggal", "Jenis", "No. Transaksi", "Pelanggan", "Kode Barang", "Nama Barang", "Kategori", "Jumlah", "Harga Satuan", "Nilai", "Petugas", "Keterangan"].forEach(
    (h, i) => (ws.getCell(headerRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, headerRow, lastCol);
  row += 1;

  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    for (const r of rows) {
      const d = safeDate(r.tanggal);
      const dCell = ws.getCell(row, 1);
      if (d) {
        dCell.value = d;
        dCell.numFmt = FMT_DATETIME;
      } else dCell.value = "-";
      ws.getCell(row, 2).value = r.jenis;
      ws.getCell(row, 2).alignment = { horizontal: "center" };
      toneCell(ws.getCell(row, 2), r.jenis === "Penjualan" ? TONE.penjualan : TONE.koreksi);
      ws.getCell(row, 3).value = safeText(r.noRef);
      ws.getCell(row, 4).value = safeText(r.pelanggan);
      ws.getCell(row, 5).value = safeText(r.kode);
      ws.getCell(row, 6).value = safeText(r.nama);
      ws.getCell(row, 7).value = safeText(r.kategori);
      ws.getCell(row, 8).value = safeNumber(r.qty);
      ws.getCell(row, 8).numFmt = FMT_INT;
      ws.getCell(row, 8).alignment = { horizontal: "center" };
      toneCell(ws.getCell(row, 8), TONE.keluar, true);
      const hCell = ws.getCell(row, 9);
      const nCell = ws.getCell(row, 10);
      if (r.hargaSatuan != null) {
        hCell.value = r.hargaSatuan;
        hCell.numFmt = FMT_RUPIAH;
        nCell.value = safeNumber(r.nilai);
        nCell.numFmt = FMT_RUPIAH;
      } else {
        hCell.value = "-";
        nCell.value = "-";
      }
      ws.getCell(row, 11).value = safeText(r.petugas);
      ws.getCell(row, 12).value = safeText(r.keterangan);
      row++;
    }
    ws.getCell(row, 6).value = "TOTAL";
    ws.getCell(row, 8).value = totalQty;
    ws.getCell(row, 8).numFmt = FMT_INT;
    ws.getCell(row, 8).alignment = { horizontal: "center" };
    ws.getCell(row, 10).value = rows.reduce((a, r) => a + safeNumber(r.nilai), 0);
    ws.getCell(row, 10).numFmt = FMT_RUPIAH;
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  autoFitColumns(ws, lastCol);
  ws.getColumn(1).width = Math.max(ws.getColumn(1).width ?? 10, 17);
  ws.getColumn(12).width = Math.min(ws.getColumn(12).width ?? 30, 36);
  setPrintHeaderRow(ws, headerRow);
  if (rows.length > 0) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow - 1, column: lastCol } };
}

// ===================== ENTRYPOINT =====================

/** Nama file export sesuai tanggal hari ini. */
export function buildFileName(date = new Date()): string {
  return buildExportFileName("Laporan-Analitik", date);
}

/**
 * Membangun workbook lengkap (5 sheet) dari data asli halaman.
 * Dipisah dari proses unduh agar mudah diuji & dipakai ulang.
 */
export async function buildAnalyticWorkbook(payload: ExportAnalyticPayload): Promise<Workbook> {
  // Import dinamis: ExcelJS hanya dimuat saat fitur dipakai (bukan via CDN).
  const ExcelJS = (await import("exceljs")).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Sistem Inventory";
  wb.created = new Date();

  const meta: MetaInfo = {
    reportName: "Analisis & Laporan",
    period: payload.period && payload.period.trim().length > 0 ? payload.period : "Keseluruhan (semua data tercatat)",
    exportDate: new Date(),
    userName: safeText(payload.userName),
  };

  addRingkasanSheet(wb, payload, meta);
  addPenjualanSheet(wb, payload, meta);
  addMarginSheet(wb, payload, meta);
  addPiutangAgingSheet(wb, payload, meta);
  addStokAsetSheet(wb, payload, meta);
  if (payload.stokKeluar) addStokKeluarSheet(wb, payload.stokKeluar, meta);

  return wb;
}

/**
 * Membangun workbook lalu memicu unduhan di browser.
 * Mengembalikan nama file yang dihasilkan.
 */
export async function exportAnalyticExcel(payload: ExportAnalyticPayload): Promise<string> {
  const wb = await buildAnalyticWorkbook(payload);
  const fileName = buildFileName();
  await downloadWorkbook(wb, fileName);
  return fileName;
}
