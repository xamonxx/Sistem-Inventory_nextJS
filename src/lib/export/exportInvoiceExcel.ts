/**
 * Export halaman "Invoices & Piutang Dagang" ke Excel (.xlsx) memakai ExcelJS.
 *
 * Dipakai sisi-klien. ExcelJS di-import dinamis (tanpa CDN). Semua angka diambil
 * dari data asli halaman dan MENGIKUTI filter aktif (pencarian + status) — baris
 * yang diekspor = baris yang sedang tampil setelah filter.
 *
 * Konvensi jatuh tempo: mengikuti aplikasi (reminder WhatsApp), yaitu
 * Jatuh Tempo = Tanggal Invoice + 30 hari.
 */

import type { Workbook } from "exceljs";
import {
  COLOR,
  FMT_RUPIAH,
  FMT_PERCENT,
  FMT_INT,
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

// ===================== TIPE DATA INPUT =====================

export interface ExportInvoiceItem {
  kode: string;
  nama: string;
  qty: number;
  harga: number;
  subtotal: number;
}

export interface ExportPayment {
  id: number;
  tanggal: string;
  tipe: string;
  jumlah: number;
  keterangan: string | null;
}

export interface ExportInvoice {
  noInvoice: string;
  noTransaksi?: string;
  tanggal: string; // ISO
  namaClient: string;
  projectName?: string;
  namaWs?: string | null;
  alamat?: string | null;
  total: number;
  totalDibayar: number;
  status: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  verifCount?: number;
  items: ExportInvoiceItem[];
  payments?: ExportPayment[];
}

export interface ExportInvoicePayload {
  userName?: string;
  /** Label filter aktif untuk metadata (mis. "Status: Semua • Cari: kitchen"). */
  filterLabel?: string;
  invoices: ExportInvoice[];
}

const DUE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

// ===================== HELPER DOMAIN =====================

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  PARTIAL: "Cicilan (Partial)",
  PAID: "Lunas",
  OVERDUE: "Terlambat",
};

const STATUS_FILL: Record<string, string | undefined> = {
  DRAFT: COLOR.slate,
  PENDING: COLOR.yellow,
  PARTIAL: COLOR.blue,
  PAID: COLOR.green,
  OVERDUE: COLOR.red,
};

interface EnrichedInvoice extends ExportInvoice {
  invDate: Date | null;
  dueDate: Date | null;
  sisa: number;
  isLunas: boolean;
  umurHari: number;
  agingKategori: string;
  agingFill: string;
  agingRisiko: string;
  jatuhTempoStatus: string;
}

function agingByUmur(umur: number): { kategori: string; fill: string; risiko: string } {
  if (umur > 90) return { kategori: ">90 Hari", fill: COLOR.red, risiko: "Risiko Tinggi" };
  if (umur > 60) return { kategori: "61-90 Hari", fill: COLOR.orange, risiko: "Risiko Sedang" };
  if (umur > 30) return { kategori: "31-60 Hari", fill: COLOR.yellow, risiko: "Perlu Dipantau" };
  return { kategori: "0-30 Hari", fill: COLOR.green, risiko: "Aman" };
}

function enrich(inv: ExportInvoice, now: Date): EnrichedInvoice {
  const invDate = safeDate(inv.tanggal);
  const dueDate = invDate ? new Date(invDate.getTime() + DUE_DAYS * MS_PER_DAY) : null;
  const total = safeNumber(inv.total);
  const dibayar = safeNumber(inv.totalDibayar);
  const sisa = total - dibayar;
  const isLunas = inv.status === "PAID" || sisa <= 0;
  const umurHari = invDate ? Math.max(0, Math.ceil((now.getTime() - invDate.getTime()) / MS_PER_DAY)) : 0;
  const aging = agingByUmur(umurHari);

  let jatuhTempoStatus = "Belum Jatuh Tempo";
  if (isLunas) jatuhTempoStatus = "Lunas";
  else if (dueDate && now.getTime() > dueDate.getTime()) {
    const lewat = Math.ceil((now.getTime() - dueDate.getTime()) / MS_PER_DAY);
    jatuhTempoStatus = `Terlambat ${lewat} hari`;
  }

  return {
    ...inv,
    invDate,
    dueDate,
    sisa,
    isLunas,
    umurHari,
    agingKategori: isLunas ? "Lunas" : aging.kategori,
    agingFill: aging.fill,
    agingRisiko: isLunas ? "Lunas" : aging.risiko,
    jatuhTempoStatus,
  };
}

// ===================== SHEET 1: RINGKASAN =====================

function addRingkasanSheet(wb: Workbook, rows: EnrichedInvoice[], meta: MetaInfo) {
  const ws = wb.addWorksheet("Ringkasan");
  const lastCol = 5;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const totalTagihan = rows.reduce((a, r) => a + safeNumber(r.total), 0);
  const totalDibayar = rows.reduce((a, r) => a + safeNumber(r.totalDibayar), 0);
  const totalPiutang = rows.filter((r) => !r.isLunas).reduce((a, r) => a + r.sisa, 0);
  const jmlLunas = rows.filter((r) => r.isLunas).length;
  const jmlPending = rows.length - jmlLunas;

  // ---- KPI utama ----
  let row = startRow;
  ws.getCell(row, 1).value = "Ringkasan Piutang Dagang";
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
  row += 1;

  const kpiHeader = row;
  ["KPI", "Nilai", "Persentase Acuan", "Keterangan", ""].forEach((h, i) => (ws.getCell(kpiHeader, i + 1).value = h));
  applyHeaderStyle(ws, kpiHeader, 4);
  row += 1;

  const pctTertagih = safePercent(totalDibayar, totalTagihan);
  const pctPiutang = safePercent(totalPiutang, totalTagihan);
  const pctLunas = safePercent(jmlLunas, rows.length);

  type Kpi = { kpi: string; value: number | string; fmt: "rp" | "int" | "none"; pct: number | null | "none"; note: string };
  const kpis: Kpi[] = [
    { kpi: "Total Invoice", value: rows.length, fmt: "int", pct: "none", note: "Jumlah invoice terekspor (sesuai filter)" },
    { kpi: "Total Nilai Tagihan", value: totalTagihan, fmt: "rp", pct: "none", note: "Akumulasi seluruh tagihan" },
    { kpi: "Total Telah Dibayar", value: totalDibayar, fmt: "rp", pct: pctTertagih, note: "Pembayaran/cicilan terkumpul (thd tagihan)" },
    { kpi: "Total Piutang Aktif", value: totalPiutang, fmt: "rp", pct: pctPiutang, note: "Sisa tagihan belum lunas (thd tagihan)" },
    { kpi: "Invoice Lunas", value: jmlLunas, fmt: "int", pct: pctLunas, note: "Jumlah invoice berstatus lunas" },
    { kpi: "Invoice Belum Lunas", value: jmlPending, fmt: "int", pct: "none", note: "Pending / cicilan / draft" },
  ];

  const kpiStart = row;
  for (const k of kpis) {
    ws.getCell(row, 1).value = k.kpi;
    const vCell = ws.getCell(row, 2);
    vCell.value = k.value;
    if (k.fmt === "rp") vCell.numFmt = FMT_RUPIAH;
    else if (k.fmt === "int") vCell.numFmt = FMT_INT;
    const pCell = ws.getCell(row, 3);
    if (k.pct === "none") pCell.value = "-";
    else if (k.pct === null) pCell.value = "Tidak tersedia";
    else {
      pCell.value = k.pct;
      pCell.numFmt = FMT_PERCENT;
    }
    ws.getCell(row, 4).value = k.note;
    row++;
  }
  applyBorder(ws, kpiHeader, row - 1, 4);
  row += 1;

  // ---- Breakdown per status ----
  ws.getCell(row, 1).value = "Rincian per Status";
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
  row += 1;
  const stHeader = row;
  ["Status", "Jumlah Invoice", "Total Tagihan", "Sisa Piutang", "% dari Total Tagihan"].forEach(
    (h, i) => (ws.getCell(stHeader, i + 1).value = h)
  );
  applyHeaderStyle(ws, stHeader, lastCol);
  row += 1;

  const statusOrder = ["PAID", "PARTIAL", "PENDING", "DRAFT"];
  for (const st of statusOrder) {
    const group = rows.filter((r) => r.status === st);
    if (group.length === 0) continue;
    const gTagih = group.reduce((a, r) => a + safeNumber(r.total), 0);
    const gSisa = group.reduce((a, r) => a + r.sisa, 0);
    const pct = safePercent(gTagih, totalTagihan);
    ws.getCell(row, 1).value = STATUS_LABEL[st] ?? st;
    ws.getCell(row, 2).value = group.length;
    ws.getCell(row, 2).numFmt = FMT_INT;
    ws.getCell(row, 3).value = gTagih;
    ws.getCell(row, 3).numFmt = FMT_RUPIAH;
    ws.getCell(row, 4).value = gSisa;
    ws.getCell(row, 4).numFmt = FMT_RUPIAH;
    const pCell = ws.getCell(row, 5);
    if (pct === null) pCell.value = "Tidak tersedia";
    else {
      pCell.value = pct;
      pCell.numFmt = FMT_PERCENT;
    }
    const fill = STATUS_FILL[st];
    if (fill) fillRow(ws, row, 1, 1, fill);
    row++;
  }
  applyBorder(ws, stHeader, row - 1, lastCol);
  row += 1;

  // ---- Ringkasan aging (belum lunas) ----
  ws.getCell(row, 1).value = "Ringkasan Umur Piutang (Belum Lunas)";
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: COLOR.headerText } };
  row += 1;
  const agHeader = row;
  ["Kategori Aging", "Jumlah Invoice", "Sisa Piutang", "% dari Piutang Aktif", "Status Risiko"].forEach(
    (h, i) => (ws.getCell(agHeader, i + 1).value = h)
  );
  applyHeaderStyle(ws, agHeader, lastCol);
  row += 1;

  const belumLunas = rows.filter((r) => !r.isLunas);
  const buckets: [string, string, string][] = [
    ["0-30 Hari", COLOR.green, "Aman"],
    ["31-60 Hari", COLOR.yellow, "Perlu Dipantau"],
    ["61-90 Hari", COLOR.orange, "Risiko Sedang"],
    [">90 Hari", COLOR.red, "Risiko Tinggi"],
  ];
  for (const [kat, fill, risk] of buckets) {
    const group = belumLunas.filter((r) => r.agingKategori === kat);
    const gSisa = group.reduce((a, r) => a + r.sisa, 0);
    const pct = safePercent(gSisa, totalPiutang);
    ws.getCell(row, 1).value = kat;
    ws.getCell(row, 2).value = group.length;
    ws.getCell(row, 2).numFmt = FMT_INT;
    ws.getCell(row, 3).value = gSisa;
    ws.getCell(row, 3).numFmt = FMT_RUPIAH;
    const pCell = ws.getCell(row, 4);
    if (pct === null) pCell.value = "Tidak tersedia";
    else {
      pCell.value = pct;
      pCell.numFmt = FMT_PERCENT;
    }
    ws.getCell(row, 5).value = risk;
    fillRow(ws, row, 1, 1, fill);
    row++;
  }
  applyBorder(ws, agHeader, row - 1, lastCol);

  autoFitColumns(ws, lastCol);
  ws.getColumn(4).width = Math.max(ws.getColumn(4).width ?? 10, 40);
  ws.views = [{ state: "frozen", ySplit: startRow - 1 }];
}

// ===================== SHEET 2: DAFTAR INVOICE =====================

function addDaftarInvoiceSheet(wb: Workbook, rows: EnrichedInvoice[], meta: MetaInfo) {
  const ws = wb.addWorksheet("Daftar Invoice");
  const lastCol = 15;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const headerRow = startRow;
  [
    "No. Invoice",
    "No. Transaksi",
    "Tanggal",
    "Jatuh Tempo",
    "Klien / Pelanggan",
    "Proyek",
    "WS",
    "Total Tagihan",
    "Telah Dibayar",
    "Sisa Piutang",
    "% Terbayar",
    "Umur (Hari)",
    "Kategori Aging",
    "Verifikasi (x)",
    "Status",
  ].forEach((h, i) => (ws.getCell(headerRow, i + 1).value = h));
  applyHeaderStyle(ws, headerRow, lastCol);

  let row = headerRow + 1;
  if (rows.length === 0) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    let tTotal = 0;
    let tDibayar = 0;
    let tSisa = 0;
    for (const r of rows) {
      const total = safeNumber(r.total);
      const dibayar = safeNumber(r.totalDibayar);
      tTotal += total;
      tDibayar += dibayar;
      tSisa += r.isLunas ? 0 : r.sisa;

      ws.getCell(row, 1).value = safeText(r.noInvoice);
      ws.getCell(row, 2).value = r.noTransaksi ? safeText(r.noTransaksi) : "-";
      const dCell = ws.getCell(row, 3);
      if (r.invDate) {
        dCell.value = r.invDate;
        dCell.numFmt = "dd/mm/yyyy";
      } else dCell.value = "-";
      const jtCell = ws.getCell(row, 4);
      if (r.dueDate) {
        jtCell.value = r.dueDate;
        jtCell.numFmt = "dd/mm/yyyy";
      } else jtCell.value = "-";
      ws.getCell(row, 5).value = safeText(r.namaClient);
      ws.getCell(row, 6).value = r.projectName ? safeText(r.projectName) : "Eceran / Umum";
      ws.getCell(row, 7).value = r.namaWs ? safeText(r.namaWs) : "-";
      ws.getCell(row, 8).value = total;
      ws.getCell(row, 8).numFmt = FMT_RUPIAH;
      ws.getCell(row, 9).value = dibayar;
      ws.getCell(row, 9).numFmt = FMT_RUPIAH;
      ws.getCell(row, 10).value = r.isLunas ? 0 : r.sisa;
      ws.getCell(row, 10).numFmt = FMT_RUPIAH;
      const pctCell = ws.getCell(row, 11);
      const pct = safePercent(dibayar, total);
      if (pct === null) pctCell.value = "Tidak tersedia";
      else {
        pctCell.value = pct;
        pctCell.numFmt = FMT_PERCENT;
      }
      ws.getCell(row, 12).value = r.umurHari;
      ws.getCell(row, 12).numFmt = FMT_INT;
      ws.getCell(row, 12).alignment = { horizontal: "center" };
      ws.getCell(row, 13).value = r.agingKategori;
      ws.getCell(row, 13).alignment = { horizontal: "center" };
      ws.getCell(row, 14).value = safeNumber(r.verifCount);
      ws.getCell(row, 14).numFmt = FMT_INT;
      ws.getCell(row, 14).alignment = { horizontal: "center" };
      ws.getCell(row, 15).value = STATUS_LABEL[r.status] ?? r.status;
      ws.getCell(row, 15).alignment = { horizontal: "center" };

      // highlight kolom status + kategori aging
      const stFill = STATUS_FILL[r.status];
      if (stFill) fillRow(ws, row, 15, 15, stFill);
      if (!r.isLunas) fillRow(ws, row, 13, 13, r.agingFill);
      row++;
    }
    // total
    ws.getCell(row, 5).value = "TOTAL";
    ws.getCell(row, 5).font = { bold: true };
    ws.getCell(row, 8).value = tTotal;
    ws.getCell(row, 8).numFmt = FMT_RUPIAH;
    ws.getCell(row, 9).value = tDibayar;
    ws.getCell(row, 9).numFmt = FMT_RUPIAH;
    ws.getCell(row, 10).value = tSisa;
    ws.getCell(row, 10).numFmt = FMT_RUPIAH;
    [5, 8, 9, 10].forEach((c) => (ws.getCell(row, c).font = { bold: true }));
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  autoFitColumns(ws, lastCol);
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== SHEET 3: RINCIAN BARANG =====================

function addRincianBarangSheet(wb: Workbook, rows: EnrichedInvoice[], meta: MetaInfo) {
  const ws = wb.addWorksheet("Rincian Barang");
  const lastCol = 8;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const headerRow = startRow;
  ["No. Invoice", "Tanggal", "Klien", "Kode Barang", "Nama Barang", "Qty", "Harga Satuan", "Subtotal"].forEach(
    (h, i) => (ws.getCell(headerRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, headerRow, lastCol);

  let row = headerRow + 1;
  let grandSubtotal = 0;
  let anyItem = false;

  for (const inv of rows) {
    for (const it of inv.items ?? []) {
      anyItem = true;
      const subtotal = safeNumber(it.subtotal);
      grandSubtotal += subtotal;
      ws.getCell(row, 1).value = safeText(inv.noInvoice);
      const dCell = ws.getCell(row, 2);
      if (inv.invDate) {
        dCell.value = inv.invDate;
        dCell.numFmt = "dd/mm/yyyy";
      } else dCell.value = "-";
      ws.getCell(row, 3).value = safeText(inv.namaClient);
      ws.getCell(row, 4).value = safeText(it.kode);
      ws.getCell(row, 5).value = safeText(it.nama);
      ws.getCell(row, 6).value = safeNumber(it.qty);
      ws.getCell(row, 6).numFmt = FMT_INT;
      ws.getCell(row, 6).alignment = { horizontal: "center" };
      ws.getCell(row, 7).value = safeNumber(it.harga);
      ws.getCell(row, 7).numFmt = FMT_RUPIAH;
      ws.getCell(row, 8).value = subtotal;
      ws.getCell(row, 8).numFmt = FMT_RUPIAH;
      row++;
    }
  }

  if (!anyItem) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    ws.getCell(row, 5).value = "TOTAL SUBTOTAL";
    ws.getCell(row, 5).font = { bold: true };
    ws.getCell(row, 8).value = grandSubtotal;
    ws.getCell(row, 8).numFmt = FMT_RUPIAH;
    ws.getCell(row, 8).font = { bold: true };
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  autoFitColumns(ws, lastCol);
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== SHEET 4: RIWAYAT PEMBAYARAN =====================

function addRiwayatPembayaranSheet(wb: Workbook, rows: EnrichedInvoice[], meta: MetaInfo) {
  const ws = wb.addWorksheet("Riwayat Pembayaran");
  const lastCol = 6;
  const startRow = writeSheetHeader(ws, lastCol, meta);

  const headerRow = startRow;
  ["No. Invoice", "Klien", "Tanggal Bayar", "Tipe", "Jumlah", "Keterangan"].forEach(
    (h, i) => (ws.getCell(headerRow, i + 1).value = h)
  );
  applyHeaderStyle(ws, headerRow, lastCol);

  let row = headerRow + 1;
  let grandJumlah = 0;
  let anyPay = false;

  for (const inv of rows) {
    for (const p of inv.payments ?? []) {
      anyPay = true;
      const jumlah = safeNumber(p.jumlah);
      grandJumlah += jumlah;
      ws.getCell(row, 1).value = safeText(inv.noInvoice);
      ws.getCell(row, 2).value = safeText(inv.namaClient);
      const dCell = ws.getCell(row, 3);
      const pd = safeDate(p.tanggal);
      if (pd) {
        dCell.value = pd;
        dCell.numFmt = "dd/mm/yyyy";
      } else dCell.value = "-";
      ws.getCell(row, 4).value = safeText(p.tipe);
      ws.getCell(row, 4).alignment = { horizontal: "center" };
      ws.getCell(row, 5).value = jumlah;
      ws.getCell(row, 5).numFmt = FMT_RUPIAH;
      ws.getCell(row, 6).value = p.keterangan ? safeText(p.keterangan) : "-";
      // warna tipe pembayaran
      const tipeFill = p.tipe === "TRANSFER" ? COLOR.blue : p.tipe === "CASH" ? COLOR.green : COLOR.slate;
      fillRow(ws, row, 4, 4, tipeFill);
      row++;
    }
  }

  if (!anyPay) {
    writeEmptyNotice(ws, row, lastCol);
    row += 1;
  } else {
    ws.getCell(row, 4).value = "TOTAL";
    ws.getCell(row, 4).font = { bold: true };
    ws.getCell(row, 5).value = grandJumlah;
    ws.getCell(row, 5).numFmt = FMT_RUPIAH;
    ws.getCell(row, 5).font = { bold: true };
    fillRow(ws, row, 1, lastCol, COLOR.totalBg);
    row++;
  }
  const tableLastRow = row - 1;
  applyBorder(ws, headerRow, tableLastRow, lastCol);

  autoFitColumns(ws, lastCol);
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: tableLastRow, column: lastCol } };
}

// ===================== ENTRYPOINT =====================

export function buildInvoiceFileName(date = new Date()): string {
  return `Invoices-Piutang-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.xlsx`;
}

/** Bangun workbook 4 sheet dari data invoice (dipisah agar mudah diuji). */
export async function buildInvoiceWorkbook(payload: ExportInvoicePayload): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Sistem Inventory ERP";
  wb.created = new Date();

  const now = new Date();
  const rows = payload.invoices.map((inv) => enrich(inv, now));

  const meta: MetaInfo = {
    reportName: "Invoices & Piutang Dagang",
    period: payload.filterLabel && payload.filterLabel.trim().length > 0 ? payload.filterLabel : "Semua tagihan (tanpa filter)",
    exportDate: now,
    userName: safeText(payload.userName),
  };

  addRingkasanSheet(wb, rows, meta);
  addDaftarInvoiceSheet(wb, rows, meta);
  addRincianBarangSheet(wb, rows, meta);
  addRiwayatPembayaranSheet(wb, rows, meta);

  return wb;
}

/** Bangun workbook lalu picu unduhan di browser. Mengembalikan nama file. */
export async function exportInvoiceExcel(payload: ExportInvoicePayload): Promise<string> {
  const wb = await buildInvoiceWorkbook(payload);
  const fileName = buildInvoiceFileName();

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
