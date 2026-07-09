"use client";

import { useMemo, useState, useTransition, type ElementType, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Check, Download, Percent, Printer, TrendingUp, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Table, Td, Th } from "@/components/ui";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import { usePagination, Pagination } from "@/components/Pagination";
import { exportNgExcel } from "@/lib/export/exportNgExcel";
import { cn, formatRupiah } from "@/lib/utils";
import type { NgAnalisa, NgKonsumenLaporanRow } from "@/lib/ngReports";

function splitPeriodLabel(label: string) {
  const match = label.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) return { title: label, range: "" };
  return { title: match[1], range: match[2] };
}

export function NgLaporanClient({
  analisa,
  perKonsumen,
  userName,
  periodeLabel,
  initialFrom,
  initialTo,
}: {
  analisa: NgAnalisa;
  perKonsumen: NgKonsumenLaporanRow[];
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

  const { summary } = analisa;
  const periodDisplay = splitPeriodLabel(periodeLabel);

  const totals = useMemo(
    () =>
      perKonsumen.reduce(
        (acc, k) => {
          acc.omzet += k.totalOmzet;
          acc.dibayar += k.totalDibayar;
          acc.piutang += k.sisaPiutang;
          acc.profit += k.totalProfit;
          return acc;
        },
        { omzet: 0, dibayar: 0, piutang: 0, profit: 0 }
      ),
    [perKonsumen]
  );

  const pg = usePagination(perKonsumen, 12);

  const stats = [
    { icon: TrendingUp, tone: "blue" as const, label: "Total Omzet", value: formatRupiah(summary.totalOmzet), hint: `${summary.jumlahInvoice} invoice` },
    { icon: BarChart3, tone: "emerald" as const, label: "Total Profit", value: formatRupiah(summary.totalProfit), hint: "Omzet - modal pembelian" },
    { icon: Percent, tone: "violet" as const, label: "Total Margin", value: `${summary.margin.toFixed(2)}%`, hint: `Markup ${summary.markup.toFixed(2)}%` },
    { icon: Wallet, tone: "amber" as const, label: "Sisa Piutang", value: formatRupiah(summary.totalPiutang), hint: "Belum tertagih" },
    { icon: UserRound, tone: "slate" as const, label: "Konsumen", value: String(perKonsumen.length), hint: "Dengan transaksi" },
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
    if (range.preset === "custom") setPendingRange(range);
    else applyRange(range);
  }

  const canApply = !!pendingRange && !!(pendingRange.from || pendingRange.to);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const name = await exportNgExcel({ userName, period: periodeLabel, analisa, perKonsumen });
      toast.success(`Export berhasil: ${name}`);
    } catch (error) {
      console.error("Export NG Laporan gagal:", error);
      toast.error("Export Excel gagal, coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={cn("space-y-5", filtering && "opacity-60 transition-opacity")}>
      <header className="liquid-panel liquid-panel-strong dashboard-hero relative z-20 rounded-xl" style={{ overflow: "visible" }}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="border-b border-slate-200/80 p-5 dark:border-slate-800/80 lg:border-b-0 lg:border-r md:p-6">
            <p className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--primary-strong)] dark:border-sky-900/60 dark:bg-sky-950/35">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              Laporan Non-Gudang
            </p>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.04em] text-foreground md:text-5xl">
              Laporan &amp; Export
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300 md:text-base">
              Rekap penjualan, profit, dan piutang per konsumen. Export Excel berisi ringkasan, per toko, top produk, tren, dan per konsumen.
            </p>
          </div>

          <div className="relative z-40 flex flex-col justify-between gap-4 bg-slate-50/80 p-5 dark:bg-slate-950/25 md:p-6 no-print">
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
                <Button variant="outline" onClick={() => window.print()} className="h-12 flex-1 font-black">
                  <Printer size={15} />
                  Cetak PDF
                </Button>
                <Button variant="primary" onClick={handleExport} disabled={exporting} className="h-12 flex-1 font-black">
                  <Download size={15} />
                  {exporting ? "Mengekspor..." : "Export Excel"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <Panel title="Rekap per Konsumen" icon={<UserRound size={16} />} desc="Penjualan, pembayaran, piutang, dan profit tiap konsumen.">
        {perKonsumen.length === 0 ? (
          <EmptyBox text="Belum ada transaksi pada periode ini." />
        ) : (
          <>
            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {pg.pageData.map((k) => (
                <article key={k.konsumen} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/25">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">{k.konsumen}</p>
                      {k.namaGrup && <p className="truncate text-[11px] font-semibold text-[var(--primary-strong)]">{k.namaGrup}</p>}
                      <p className="mt-0.5 text-xs text-slate-500">{k.jumlahInvoice} invoice</p>
                    </div>
                    <Badge tone={k.margin >= 15 ? "green" : k.margin >= 8 ? "blue" : "amber"}>{k.margin.toFixed(1)}%</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <MiniValue label="Omzet" value={formatRupiah(k.totalOmzet)} />
                    <MiniValue label="Sisa Piutang" value={formatRupiah(k.sisaPiutang)} warn={k.sisaPiutang > 0} />
                  </div>
                </article>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <Table variant="plain" tableClassName="min-w-[860px]">
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Konsumen</Th>
                    <Th className="text-right">Invoice</Th>
                    <Th className="text-right">Omzet</Th>
                    <Th className="text-right">Diterima</Th>
                    <Th className="text-right">Sisa Piutang</Th>
                    <Th className="text-right">Profit</Th>
                    <Th className="text-right">Margin</Th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageData.map((k, index) => (
                    <tr key={k.konsumen}>
                      <Td className="text-xs text-slate-400">{(pg.page - 1) * pg.perPage + index + 1}</Td>
                      <Td>
                        <div className="text-xs font-bold text-foreground">{k.konsumen}</div>
                        {k.namaGrup && <div className="mt-0.5 text-[10px] font-semibold text-[var(--primary-strong)]">{k.namaGrup}</div>}
                      </Td>
                      <Td className="text-right text-xs">{k.jumlahInvoice}</Td>
                      <Td className="whitespace-nowrap text-right text-xs font-bold">{formatRupiah(k.totalOmzet)}</Td>
                      <Td className="whitespace-nowrap text-right text-xs">{formatRupiah(k.totalDibayar)}</Td>
                      <Td className={cn("whitespace-nowrap text-right text-xs font-semibold", k.sisaPiutang > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-500")}>{formatRupiah(k.sisaPiutang)}</Td>
                      <Td className="whitespace-nowrap text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatRupiah(k.totalProfit)}</Td>
                      <Td className="text-right">
                        <Badge tone={k.margin >= 15 ? "green" : k.margin >= 8 ? "blue" : "amber"}>{k.margin.toFixed(1)}%</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/30">
                    <Td colSpan={3} className="text-[10px] font-black uppercase tracking-wide text-slate-500">Total ({perKonsumen.length} konsumen)</Td>
                    <Td className="whitespace-nowrap text-right text-xs font-black">{formatRupiah(totals.omzet)}</Td>
                    <Td className="whitespace-nowrap text-right text-xs font-black">{formatRupiah(totals.dibayar)}</Td>
                    <Td className="whitespace-nowrap text-right text-xs font-black text-amber-600 dark:text-amber-400">{formatRupiah(totals.piutang)}</Td>
                    <Td className="whitespace-nowrap text-right text-xs font-black text-emerald-600 dark:text-emerald-400">{formatRupiah(totals.profit)}</Td>
                    <Td />
                  </tr>
                </tfoot>
              </Table>
            </div>
            {perKonsumen.length > pg.perPage && (
              <div className="mt-4 no-print">
                <Pagination page={pg.page} perPage={pg.perPage} total={pg.total} onPage={pg.setPage} />
              </div>
            )}
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
}: {
  icon: ElementType;
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "blue" | "amber" | "slate" | "violet";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900/50",
    blue: "bg-sky-50 text-[var(--primary-strong)] ring-sky-100 dark:bg-sky-950/30 dark:ring-sky-900/50",
    amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900/50",
    slate: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    violet: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-900/50",
  };
  return (
    <article className="rounded-xl border border-slate-300/80 bg-white p-4 shadow-[0_18px_55px_-48px_rgba(15,23,42,0.65)] dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-3 truncate text-xl font-black tracking-tight text-foreground">{value}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-500" title={hint}>{hint}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1", tones[tone])}>
          <Icon size={18} />
        </div>
      </div>
    </article>
  );
}

function MiniValue({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className={cn("mt-1 truncate font-black text-foreground", warn && "text-amber-600 dark:text-amber-400")}>{value}</p>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 text-center text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-950/20">
      {text}
    </div>
  );
}
