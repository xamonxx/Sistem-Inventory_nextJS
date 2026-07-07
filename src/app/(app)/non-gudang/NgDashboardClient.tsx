"use client";

import { useState, useTransition, type ElementType, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  Check,
  Download,
  FileText,
  Percent,
  ShoppingBag,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Table, Td, Th } from "@/components/ui";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import { exportNgExcel } from "@/lib/export/exportNgExcel";
import { cn, formatRupiah } from "@/lib/utils";
import type { NgAnalisa } from "@/lib/ngReports";

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow: "var(--shadow-card)",
    fontSize: 12,
    padding: "8px 12px",
  },
  labelStyle: { fontWeight: 700, color: "var(--foreground)", marginBottom: 2 },
  itemStyle: { color: "var(--foreground)" },
};

const BAR_COLORS = ["#0284c7", "#10b981", "#f97316", "#8b5cf6", "#ef4444", "#eab308", "#14b8a6", "#ec4899"];
const SERIES = {
  pembelian: "#0284c7",
  omzet: "#10b981",
  profit: "#f97316",
};

function fmtAxis(value: unknown) {
  const n = value as number;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1000) return `${Math.round(n / 1000)}rb`;
  return `${n}`;
}

function splitPeriodLabel(label: string) {
  const match = label.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) return { title: label, range: "" };
  return { title: match[1], range: match[2] };
}

function CustomYAxisTick(props: { x?: number; y?: number; payload?: { value: string; index?: number }; index?: number }) {
  const { x = 0, y = 0, payload, index } = props;
  const resolvedIndex = index !== undefined ? index : (payload?.index ?? 0);
  const color = BAR_COLORS[resolvedIndex % BAR_COLORS.length];
  const label = payload?.value || "";
  const displayLabel = label.length > 20 ? label.slice(0, 18) + "..." : label;

  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={-134} cy={-2} r={4.5} fill={color} />
      <text
        x={-124}
        y={0}
        dy={3}
        textAnchor="start"
        fill="var(--muted)"
        fontSize={10}
        className="font-medium"
      >
        {displayLabel}
      </text>
    </g>
  );
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
  const tokoChart = perToko.slice(0, 8).map((t) => ({ name: t.namaToko, pembelian: t.totalPembelian, omzet: t.totalOmzet }));
  const produkChart = topProduk.slice(0, 8).map((p) => ({ name: p.nama, omzet: p.omzet, profit: p.profit }));

  const primaryStats = [
    { icon: TrendingUp, tone: "blue" as const, label: "Total Omzet", value: formatRupiah(summary.totalOmzet), hint: "Penjualan ke konsumen" },
    { icon: BarChart3, tone: "emerald" as const, label: "Total Profit", value: formatRupiah(summary.totalProfit), hint: "Omzet - pembelian" },
    { icon: Percent, tone: "amber" as const, label: "Margin", value: `${summary.margin.toFixed(2)}%`, hint: `Markup ${summary.markup.toFixed(2)}%` },
    { icon: Wallet, tone: "amber" as const, label: "Sisa Piutang", value: formatRupiah(summary.totalPiutang), hint: "Belum tertagih" },
  ];

  const secondaryStats = [
    { icon: ShoppingBag, tone: "slate" as const, label: "Total Pembelian", value: formatRupiah(summary.totalPembelian), hint: "Modal beli seluruh toko" },
    { icon: FileText, tone: "blue" as const, label: "Jumlah Invoice", value: String(summary.jumlahInvoice), hint: `Lunas ${summary.jumlahLunas} | Tempo ${summary.jumlahTempo} | Partial ${summary.jumlahPartial}` },
    { icon: Store, tone: "emerald" as const, label: "Toko Sumber Aktif", value: String(perToko.length), hint: "Toko dengan transaksi" },
    { icon: AlertTriangle, tone: summary.jumlahTerlambat > 0 ? ("amber" as const) : ("slate" as const), label: "Invoice Terlambat", value: String(summary.jumlahTerlambat), hint: "Belum lunas dan lewat tempo" },
  ];

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
      toast.success(`Export berhasil: ${name}`);
    } catch (error) {
      console.error("Export NG Excel gagal:", error);
      toast.error("Export Excel gagal, coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={cn("space-y-5", filtering && "opacity-60 transition-opacity")}>
      <header className="relative z-40 rounded-xl border border-slate-300/80 bg-white shadow-[0_18px_55px_-42px_rgba(15,23,42,0.65)] dark:border-slate-800 dark:bg-slate-900">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800 lg:border-b-0 lg:border-r md:p-6">
            <p className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--primary-strong)] dark:border-sky-900/60 dark:bg-sky-950/35">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              Fase 4 Non-Gudang
            </p>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.04em] text-foreground md:text-5xl">
              Dashboard Analisa Margin
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300 md:text-base">
              Pantau omzet, profit, piutang, performa toko sumber, dan produk paling kuat dalam satu layar analisa.
            </p>
          </div>

          <div className="relative z-40 flex flex-col justify-between gap-4 bg-slate-50/80 p-5 dark:bg-slate-950/25 md:p-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Periode aktif</p>
              <p className="mt-2 truncate text-xl font-black tracking-tight text-foreground sm:text-2xl" title={periodeLabel}>
                {periodDisplay.title}
              </p>
              {periodDisplay.range && (
                <p className="mt-1 truncate text-sm font-bold text-slate-600 dark:text-slate-300" title={periodDisplay.range}>
                  {periodDisplay.range}
                </p>
              )}
              <p className="mt-1 text-xs font-semibold text-slate-500">{summary.jumlahInvoice} invoice dianalisa</p>
            </div>
            <div className="flex flex-col gap-2">
              <PeriodFilter
                onChange={handlePeriodChange}
                defaultPreset={initialFrom || initialTo ? "custom" : "all"}
                defaultFrom={initialFrom}
                defaultTo={initialTo}
              />
              {pendingRange && (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Rentang custom belum diterapkan — klik <span className="font-bold">Terapkan</span>.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {pendingRange && (
                  <button
                    type="button"
                    onClick={() => pendingRange && applyRange(pendingRange)}
                    disabled={!canApply || filtering}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-[var(--primary)] bg-[var(--primary-soft)] px-4 text-sm font-bold text-[var(--primary-strong)] transition hover:bg-[var(--primary)]/15 disabled:opacity-50"
                  >
                    <Check size={15} />
                    Terapkan
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-strong)] disabled:opacity-60"
                >
                  <Download size={15} />
                  {exporting ? "Mengekspor..." : "Export Excel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-0 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primaryStats.map((stat) => (
          <StatCard key={stat.label} {...stat} priority />
        ))}
      </section>

      <section className="relative z-0 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {secondaryStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <Panel title="Tren Bulanan" desc="Pembelian, omzet, dan profit per bulan" icon={<TrendingUp size={16} />}>
        {tren.length === 0 ? (
          <EmptyChart text="Belum ada data pada periode ini." />
        ) : (
          <div className="space-y-3">
            <ChartLegend
              items={[
                { label: "Pembelian", color: SERIES.pembelian },
                { label: "Omzet", color: SERIES.omzet },
                { label: "Profit", color: SERIES.profit },
              ]}
            />
          <div className="h-[260px] sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tren} margin={{ top: 10, right: 16, left: 18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="periode" tick={{ fontSize: 11, fill: "var(--muted)" }} tickMargin={8} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: "var(--muted)" }} width={62} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]} />
                <Line type="monotone" dataKey="pembelian" name="Pembelian" stroke={SERIES.pembelian} strokeWidth={2.5} dot={{ r: 2.5 }} />
                <Line type="monotone" dataKey="omzet" name="Omzet" stroke={SERIES.omzet} strokeWidth={2.5} dot={{ r: 2.5 }} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke={SERIES.profit} strokeWidth={2.5} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Pembelian per Toko Sumber" desc="Top 8 toko berdasarkan modal beli" icon={<Store size={16} />}>
          {tokoChart.length === 0 ? (
            <EmptyChart text="Belum ada data toko." />
          ) : (
            <div className="space-y-3">
              <ChartLegend items={[{ label: "Pembelian", color: SERIES.pembelian }]} />
            <div className="h-[300px] sm:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokoChart} layout="vertical" margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis type="category" dataKey="name" width={142} tick={<CustomYAxisTick />} interval={0} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]} />
                  <Bar dataKey="pembelian" name="Pembelian" radius={[0, 6, 6, 0]}>
                    {tokoChart.map((_, index) => (
                      <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            </div>
          )}
        </Panel>

        <Panel title="Top Produk (Omzet)" desc="Produk penyumbang omzet terbesar" icon={<BarChart3 size={16} />}>
          {produkChart.length === 0 ? (
            <EmptyChart text="Belum ada data produk." />
          ) : (
            <div className="space-y-3">
              <ChartLegend items={[{ label: "Omzet", color: SERIES.pembelian }]} />
            <div className="h-[300px] sm:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={produkChart} layout="vertical" margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis type="category" dataKey="name" width={142} tick={<CustomYAxisTick />} interval={0} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]} />
                  <Bar dataKey="omzet" name="Omzet" radius={[0, 6, 6, 0]}>
                    {produkChart.map((_, index) => (
                      <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                  <Bar dataKey="profit" name="Profit" hide />
                </BarChart>
              </ResponsiveContainer>
            </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Rincian Pembelian per Toko" icon={<Store size={16} />}>
        {perToko.length === 0 ? (
          <EmptyChart h={120} text="Belum ada data." />
        ) : (
          <>
            <TokoMobileList rows={perToko} />
            <div className="hidden overflow-x-auto md:block">
              <Table variant="plain" className="min-w-[900px]">
                <thead>
                  <tr>
                    <Th>#</Th>
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
                      <Td className="text-xs text-slate-400">{index + 1}</Td>
                      <Td className="text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                          />
                          <span>{row.namaToko}</span>
                        </div>
                      </Td>
                      <Td className="text-right text-xs">{row.jumlahInvoice}</Td>
                      <Td className="text-right text-xs">{row.totalQty}</Td>
                      <Td className="whitespace-nowrap text-right text-xs font-bold">{formatRupiah(row.totalPembelian)}</Td>
                      <Td className="whitespace-nowrap text-right text-xs">{formatRupiah(row.totalOmzet)}</Td>
                      <Td className="text-right">
                        <Badge tone={row.margin >= 15 ? "green" : row.margin >= 8 ? "blue" : "amber"}>{row.margin.toFixed(1)}%</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Top Produk" icon={<BarChart3 size={16} />}>
        {topProduk.length === 0 ? (
          <EmptyChart h={120} text="Belum ada data." />
        ) : (
          <>
            <ProdukMobileList rows={topProduk} />
            <div className="hidden overflow-x-auto md:block">
              <Table variant="plain" className="min-w-[780px]">
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Nama Barang</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Omzet</Th>
                    <Th className="text-right">Profit</Th>
                    <Th className="text-right">Margin</Th>
                  </tr>
                </thead>
                <tbody>
                  {topProduk.map((row, index) => (
                    <tr key={row.nama}>
                      <Td className="text-xs text-slate-400">{index + 1}</Td>
                      <Td className="text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                          />
                          <span>{row.nama}</span>
                        </div>
                      </Td>
                      <Td className="text-right text-xs">{row.qty}</Td>
                      <Td className="whitespace-nowrap text-right text-xs font-bold">{formatRupiah(row.omzet)}</Td>
                      <Td className="whitespace-nowrap text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatRupiah(row.profit)}</Td>
                      <Td className="text-right">
                        <Badge tone={row.margin >= 15 ? "green" : row.margin >= 8 ? "blue" : "amber"}>{row.margin.toFixed(1)}%</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, desc, icon, children }: { title: string; desc?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-[0_18px_55px_-46px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/25 sm:px-5">
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-[var(--primary-strong)] ring-1 ring-sky-100 dark:bg-sky-950/30 dark:ring-sky-900/50">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-black leading-tight text-foreground">{title}</h2>
          {desc && <p className="mt-0.5 text-xs font-medium text-slate-500">{desc}</p>}
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  priority = false,
}: {
  icon: ElementType;
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "blue" | "amber" | "slate";
  priority?: boolean;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900/50",
    blue: "bg-sky-50 text-[var(--primary-strong)] ring-sky-100 dark:bg-sky-950/30 dark:ring-sky-900/50",
    amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900/50",
    slate: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };

  return (
    <article className="rounded-xl border border-slate-300/80 bg-white p-4 shadow-[0_18px_55px_-48px_rgba(15,23,42,0.65)] dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className={cn("mt-3 truncate font-black tracking-tight text-foreground", priority ? "text-2xl" : "text-xl")}>{value}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-500" title={hint}>{hint}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1", tones[tone])}>
          <Icon size={18} />
        </div>
      </div>
    </article>
  );
}

function TokoMobileList({ rows }: { rows: NgAnalisa["perToko"] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row, index) => (
        <article key={row.namaToko} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/25">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-400">#{index + 1}</p>
              <p className="mt-1 flex items-center gap-1.5 min-w-0 text-sm font-black text-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                />
                <span className="truncate">{row.namaToko}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{row.jumlahInvoice} invoice | {row.totalQty} qty</p>
            </div>
            <Badge tone={row.margin >= 15 ? "green" : row.margin >= 8 ? "blue" : "amber"}>{row.margin.toFixed(1)}%</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <MiniValue label="Pembelian" value={formatRupiah(row.totalPembelian)} />
            <MiniValue label="Omzet" value={formatRupiah(row.totalOmzet)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ProdukMobileList({ rows }: { rows: NgAnalisa["topProduk"] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row, index) => (
        <article key={row.nama} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/25">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-400">#{index + 1}</p>
              <p className="mt-1 flex items-center gap-1.5 min-w-0 text-sm font-black text-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                />
                <span className="truncate">{row.nama}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{row.qty} qty terjual</p>
            </div>
            <Badge tone={row.margin >= 15 ? "green" : row.margin >= 8 ? "blue" : "amber"}>{row.margin.toFixed(1)}%</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <MiniValue label="Omzet" value={formatRupiah(row.omzet)} />
            <MiniValue label="Profit" value={formatRupiah(row.profit)} accent />
          </div>
        </article>
      ))}
    </div>
  );
}

function MiniValue({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className={cn("mt-1 truncate font-black text-foreground", accent && "text-emerald-600 dark:text-emerald-300")}>{value}</p>
    </div>
  );
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyChart({ h = 240, text }: { h?: number; text: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 text-center text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-950/20" style={{ height: h }}>
      {text}
    </div>
  );
}
