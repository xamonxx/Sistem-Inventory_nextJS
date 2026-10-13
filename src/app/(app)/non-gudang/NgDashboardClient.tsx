"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Check,
  Download,
  FileText,
  LineChart,
  ShoppingBag,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Table, Td, Th } from "@/components/ui";
import { PageHeader, Panel, StatCard, StatGrid, TonePill } from "@/components/page";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import { exportNgExcel } from "@/lib/export/exportNgExcel";
import { cn, formatRupiah } from "@/lib/utils";
import type { NgAnalisa } from "@/lib/ngReports";

// Recharts hanya di client; skeleton mengisi tinggi kontainer.
const chartLoading = () => <div className="h-full w-full animate-pulse rounded-xl bg-[var(--surface-2)] opacity-50" />;
const NgTrendChart = dynamic(() => import("./NgDashboardCharts").then((m) => m.NgTrendChart), { ssr: false, loading: chartLoading });
const NgRankBarChart = dynamic(() => import("./NgDashboardCharts").then((m) => m.NgRankBarChart), { ssr: false, loading: chartLoading });

const SERIES = [
  { label: "Pembelian", color: "#0ea5e9" },
  { label: "Omzet", color: "#10b981" },
  { label: "Keuntungan", color: "#f59e0b" },
];

function splitPeriodLabel(label: string) {
  const match = label.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) return { title: label, range: "" };
  return { title: match[1], range: match[2] };
}

export function NgDashboardClient({
  analisa,
  userName,
  periodeLabel,
  initialFrom,
  initialTo,
}: {
  analisa: NgAnalisa;
  userName?: string;
  periodeLabel: string;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filtering, startFilter] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [pendingRange, setPendingRange] = useState<ResolvedPeriodRange | null>(null);

  const { summary, perToko, topProduk, tren } = analisa;
  const periodDisplay = splitPeriodLabel(periodeLabel);

  const tokoChart = perToko.slice(0, 8).map((t) => ({ name: t.namaToko, pembelian: t.totalPembelian }));
  const produkChart = topProduk.slice(0, 8).map((p) => ({ name: p.nama, omzet: p.omzet }));

  function applyRange(range: ResolvedPeriodRange) {
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    if (range.label) params.set("label", range.label);
    const qs = params.toString();
    setPendingRange(null);
    startFilter(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function handlePeriodChange(range: ResolvedPeriodRange) {
    // Preset (Minggu/Bulan/Tahun/Semua) langsung diterapkan. Rentang custom
    // menunggu tombol "Terapkan" supaya tidak ter-apply saat tanggal belum lengkap.
    if (range.preset === "custom") {
      setPendingRange(range);
    } else {
      applyRange(range);
    }
  }

  const canApply = !!pendingRange && !!(pendingRange.from || pendingRange.to);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const name = await exportNgExcel({ userName, period: periodeLabel, analisa });
      toast.success(`Berhasil diunduh: ${name}`);
    } catch (error) {
      console.error("Export NG Excel gagal:", error);
      toast.error("Gagal mengunduh Excel, coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={cn("space-y-5", filtering && "opacity-60 transition-opacity")}>
      <PageHeader
        eyebrow="Non-Gudang"
        title="Dashboard Analisa Margin"
        description="Omzet, keuntungan, piutang, performa toko sumber, dan produk terkuat."
        actions={
          <>
            <PeriodFilter
              onChange={handlePeriodChange}
              defaultPreset={initialFrom || initialTo ? "custom" : "all"}
              defaultFrom={initialFrom}
              defaultTo={initialTo}
              align="right"
            />
            {pendingRange && (
              <Button size="sm" variant="outline" onClick={() => pendingRange && applyRange(pendingRange)} disabled={!canApply || filtering}>
                <Check size={14} /> Terapkan
              </Button>
            )}
            <Button size="sm" variant="success" onClick={handleExport} disabled={exporting}>
              <Download size={14} /> {exporting ? "Mengunduh..." : "Unduh Excel"}
            </Button>
          </>
        }
      />

      <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted-2)]">
        <span className="font-semibold text-[var(--text-soft)]">{periodDisplay.title}</span>
        {periodDisplay.range && <span>· {periodDisplay.range}</span>}
        <span>· {summary.jumlahInvoice} invoice dianalisa</span>
        {pendingRange && <span className="font-semibold text-amber-600 dark:text-amber-300">· rentang custom belum diterapkan</span>}
      </p>

      <StatGrid>
        <StatCard icon={TrendingUp} tone="sky" label="Total Omzet" value={formatRupiah(summary.totalOmzet)} hint="Penjualan ke konsumen" />
        <StatCard
          icon={BarChart3}
          tone="emerald"
          label="Total Keuntungan"
          value={formatRupiah(summary.totalProfit)}
          badge={`${summary.margin.toFixed(2)}%`}
          hint={`Margin · markup ${summary.markup.toFixed(2)}%`}
        />
        <StatCard
          icon={Wallet}
          tone="amber"
          label="Sisa Piutang"
          value={formatRupiah(summary.totalPiutang)}
          hint={summary.jumlahTerlambat > 0 ? `${summary.jumlahTerlambat} invoice terlambat` : "Belum tertagih"}
        />
        <StatCard icon={ShoppingBag} tone="slate" label="Total Pembelian" value={formatRupiah(summary.totalPembelian)} hint="Modal beli seluruh toko" />
      </StatGrid>

      {/* Ringkasan sekunder dalam satu strip */}
      <div className="bento-card grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <MiniStat icon={FileText} label="Jumlah invoice" value={String(summary.jumlahInvoice)} hint={`Lunas ${summary.jumlahLunas} · Tempo ${summary.jumlahTempo} · Sebagian ${summary.jumlahPartial}`} />
        <MiniStat icon={Store} label="Toko sumber aktif" value={String(perToko.length)} hint="Toko dengan transaksi" />
        <MiniStat
          icon={AlertTriangle}
          label="Invoice terlambat"
          value={String(summary.jumlahTerlambat)}
          hint="Belum lunas & lewat tempo"
          warn={summary.jumlahTerlambat > 0}
        />
      </div>

      <Panel
        title="Tren Bulanan"
        description="Pembelian, omzet, dan keuntungan per bulan"
        icon={LineChart}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {SERIES.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-soft)]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        }
      >
        <div className="h-[260px] sm:h-[300px]">
          {tren.length === 0 ? <EmptyBlock text="Belum ada data pada periode ini." /> : <NgTrendChart tren={tren} />}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Pembelian per Toko Sumber" description="Top 8 toko berdasarkan modal beli" icon={Store}>
          <div className="h-[300px]">
            {tokoChart.length === 0 ? (
              <EmptyBlock text="Belum ada data toko." />
            ) : (
              <NgRankBarChart data={tokoChart} dataKey="pembelian" label="Pembelian" gradientId="ngTokoBar" from="#0284c7" to="#38bdf8" />
            )}
          </div>
        </Panel>
        <Panel title="Top Produk (Omzet)" description="Produk penyumbang omzet terbesar" icon={BarChart3} tone="emerald">
          <div className="h-[300px]">
            {produkChart.length === 0 ? (
              <EmptyBlock text="Belum ada data produk." />
            ) : (
              <NgRankBarChart data={produkChart} dataKey="omzet" label="Omzet" gradientId="ngProdukBar" from="#059669" to="#34d399" />
            )}
          </div>
        </Panel>
      </div>

      {/* Tabel penuh lebar: berdampingan, kolom Margin terpotong dan tabel bergeser ke samping. */}
      <div className="grid grid-cols-1 gap-5">
        <Panel title="Rincian Pembelian per Toko" description={`${perToko.length} toko sumber`} icon={Store} flush>
          {perToko.length === 0 ? (
            <div className="p-4"><EmptyBlock text="Belum ada data." h={120} /></div>
          ) : (
            <>
              <ul className="divide-y divide-border md:hidden">
                {perToko.map((row, index) => (
                  <li key={row.namaToko} className="flex items-center gap-3 px-4 py-3">
                    <Rank n={index + 1} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{row.namaToko}</p>
                      <p className="tnum text-[11px] text-[var(--text-muted-2)]">
                        {row.jumlahInvoice} invoice · {row.totalQty} qty · omzet {formatRupiah(row.totalOmzet)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-sm font-semibold text-foreground">{formatRupiah(row.totalPembelian)}</p>
                      <TonePill value={row.margin} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table variant="plain" tableClassName="[&_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4">
                  <thead>
                    <tr>
                      <Th className="w-12 text-center">#</Th>
                      <Th>Toko Sumber</Th>
                      <Th className="text-right">Invoice</Th>
                      <Th className="text-right">Qty</Th>
                      <Th className="text-right">Pembelian</Th>
                      <Th className="text-right">Omzet</Th>
                      <Th className="text-right">Margin</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {perToko.map((row, index) => (
                      <tr key={row.namaToko}>
                        <Td className="text-center"><Rank n={index + 1} /></Td>
                        <Td className="font-semibold text-foreground">{row.namaToko}</Td>
                        <Td className="tnum text-right text-[var(--text-soft)]">{row.jumlahInvoice}</Td>
                        <Td className="tnum text-right text-[var(--text-soft)]">{row.totalQty}</Td>
                        <Td className="tnum text-right font-semibold text-foreground">{formatRupiah(row.totalPembelian)}</Td>
                        <Td className="tnum text-right text-[var(--text-soft)]">{formatRupiah(row.totalOmzet)}</Td>
                        <Td className="text-right"><TonePill value={row.margin} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Panel>

        <Panel title="Top Produk" description="Berdasarkan omzet pada periode aktif" icon={BarChart3} tone="emerald" flush>
          {topProduk.length === 0 ? (
            <div className="p-4"><EmptyBlock text="Belum ada data." h={120} /></div>
          ) : (
            <>
              <ul className="divide-y divide-border md:hidden">
                {topProduk.map((row, index) => (
                  <li key={row.nama} className="flex items-center gap-3 px-4 py-3">
                    <Rank n={index + 1} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{row.nama}</p>
                      <p className="tnum text-[11px] text-[var(--text-muted-2)]">
                        {row.qty} qty · untung <span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(row.profit)}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-sm font-semibold text-foreground">{formatRupiah(row.omzet)}</p>
                      <TonePill value={row.margin} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table variant="plain" tableClassName="[&_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4">
                  <thead>
                    <tr>
                      <Th className="w-12 text-center">#</Th>
                      <Th>Nama Barang</Th>
                      <Th className="text-right">Qty</Th>
                      <Th className="text-right">Omzet</Th>
                      <Th className="text-right">Keuntungan</Th>
                      <Th className="text-right">Margin</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProduk.map((row, index) => (
                      <tr key={row.nama}>
                        <Td className="text-center"><Rank n={index + 1} /></Td>
                        <Td className="max-w-[280px] truncate font-semibold text-foreground" title={row.nama}>{row.nama}</Td>
                        <Td className="tnum text-right text-[var(--text-soft)]">{row.qty}</Td>
                        <Td className="tnum text-right font-semibold text-foreground">{formatRupiah(row.omzet)}</Td>
                        <Td className="tnum text-right text-emerald-600 dark:text-emerald-400">{formatRupiah(row.profit)}</Td>
                        <Td className="text-right"><TonePill value={row.margin} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  warn = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <Icon size={18} className={warn ? "shrink-0 text-amber-500" : "shrink-0 text-[var(--text-muted-2)]"} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted-2)]">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className={cn("tnum font-display text-lg font-extrabold text-foreground", warn && "text-amber-600 dark:text-amber-300")}>{value}</span>
          <span className="truncate text-[11px] text-[var(--text-muted-2)]" title={hint}>{hint}</span>
        </p>
      </div>
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "tnum inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
        n <= 3 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "text-[var(--text-muted-2)]"
      )}
    >
      {n}
    </span>
  );
}

function EmptyBlock({ text, h }: { text: string; h?: number }) {
  return (
    <div
      className="flex h-full min-h-28 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-xs font-medium text-[var(--text-muted-2)]"
      style={h ? { height: h } : undefined}
    >
      {text}
    </div>
  );
}
