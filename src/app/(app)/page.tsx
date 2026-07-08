import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getStokAkhirMap } from "@/lib/stock";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { DatePicker } from "@/components/DatePicker";
import { DashboardCharts } from "@/components/DashboardChartsWrapper";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Wallet,
  Building2,
  Users,
  FileText,
  Clock,
  Layers,
  CircleAlert,
  Filter,
  ShieldCheck,
} from "lucide-react";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

// Terima hanya format YYYY-MM-DD yang valid; selain itu pakai fallback.
function parseDateParam(value: string | undefined, fallback: Date, endOfDay = false): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const d = new Date(value + (endOfDay ? "T23:59:59" : "T00:00:00"));
  return isNaN(d.getTime()) ? fallback : d;
}

// Cache dashboard for 30 seconds (balances real-time data with performance)
export const revalidate = 30;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; mode?: string }>;
}) {
  const user = await requireUser();

  // Role non-gudang punya dashboard sendiri
  if (user.role === "ADMIN_NONGUDANG") {
    redirect("/non-gudang");
  }

  const params = await searchParams;

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86400000);

  // Parse filters & mode (validasi format tanggal supaya query tidak menerima Invalid Date)
  const dateFrom = parseDateParam(params.from, startOfDay(new Date(now.getTime() - 29 * 86400000)));
  const dateTo = parseDateParam(params.to, new Date(), true);
  const isOwnerMode = user.role !== "ADMIN_KASIR" && params.mode === "owner";

  const isGudang = user.role === "ADMIN_GUDANG";

  // 1. KPI Today's Revenue
  const omsetTodayAgg = await prisma.transaction.aggregate({
    where: { tanggal: { gte: today, lt: tomorrow } },
    _sum: { grandTotal: true },
  });
  const omsetToday = Number(omsetTodayAgg._sum.grandTotal ?? 0);

  // 2. Monthly Revenue
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const omsetMonthAgg = await prisma.transaction.aggregate({
    where: { tanggal: { gte: firstDayOfMonth } },
    _sum: { grandTotal: true },
  });
  const omsetMonth = Number(omsetMonthAgg._sum.grandTotal ?? 0);

  // 3. Gross Margin (Only computed for ADMIN_GUDANG)
  let marginTotal = 0;
  if (isGudang) {
    const marginAgg = await prisma.transactionItem.findMany({
      where: { transaction: { tanggal: { gte: dateFrom, lte: dateTo } } },
      select: { qty: true, hargaSnapshot: true, hargaBeliSnapshot: true },
    });
    marginTotal = marginAgg.reduce(
      (acc, it) => acc + (Number(it.hargaSnapshot) - Number(it.hargaBeliSnapshot)) * it.qty,
      0
    );
  }

  // 4. Outstanding Receivables
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { status: { not: "LUNAS" } },
    select: { total: true, totalDibayar: true, tanggal: true, noInvoice: true, namaClient: true },
  });
  const outstandingReceivables = unpaidInvoices.reduce(
    (acc, inv) => acc + (Number(inv.total) - Number(inv.totalDibayar)),
    0
  );

  // 5. Active Projects & Clients
  const activeProjectsCount = await prisma.project.count();
  const activeClientsCount = await prisma.client.count();

  // 6. Revenue & Margin Trend (Optimized: 2 queries instead of 60)
  const chartDays = 30;
  const chartStartDate = startOfDay(new Date(now.getTime() - (chartDays - 1) * 86400000));
  
  // Fetch all transactions for the entire period in ONE query
  const allTransactions = await prisma.transaction.findMany({
    where: { tanggal: { gte: chartStartDate } },
    select: { tanggal: true, grandTotal: true },
  });

  // Fetch all transaction items for margin calculation in ONE query (if needed)
  let allTransactionItems: Array<{ tanggal: Date; qty: number; hargaSnapshot: any; hargaBeliSnapshot: any }> = [];
  if (isGudang) {
    allTransactionItems = await prisma.transactionItem.findMany({
      where: { transaction: { tanggal: { gte: chartStartDate } } },
      select: { 
        qty: true, 
        hargaSnapshot: true, 
        hargaBeliSnapshot: true,
        transaction: { select: { tanggal: true } }
      },
    }).then(items => items.map(it => ({
      tanggal: it.transaction.tanggal,
      qty: it.qty,
      hargaSnapshot: it.hargaSnapshot,
      hargaBeliSnapshot: it.hargaBeliSnapshot,
    })));
  }

  // Group data by date in memory
  const dateMap = new Map<string, { omset: number; margin: number }>();
  
  // Process transactions
  for (const trx of allTransactions) {
    const dateKey = trx.tanggal.toISOString().split('T')[0];
    const existing = dateMap.get(dateKey) ?? { omset: 0, margin: 0 };
    existing.omset += Number(trx.grandTotal);
    dateMap.set(dateKey, existing);
  }

  // Process transaction items for margin
  for (const item of allTransactionItems) {
    const dateKey = item.tanggal.toISOString().split('T')[0];
    const existing = dateMap.get(dateKey) ?? { omset: 0, margin: 0 };
    existing.margin += (Number(item.hargaSnapshot) - Number(item.hargaBeliSnapshot)) * item.qty;
    dateMap.set(dateKey, existing);
  }

  // Build trend data array with all 30 days (including zeros)
  const trendData: { tanggal: string; omset: number; margin: number }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = startOfDay(new Date(now.getTime() - i * 86400000));
    const dateKey = d.toISOString().split('T')[0];
    const data = dateMap.get(dateKey) ?? { omset: 0, margin: 0 };
    
    trendData.push({
      tanggal: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(d),
      omset: data.omset,
      margin: data.margin,
    });
  }

  // 7. Top Selling Items
  const topSellingAgg = await prisma.transactionItem.groupBy({
    by: ["itemId", "namaSnapshot"],
    where: { transaction: { tanggal: { gte: dateFrom, lte: dateTo } } },
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take: 10,
  });
  const topItems = topSellingAgg.map((x) => ({
    nama: x.namaSnapshot,
    qty: x._sum.qty ?? 0,
  }));

  // 8. Sales by Project
  const projectSalesAgg = await prisma.transaction.groupBy({
    by: ["projectId"],
    where: {
      projectId: { not: null },
      tanggal: { gte: dateFrom, lte: dateTo },
    },
    _sum: { grandTotal: true },
    orderBy: { _sum: { grandTotal: "desc" } },
    take: 5,
  });
  const projectIds = projectSalesAgg.map((x) => x.projectId as number);
  const projectsMeta = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, nama: true },
  });
  const projectMap = new Map(projectsMeta.map((p) => [p.id, p.nama]));
  const projectSales = projectSalesAgg.map((x) => ({
    nama: projectMap.get(x.projectId as number) ?? "Proyek Tidak Dikenal",
    total: Number(x._sum.grandTotal ?? 0),
  }));

  // 9. Inventory calculations
  const items = await prisma.item.findMany({ where: { aktif: true } });
  const stokMap = await getStokAkhirMap();
  const allStok = items.map((it) => ({
    ...it,
    stok: stokMap[it.id] ?? it.stokAwal,
  }));

  const lowStockItems = allStok.filter((it) => it.stok >= 0 && it.stok < it.minStok).sort((a, b) => a.stok - b.stok);
  const negativeStockItems = allStok.filter((it) => it.stok < 0).sort((a, b) => a.stok - b.stok);

  const totalAssetValue = allStok.reduce((acc, it) => acc + Number(it.hargaBeli) * it.stok, 0);

  // Operational metrics
  const transactionsTodayCount = await prisma.transaction.count({
    where: { tanggal: { gte: today, lt: tomorrow } }
  });
  const logsTodayCount = await prisma.activityLog.count({
    where: { createdAt: { gte: today, lt: tomorrow } }
  });

  // Recent timeline events (Logs)
  const recentLogs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { user: true }
  });

  // Build KPIs based on Selected Mode
  const kpiCards = isOwnerMode
    ? [
        { label: "Omset Bulan Ini", value: formatRupiah(omsetMonth), desc: "Penjualan kotor bulan berjalan", icon: TrendingUp, tone: "success" },
        { label: "Margin Kotor", value: isGudang ? formatRupiah(marginTotal) : "Terkunci", desc: "Berdasarkan filter tanggal", icon: Layers, tone: "blue" },
        { label: "Outstanding Piutang", value: formatRupiah(outstandingReceivables), desc: `${unpaidInvoices.length} invoice aktif`, icon: Wallet, tone: "amber" },
        { label: "Nilai Aset Gudang", value: isGudang ? formatRupiah(totalAssetValue) : "Terkunci", desc: "Total nilai modal persediaan", icon: Package, tone: "slate" },
        { label: "Proyek Konstruksi", value: String(activeProjectsCount), desc: "Proyek aktif terdaftar", icon: Building2, tone: "blue" },
        { label: "Pelanggan Terdaftar", value: String(activeClientsCount), desc: "Customer di dalam CRM", icon: Users, tone: "primary" },
      ]
    : [
        { label: "Omset Hari Ini", value: formatRupiah(omsetToday), desc: "Total penjualan hari ini", icon: TrendingUp, tone: "success" },
        { label: "Transaksi Hari Ini", value: `${transactionsTodayCount} trx`, desc: "Invoice kasir terbuat", icon: FileText, tone: "blue" },
        { label: "Stok Kritis (Safety)", value: `${lowStockItems.length} barang`, desc: "Stok di bawah batas minimum", icon: AlertTriangle, tone: "amber" },
        { label: "Stok Minus Gudang", value: `${negativeStockItems.length} barang`, desc: "Koreksi fisik dibutuhkan", icon: CircleAlert, tone: "red" },
        ...(user.role !== "ADMIN_KASIR"
          ? [
              { label: "Operator Aktif", value: `${await prisma.user.count({ where: { aktif: true } })} user`, desc: "Total staf terdaftar", icon: Users, tone: "primary" },
              { label: "Aktivitas Hari Ini", value: `${logsTodayCount} logs`, desc: "Audit trail log operasional", icon: Clock, tone: "slate" },
            ]
          : []),
      ];

  const toneColors: Record<string, string> = {
    success: "#0ea5e9",
    blue: "#2563eb",
    amber: "#f59e0b",
    red: "#ef4444",
    primary: "#0284c7",
    slate: "#60736f",
  };

  return (
    <div className="space-y-7">
      <header className="liquid-panel liquid-panel-strong dashboard-hero relative z-20 anim-rise p-5 backdrop-blur-2xl backdrop-saturate-150 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="u-label flex items-center gap-2.5 text-[var(--primary)]">
            <span className="inline-block h-[3px] w-7 rounded-full bg-gradient-to-r from-[var(--primary)] via-sky-400 to-amber-400" />
            Sistem ERP Putra Corp
          </p>
          <h1 className="mt-3 text-2xl font-extrabold text-foreground tracking-normal">
            {isOwnerMode ? "Owner Business Dashboard" : "Operational Workspace"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--text-soft)]">
            Selamat datang kembali, <span className="font-bold text-foreground">{user.nama}</span>. Pantau omset, stok kritis, dan aktivitas gudang dari satu ruang kerja.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="dashboard-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold text-[var(--text-soft)] backdrop-blur-xl backdrop-saturate-150">
              <ShieldCheck size={13} className="text-[var(--primary)]" />
              Live inventory
            </span>
            <span className="dashboard-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold text-[var(--text-soft)] backdrop-blur-xl backdrop-saturate-150">
              <Clock size={13} className="text-amber-500" />
              Update {formatTanggal(now)}
            </span>
          </div>
        </div>

        {/* Toggle Mode & Filters */}
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:items-end">
          {user.role !== "ADMIN_KASIR" && (
            <div className="dashboard-chip flex w-full rounded-xl p-1.5 backdrop-blur-xl backdrop-saturate-150 sm:w-auto">
              <Link
                href={`/?mode=operational${params.from ? `&from=${encodeURIComponent(params.from)}` : ""}${params.to ? `&to=${encodeURIComponent(params.to)}` : ""}`}
                className={`flex-1 rounded-lg px-4 py-2.5 text-center text-xs font-bold transition-all duration-200 sm:flex-none ${
                  !isOwnerMode
                    ? "bg-gradient-to-br from-[var(--primary)] to-sky-500 text-white shadow-lg shadow-sky-500/20"
                    : "text-[var(--text-soft)] hover:bg-white/45 hover:text-foreground dark:hover:bg-white/5"
                }`}
              >
                Operasional
              </Link>
              <Link
                href={`/?mode=owner${params.from ? `&from=${encodeURIComponent(params.from)}` : ""}${params.to ? `&to=${encodeURIComponent(params.to)}` : ""}`}
                className={`flex-1 rounded-lg px-4 py-2.5 text-center text-xs font-bold transition-all duration-200 sm:flex-none ${
                  isOwnerMode
                    ? "bg-gradient-to-br from-[var(--primary)] to-sky-500 text-white shadow-lg shadow-sky-500/20"
                    : "text-[var(--text-soft)] hover:bg-white/45 hover:text-foreground dark:hover:bg-white/5"
                }`}
              >
                Owner
              </Link>
            </div>
          )}

          <form className="flex w-full flex-col gap-2 xl:w-auto xl:flex-row xl:flex-wrap xl:items-center">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 xl:contents">
              <DatePicker
                name="from"
                defaultValue={params.from ?? ""}
                className="h-11 min-w-0 text-xs font-semibold xl:w-40 xl:flex-none"
              />
              <span className="text-center text-xs font-bold text-slate-400 xl:px-0.5">s/d</span>
              <DatePicker
                name="to"
                defaultValue={params.to ?? ""}
                align="right"
                className="h-11 min-w-0 text-xs font-semibold xl:w-40 xl:flex-none"
              />
            </div>
            {params.mode && <input type="hidden" name="mode" value={params.mode} />}
            <div className="flex gap-2">
              <button
                className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[var(--primary)] to-sky-500 px-5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition-all hover:brightness-105 xl:flex-none"
              >
                <Filter size={14} />
                Saring
              </button>
              {params.from || params.to ? (
                <Link
                  href={isOwnerMode ? "/?mode=owner" : "/"}
                  className="dashboard-chip flex h-11 flex-1 items-center justify-center rounded-lg px-3 text-xs font-bold text-[var(--text-soft)] backdrop-blur-xl backdrop-saturate-150 transition-all hover:text-foreground xl:flex-none"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </div>
        </div>
      </header>

      {/* ===== Alert Center — Premium ===== */}
      {(negativeStockItems.length > 0 || lowStockItems.length > 0) && (
        <div className="liquid-panel anim-rise space-y-5 rounded-2xl p-6 backdrop-blur-2xl backdrop-saturate-150">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200/60 dark:ring-amber-500/20">
                <AlertTriangle size={18} strokeWidth={2.4} />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-foreground leading-tight">Alert Center</h3>
                <p className="text-xs text-muted mt-0.5">Peringatan stok gudang yang perlu ditindaklanjuti.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              {negativeStockItems.length + lowStockItems.length} butuh tindakan
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Stok Minus Gudang — merah */}
            {negativeStockItems.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-red-200/70 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/[0.06]">
                <div className="flex items-center gap-3 border-b border-red-200/60 dark:border-red-500/15 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">
                    <CircleAlert size={17} strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Stok Minus Gudang</p>
                    <p className="text-[10px] text-red-600/70 dark:text-red-400/60">Perlu koreksi fisik segera</p>
                  </div>
                  <span className="text-2xl font-extrabold tabular-nums text-red-600 dark:text-red-400 leading-none">{negativeStockItems.length}</span>
                </div>
                <ul className="divide-y divide-red-200/40 dark:divide-red-500/10">
                  {negativeStockItems.slice(0, 4).map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">{it.nama}</p>
                        <p className="font-mono text-[10px] text-muted">{it.kode}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-red-100 dark:bg-red-500/15 px-2 py-1 font-mono text-[11px] font-bold text-red-700 dark:text-red-300 tabular-nums">
                        {it.stok} unit
                      </span>
                    </li>
                  ))}
                </ul>
                {negativeStockItems.length > 4 && (
                  <Link href="/stok" className="flex items-center justify-center gap-1 border-t border-red-200/50 dark:border-red-500/15 px-4 py-2 text-[11px] font-bold text-red-700 dark:text-red-400 transition hover:bg-red-100/50 dark:hover:bg-red-500/10">
                    +{negativeStockItems.length - 4} barang lainnya
                  </Link>
                )}
              </div>
            )}

            {/* Stok Kritis — amber */}
            {lowStockItems.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.06]">
                <div className="flex items-center gap-3 border-b border-amber-200/60 dark:border-amber-500/15 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={17} strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Stok Kritis</p>
                    <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60">Di bawah batas aman (safety)</p>
                  </div>
                  <span className="text-2xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400 leading-none">{lowStockItems.length}</span>
                </div>
                <ul className="divide-y divide-amber-200/40 dark:divide-amber-500/10">
                  {lowStockItems.slice(0, 4).map((it) => {
                    const pct = Math.min(100, Math.round((it.stok / Math.max(1, it.minStok)) * 100));
                    return (
                      <li key={it.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-xs font-semibold text-foreground">{it.nama}</p>
                          <span className="shrink-0 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                            {it.stok}<span className="text-muted font-medium"> / {it.minStok}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-amber-200/50 dark:bg-amber-500/15">
                          <div className="h-full rounded-full bg-amber-500 dark:bg-amber-400" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {lowStockItems.length > 4 && (
                  <Link href="/stok/masuk" className="flex items-center justify-center gap-1 border-t border-amber-200/50 dark:border-amber-500/15 px-4 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-400 transition hover:bg-amber-100/50 dark:hover:bg-amber-500/10">
                    +{lowStockItems.length - 4} barang lainnya
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Card grid - Premium Liquid Glass Cards */}
      <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${kpiCards.length === 4 ? "2xl:grid-cols-4" : "2xl:grid-cols-6"}`}>
        {kpiCards.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="liquid-panel kpi-glass-card anim-rise relative flex min-h-[136px] flex-col justify-between p-5 backdrop-blur-2xl backdrop-saturate-150"
              style={{
                animationDelay: `${i * 40}ms`,
              }}
            >
              {/* Accent indicator with glow */}
              <span
                className="absolute inset-y-4 left-0 w-[3px] rounded-r-full"
                style={{
                  background: `linear-gradient(180deg, ${toneColors[kpi.tone]}, ${toneColors[kpi.tone]}90)`,
                  boxShadow: `0 0 12px -2px ${toneColors[kpi.tone]}40`,
                }}
              />

              <div className="flex items-start justify-between gap-3">
                <p className="pl-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)] leading-tight">
                  {kpi.label}
                </p>
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `${toneColors[kpi.tone]}15`,
                    border: `1px solid ${toneColors[kpi.tone]}20`,
                  }}
                >
                  <Icon size={15} style={{ color: toneColors[kpi.tone] }} strokeWidth={2.5} />
                </div>
              </div>

              <div className="mt-3 min-w-0 pl-3">
                <div data-tooltip={kpi.value}>
                  <h3 className="tnum overflow-hidden text-ellipsis whitespace-nowrap font-display text-[20px] font-extrabold leading-none text-slate-950 dark:text-slate-50 tracking-tight">
                    {kpi.value}
                  </h3>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--text-muted-2)]" title={kpi.desc}>
                  {kpi.desc}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Charts Section */}
      <section className="anim-rise">
        <DashboardCharts
          revenueTrend={trendData}
          topItems={topItems}
          projectSales={projectSales}
          showMargin={user.role !== "ADMIN_KASIR"}
        />
      </section>

      {/* Spacious Double Column Layout: Activity - Premium */}
      {user.role !== "ADMIN_KASIR" && (
        <section className="anim-rise">
          <div className="liquid-panel space-y-5 rounded-2xl p-6 backdrop-blur-2xl backdrop-saturate-150">
            <div>
              <h3 className="font-display text-base font-bold text-foreground dark:text-slate-100 flex items-center gap-2.5">
                <Clock size={17} className="text-[var(--primary)]" /> Riwayat Audit Operasional
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Log audit aktivitas staf kasir dan gudang terbaru.</p>
            </div>

            <div className="relative border-l border-border dark:border-slate-800 pl-4 ml-2 space-y-5">
              {recentLogs.map((log) => (
                <div key={log.id} className="relative text-xs">
                  {/* Bullet point indicator */}
                  <span className="absolute -left-[21px] top-1 flex h-2 w-2 rounded-full bg-slate-350 dark:bg-slate-700 ring-4 ring-white dark:ring-card" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-foreground dark:text-slate-300">
                        {log.user?.nama ?? "System"} melakukan <span className="font-bold text-slate-950 dark:text-white">{log.aksi}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Target: {log.entitas} (ID: {log.entitasId ?? "-"})</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}

              {recentLogs.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">Belum ada catatan aktivitas.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
