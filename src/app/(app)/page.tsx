import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getStokAkhirMap } from "@/lib/stock";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { DatePicker } from "@/components/DatePicker";
import {
  RevenueTrendChart,
  MarginPctChart,
  TopItemsChart,
  ProjectSalesChart,
} from "@/components/DashboardChartsWrapper";
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
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Inbox,
} from "lucide-react";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Kunci tanggal berdasarkan waktu lokal; toISOString() memakai UTC sehingga
// transaksi WIB 00:00–06:59 dan label hari bergeser satu hari.
function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    const dateKey = localDateKey(trx.tanggal);
    const existing = dateMap.get(dateKey) ?? { omset: 0, margin: 0 };
    existing.omset += Number(trx.grandTotal);
    dateMap.set(dateKey, existing);
  }

  // Process transaction items for margin
  for (const item of allTransactionItems) {
    const dateKey = localDateKey(item.tanggal);
    const existing = dateMap.get(dateKey) ?? { omset: 0, margin: 0 };
    existing.margin += (Number(item.hargaSnapshot) - Number(item.hargaBeliSnapshot)) * item.qty;
    dateMap.set(dateKey, existing);
  }

  // Build trend data array with all 30 days (including zeros)
  const trendData: { tanggal: string; omset: number; margin: number }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = startOfDay(new Date(now.getTime() - i * 86400000));
    const dateKey = localDateKey(d);
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
        { label: "Omzet Bulan Ini", value: formatRupiah(omsetMonth), desc: "Penjualan kotor bulan berjalan", icon: TrendingUp, tone: "success" },
        { label: "Margin Kotor", value: isGudang ? formatRupiah(marginTotal) : "Terkunci", desc: "Berdasarkan filter tanggal", icon: Layers, tone: "blue" },
        { label: "Piutang Belum Dibayar", value: formatRupiah(outstandingReceivables), desc: `${unpaidInvoices.length} invoice aktif`, icon: Wallet, tone: "amber" },
        { label: "Nilai Aset Gudang", value: isGudang ? formatRupiah(totalAssetValue) : "Terkunci", desc: "Total nilai modal persediaan", icon: Package, tone: "slate" },
        { label: "Proyek Konstruksi", value: String(activeProjectsCount), desc: "Proyek aktif terdaftar", icon: Building2, tone: "blue" },
        { label: "Pelanggan Terdaftar", value: String(activeClientsCount), desc: "Pelanggan yang sudah terdaftar", icon: Users, tone: "primary" },
      ]
    : [
        { label: "Omzet Hari Ini", value: formatRupiah(omsetToday), desc: "Total penjualan hari ini", icon: TrendingUp, tone: "success" },
        { label: "Transaksi Hari Ini", value: `${transactionsTodayCount} trx`, desc: "Invoice kasir terbuat", icon: FileText, tone: "blue" },
        { label: "Stok Menipis", value: `${lowStockItems.length} barang`, desc: "Stok di bawah stok minimum", icon: AlertTriangle, tone: "amber" },
        { label: "Stok Minus Gudang", value: `${negativeStockItems.length} barang`, desc: "Perlu dicek ke gudang", icon: CircleAlert, tone: "red" },
        ...(user.role !== "ADMIN_KASIR"
          ? [
              { label: "Petugas Aktif", value: `${await prisma.user.count({ where: { aktif: true } })} pengguna`, desc: "Total staf terdaftar", icon: Users, tone: "primary" },
              { label: "Aktivitas Hari Ini", value: `${logsTodayCount} aktivitas`, desc: "Catatan aktivitas pengguna", icon: Clock, tone: "slate" },
            ]
          : []),
      ];

  const toneColors: Record<string, string> = {
    success: "#0ea5e9",
    blue: "#6366f1",
    amber: "#f59e0b",
    red: "#f43f5e",
    primary: "#14b8a6",
    slate: "#94a3b8",
  };
  const kpiHref: Record<string, string> = {
    "Stok Menipis": "/stok",
    "Stok Minus Gudang": "/stok",
    "Piutang Belum Dibayar": "/invoice",
  };

  // KPI unggulan + konteks tren 30 hari dari trendData (tanpa query tambahan).
  const [featured, ...restKpis] = kpiCards;
  const stackedKpis = restKpis.length === 3;
  const FeaturedIcon = featured.icon;
  const omsetSeries = trendData.map((d) => d.omset);
  const omset30 = omsetSeries.reduce((a, b) => a + b, 0);
  const margin30 = trendData.reduce((a, d) => a + d.margin, 0);
  const omsetYesterday = omsetSeries[omsetSeries.length - 2] ?? 0;
  const omsetLast = omsetSeries[omsetSeries.length - 1] ?? 0;
  const deltaPct = omsetYesterday > 0 ? ((omsetLast - omsetYesterday) / omsetYesterday) * 100 : null;
  const sparkline = buildSparkline(omsetSeries, 300, 72);
  const featuredStats = isOwnerMode
    ? [
        { label: "30 hari terakhir", value: formatRupiah(omset30) },
        { label: "Rata-rata / hari", value: formatRupiah(Math.round(omset30 / Math.max(1, trendData.length))) },
      ]
    : [
        { label: "Kemarin", value: formatRupiah(omsetYesterday) },
        { label: "30 hari terakhir", value: formatRupiah(omset30) },
      ];

  const showMargin = user.role !== "ADMIN_KASIR";
  const alertCount = negativeStockItems.length + lowStockItems.length;
  const lowStockLimit = negativeStockItems.length > 0 ? 3 : 6;
  const modeQuery = `${params.from ? `&from=${encodeURIComponent(params.from)}` : ""}${params.to ? `&to=${encodeURIComponent(params.to)}` : ""}`;

  return (
    <div className="space-y-5">
      {/* ===== Hero ===== */}
      <header className="bento-card bento-hero relative z-20 anim-rise p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-soft)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
              {isOwnerMode ? "Mode Owner" : "Mode Operasional"}
            </p>
            <h1 className="mt-3 font-display text-[26px] font-extrabold leading-tight tracking-tight text-foreground md:text-[30px]">
              {isOwnerMode ? "Owner Business Dashboard" : "Operational Workspace"}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm font-medium leading-6 text-[var(--text-soft)]">
              Selamat datang kembali, <span className="font-bold text-foreground">{user.nama}</span>. Pantau omzet, stok, dan aktivitas dari satu ruang kerja.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--text-muted-2)]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-[var(--primary)]" /> Stok terkini
              </span>
              <span className="text-[var(--border)]">•</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} className="text-amber-500" /> Update {formatTanggal(now)}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2.5 xl:w-auto xl:items-end">
            {user.role !== "ADMIN_KASIR" && (
              <div className="bento-segment flex w-full rounded-xl p-1 sm:w-auto">
                {[
                  { key: "operational", label: "Operasional", active: !isOwnerMode },
                  { key: "owner", label: "Owner", active: isOwnerMode },
                ].map((m) => (
                  <Link
                    key={m.key}
                    href={`/?mode=${m.key}${modeQuery}`}
                    className={`flex-1 rounded-lg px-4 py-2 text-center text-xs font-bold transition-all duration-200 sm:flex-none ${
                      m.active
                        ? "bg-[var(--card)] text-[var(--primary)] shadow-[0_1px_2px_rgba(15,23,42,0.08),0_6px_16px_-8px_rgba(2,132,199,0.45)] ring-1 ring-[var(--border)]"
                        : "text-[var(--text-soft)] hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </Link>
                ))}
              </div>
            )}

            <form className="flex w-full flex-col gap-2 xl:w-auto xl:flex-row xl:flex-wrap xl:items-center">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 xl:contents">
                <DatePicker
                  name="from"
                  defaultValue={params.from ?? ""}
                  className="h-10 min-w-0 text-xs font-semibold xl:w-40 xl:flex-none"
                />
                <span className="text-center text-xs font-bold text-[var(--text-muted-2)] xl:px-0.5">s/d</span>
                <DatePicker
                  name="to"
                  defaultValue={params.to ?? ""}
                  align="right"
                  className="h-10 min-w-0 text-xs font-semibold xl:w-40 xl:flex-none"
                />
              </div>
              {params.mode && <input type="hidden" name="mode" value={params.mode} />}
              <div className="flex gap-2">
                <button className="btn-liquid-primary inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 text-xs font-bold transition-all xl:flex-none">
                  <Filter size={14} />
                  Terapkan
                </button>
                {params.from || params.to ? (
                  <Link
                    href={isOwnerMode ? "/?mode=owner" : "/"}
                    className="bento-segment flex h-10 flex-1 items-center justify-center rounded-lg px-3 text-xs font-bold text-[var(--text-soft)] transition-all hover:text-foreground xl:flex-none"
                  >
                    Reset
                  </Link>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* ===== KPI bento ===== */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div
          className="bento-card bento-tone anim-rise flex flex-col p-5 md:p-6 xl:col-span-5"
          style={{ "--tone": toneColors[featured.tone] } as React.CSSProperties}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bento-icon">
                <FeaturedIcon size={18} strokeWidth={2.4} />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)]">{featured.label}</p>
                <p className="text-[11px] font-medium text-[var(--text-muted-2)]">{featured.desc}</p>
              </div>
            </div>
            {!isOwnerMode && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
                  deltaPct === null
                    ? "bg-[var(--surface-2)] text-[var(--text-muted-2)]"
                    : deltaPct >= 0
                      ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/12 text-rose-600 dark:text-rose-400"
                }`}
                title="Dibanding kemarin"
              >
                {deltaPct === null ? (
                  "— vs kemarin"
                ) : (
                  <>
                    {deltaPct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {Math.abs(deltaPct).toFixed(1)}%
                  </>
                )}
              </span>
            )}
          </div>

          <p className="tnum mt-5 truncate pb-1 font-display text-[34px] font-extrabold leading-[1.1] tracking-tight text-foreground" title={featured.value}>
            {featured.value}
          </p>

          <svg viewBox="0 0 300 72" preserveAspectRatio="none" className="mt-4 h-[72px] w-full" aria-hidden="true">
            <defs>
              <linearGradient id="kpiSpark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={toneColors[featured.tone]} stopOpacity="0.32" />
                <stop offset="100%" stopColor={toneColors[featured.tone]} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={sparkline.area} fill="url(#kpiSpark)" />
            <path d={sparkline.line} fill="none" stroke={toneColors[featured.tone]} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>

          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
            {featuredStats.map((s) => (
              <div key={s.label} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">{s.label}</p>
                <p className="tnum mt-1 truncate text-sm font-bold text-foreground" title={s.value}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 3 kartu (role Kasir): di xl ditumpuk sebagai baris agar tingginya sejajar kartu utama. */}
        <div className={`grid grid-cols-2 gap-4 sm:grid-cols-6 xl:col-span-7 ${stackedKpis ? "xl:grid-cols-1 xl:gap-3" : ""}`}>
          {restKpis.map((kpi, i) => {
            const Icon = kpi.icon;
            const href = kpiHref[kpi.label];
            const span =
              restKpis.length === 5 ? (i < 3 ? "sm:col-span-2" : "sm:col-span-3") : restKpis.length === 4 ? "sm:col-span-3" : "sm:col-span-2";
            const lastOdd = restKpis.length % 2 === 1 && i === restKpis.length - 1 ? "col-span-2" : "";
            const valueSize = kpi.value.length > 14 ? "text-[17px]" : kpi.value.length > 11 ? "text-[19px]" : "text-[22px]";
            const verticalBody = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase leading-tight tracking-wider text-[var(--text-soft)]">{kpi.label}</p>
                  <span className="bento-icon !h-9 !w-9 !rounded-[11px]">
                    <Icon size={16} strokeWidth={2.4} />
                  </span>
                </div>
                <div className="mt-4 min-w-0">
                  <p
                    className={`tnum truncate pb-0.5 font-display font-extrabold leading-[1.15] tracking-tight text-foreground ${valueSize}`}
                    title={kpi.value}
                  >
                    {kpi.value}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium leading-snug text-[var(--text-muted-2)]">
                    <span className="line-clamp-1">{kpi.desc}</span>
                    {href && <ArrowUpRight size={12} className="shrink-0 opacity-70" />}
                  </p>
                </div>
              </>
            );
            const body = stackedKpis ? (
              <>
                <div className="flex h-full flex-col justify-between xl:hidden">{verticalBody}</div>
                <div className="hidden items-center gap-4 xl:flex">
                  <span className="bento-icon">
                    <Icon size={18} strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase leading-tight tracking-wider text-[var(--text-soft)]">{kpi.label}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted-2)]">
                      <span className="truncate">{kpi.desc}</span>
                      {href && <ArrowUpRight size={12} className="shrink-0 opacity-70" />}
                    </p>
                  </div>
                  <p className={`tnum shrink-0 font-display font-extrabold leading-none tracking-tight text-foreground ${valueSize}`} title={kpi.value}>
                    {kpi.value}
                  </p>
                </div>
              </>
            ) : (
              verticalBody
            );
            const cls = `bento-card bento-tone anim-rise flex flex-col justify-between p-4 md:p-5 ${span} ${lastOdd} ${
              stackedKpis ? "xl:col-span-1 xl:justify-center xl:py-4" : ""
            } ${href ? "bento-interactive" : ""}`;
            const style = { "--tone": toneColors[kpi.tone], animationDelay: `${(i + 1) * 40}ms` } as React.CSSProperties;
            return href ? (
              <Link key={kpi.label} href={href} className={cls} style={style}>
                {body}
              </Link>
            ) : (
              <div key={kpi.label} className={cls} style={style}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== Tren omzet + Pusat Peringatan ===== */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="bento-card anim-rise flex flex-col p-5 md:p-6 xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">{showMargin ? "Tren Omzet & Margin Kotor" : "Tren Omzet"}</h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted-2)]">30 hari terakhir</p>
            </div>
            <div className="flex gap-5">
              <LegendStat color="#0ea5e9" label="Omzet" value={formatRupiah(omset30)} />
              {showMargin && <LegendStat color="#10b981" label="Margin" value={formatRupiah(margin30)} />}
            </div>
          </div>
          <div className="mt-4 h-72">
            <RevenueTrendChart data={trendData} showMargin={showMargin} />
          </div>
        </div>

        <div className="bento-card anim-rise flex flex-col p-5 md:p-6 xl:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bento-icon" style={{ "--tone": alertCount > 0 ? "#f59e0b" : "#10b981" } as React.CSSProperties}>
                {alertCount > 0 ? <AlertTriangle size={18} strokeWidth={2.4} /> : <ShieldCheck size={18} strokeWidth={2.4} />}
              </span>
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">Pusat Peringatan</h3>
                <p className="text-xs text-[var(--text-muted-2)]">Stok yang perlu ditindaklanjuti</p>
              </div>
            </div>
            {alertCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                </span>
                {alertCount}
              </span>
            )}
          </div>

          {alertCount === 0 ? (
            <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 px-4 py-10 text-center">
              <ShieldCheck size={28} className="text-emerald-500" />
              <p className="mt-2 text-sm font-bold text-foreground">Semua stok aman</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted-2)]">Tidak ada barang minus atau di bawah minimum.</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-1 flex-col gap-4">
              {negativeStockItems.length > 0 && (
                <AlertGroup
                  title="Stok Minus"
                  count={negativeStockItems.length}
                  tone="rose"
                  href="/stok"
                  items={negativeStockItems.slice(0, 3).map((it) => ({ id: it.id, nama: it.nama, right: `${it.stok} unit`, pct: null }))}
                  more={negativeStockItems.length - 3}
                />
              )}
              {lowStockItems.length > 0 && (
                <AlertGroup
                  title="Stok Menipis"
                  count={lowStockItems.length}
                  tone="amber"
                  href="/stok/masuk"
                  items={lowStockItems.slice(0, lowStockLimit).map((it) => ({
                    id: it.id,
                    nama: it.nama,
                    right: `${it.stok} / ${it.minStok}`,
                    pct: Math.min(100, Math.round((it.stok / Math.max(1, it.minStok)) * 100)),
                  }))}
                  more={lowStockItems.length - lowStockLimit}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===== Barang terlaris + Margin % / Proyek ===== */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="bento-card anim-rise flex flex-col p-5 md:p-6 xl:col-span-7">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">10 Barang Terlaris</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted-2)]">Berdasarkan jumlah terjual pada periode filter</p>
          </div>
          <div className="mt-4 h-80">
            {topItems.length === 0 ? (
              <EmptyChart text="Belum ada data penjualan." />
            ) : (
              <TopItemsChart data={topItems} />
            )}
          </div>
        </div>

        {showMargin ? (
          <div className="bento-card anim-rise flex flex-col p-5 md:p-6 xl:col-span-5">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">Persentase Margin Kotor</h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted-2)]">Hanya hari dengan penjualan · 30 hari terakhir</p>
            </div>
            <div className="mt-4 h-80">
              <MarginPctChart data={trendData} />
            </div>
          </div>
        ) : (
          <ProjectCard projectSales={projectSales} className="xl:col-span-5" />
        )}
      </section>

      {/* ===== Proyek + Riwayat Aktivitas ===== */}
      {showMargin && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <ProjectCard projectSales={projectSales} className="xl:col-span-5" />

          <div className="bento-card anim-rise flex flex-col p-5 md:p-6 xl:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">Riwayat Aktivitas</h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted-2)]">Aktivitas staf kasir dan gudang terbaru</p>
              </div>
              <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-soft)]">
                {logsTodayCount} hari ini
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div className="mt-4 flex-1">
                <EmptyChart text="Belum ada catatan aktivitas." />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {recentLogs.map((log) => {
                  const nama = log.user?.nama ?? "System";
                  return (
                    <li key={log.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-[11px] font-bold text-white">
                        {initials(nama)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-[var(--text-soft)]">
                          <span className="font-bold text-foreground">{nama}</span> · {aksiLabel(log.aksi)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted-2)]">
                          {log.entitas}
                          {log.entitasId ? ` #${log.entitasId}` : ""}
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-right text-[11px] font-semibold text-[var(--text-muted-2)]">
                        {new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        <span className="block text-[10px] font-medium opacity-80">
                          {new Date(log.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ===================== Komponen & helper presentasi =====================

/** Path SVG sparkline (garis + area) dari deret angka, skala 0..max. */
function buildSparkline(values: number[], width: number, height: number) {
  if (values.length < 2) return { line: "", area: "" };
  const max = Math.max(...values, 1);
  const pad = 4;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - pad - (v / max) * (height - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}

const AKSI_LABEL: Record<string, string> = {
  STOCK_IN_BATCH: "mencatat stok masuk (batch)",
  BARANG_MASUK: "mencatat barang masuk",
  KOREKSI_STOK: "mengoreksi stok",
  CREATE_TRANSAKSI: "membuat transaksi",
  CREATE_BARANG: "menambah barang",
  UPDATE_BARANG: "memperbarui barang",
  DELETE_BARANG: "menghapus barang",
  TOGGLE_BARANG: "mengubah status barang",
  PRINT_BARCODE: "mencetak barcode",
  BAYAR_INVOICE: "mencatat pembayaran invoice",
  UPDATE_INVOICE: "memperbarui invoice",
  UPDATE_INVOICE_DAN_BARANG: "memperbarui invoice & barang",
  HAPUS_INVOICE: "menghapus invoice",
  HAPUS_INVOICE_MASSAL: "menghapus invoice (massal)",
  VERIFIKASI_INVOICE: "memverifikasi invoice",
  CREATE_USER: "menambah pengguna",
  UPDATE_USER: "memperbarui pengguna",
  TOGGLE_USER: "mengubah status pengguna",
  RESET_PASSWORD_USER: "mereset password pengguna",
  CLEAR_LOGS: "membersihkan log aktivitas",
};

function aksiLabel(aksi: string) {
  return AKSI_LABEL[aksi] ?? aksi.toLowerCase().replace(/_/g, " ");
}

function initials(nama: string) {
  return (
    nama
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

function LegendStat({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </p>
      <p className="tnum mt-0.5 text-sm font-extrabold text-foreground">{value}</p>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] text-center">
      <Inbox size={22} className="text-[var(--text-muted-2)] opacity-70" />
      <p className="text-xs font-medium text-[var(--text-muted-2)]">{text}</p>
    </div>
  );
}

const ALERT_TONE = {
  rose: { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", track: "bg-rose-500/15", chip: "bg-rose-500/12" },
  amber: { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", track: "bg-amber-500/15", chip: "bg-amber-500/12" },
};

function AlertGroup({
  title,
  count,
  tone,
  href,
  items,
  more,
}: {
  title: string;
  count: number;
  tone: keyof typeof ALERT_TONE;
  href: string;
  items: { id: number; nama: string; right: string; pct: number | null }[];
  more: number;
}) {
  const t = ALERT_TONE[tone];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-wider ${t.text}`}>{title}</p>
        <span className={`tnum rounded-md px-1.5 py-0.5 text-[11px] font-bold ${t.chip} ${t.text}`}>{count}</span>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl bg-[var(--surface-2)]/60 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-semibold text-foreground" title={it.nama}>{it.nama}</p>
              <span className={`tnum shrink-0 font-mono text-[11px] font-bold ${t.text}`}>{it.right}</span>
            </div>
            {it.pct !== null && (
              <div className={`mt-1.5 h-1 w-full overflow-hidden rounded-full ${t.track}`}>
                <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(it.pct, 2)}%` }} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link href={href} className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold hover:underline ${t.text}`}>
          +{more} barang lainnya <ArrowUpRight size={12} />
        </Link>
      )}
    </div>
  );
}

function ProjectCard({ projectSales, className = "" }: { projectSales: { nama: string; total: number }[]; className?: string }) {
  return (
    <div className={`bento-card anim-rise flex flex-col p-5 md:p-6 ${className}`}>
      <div>
        <h3 className="font-display text-sm font-bold text-foreground">Omzet per Proyek</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted-2)]">5 proyek teratas pada periode filter</p>
      </div>
      <div className={`mt-4 ${projectSales.length === 0 ? "flex-1" : "min-h-44"}`}>
        {projectSales.length === 0 ? <EmptyChart text="Belum ada data penjualan proyek." /> : <ProjectSalesChart data={projectSales} />}
      </div>
    </div>
  );
}
