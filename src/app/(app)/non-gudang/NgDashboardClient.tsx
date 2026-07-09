"use client";

import dynamic from "next/dynamic";
import { useState, useTransition, type ElementType, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { Badge, Button, Table, Td, Th } from "@/components/ui";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import { exportNgExcel } from "@/lib/export/exportNgExcel";
import { cn, formatRupiah } from "@/lib/utils";
import type { NgAnalisa } from "@/lib/ngReports";

const NgDashboardCharts = dynamic(() => import("./NgDashboardCharts").then((m) => ({ default: m.NgDashboardCharts })), {
  ssr: false,
});

const BAR_COLORS = ["#0284c7", "#10b981", "#f97316", "#8b5cf6", "#ef4444", "#eab308", "#14b8a6", "#ec4899"];

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
      <header className="liquid-panel liquid-panel-strong dashboard-hero relative z-40 rounded-xl border-sky-200/70 dark:border-sky-300/15" style={{ overflow: "visible" }}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="border-b border-sky-100/80 p-5 dark:border-sky-300/10 lg:border-b-0 lg:border-r md:p-6">
            <p className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--primary-strong)] shadow-sm dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_14px_rgba(14,165,233,0.85)]" />
              Dashboard Non-Gudang
            </p>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-normal text-foreground dark:text-white md:text-5xl">
              Dashboard Analisa Margin
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-200/90 md:text-base">
              Pantau omzet, profit, piutang, performa toko sumber, dan produk paling kuat dalam satu layar analisa.
            </p>
          </div>

          <div className="relative z-40 flex flex-col justify-between gap-4 bg-sky-50/55 p-5 backdrop-blur-xl dark:bg-slate-950/30 md:p-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-sky-200/60">Periode aktif</p>
              <p className="mt-2 truncate text-xl font-black tracking-tight text-foreground dark:text-white sm:text-2xl" title={periodeLabel}>
                {periodDisplay.title}
              </p>
              {periodDisplay.range && (
                <p className="mt-1 truncate text-sm font-bold text-slate-600 dark:text-slate-200" title={periodDisplay.range}>
                  {periodDisplay.range}
                </p>
              )}
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">{summary.jumlahInvoice} invoice dianalisa</p>
            </div>
            <div className="flex flex-col gap-2">
              <PeriodFilter
                onChange={handlePeriodChange}
                defaultPreset={initialFrom || initialTo ? "custom" : "all"}
                defaultFrom={initialFrom}
                defaultTo={initialTo}
              />
              {pendingRange && (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                  Rentang custom belum diterapkan - klik <span className="font-bold">Terapkan</span>.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {pendingRange && (
                  <Button
                    variant="outline"
                    onClick={() => pendingRange && applyRange(pendingRange)}
                    disabled={!canApply || filtering}
                    className="h-12 flex-1 font-black"
                  >
                    <Check size={15} />
                    Terapkan
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={handleExport}
                  disabled={exporting}
                  className="h-12 flex-1 font-black"
                >
                  <Download size={15} />
                  {exporting ? "Mengekspor..." : "Export Excel"}
                </Button>
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

      <NgDashboardCharts tren={tren} perToko={perToko} topProduk={topProduk} />

      <Panel title="Rincian Pembelian per Toko" icon={<Store size={16} />}>
        {perToko.length === 0 ? (
          <EmptyChart h={120} text="Belum ada data." />
        ) : (
          <>
            <TokoMobileList rows={perToko} />
            <div className="hidden overflow-x-auto md:block">
              <Table variant="plain" tableClassName="min-w-[900px]">
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
              <Table variant="plain" tableClassName="min-w-[780px]">
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
    <section className="overflow-hidden rounded-xl border border-sky-200/70 bg-white/85 shadow-[0_22px_60px_-46px_rgba(8,47,73,0.75)] backdrop-blur-xl dark:border-sky-300/15 dark:bg-slate-900/80">
      <header className="flex items-center gap-2.5 border-b border-sky-100/80 bg-sky-50/60 px-4 py-3.5 dark:border-sky-300/10 dark:bg-slate-950/30 sm:px-5">
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-[var(--primary-strong)] ring-1 ring-sky-100 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-300/20">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-black leading-tight text-foreground dark:text-white">{title}</h2>
          {desc && <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">{desc}</p>}
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
    emerald: {
      icon: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/20 dark:text-emerald-100 dark:ring-emerald-300/25",
      glow: "from-emerald-400/10 via-transparent to-transparent dark:from-emerald-400/20",
      rail: "bg-emerald-400",
    },
    blue: {
      icon: "bg-sky-50 text-[var(--primary-strong)] ring-sky-100 dark:bg-sky-400/20 dark:text-sky-100 dark:ring-sky-300/25",
      glow: "from-sky-400/10 via-transparent to-transparent dark:from-sky-400/20",
      rail: "bg-sky-400",
    },
    amber: {
      icon: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/20 dark:text-amber-100 dark:ring-amber-300/25",
      glow: "from-amber-300/8 via-transparent to-transparent dark:from-amber-400/20",
      rail: "bg-amber-400",
    },
    slate: {
      icon: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-300/15 dark:text-slate-100 dark:ring-slate-300/20",
      glow: "from-sky-200/10 via-transparent to-transparent dark:from-slate-300/15",
      rail: "bg-slate-300",
    },
  };
  const toneClass = tones[tone];

  return (
    <article className="group relative overflow-hidden rounded-xl border border-sky-200/80 bg-[rgba(255,255,255,0.94)] p-4 shadow-[0_18px_45px_-34px_rgba(8,47,73,0.32),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-2xl transition hover:border-sky-300/90 hover:bg-white dark:border-sky-300/20 dark:bg-slate-900/75 dark:shadow-[0_24px_70px_-50px_rgba(8,47,73,0.95)] dark:hover:border-sky-300/30 dark:hover:bg-slate-900/90 sm:p-5">
      <span className={cn("pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r", toneClass.glow)} />
      <span className={cn("pointer-events-none absolute left-0 top-5 h-10 w-1 rounded-r-full opacity-80 shadow-[0_0_18px_currentColor]", toneClass.rail)} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.68),transparent_42%),radial-gradient(circle_at_92%_16%,rgba(14,165,233,0.045),transparent_30%),radial-gradient(circle_at_94%_92%,rgba(245,158,11,0.035),transparent_26%)] dark:bg-none" />
      <div className={cn("pointer-events-none absolute -right-12 -top-16 h-28 w-28 rounded-full bg-gradient-to-br blur-3xl", toneClass.glow)} />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-sky-100/70">{label}</p>
          <p className={cn("mt-3 truncate font-black tracking-tight text-foreground dark:text-white", priority ? "text-2xl" : "text-xl")}>{value}</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-200/90" title={hint}>{hint}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_30px_-18px_currentColor] transition group-hover:scale-[1.04]", toneClass.icon)}>
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
        <article key={row.namaToko} className="rounded-lg border border-sky-100 bg-white/80 p-3 shadow-sm backdrop-blur-md dark:border-sky-300/15 dark:bg-slate-900/75">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-400 dark:text-sky-200/50">#{index + 1}</p>
              <p className="mt-1 flex items-center gap-1.5 min-w-0 text-sm font-black text-foreground dark:text-white">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                />
                <span className="truncate">{row.namaToko}</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">{row.jumlahInvoice} invoice | {row.totalQty} qty</p>
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
        <article key={row.nama} className="rounded-lg border border-sky-100 bg-white/80 p-3 shadow-sm backdrop-blur-md dark:border-sky-300/15 dark:bg-slate-900/75">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-400 dark:text-sky-200/50">#{index + 1}</p>
              <p className="mt-1 flex items-center gap-1.5 min-w-0 text-sm font-black text-foreground dark:text-white">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                />
                <span className="truncate">{row.nama}</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">{row.qty} qty terjual</p>
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
    <div className="rounded-md bg-white/85 px-3 py-2 ring-1 ring-sky-100 dark:bg-slate-950/40 dark:ring-sky-300/15">
      <p className="font-semibold text-slate-500 dark:text-slate-300">{label}</p>
      <p className={cn("mt-1 truncate font-black text-foreground dark:text-white", accent && "text-emerald-600 dark:text-emerald-200")}>{value}</p>
    </div>
  );
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 rounded-md border border-sky-100 bg-white/85 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-sky-300/15 dark:bg-slate-950/40 dark:text-slate-200"
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
    <div className="flex items-center justify-center rounded-lg border border-dashed border-sky-200 bg-sky-50/60 px-4 text-center text-sm font-semibold text-slate-500 dark:border-sky-300/20 dark:bg-slate-950/25 dark:text-slate-300" style={{ height: h }}>
      {text}
    </div>
  );
}
