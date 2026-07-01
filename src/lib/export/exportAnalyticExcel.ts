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
 *   pelanggan. Field semacam itu ditandai "Tidak tersedia" â€” tidak dikarang.
 * - HPP (modal) per barang diturunkan dari: HPP = Omset - Laba Kotor (margin).
 */

import type { Workbook } from "exceljs";
import {
  COLOR,
  FMT_RUPIAH,
  FMT_PERCENT,
  FMT_INT,
  FMT_DATE,
  PERCENT_NA,
  TEXT_NA,
  type MetaInfo,
  safeNumber,
  safeText,
  safePercent,
  safeDate,
  pad2,
  applyBorder,
  applyHeaderStyle,
  autoFitColumns,
  writeSheetHeader,
  writeEmptyNotice,
  fillRow,
} from "./excelStyles";

// ===================== TIPE DATA INPUT (sesuai props halaman) =====================

export interface MarginRow {
  nama: string;
  qtyTerjual: number;
  omset: number;
  margin: number;
}

export interface TerlarisRow {
  nama: string;
  qtyTerjual: number;
  omset: number;
}

export interface StokRow {
  kode: string;
  nama: string;
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
      note: "Laba kotor setelah modal (Margin / Omset)",
    },
    {
      kpi: "Outstanding Piutang",
      value: totalPiutang,
      pct: pctPiutang,
      status: sPiutang.status,
      fill: sPiutang.fill,
      note: "Tagihan belum tertagih (Piutang / Omset)",
    },
    {
      kpi: "Nilai Aset Persediaan",
      value: isGudang ? totalAset : TEXT_NA,
      pct: isGudang ? pctAset : "skip",
      status: isGudang ? sAset.status : TEXT_NA,
      fill: isGudang ? sAset.fill : undefined,
      note: "Valuasi stok gudang (Aset / Omset)",
    },
  ];

  let r = headerRow + 1;
  const firstDataRow = r;
  for (const ln of lines) {
    ws.getCell(r, 1).value = ln.kpi;
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
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastDataRow, column: lastCol } };
  // referensi var supaya tidak unused di mode non-gudang
  void firstDataRow;
}

// ===================== SHEET 2: PENJUALAN =====================

function addPenjualanSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Penjualan");
  const lastCol = 7;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const rows = [...payload.marginData].sort((a, b) => safeNumber(b.omset) - safeNumber(a.omset));
  const totalOmset = rows.reduce((a, x) => a + safeNumber(x.omset), 0);

  // ---- Tabel utama: omset per barang ----
  let row = startRow;
  ws.getCell(row, 1).value = "Daftar Omset Produk Terjual";
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
  row += 1;

  const headerRow = row;
  ["No. / Tgl Transaksi", "Nama Barang", "Qty Terjual", "Total Penjualan", "Kontribusi Omset", "Status", "Keterangan"].forEach(
    (h, i) => (ws.getCell(headerRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, headerRow, lastCol);

  row = headerRow + 1;
  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    for (const it of rows) {
      const omset = safeNumber(it.omset);
      const pct = safePercent(omset, totalOmset);
      ws.getCell(row, 1).value = TEXT_NA; // data agregat per-barang: tanpa no/tgl transaksi
      ws.getCell(row, 2).value = safeText(it.nama);
      ws.getCell(row, 3).value = safeNumber(it.qtyTerjual);
      ws.getCell(row, 3).numFmt = FMT_INT;
      ws.getCell(row, 4).value = omset;
      ws.getCell(row, 4).numFmt = FMT_RUPIAH;
      const pctCell = ws.getCell(row, 5);
      if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      // status kontribusi
      let st = "Produk Pendukung";
      let note = "Kontribusi < 10% omset";
      if (pct !== null && pct >= 0.2) {
        st = "Produk Utama";
        note = "Kontribusi >= 20% omset";
      } else if (pct !== null && pct >= 0.1) {
        st = "Produk Potensial";
        note = "Kontribusi 10% - 19% omset";
      }
      ws.getCell(row, 6).value = st;
      ws.getCell(row, 6).alignment = { horizontal: "center" };
      ws.getCell(row, 7).value = note;
      row++;
    }
    // baris total
    ws.getCell(row, 2).value = "TOTAL PENJUALAN";
    ws.getCell(row, 2).font = { bold: true };
    ws.getCell(row, 4).value = totalOmset;
    ws.getCell(row, 4).numFmt = FMT_RUPIAH;
    ws.getCell(row, 4).font = { bold: true };
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const mainLastRow = row - 1;
  applyBorder(ws, headerRow, mainLastRow, lastCol);

  // ---- Bagian Top 10 Barang Terlaris ----
  row += 1;
  ws.getCell(row, 1).value = "Top 10 Barang Terlaris (Volume)";
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
  row += 1;

  const topHeaderRow = row;
  ["Ranking", "Nama Barang", "Total Qty", "Total Omset", "Kontribusi Omset", "Keterangan Analisis"].forEach(
    (h, i) => (ws.getCell(topHeaderRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, topHeaderRow, 6);

  row = topHeaderRow + 1;
  const top = [...payload.terlaris].slice(0, 10);
  if (top.length === 0) {
    writeEmptyNotice(ws, row, 6);
    row += 1;
  } else {
    top.forEach((t, i) => {
      const omset = safeNumber(t.omset);
      const pct = safePercent(omset, totalOmset);
      ws.getCell(row, 1).value = i + 1;
      ws.getCell(row, 1).alignment = { horizontal: "center" };
      ws.getCell(row, 2).value = safeText(t.nama);
      ws.getCell(row, 3).value = safeNumber(t.qtyTerjual);
      ws.getCell(row, 3).numFmt = FMT_INT;
      ws.getCell(row, 4).value = omset;
      ws.getCell(row, 4).numFmt = FMT_RUPIAH;
      const pctCell = ws.getCell(row, 5);
      if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      let note = "Produk pendukung (kontribusi < 10%)";
      if (pct !== null && pct >= 0.2) note = "Produk utama (kontribusi >= 20%)";
      else if (pct !== null && pct >= 0.1) note = "Produk potensial (kontribusi 10% - 19%)";
      ws.getCell(row, 6).value = note;
      row++;
    });
  }
  applyBorder(ws, topHeaderRow, row - 1, 6);

  autoFitColumns(ws, lastCol);
  ws.getColumn(7).width = 30;
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: mainLastRow, column: lastCol } };
}

// ===================== SHEET 3: MARGIN =====================

function addMarginSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Margin");
  const isGudang = payload.role === "ADMIN_GUDANG";
  const lastCol = 8;
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
  ["Nama Barang", "Qty Terjual", "Omset", "Modal / HPP", "Laba Kotor", "Persentase Margin", "Status Margin", "Keterangan"].forEach(
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
      const hpp = omset - laba; // HPP diturunkan: Omset - Laba Kotor
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

      ws.getCell(row, 1).value = safeText(it.nama);
      ws.getCell(row, 2).value = safeNumber(it.qtyTerjual);
      ws.getCell(row, 2).numFmt = FMT_INT;
      ws.getCell(row, 3).value = omset;
      ws.getCell(row, 3).numFmt = FMT_RUPIAH;
      ws.getCell(row, 4).value = hpp;
      ws.getCell(row, 4).numFmt = FMT_RUPIAH;
      ws.getCell(row, 5).value = laba;
      ws.getCell(row, 5).numFmt = FMT_RUPIAH;
      const pctCell = ws.getCell(row, 6);
      if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      ws.getCell(row, 7).value = s.status;
      ws.getCell(row, 7).alignment = { horizontal: "center" };
      ws.getCell(row, 8).value =
        s.status === "Bagus"
          ? "Margin >= 30%"
          : s.status === "Cukup"
          ? "Margin 15% - 29%"
          : s.status === "Tipis"
          ? "Margin 1% - 14%"
          : s.status === "Rugi"
          ? "Margin <= 0%"
          : "-";
      // highlight baris berdasar status
      if (s.fill) fillRow(ws, row, 1, lastCol, s.fill);
      row++;
    }
    // baris total
    ws.getCell(row, 1).value = "TOTAL";
    ws.getCell(row, 1).font = { bold: true };
    ws.getCell(row, 3).value = totOmset;
    ws.getCell(row, 3).numFmt = FMT_RUPIAH;
    ws.getCell(row, 4).value = totHpp;
    ws.getCell(row, 4).numFmt = FMT_RUPIAH;
    ws.getCell(row, 5).value = totLaba;
    ws.getCell(row, 5).numFmt = FMT_RUPIAH;
    [1, 3, 4, 5].forEach((c) => (ws.getCell(row, c).font = { bold: true }));
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  // ---- Ringkasan margin ----
  row += 1;
  ws.getCell(row, 1).value = "Ringkasan Margin";
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
  row += 1;

  const totalItem = rows.length;
  const avgPct = cntPct > 0 ? sumPct / cntPct : null;
  const summary: [string, number | string, boolean][] = [
    ["Total Omset", totOmset, true],
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
  ws.getColumn(8).width = 22;
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== SHEET 4: PIUTANG & AGING =====================

function addPiutangAgingSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Piutang & Aging");
  const lastCol = 11;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const now = new Date();
  const enriched = payload.piutangData.map((p) => {
    const inv = safeDate(p.tanggal);
    const diffDays = inv ? Math.ceil(Math.abs(now.getTime() - inv.getTime()) / 86400000) : 0;
    const bucket = agingBucket(diffDays);
    const isLunas = p.status === "LUNAS";
    return { ...p, inv, diffDays, bucket, isLunas, outstanding: isLunas ? 0 : safeNumber(p.sisa) };
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
  ws.getCell(row, 1).value = "Ringkasan Umur Piutang";
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
  row += 1;

  const sumHeaderRow = row;
  ["Kategori Aging", "Total Outstanding", "Persentase dari Total", "Status Risiko"].forEach(
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
    fillRow(ws, row, 1, 1, fill);
    row++;
  }
  // total outstanding
  ws.getCell(row, 1).value = "Total Outstanding Piutang";
  ws.getCell(row, 1).font = { bold: true };
  ws.getCell(row, 2).value = totalOutstanding;
  ws.getCell(row, 2).numFmt = FMT_RUPIAH;
  ws.getCell(row, 2).font = { bold: true };
  fillRow(ws, row, 1, 4, COLOR.totalBg);
  applyBorder(ws, sumHeaderRow, row, 4);
  row += 2;

  // ---- Tabel detail aging ----
  const headerRow = row;
  [
    "No. Invoice",
    "Tanggal Invoice",
    "Jatuh Tempo",
    "Pelanggan",
    "Total Tagihan",
    "Sudah Dibayar",
    "Outstanding",
    "Umur (Hari)",
    "Kategori Aging",
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
      ws.getCell(row, 3).value = TEXT_NA; // jatuh tempo tidak tersedia di data sumber
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
      // highlight baris (kecuali lunas) per kategori
      if (!e.isLunas) fillRow(ws, row, 9, 11, e.bucket.fill);
      row++;
    }
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  autoFitColumns(ws, lastCol);
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== SHEET 5: STOK & ASET =====================

function addStokAsetSheet(wb: Workbook, payload: ExportAnalyticPayload, meta: MetaInfo) {
  const ws = wb.addWorksheet("Stok & Aset");
  const isGudang = payload.role === "ADMIN_GUDANG";
  const lastCol = 11;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const rows = [...payload.stokData];
  const totalAset = rows.reduce((a, s) => a + safeNumber(s.nilaiAset), 0);

  const headerRow = startRow;
  [
    "Kode / SKU",
    "Nama Barang",
    "Kategori",
    "Stok Masuk",
    "Stok Keluar",
    "Sisa Stok",
    "Harga Modal",
    "Nilai Aset",
    "Kontribusi Aset",
    "Status Stok",
    "Keterangan Analisis",
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
      const hargaBeli = safeNumber(s.hargaBeli);
      const nilaiAset = safeNumber(s.nilaiAset);
      const pct = safePercent(nilaiAset, totalAset);

      let stokStatus = "Stok Aman";
      let fill: string | undefined;
      let note = "Sisa stok di atas batas minimum";
      if (sisa <= 0) {
        stokStatus = "Stok Kosong";
        fill = COLOR.red;
        note = "Sisa stok 0 / minus â€” segera restock";
        cntKosong++;
      } else if (sisa <= minStok) {
        stokStatus = "Stok Rendah";
        fill = COLOR.yellow;
        note = "Sisa stok <= batas minimum";
        cntRendah++;
      }
      if (nilaiAset > topAsetNilai) {
        topAsetNilai = nilaiAset;
        topAsetNama = safeText(s.nama);
      }

      ws.getCell(row, 1).value = safeText(s.kode);
      ws.getCell(row, 2).value = safeText(s.nama);
      ws.getCell(row, 3).value = TEXT_NA; // kategori tidak tersedia di data sumber
      ws.getCell(row, 4).value = TEXT_NA; // stok masuk tidak tersedia
      ws.getCell(row, 5).value = TEXT_NA; // stok keluar tidak tersedia
      ws.getCell(row, 6).value = sisa;
      ws.getCell(row, 6).numFmt = FMT_INT;
      ws.getCell(row, 6).alignment = { horizontal: "center" };
      const hbCell = ws.getCell(row, 7);
      const naCell = ws.getCell(row, 8);
      if (isGudang) {
        hbCell.value = hargaBeli;
        hbCell.numFmt = FMT_RUPIAH;
        naCell.value = nilaiAset;
        naCell.numFmt = FMT_RUPIAH;
      } else {
        hbCell.value = TEXT_NA;
        naCell.value = TEXT_NA;
      }
      const pctCell = ws.getCell(row, 9);
      if (!isGudang) pctCell.value = TEXT_NA;
      else if (pct === null) pctCell.value = PERCENT_NA;
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      ws.getCell(row, 10).value = stokStatus;
      ws.getCell(row, 10).alignment = { horizontal: "center" };
      ws.getCell(row, 11).value = note;
      if (fill) fillRow(ws, row, 10, 10, fill);
      row++;
    }
    // total
    ws.getCell(row, 2).value = "TOTAL NILAI ASET";
    ws.getCell(row, 2).font = { bold: true };
    if (isGudang) {
      ws.getCell(row, 8).value = totalAset;
      ws.getCell(row, 8).numFmt = FMT_RUPIAH;
      ws.getCell(row, 8).font = { bold: true };
    } else {
      ws.getCell(row, 8).value = TEXT_NA;
    }
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  // ---- Ringkasan stok ----
  row += 1;
  ws.getCell(row, 1).value = "Ringkasan Stok & Aset";
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
  row += 1;

  const totalSku = rows.length;
  const summary: [string, number | string, "rp" | "pct" | "int" | "text"][] = [
    ["Total Nilai Aset", isGudang ? totalAset : TEXT_NA, isGudang ? "rp" : "text"],
    ["Total SKU", totalSku, "int"],
    ["Jumlah Barang Stok Kosong", cntKosong, "int"],
    ["Persentase Stok Kosong", safePercent(cntKosong, totalSku) ?? PERCENT_NA, "pct"],
    ["Jumlah Barang Stok Rendah", cntRendah, "int"],
    ["Persentase Stok Rendah", safePercent(cntRendah, totalSku) ?? PERCENT_NA, "pct"],
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
  ws.getColumn(11).width = 32;
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== ENTRYPOINT =====================

/** Nama file export sesuai tanggal hari ini. */
export function buildFileName(date = new Date()): string {
  return `Analitik-Laporan-ERP-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.xlsx`;
}

/**
 * Membangun workbook lengkap (5 sheet) dari data asli halaman.
 * Dipisah dari proses unduh agar mudah diuji & dipakai ulang.
 */
export async function buildAnalyticWorkbook(payload: ExportAnalyticPayload): Promise<Workbook> {
  // Import dinamis: ExcelJS hanya dimuat saat fitur dipakai (bukan via CDN).
  const ExcelJS = (await import("exceljs")).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Sistem Inventory ERP";
  wb.created = new Date();

  const meta: MetaInfo = {
    reportName: "Analitik & Laporan ERP",
    period: payload.period && payload.period.trim().length > 0 ? payload.period : "Keseluruhan (semua data tercatat)",
    exportDate: new Date(),
    userName: safeText(payload.userName),
  };

  addRingkasanSheet(wb, payload, meta);
  addPenjualanSheet(wb, payload, meta);
  addMarginSheet(wb, payload, meta);
  addPiutangAgingSheet(wb, payload, meta);
  addStokAsetSheet(wb, payload, meta);

  return wb;
}

/**
 * Membangun workbook lalu memicu unduhan di browser.
 * Mengembalikan nama file yang dihasilkan.
 */
export async function exportAnalyticExcel(payload: ExportAnalyticPayload): Promise<string> {
  const wb = await buildAnalyticWorkbook(payload);
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
