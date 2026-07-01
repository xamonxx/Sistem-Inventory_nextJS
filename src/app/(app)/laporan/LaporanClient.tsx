"use client";

import { useState, useMemo, useEffect, useTransition, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Table, Th, Td, Badge } from "@/components/ui";
import { Pagination, usePagination } from "@/components/Pagination";
import { formatRupiah, cn } from "@/lib/utils";
import {
  Download,
  BarChart3,
  TrendingUp,
  Wallet,
  ShieldAlert,
  Archive,
  Printer,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  LayoutGrid,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { exportAnalyticExcel } from "@/lib/export/exportAnalyticExcel";
import { printArea } from "@/lib/print";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";

type LaporanClientProps = {
  role: string;
  userName?: string;
  periodeLabel?: string;
  initialFrom?: string;
  initialTo?: string;
  marginData: { nama: string; qtyTerjual: number; omset: number; margin: number }[];
  terlaris: { nama: string; qtyTerjual: number; omset: number }[];
  stokData: {
    kode: string;
    nama: string;
    stokAkhir: number;
    minStok: number;
    hargaBeli: number;
    hargaJual: number;
    nilaiAset: number;
    status: string;
  }[];
  piutangData: {
    noInvoice: string;
    tanggal: string;
    client: string;
    total: number;
    dibayar: number;
    sisa: number;
    status: string;
  }[];
};

type TabKey = "ringkasan" | "omset" | "margin" | "piutang" | "stok";

// ===== Shared chart helpers (shadcn-style neutral surfaces) =====
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    fontSize: 12,
    padding: "8px 12px",
  },
  labelStyle: { fontWeight: 700, color: "#0f172a", marginBottom: 2 },
  itemStyle: { color: "#334155" },
};

const fmtAxis = (v: unknown) => {
  const n = v as number;
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1000 ? `${Math.round(n / 1000)}rb` : `${n}`;
};
// ===== Reusable surface (shadcn "Card") =====
function Panel({
  title,
  desc,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  desc?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          {icon}
          <div>
            <h3 className="text-sm font-bold leading-tight text-slate-900">{title}</h3>
            {desc && <p className="mt-0.5 text-[11px] text-muted">{desc}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "blue" | "amber" | "slate";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border transition-transform group-hover:scale-105", tones[tone])}>
          <Icon size={17} />
        </div>
      </div>
      <div data-tooltip={value} className="mt-3">
        <p className="font-display font-extrabold tracking-tight text-slate-900 text-sm sm:text-lg whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
      </div>
      <p className="mt-1 text-[11px] text-muted truncate" title={hint}>{hint}</p>
    </div>
  );
}

function PrintMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="laporan-pdf-metric">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </div>
  );
}

function PrintPage({
  title,
  subtitle,
  badge,
  children,
}: {
  title?: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="laporan-pdf-page">
      {title ? (
        <div className="laporan-pdf-page-title">
          <div>
            <p>Analisis ERP</p>
            <h2>{title}</h2>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          {badge ? <strong>{badge}</strong> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function PrintInsight({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="laporan-pdf-insight">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </div>
  );
}

function PrintBarValue({ value, percent }: { value: string; percent: string }) {
  return (
    <strong>
      <b>{value}</b>
      <em>{percent}</em>
    </strong>
  );
}

const printPercent = (value: number, total: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "0%");

function LaporanPrintDocument({
  role,
  userName,
  totalOmset,
  totalMargin,
  totalPiutang,
  totalAsetValue,
  terlaris,
  warningStok,
  agingAnalysis,
  assetTop,
  marginData,
  stokData,
  piutangData,
  inventoryHealth,
}: {
  role: string;
  userName?: string;
  totalOmset: number;
  totalMargin: number;
  totalPiutang: number;
  totalAsetValue: number;
  terlaris: { nama: string; qtyTerjual: number; omset: number }[];
  warningStok: {
    kode: string;
    nama: string;
    stokAkhir: number;
    minStok: number;
  }[];
  agingAnalysis: {
    items: Array<{
      noInvoice: string;
      client: string;
      total: number;
      sisa: number;
      status: string;
      ageDays: number;
      ageGroup: string;
    }>;
    summary: {
      currentBucket: number;
      midBucket: number;
      lateBucket: number;
      criticalBucket: number;
    };
  };
  assetTop: { name: string; nilai: number }[];
  marginData: { nama: string; qtyTerjual: number; omset: number; margin: number }[];
  stokData: {
    kode: string;
    nama: string;
    stokAkhir: number;
    minStok: number;
    hargaBeli: number;
    hargaJual: number;
    nilaiAset: number;
    status: string;
  }[];
  piutangData: {
    noInvoice: string;
    tanggal: string;
    client: string;
    total: number;
    dibayar: number;
    sisa: number;
    status: string;
  }[];
  inventoryHealth: {
    all: Array<LaporanClientProps["stokData"][number] & { soldQty: number; velocity: "FAST" | "NORMAL" | "SLOW" | "DEAD" }>;
    fastMoving: Array<LaporanClientProps["stokData"][number] & { soldQty: number; velocity: "FAST" | "NORMAL" | "SLOW" | "DEAD" }>;
    slowMoving: Array<LaporanClientProps["stokData"][number] & { soldQty: number; velocity: "FAST" | "NORMAL" | "SLOW" | "DEAD" }>;
  };
}) {
  const isGudang = role === "ADMIN_GUDANG";
  const generatedAt = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const topOmset = [...marginData].sort((a, b) => b.omset - a.omset).slice(0, 8);
  const topVolume = [...terlaris].sort((a, b) => b.qtyTerjual - a.qtyTerjual).slice(0, 8);
  const topMargin = [...marginData].sort((a, b) => b.margin - a.margin).slice(0, 8);
  const lowMargin = [...marginData]
    .filter((item) => item.omset > 0)
    .sort((a, b) => a.margin / a.omset - b.margin / b.omset)
    .slice(0, 6);
  const assetRows = assetTop.slice(0, 8);
  const maxOmset = Math.max(1, ...topOmset.map((x) => x.omset));
  const maxQty = Math.max(1, ...topVolume.map((x) => x.qtyTerjual));
  const maxMargin = Math.max(1, ...topMargin.map((x) => x.margin));
  const maxAsset = Math.max(1, ...assetRows.map((x) => x.nilai));
  const topWarnings = warningStok.slice(0, 8);
  const outstanding = agingAnalysis.items
    .filter((p) => p.status !== "LUNAS")
    .sort((a, b) => b.sisa - a.sisa)
    .slice(0, 8);
  const paidCount = piutangData.filter((p) => p.status === "LUNAS").length;
  const unpaidCount = Math.max(0, piutangData.length - paidCount);
  const totalUnits = marginData.reduce((acc, item) => acc + item.qtyTerjual, 0);
  const marginRate = totalOmset > 0 ? Math.round((totalMargin / totalOmset) * 100) : 0;
  const averageInvoice = piutangData.length > 0 ? piutangData.reduce((acc, item) => acc + item.total, 0) / piutangData.length : 0;
  const totalAging = agingAnalysis.summary.currentBucket + agingAnalysis.summary.midBucket + agingAnalysis.summary.lateBucket + agingAnalysis.summary.criticalBucket;
  const fastRows = inventoryHealth.fastMoving.slice(0, 6);
  const slowRows = inventoryHealth.slowMoving.slice(0, 6);
  const stockMinus = stokData.filter((s) => s.stokAkhir < 0).length;
  const healthyStock = stokData.filter((s) => s.status !== "MENIPIS" && s.stokAkhir >= 0).length;
  const soldProductCount = marginData.filter((item) => item.qtyTerjual > 0).length;
  const stockRiskRate = printPercent(warningStok.length, Math.max(1, stokData.length));
  const healthyStockRate = printPercent(healthyStock, Math.max(1, stokData.length));
  const slowMovingRate = printPercent(inventoryHealth.slowMoving.length, Math.max(1, stokData.length));
  const marginPercent = (margin: number, omset: number) => (omset > 0 ? `${Math.round((margin / omset) * 100)}%` : "0%");

  return (
    <div className="print-area laporan-print-source" aria-hidden="true">
      <article className="laporan-pdf">
        <PrintPage>
          <header className="laporan-pdf-hero">
            <div>
              <p className="laporan-pdf-eyebrow">PUTRA CORPORATION</p>
              <h1>Analitik & Laporan ERP</h1>
              <p>Dokumen lengkap seluruh modul analisis: ringkasan, penjualan, margin, piutang-aging, stok, dan aset persediaan.</p>
            </div>
            <div className="laporan-pdf-meta">
              <span>Dicetak oleh</span>
              <strong>{userName ?? "Admin Gudang"}</strong>
              <span>{generatedAt}</span>
            </div>
          </header>

          <section className="laporan-pdf-grid">
            <PrintMetric label="Total Pendapatan" value={formatRupiah(totalOmset)} hint="Akumulasi omset penjualan" />
            <PrintMetric label="Margin Keuntungan" value={isGudang ? formatRupiah(totalMargin) : "Dibatasi"} hint="Laba kotor setelah modal" />
            <PrintMetric label="Outstanding Piutang" value={formatRupiah(totalPiutang)} hint="Tagihan belum tertagih" />
            <PrintMetric label="Nilai Aset Persediaan" value={isGudang ? formatRupiah(totalAsetValue) : "Dibatasi"} hint="Valuasi stok gudang" />
          </section>

          <section className="laporan-pdf-mini-grid">
            <PrintInsight label="Unit Terjual" value={`${totalUnits} unit`} note="Akumulasi volume barang terjual" />
            <PrintInsight label="Rasio Margin" value={isGudang ? `${marginRate}%` : "Dibatasi"} note="Margin dibanding total pendapatan" />
            <PrintInsight label="Risiko Stok" value={`${warningStok.length} item`} note={`${stockRiskRate} dari seluruh stok perlu ditinjau`} />
          </section>

          <section className="laporan-pdf-note">
            <h2>Prioritas Analisis</h2>
            <ul>
              <li>Penjualan teratas menyumbang {topOmset[0] ? printPercent(topOmset[0].omset, totalOmset) : "0%"} dari total omset; cek ketersediaan barang utamanya.</li>
              <li>{unpaidCount} invoice belum lunas dengan outstanding {formatRupiah(totalPiutang)}; dahulukan nominal terbesar pada halaman Piutang.</li>
              <li>{warningStok.length} item masuk risiko stok ({stockRiskRate}); cocokkan fisik gudang sebelum pembelian ulang.</li>
            </ul>
          </section>

          <section className="laporan-pdf-section">
            <div className="laporan-pdf-section-head">
              <div>
                <h2>Omset Barang Terlaris</h2>
                <p>Produk dengan kontribusi pendapatan tertinggi.</p>
              </div>
              <span>Top {topOmset.length}</span>
            </div>
            <div className="laporan-pdf-bars">
              {topOmset.map((it) => (
                <div className="laporan-pdf-bar-row" key={it.nama}>
                  <span>{it.nama}</span>
                  <div>
                    <i style={{ width: `${Math.max(8, (it.omset / maxOmset) * 100)}%` }} />
                  </div>
                  <PrintBarValue value={formatRupiah(it.omset)} percent={`${printPercent(it.omset, totalOmset)} omset`} />
                </div>
              ))}
            </div>
          </section>
          <footer className="laporan-pdf-footer">
            <span>Halaman 1 - Ringkasan Eksekutif</span>
            <span>PUTRA CORPORATION</span>
          </footer>
        </PrintPage>

        <PrintPage title="Penjualan" subtitle="Analisis performa barang berdasarkan volume unit dan total omset." badge="Sales">
          <section className="laporan-pdf-mini-grid">
            <PrintInsight label="Produk Terjual" value={`${soldProductCount} item`} note={`${printPercent(soldProductCount, Math.max(1, marginData.length))} dari katalog penjualan`} />
            <PrintInsight label="Volume Tertinggi" value={topVolume[0] ? `${topVolume[0].qtyTerjual} unit` : "0 unit"} note={topVolume[0]?.nama ?? "Belum ada transaksi"} />
            <PrintInsight label="Rata-rata Invoice" value={formatRupiah(averageInvoice)} note="Nilai rata-rata transaksi piutang/invoice" />
          </section>

          <section className="laporan-pdf-section">
            <div className="laporan-pdf-section-head">
              <div>
                <h2>Volume Barang Terlaris</h2>
                <p>Ranking barang berdasarkan jumlah unit terjual.</p>
              </div>
              <span>Top {topVolume.length}</span>
            </div>
            <div className="laporan-pdf-bars laporan-pdf-bars-emerald">
              {topVolume.map((it) => (
                <div className="laporan-pdf-bar-row" key={it.nama}>
                  <span>{it.nama}</span>
                  <div>
                    <i style={{ width: `${Math.max(8, (it.qtyTerjual / maxQty) * 100)}%` }} />
                  </div>
                  <PrintBarValue value={`${it.qtyTerjual} unit`} percent={`${printPercent(it.qtyTerjual, totalUnits)} volume`} />
                </div>
              ))}
            </div>
          </section>

          <section className="laporan-pdf-section">
            <div className="laporan-pdf-section-head">
              <div>
                <h2>Daftar Omset Produk Terjual</h2>
                <p>Detail qty dan pendapatan kotor setiap barang prioritas.</p>
              </div>
            </div>
            <table className="laporan-pdf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barang</th>
                  <th>Qty</th>
                  <th>Omset</th>
                  <th>Kontribusi</th>
                </tr>
              </thead>
              <tbody>
                {topOmset.map((it, index) => (
                  <tr key={it.nama}>
                    <td>{index + 1}</td>
                    <td>{it.nama}</td>
                    <td>{it.qtyTerjual} unit</td>
                    <td>{formatRupiah(it.omset)}</td>
                    <td>{printPercent(it.omset, totalOmset)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <footer className="laporan-pdf-footer">
            <span>Halaman 2 - Analisis Penjualan</span>
            <span>{formatRupiah(totalOmset)} total omset</span>
          </footer>
        </PrintPage>

        {isGudang ? (
          <PrintPage title="Margin Keuntungan" subtitle="Evaluasi profitabilitas produk agar keputusan stok tidak hanya berbasis omset." badge="Margin">
            <section className="laporan-pdf-mini-grid">
              <PrintInsight label="Total Margin" value={formatRupiah(totalMargin)} note="Laba kotor dari barang terjual" />
              <PrintInsight label="Rasio Margin" value={`${marginRate}%`} note="Persentase margin terhadap omset" />
              <PrintInsight label="Margin Terbesar" value={topMargin[0] ? formatRupiah(topMargin[0].margin) : formatRupiah(0)} note={topMargin[0]?.nama ?? "Belum ada margin"} />
            </section>

            <section className="laporan-pdf-section">
              <div className="laporan-pdf-section-head">
                <div>
                  <h2>Produk Paling Menguntungkan</h2>
                  <p>Ranking berdasarkan nilai margin bersih.</p>
                </div>
                <span>Top {topMargin.length}</span>
              </div>
              <div className="laporan-pdf-bars laporan-pdf-bars-blue">
                {topMargin.map((it) => (
                  <div className="laporan-pdf-bar-row" key={it.nama}>
                    <span>{it.nama}</span>
                    <div>
                      <i style={{ width: `${Math.max(8, (it.margin / maxMargin) * 100)}%` }} />
                    </div>
                    <PrintBarValue value={formatRupiah(it.margin)} percent={`${printPercent(it.margin, totalMargin)} margin`} />
                  </div>
                ))}
              </div>
            </section>

            <section className="laporan-pdf-section">
              <div className="laporan-pdf-section-head">
                <div>
                  <h2>Detail Margin Produk</h2>
                  <p>Omset, margin, dan persentase keuntungan per barang.</p>
                </div>
              </div>
              <table className="laporan-pdf-table">
                <thead>
                  <tr>
                    <th>Barang</th>
                    <th>Qty</th>
                    <th>Omset</th>
                    <th>Margin</th>
                    <th>Rasio</th>
                    <th>Kontribusi</th>
                  </tr>
                </thead>
                <tbody>
                  {topMargin.map((it) => (
                    <tr key={it.nama}>
                      <td>{it.nama}</td>
                      <td>{it.qtyTerjual} unit</td>
                      <td>{formatRupiah(it.omset)}</td>
                      <td className="laporan-pdf-positive">{formatRupiah(it.margin)}</td>
                      <td>{marginPercent(it.margin, it.omset)}</td>
                      <td>{printPercent(it.margin, totalMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="laporan-pdf-section laporan-pdf-compact">
              <div className="laporan-pdf-section-head">
                <div>
                  <h2>Produk Dengan Rasio Margin Rendah</h2>
                  <p>Daftar ini membantu menentukan penyesuaian harga atau prioritas pembelian.</p>
                </div>
              </div>
              <table className="laporan-pdf-table">
                <tbody>
                  {lowMargin.map((it) => (
                    <tr key={it.nama}>
                      <td>{it.nama}</td>
                      <td>{formatRupiah(it.margin)}</td>
                      <td>{marginPercent(it.margin, it.omset)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <footer className="laporan-pdf-footer">
              <span>Halaman 3 - Analisis Margin</span>
              <span>{marginRate}% rasio margin total</span>
            </footer>
          </PrintPage>
        ) : null}

        <PrintPage title="Piutang & Aging" subtitle="Kontrol risiko tagihan berdasarkan umur piutang dan status pembayaran." badge="Receivable">
          <section className="laporan-pdf-grid">
            <PrintMetric label="0-30 Hari" value={formatRupiah(agingAnalysis.summary.currentBucket)} hint={`${printPercent(agingAnalysis.summary.currentBucket, totalAging)} dari outstanding`} />
            <PrintMetric label="31-60 Hari" value={formatRupiah(agingAnalysis.summary.midBucket)} hint={`${printPercent(agingAnalysis.summary.midBucket, totalAging)} dari outstanding`} />
            <PrintMetric label="61-90 Hari" value={formatRupiah(agingAnalysis.summary.lateBucket)} hint={`${printPercent(agingAnalysis.summary.lateBucket, totalAging)} dari outstanding`} />
            <PrintMetric label=">90 Hari" value={formatRupiah(agingAnalysis.summary.criticalBucket)} hint={`${printPercent(agingAnalysis.summary.criticalBucket, totalAging)} dari outstanding`} />
          </section>

          <div className="laporan-pdf-columns">
            <section className="laporan-pdf-section">
              <div className="laporan-pdf-section-head">
                <div>
                  <h2>Komposisi Umur Piutang</h2>
                  <p>Outstanding per kelompok umur.</p>
                </div>
              </div>
              <div className="laporan-pdf-aging">
                <div><span>0-30 Hari</span><strong>{formatRupiah(agingAnalysis.summary.currentBucket)} ({printPercent(agingAnalysis.summary.currentBucket, totalAging)})</strong></div>
                <div><span>31-60 Hari</span><strong>{formatRupiah(agingAnalysis.summary.midBucket)} ({printPercent(agingAnalysis.summary.midBucket, totalAging)})</strong></div>
                <div><span>61-90 Hari</span><strong>{formatRupiah(agingAnalysis.summary.lateBucket)} ({printPercent(agingAnalysis.summary.lateBucket, totalAging)})</strong></div>
                <div><span>&gt;90 Hari</span><strong>{formatRupiah(agingAnalysis.summary.criticalBucket)} ({printPercent(agingAnalysis.summary.criticalBucket, totalAging)})</strong></div>
              </div>
            </section>

            <section className="laporan-pdf-section">
              <div className="laporan-pdf-section-head">
                <div>
                  <h2>Status Pembayaran</h2>
                  <p>Rasio invoice lunas dan belum lunas.</p>
                </div>
              </div>
              <div className="laporan-pdf-aging">
                <div><span>Invoice Lunas</span><strong>{paidCount} invoice ({printPercent(paidCount, piutangData.length)})</strong></div>
                <div><span>Belum Lunas</span><strong>{unpaidCount} invoice ({printPercent(unpaidCount, piutangData.length)})</strong></div>
                <div><span>Total Outstanding</span><strong>{formatRupiah(totalPiutang)}</strong></div>
                <div><span>Rata-rata Invoice</span><strong>{formatRupiah(averageInvoice)}</strong></div>
              </div>
            </section>
          </div>

          <section className="laporan-pdf-section">
            <div className="laporan-pdf-section-head">
              <div>
                <h2>Daftar Prioritas Penagihan</h2>
                <p>Invoice belum lunas diurutkan dari nominal outstanding terbesar.</p>
              </div>
            </div>
            <table className="laporan-pdf-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Umur</th>
                  <th>Sisa</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((p) => (
                  <tr key={p.noInvoice}>
                    <td>{p.noInvoice}</td>
                    <td>{p.client}</td>
                    <td>{p.ageDays} hari</td>
                    <td>{formatRupiah(p.sisa)}</td>
                    <td>{printPercent(p.sisa, totalPiutang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <footer className="laporan-pdf-footer">
            <span>Halaman {isGudang ? 4 : 3} - Analisis Piutang & Aging</span>
            <span>{formatRupiah(totalPiutang)} outstanding</span>
          </footer>
        </PrintPage>

        <PrintPage title="Stok & Aset" subtitle="Valuasi persediaan, peringatan stok, dan indikator pergerakan barang." badge="Inventory">
          <section className="laporan-pdf-mini-grid">
            <PrintInsight label="Item Sehat" value={`${healthyStock} item`} note={`${healthyStockRate} dari seluruh item`} />
            <PrintInsight label="Stok Minus" value={`${stockMinus} item`} note="Butuh koreksi fisik atau retur" />
            <PrintInsight label="Slow Moving" value={`${inventoryHealth.slowMoving.length} item`} note={`${slowMovingRate} dari seluruh item`} />
          </section>

          <section className="laporan-pdf-section">
            <div className="laporan-pdf-section-head">
              <div>
                <h2>Aset Persediaan Terbesar</h2>
                <p>Nilai aset berdasarkan stok akhir.</p>
              </div>
              <span>Top {assetTop.length}</span>
            </div>
            <div className="laporan-pdf-bars laporan-pdf-bars-blue">
              {assetRows.map((it) => (
                <div className="laporan-pdf-bar-row" key={it.name}>
                  <span>{it.name}</span>
                  <div>
                    <i style={{ width: `${Math.max(8, (it.nilai / maxAsset) * 100)}%` }} />
                  </div>
                  <PrintBarValue value={isGudang ? formatRupiah(it.nilai) : "Dibatasi"} percent={`${printPercent(it.nilai, totalAsetValue)} aset`} />
                </div>
              ))}
            </div>
          </section>

          <div className="laporan-pdf-columns">
            <section className="laporan-pdf-section">
              <div className="laporan-pdf-section-head">
                <div>
                  <h2>Peringatan Stok</h2>
                  <p>Barang minus atau di bawah safety stock.</p>
                </div>
                <span>{warningStok.length} item</span>
              </div>
              <table className="laporan-pdf-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nama Barang</th>
                    <th>Stok</th>
                    <th>Min</th>
                  </tr>
                </thead>
                <tbody>
                  {topWarnings.map((it) => (
                    <tr key={it.kode}>
                      <td>{it.kode}</td>
                      <td>{it.nama}</td>
                      <td className={it.stokAkhir < 0 ? "laporan-pdf-danger" : ""}>{it.stokAkhir} unit</td>
                      <td>{it.minStok}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="laporan-pdf-section">
              <div className="laporan-pdf-section-head">
                <div>
                  <h2>Barang Lambat Bergerak</h2>
                  <p>Stok tersedia dengan penjualan rendah atau nihil.</p>
                </div>
              </div>
              <table className="laporan-pdf-table">
                <thead>
                  <tr>
                    <th>Barang</th>
                    <th>Stok</th>
                    <th>Terjual</th>
                  </tr>
                </thead>
                <tbody>
                  {slowRows.map((it) => (
                    <tr key={it.kode}>
                      <td>{it.nama}</td>
                      <td>{it.stokAkhir} unit</td>
                      <td>{it.soldQty} unit</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="laporan-pdf-section laporan-pdf-compact">
            <div className="laporan-pdf-section-head">
              <div>
                <h2>Fast Moving</h2>
                <p>Barang dengan pergerakan terbaik untuk prioritas ketersediaan.</p>
              </div>
            </div>
            <table className="laporan-pdf-table">
              <thead>
                <tr>
                  <th>Barang</th>
                  <th>Stok</th>
                  <th>Terjual</th>
                  <th>Nilai Aset</th>
                </tr>
              </thead>
              <tbody>
                {(fastRows.length > 0 ? fastRows : inventoryHealth.all.slice(0, 6)).map((it) => (
                  <tr key={it.kode}>
                    <td>{it.nama}</td>
                    <td>{it.stokAkhir} unit</td>
                    <td>{it.soldQty} unit</td>
                    <td>{isGudang ? formatRupiah(it.nilaiAset) : "Dibatasi"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <footer className="laporan-pdf-footer">
            <span>Halaman {isGudang ? 5 : 4} - Analisis Stok & Aset</span>
            <span>{isGudang ? formatRupiah(totalAsetValue) : "Aset dibatasi"} valuasi stok</span>
          </footer>
        </PrintPage>
      </article>
    </div>
  );
}

export function LaporanClient({ role, userName, periodeLabel, initialFrom, initialTo, marginData, terlaris, stokData, piutangData }: LaporanClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("ringkasan");
  const [mounted, setMounted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isGudang = role === "ADMIN_GUDANG";

  const router = useRouter();
  const pathname = usePathname();
  const [isFilterPending, startFilterTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  // ===== Filter periode (server-side via query URL) =====
  // Data analitik diagregasi di server, jadi perubahan periode mendorong
  // parameter ?from&to ke URL lalu server memuat ulang data sesuai rentang.
  const handlePeriodChange = (range: ResolvedPeriodRange) => {
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    if (range.label) params.set("label", range.label);
    const qs = params.toString();
    startFilterTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  // ===== Export Excel (mengikuti data asli halaman + periode aktif) =====
  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportAnalyticExcel({ role, userName, period: periodeLabel, marginData, terlaris, stokData, piutangData });
      toast.success("Export Excel berhasil");
    } catch (err) {
      console.error("Export Excel gagal:", err);
      toast.error("Export Excel gagal, silakan coba lagi");
    } finally {
      setExporting(false);
    }
  };

  const handlePrintPdf = () => {
    printArea({ className: "print-laporan-a4" });
  };

  // ===== Summary totals =====
  const totalOmset = useMemo(() => marginData.reduce((acc, r) => acc + r.omset, 0), [marginData]);
  const totalMargin = useMemo(() => (isGudang ? marginData.reduce((acc, r) => acc + r.margin, 0) : 0), [marginData, isGudang]);
  const totalPiutang = useMemo(() => piutangData.filter((p) => p.status !== "LUNAS").reduce((acc, p) => acc + p.sisa, 0), [piutangData]);
  const totalAsetValue = useMemo(() => stokData.reduce((acc, s) => acc + s.nilaiAset, 0), [stokData]);
  const stokMenipisCount = useMemo(() => stokData.filter((s) => s.status === "MENIPIS").length, [stokData]);

  // ===== Aging analysis =====
  const agingAnalysis = useMemo(() => {
    let currentBucket = 0;
    let midBucket = 0;
    let lateBucket = 0;
    let criticalBucket = 0;
    const now = new Date();

    const formattedPiutang = piutangData.map((p) => {
      const invoiceDate = new Date(p.tanggal);
      const diffDays = Math.ceil(Math.abs(now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      let ageGroup = "0-30 Hari";
      if (diffDays > 90) {
        ageGroup = ">90 Hari";
        if (p.status !== "LUNAS") criticalBucket += p.sisa;
      } else if (diffDays > 60) {
        ageGroup = "61-90 Hari";
        if (p.status !== "LUNAS") lateBucket += p.sisa;
      } else if (diffDays > 30) {
        ageGroup = "31-60 Hari";
        if (p.status !== "LUNAS") midBucket += p.sisa;
      } else {
        if (p.status !== "LUNAS") currentBucket += p.sisa;
      }
      return { ...p, ageDays: diffDays, ageGroup };
    });

    return { items: formattedPiutang, summary: { currentBucket, midBucket, lateBucket, criticalBucket } };
  }, [piutangData]);

  // ===== Inventory health (fast/slow) =====
  const inventoryHealth = useMemo(() => {
    const salesMap = new Map<string, number>();
    marginData.forEach((item) => salesMap.set(item.nama, item.qtyTerjual));

    const enrichedStok = stokData.map((s) => {
      const soldQty = salesMap.get(s.nama) ?? 0;
      let velocity: "FAST" | "NORMAL" | "SLOW" | "DEAD" = "NORMAL";
      if (soldQty >= 15) velocity = "FAST";
      else if (soldQty === 0 && s.stokAkhir > 0) velocity = "DEAD";
      else if (soldQty <= 3) velocity = "SLOW";
      return { ...s, soldQty, velocity };
    });

    return {
      all: enrichedStok,
      fastMoving: enrichedStok.filter((s) => s.velocity === "FAST").sort((a, b) => b.soldQty - a.soldQty),
      slowMoving: enrichedStok.filter((s) => s.velocity === "SLOW" || s.velocity === "DEAD").sort((a, b) => a.soldQty - b.soldQty),
    };
  }, [stokData, marginData]);

  // ===== Chart datasets =====
  const omsetTop = useMemo(
    () => [...marginData].sort((a, b) => b.omset - a.omset).slice(0, 10).map((r) => ({ nama: r.nama, omset: r.omset, margin: r.margin, qty: r.qtyTerjual })),
    [marginData]
  );
  const terlarisChart = useMemo(() => terlaris.slice(0, 10).map((t) => ({ nama: t.nama, omset: t.omset, qty: t.qtyTerjual })), [terlaris]);
  const qtyTop = useMemo(
    () => [...marginData].sort((a, b) => b.qtyTerjual - a.qtyTerjual).slice(0, 10).map((r) => ({ nama: r.nama, qty: r.qtyTerjual })),
    [marginData]
  );
  const assetTop = useMemo(
    () => [...stokData].filter((s) => s.nilaiAset > 0).sort((a, b) => b.nilaiAset - a.nilaiAset).slice(0, 10).map((s) => ({ name: s.nama, nilai: s.nilaiAset })),
    [stokData]
  );
  const agingPie = useMemo(() => {
    const s = agingAnalysis.summary;
    return [
      { name: "0-30 Hari", value: s.currentBucket, color: "#10b981" },
      { name: "31-60 Hari", value: s.midBucket, color: "#f59e0b" },
      { name: "61-90 Hari", value: s.lateBucket, color: "#fb7185" },
      { name: ">90 Hari", value: s.criticalBucket, color: "#ef4444" },
    ].filter((b) => b.value > 0);
  }, [agingAnalysis]);

  // Barang menipis / minus untuk tabel peringatan
  const warningStok = useMemo(
    () => stokData.filter((s) => s.status === "MENIPIS" || s.stokAkhir < 0),
    [stokData]
  );

  // ===== Pagination per tabel (maks 10 baris) =====
  const terlarisPg = usePagination(terlaris, 10);
  const warningPg = usePagination(warningStok, 10);
  const omsetPg = usePagination(marginData, 10);
  const marginPg = usePagination(marginData, 10);
  const agingPg = usePagination(agingAnalysis.items, 10);
  const fastPg = usePagination(inventoryHealth.fastMoving, 10);
  const slowPg = usePagination(inventoryHealth.slowMoving, 10);
  const valPg = usePagination(stokData, 10);


  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "ringkasan", label: "Ringkasan", icon: LayoutGrid },
    { key: "omset", label: "Penjualan", icon: TrendingUp },
    ...(isGudang ? [{ key: "margin" as const, label: "Margin", icon: BarChart3 }] : []),
    { key: "piutang", label: "Piutang & Aging", icon: Wallet },
    { key: "stok", label: "Stok & Aset", icon: Archive },
  ];

  const ChartSkeleton = ({ h = 280 }: { h?: number }) => <div className="skel w-full" style={{ height: h }} />;
  const EmptyChart = ({ h = 280, text }: { h?: number; text: string }) => (
    <div className="flex w-full items-center justify-center text-xs text-muted" style={{ height: h }}>
      {text}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ===== Tabs (shadcn segmented) + actions ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-slate-100/70 p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
                  active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon size={14} className={active ? "text-[var(--primary)]" : ""} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-xs transition hover:bg-emerald-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={14} /> {exporting ? "Mengekspor..." : "Export Excel"}
          </button>
          <button
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 cursor-pointer"
          >
            <Printer size={14} /> Export PDF A4
          </button>
        </div>
      </div>

      {/* ===== Filter periode (server-side) ===== */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Periode</span>
          <PeriodFilter
            onChange={handlePeriodChange}
            defaultPreset={initialFrom || initialTo ? "custom" : "all"}
            defaultFrom={initialFrom}
            defaultTo={initialTo}
            align="left"
          />
          {isFilterPending && <span className="text-[11px] font-medium text-muted animate-pulse">Memuat…</span>}
        </div>
        <p className="text-[11px] text-muted">
          Stok &amp; Aset menampilkan posisi terkini (tidak mengikuti periode).
        </p>
      </div>

      <LaporanPrintDocument
        role={role}
        userName={userName}
        totalOmset={totalOmset}
        totalMargin={totalMargin}
        totalPiutang={totalPiutang}
        totalAsetValue={totalAsetValue}
        terlaris={terlaris}
        warningStok={warningStok}
        agingAnalysis={agingAnalysis}
        assetTop={assetTop}
        marginData={marginData}
        stokData={stokData}
        piutangData={piutangData}
        inventoryHealth={inventoryHealth}
      />

      {/* ===== KPI cards ===== */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} tone="emerald" label="Total Pendapatan" value={formatRupiah(totalOmset)} hint="Akumulasi omset penjualan" />
        <StatCard icon={BarChart3} tone="blue" label="Margin Keuntungan" value={isGudang ? formatRupiah(totalMargin) : "ðŸ”’ Dibatasi"} hint="Laba kotor setelah modal" />
        <StatCard icon={Wallet} tone="amber" label="Outstanding Piutang" value={formatRupiah(totalPiutang)} hint="Tagihan belum tertagih" />
        <StatCard icon={Archive} tone="slate" label="Nilai Aset Persediaan" value={isGudang ? formatRupiah(totalAsetValue) : "ðŸ”’ Dibatasi"} hint="Valuasi stok gudang" />
      </section>

      {/* ====================== RINGKASAN ====================== */}
      {activeTab === "ringkasan" && (
        <div className="space-y-6">
          <Panel
            title="Omset 10 Barang Terlaris"
            desc="Kontribusi pendapatan tiap produk unggulan"
            icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600"><TrendingUp size={17} /></div>}
            action={<Badge tone="green">Sales Leader</Badge>}
          >
            {!mounted ? (
              <ChartSkeleton />
            ) : terlarisChart.length === 0 ? (
              <EmptyChart text="Belum ada data penjualan." />
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={terlarisChart} layout="vertical" margin={{ left: 8, right: 48 }}>
                  <defs>
                    <linearGradient id="omsetBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={fmtAxis} />
                  <YAxis type="category" dataKey="nama" width={250} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(5,150,105,0.05)" }} formatter={(v: unknown) => [formatRupiah(v as number), "Omset"]} />
                  <Bar dataKey="omset" fill="url(#omsetBar)" radius={[0, 6, 6, 0]} barSize={18}>
                    <LabelList dataKey="omset" position="right" formatter={fmtAxis} fontSize={10} fill="#64748b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel
              title="10 Barang Terlaris (Volume)"
              desc="Berdasarkan kuantitas unit terjual"
              icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600"><Boxes size={17} /></div>}
            >
              <Table className="border-none shadow-none bg-transparent rounded-none">
                <thead>
                  <tr>
                    <Th className="w-10 text-center">#</Th>
                    <Th>Nama Barang</Th>
                    <Th className="w-24 text-center">Volume</Th>
                    <Th className="w-32 text-right">Omset</Th>
                  </tr>
                </thead>
                <tbody>
                  {terlarisPg.pageData.map((it, i) => (
                    <tr key={(terlarisPg.page - 1) * terlarisPg.perPage + i}>
                      <Td className="text-center text-xs font-bold text-slate-400">{(terlarisPg.page - 1) * terlarisPg.perPage + i + 1}</Td>
                      <Td className="font-semibold text-slate-700">{it.nama}</Td>
                      <Td className="text-center font-mono text-xs font-bold text-slate-600">{it.qtyTerjual} unit</Td>
                      <Td className="text-right font-mono font-semibold text-slate-800">{formatRupiah(it.omset)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={terlarisPg.page} perPage={terlarisPg.perPage} total={terlarisPg.total} onPage={terlarisPg.setPage} />
            </Panel>

            <Panel
              title={`Peringatan Stok (${stokMenipisCount})`}
              desc="Barang menipis / minus yang butuh tindakan"
              icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600"><ShieldAlert size={17} /></div>}
              action={<Badge tone="red">Tindakan Cepat</Badge>}
            >
              <Table className="border-none shadow-none bg-transparent rounded-none">
                <thead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Nama Barang</Th>
                    <Th className="w-24 text-center">Stok</Th>
                    <Th className="w-20 text-center">Min</Th>
                  </tr>
                </thead>
                <tbody>
                  {warningPg.pageData.map((it) => (
                    <tr key={it.kode}>
                      <Td className="font-mono text-[10px] text-slate-400">{it.kode}</Td>
                      <Td className="font-semibold text-slate-700">{it.nama}</Td>
                      <Td className="text-center">
                        <Badge tone={it.stokAkhir < 0 ? "red" : "amber"}>{it.stokAkhir} unit</Badge>
                      </Td>
                      <Td className="text-center font-mono text-xs text-slate-500">{it.minStok}</Td>
                    </tr>
                  ))}
                  {warningStok.length === 0 && (
                    <tr>
                      <Td colSpan={4} className="py-12 text-center text-sm text-slate-400">
                        Semua stok aman. Tidak ada barang di bawah limit. ðŸ‘
                      </Td>
                    </tr>
                  )}
                </tbody>
              </Table>
              <Pagination page={warningPg.page} perPage={warningPg.perPage} total={warningPg.total} onPage={warningPg.setPage} />
            </Panel>
          </div>
        </div>
      )}

      {/* ====================== PENJUALAN ====================== */}
      {activeTab === "omset" && (
        <div className="space-y-6">
          <Panel
            title="Volume Penjualan per Produk"
            desc="10 produk dengan kuantitas unit terjual terbanyak"
            icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600"><TrendingUp size={17} /></div>}
          >
            {!mounted ? (
              <ChartSkeleton h={340} />
            ) : qtyTop.length === 0 ? (
              <EmptyChart text="Belum ada data penjualan." />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={qtyTop} layout="vertical" margin={{ left: 8, right: 48 }}>
                  <defs>
                    <linearGradient id="qtyBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="nama" width={250} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(16,185,129,0.05)" }} formatter={(v: unknown) => [`${v as number} unit`, "Qty Terjual"]} />
                  <Bar dataKey="qty" fill="url(#qtyBar)" radius={[0, 6, 6, 0]} barSize={18}>
                    <LabelList dataKey="qty" position="right" formatter={(v: unknown) => `${v as number}`} fontSize={10} fill="#64748b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Daftar Omset Produk Terjual" desc="Total volume omset barang dagang">
            <Table className="border-none shadow-none bg-transparent rounded-none">
              <thead>
                <tr>
                  <Th>Nama Barang</Th>
                  <Th className="w-40 text-center">Kuantitas Terjual</Th>
                  <Th className="w-56 text-right">Total Omset Kotor</Th>
                </tr>
              </thead>
              <tbody>
                {omsetPg.pageData.map((r) => (
                  <tr key={r.nama}>
                    <Td className="font-semibold text-slate-700">{r.nama}</Td>
                    <Td className="text-center font-mono font-bold text-slate-600">{r.qtyTerjual} unit</Td>
                    <Td className="text-right font-mono font-bold text-slate-800">{formatRupiah(r.omset)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={omsetPg.page} perPage={omsetPg.perPage} total={omsetPg.total} onPage={omsetPg.setPage} />
          </Panel>
        </div>
      )}

      {/* ====================== MARGIN ====================== */}
      {activeTab === "margin" && isGudang && (
        <div className="space-y-6">
          <Panel
            title="Omset vs Keuntungan Bersih"
            desc="Perbandingan pendapatan dan margin per produk"
            icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600"><BarChart3 size={17} /></div>}
          >
            {!mounted ? (
              <ChartSkeleton />
            ) : omsetTop.length === 0 ? (
              <EmptyChart text="Belum ada data margin." />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={omsetTop} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={fmtAxis} />
                  <YAxis type="category" dataKey="nama" width={250} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(59,130,246,0.05)" }} formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]} />
                  <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar name="Omset" dataKey="omset" fill="#cbd5e1" radius={[0, 5, 5, 0]} barSize={10} />
                  <Bar name="Margin" dataKey="margin" fill="#10b981" radius={[0, 5, 5, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Analisis Margin Bersih Penjualan" desc="Evaluasi produk paling menguntungkan">
            <Table className="border-none shadow-none bg-transparent rounded-none">
              <thead>
                <tr>
                  <Th>Nama Barang</Th>
                  <Th className="w-32 text-center">Qty Terjual</Th>
                  <Th className="w-44 text-right">Omset</Th>
                  <Th className="w-44 text-right">Margin Bersih</Th>
                  <Th className="w-32 text-center">Profitabilitas</Th>
                </tr>
              </thead>
              <tbody>
                {marginPg.pageData.map((r) => {
                  const marginPct = r.omset > 0 ? Math.round((r.margin / r.omset) * 100) : 0;
                  return (
                    <tr key={r.nama}>
                      <Td className="font-semibold text-slate-700">{r.nama}</Td>
                      <Td className="text-center font-mono text-slate-600">{r.qtyTerjual} unit</Td>
                      <Td className="text-right font-mono text-slate-600">{formatRupiah(r.omset)}</Td>
                      <Td className="text-right font-mono font-bold text-emerald-600">{formatRupiah(r.margin)}</Td>
                      <Td className="text-center">
                        <Badge tone={marginPct > 20 ? "green" : marginPct > 10 ? "blue" : "amber"}>{marginPct}% Margin</Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={marginPg.page} perPage={marginPg.perPage} total={marginPg.total} onPage={marginPg.setPage} />
          </Panel>
        </div>
      )}

      {/* ====================== PIUTANG & AGING ====================== */}
      {activeTab === "piutang" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "0 - 30 Hari", val: agingAnalysis.summary.currentBucket, icon: Clock, tone: "slate", note: "Tagihan lancar" },
              { label: "31 - 60 Hari", val: agingAnalysis.summary.midBucket, icon: AlertTriangle, tone: "amber", note: "Perlu diingatkan" },
              { label: "61 - 90 Hari", val: agingAnalysis.summary.lateBucket, icon: ShieldAlert, tone: "rose", note: "Kolektabilitas diragukan" },
              { label: "> 90 Hari", val: agingAnalysis.summary.criticalBucket, icon: ShieldAlert, tone: "red", note: "Risiko macet tinggi" },
            ].map((b) => {
              const Icon = b.icon;
              const toneText: Record<string, string> = { slate: "text-slate-700", amber: "text-amber-700", rose: "text-rose-700", red: "text-red-700" };
              const toneIcon: Record<string, string> = { slate: "text-slate-400", amber: "text-amber-500", rose: "text-rose-500", red: "text-red-600" };
              return (
                <div key={b.label} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{b.label}</span>
                    <Icon size={14} className={toneIcon[b.tone]} />
                  </div>
                  <p className={cn("mt-2 font-mono font-extrabold text-sm sm:text-base", toneText[b.tone])}>{formatRupiah(b.val)}</p>
                  <p className="mt-1 text-[10px] text-muted">{b.note}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              title="Komposisi Umur Piutang"
              desc="Proporsi outstanding per kelompok umur"
              icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600"><Wallet size={17} /></div>}
              className="lg:col-span-1"
            >
              {!mounted ? (
                <ChartSkeleton h={260} />
              ) : agingPie.length === 0 ? (
                <EmptyChart h={260} text="Tidak ada piutang outstanding. ðŸ‘" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={agingPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {agingPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 space-y-1.5">
                {agingPie.map((b) => (
                  <div key={b.name} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      {b.name}
                    </span>
                    <span className="font-mono font-semibold text-slate-700">{formatRupiah(b.value)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Analisis Umur Piutang (Aging List)" desc="Invoice dengan sisa outstanding" className="lg:col-span-2">
              <Table className="border-none shadow-none bg-transparent rounded-none">
                <thead>
                  <tr>
                    <Th>No. Invoice</Th>
                    <Th>Pelanggan</Th>
                    <Th className="w-24 text-center">Umur</Th>
                    <Th className="w-32 text-right">Tagihan</Th>
                    <Th className="w-32 text-right">Outstanding</Th>
                    <Th className="w-28 text-center">Kategori</Th>
                  </tr>
                </thead>
                <tbody>
                  {agingPg.pageData.map((p) => {
                    let badgeColor: "slate" | "amber" | "red" | "green" = "slate";
                    if (p.status === "LUNAS") badgeColor = "green";
                    else if (p.ageDays > 90) badgeColor = "red";
                    else if (p.ageDays > 30) badgeColor = "amber";
                    return (
                      <tr key={p.noInvoice}>
                        <Td className="font-mono font-semibold text-slate-800">{p.noInvoice}</Td>
                        <Td className="font-medium text-slate-700">{p.client}</Td>
                        <Td className="text-center font-mono text-xs font-semibold text-slate-500">{p.ageDays} Hari</Td>
                        <Td className="text-right font-mono text-slate-600">{formatRupiah(p.total)}</Td>
                        <Td className={cn("text-right font-mono font-bold", p.status === "LUNAS" ? "text-slate-400" : "text-rose-600")}>
                          {p.status === "LUNAS" ? "â€”" : formatRupiah(p.sisa)}
                        </Td>
                        <Td className="text-center">
                          <Badge tone={badgeColor}>{p.status === "LUNAS" ? "LUNAS" : p.ageGroup}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination page={agingPg.page} perPage={agingPg.perPage} total={agingPg.total} onPage={agingPg.setPage} />
            </Panel>
          </div>
        </div>
      )}

      {/* ====================== STOK & ASET ====================== */}
      {activeTab === "stok" && (
        <div className="space-y-6">
          {isGudang && (
            <Panel
              title="10 Aset Persediaan Terbesar"
              desc="Nilai aset = harga beli Ã— sisa stok"
              icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600"><Archive size={17} /></div>}
            >
              {!mounted ? (
                <ChartSkeleton h={360} />
              ) : assetTop.length === 0 ? (
                <EmptyChart h={360} text="Belum ada nilai aset tercatat." />
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={assetTop} layout="vertical" margin={{ left: 8, right: 52 }}>
                    <defs>
                      <linearGradient id="asetBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#2563eb" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={fmtAxis} />
                    <YAxis type="category" dataKey="name" width={260} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(37,99,235,0.05)" }} formatter={(v: unknown) => [formatRupiah(v as number), "Nilai Aset"]} />
                    <Bar dataKey="nilai" fill="url(#asetBar)" radius={[0, 6, 6, 0]} barSize={18}>
                      <LabelList dataKey="nilai" position="right" formatter={fmtAxis} fontSize={10} fill="#64748b" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel
              title="Fast-Moving"
              desc="Terjual â‰¥ 15 unit dalam siklus"
              icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600"><CheckCircle size={17} /></div>}
            >
              <Table className="border-none shadow-none bg-transparent rounded-none">
                <thead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Nama Barang</Th>
                    <Th className="w-20 text-right">Stok</Th>
                    <Th className="w-24 text-right">Terjual</Th>
                  </tr>
                </thead>
                <tbody>
                  {fastPg.pageData.map((s) => (
                    <tr key={s.kode}>
                      <Td className="font-mono text-[10px] text-slate-400">{s.kode}</Td>
                      <Td className="font-semibold text-slate-700">{s.nama}</Td>
                      <Td className="text-right font-mono text-xs">{s.stokAkhir} pcs</Td>
                      <Td className="text-right font-mono font-bold text-emerald-600">
                        <span className="inline-flex items-center justify-end gap-1">
                          {s.soldQty} unit <ArrowUpRight size={12} className="text-emerald-500" />
                        </span>
                      </Td>
                    </tr>
                  ))}
                  {inventoryHealth.fastMoving.length === 0 && (
                    <tr>
                      <Td colSpan={4} className="py-12 text-center text-sm text-slate-400">Belum ada barang Fast-Moving di siklus ini.</Td>
                    </tr>
                  )}
                </tbody>
              </Table>
              <Pagination page={fastPg.page} perPage={fastPg.perPage} total={fastPg.total} onPage={fastPg.setPage} />
            </Panel>

            <Panel
              title="Slow-Moving / Dead Stock"
              desc="Perputaran rendah atau stok mati"
              icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600"><AlertTriangle size={17} /></div>}
            >
              <Table className="border-none shadow-none bg-transparent rounded-none">
                <thead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Nama Barang</Th>
                    <Th className="w-20 text-right">Stok</Th>
                    <Th className="w-24 text-right">Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {slowPg.pageData.map((s) => (
                    <tr key={s.kode}>
                      <Td className="font-mono text-[10px] text-slate-400">{s.kode}</Td>
                      <Td className="font-semibold text-slate-700">{s.nama}</Td>
                      <Td className="text-right font-mono text-xs">{s.stokAkhir} pcs</Td>
                      <Td className="text-right">
                        <Badge tone={s.velocity === "DEAD" ? "red" : "amber"}>{s.velocity === "DEAD" ? "STOK MATI" : "LAMBAT"}</Badge>
                      </Td>
                    </tr>
                  ))}
                  {inventoryHealth.slowMoving.length === 0 && (
                    <tr>
                      <Td colSpan={4} className="py-12 text-center text-sm text-slate-400">Perputaran semua barang normal/baik. ðŸ‘</Td>
                    </tr>
                  )}
                </tbody>
              </Table>
              <Pagination page={slowPg.page} perPage={slowPg.perPage} total={slowPg.total} onPage={slowPg.setPage} />
            </Panel>
          </div>

          <Panel title="Detail Valuasi & Posisi Aset Persediaan" desc="Nilai aset dihitung dari Harga Beli Ã— Sisa Stok">
            <Table className="border-none shadow-none bg-transparent rounded-none">
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th>Nama Barang</Th>
                  <Th className="w-20 text-right">Stok</Th>
                  <Th className="w-36 text-right">Harga Beli</Th>
                  <Th className="w-36 text-right">Harga Jual</Th>
                  <Th className="w-40 text-right">Nilai Aset</Th>
                </tr>
              </thead>
              <tbody>
                {valPg.pageData.map((s) => (
                  <tr key={s.kode}>
                    <Td className="font-mono text-xs text-slate-400">{s.kode}</Td>
                    <Td className="font-semibold text-slate-700">{s.nama}</Td>
                    <Td className="text-right font-mono font-bold text-slate-600">{s.stokAkhir} pcs</Td>
                    <Td className="text-right font-mono text-xs text-slate-500">{isGudang ? formatRupiah(s.hargaBeli) : "ðŸ”’"}</Td>
                    <Td className="text-right font-mono text-xs text-slate-500">{formatRupiah(s.hargaJual)}</Td>
                    <Td className="text-right font-mono font-semibold text-slate-800">{isGudang ? formatRupiah(s.nilaiAset) : "ðŸ”’ Dibatasi"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={valPg.page} perPage={valPg.perPage} total={valPg.total} onPage={valPg.setPage} />
          </Panel>
        </div>
      )}
    </div>
  );
}
