"use client";

import { useState, useMemo, useEffect } from "react";
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

type LaporanClientProps = {
  role: string;
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

const fmtAxis = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : `${v}`;
const shortName = (v: string) => (v.length > 16 ? v.slice(0, 15) + "…" : v);

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
      <p className="mt-3 font-display font-extrabold tracking-tight text-slate-900 text-sm sm:text-lg">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </div>
  );
}

export function LaporanClient({ role, marginData, terlaris, stokData, piutangData }: LaporanClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("ringkasan");
  const [mounted, setMounted] = useState(false);
  const isGudang = role === "ADMIN_GUDANG";

  useEffect(() => setMounted(true), []);

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
    () => [...marginData].sort((a, b) => b.omset - a.omset).slice(0, 10).map((r) => ({ nama: shortName(r.nama), omset: r.omset, margin: r.margin, qty: r.qtyTerjual })),
    [marginData]
  );
  const terlarisChart = useMemo(() => terlaris.slice(0, 10).map((t) => ({ nama: shortName(t.nama), omset: t.omset, qty: t.qtyTerjual })), [terlaris]);
  const qtyTop = useMemo(
    () => [...marginData].sort((a, b) => b.qtyTerjual - a.qtyTerjual).slice(0, 10).map((r) => ({ nama: shortName(r.nama), qty: r.qtyTerjual })),
    [marginData]
  );
  const assetTop = useMemo(
    () => [...stokData].filter((s) => s.nilaiAset > 0).sort((a, b) => b.nilaiAset - a.nilaiAset).slice(0, 10).map((s) => ({ name: shortName(s.nama), nilai: s.nilaiAset })),
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

  function triggerExport(type: string) {
    toast.success(`Mengunduh excel laporan ${type}...`);
    window.location.href = `/api/export?type=${type}`;
  }

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
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 cursor-pointer"
          >
            <Printer size={14} /> Cetak PDF
          </button>
          <button
            onClick={() => triggerExport(activeTab)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-xs transition hover:bg-emerald-100 cursor-pointer"
          >
            <Download size={14} /> Ekspor Excel
          </button>
        </div>
      </div>

      {/* ===== KPI cards ===== */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} tone="emerald" label="Total Pendapatan" value={formatRupiah(totalOmset)} hint="Akumulasi omset penjualan" />
        <StatCard icon={BarChart3} tone="blue" label="Margin Keuntungan" value={isGudang ? formatRupiah(totalMargin) : "🔒 Dibatasi"} hint="Laba kotor setelah modal" />
        <StatCard icon={Wallet} tone="amber" label="Outstanding Piutang" value={formatRupiah(totalPiutang)} hint="Tagihan belum tertagih" />
        <StatCard icon={Archive} tone="slate" label="Nilai Aset Persediaan" value={isGudang ? formatRupiah(totalAsetValue) : "🔒 Dibatasi"} hint="Valuasi stok gudang" />
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
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={terlarisChart} layout="vertical" margin={{ left: 8, right: 48 }}>
                  <defs>
                    <linearGradient id="omsetBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f0813f" />
                      <stop offset="100%" stopColor="#d35a1f" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={fmtAxis} />
                  <YAxis type="category" dataKey="nama" width={130} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(211,90,31,0.05)" }} formatter={(v: number) => [formatRupiah(v), "Omset"]} />
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
              <Table>
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
              <Table>
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
                        Semua stok aman. Tidak ada barang di bawah limit. 👍
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
                  <YAxis type="category" dataKey="nama" width={130} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(16,185,129,0.05)" }} formatter={(v: number) => [`${v} unit`, "Qty Terjual"]} />
                  <Bar dataKey="qty" fill="url(#qtyBar)" radius={[0, 6, 6, 0]} barSize={18}>
                    <LabelList dataKey="qty" position="right" formatter={(v: number) => `${v}`} fontSize={10} fill="#64748b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Daftar Omset Produk Terjual" desc="Total volume omset barang dagang">
            <Table>
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
                  <YAxis type="category" dataKey="nama" width={130} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(59,130,246,0.05)" }} formatter={(v: number, n) => [formatRupiah(v), n as string]} />
                  <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar name="Omset" dataKey="omset" fill="#cbd5e1" radius={[0, 5, 5, 0]} barSize={10} />
                  <Bar name="Margin" dataKey="margin" fill="#10b981" radius={[0, 5, 5, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Analisis Margin Bersih Penjualan" desc="Evaluasi produk paling menguntungkan">
            <Table>
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
                <EmptyChart h={260} text="Tidak ada piutang outstanding. 👍" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={agingPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {agingPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n) => [formatRupiah(v), n as string]} />
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
              <Table>
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
                          {p.status === "LUNAS" ? "—" : formatRupiah(p.sisa)}
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
              desc="Nilai aset = harga beli × sisa stok"
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
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(37,99,235,0.05)" }} formatter={(v: number) => [formatRupiah(v), "Nilai Aset"]} />
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
              desc="Terjual ≥ 15 unit dalam siklus"
              icon={<div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600"><CheckCircle size={17} /></div>}
            >
              <Table>
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
              <Table>
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
                      <Td colSpan={4} className="py-12 text-center text-sm text-slate-400">Perputaran semua barang normal/baik. 👍</Td>
                    </tr>
                  )}
                </tbody>
              </Table>
              <Pagination page={slowPg.page} perPage={slowPg.perPage} total={slowPg.total} onPage={slowPg.setPage} />
            </Panel>
          </div>

          <Panel title="Detail Valuasi & Posisi Aset Persediaan" desc="Nilai aset dihitung dari Harga Beli × Sisa Stok">
            <Table>
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
                    <Td className="text-right font-mono text-xs text-slate-500">{isGudang ? formatRupiah(s.hargaBeli) : "🔒"}</Td>
                    <Td className="text-right font-mono text-xs text-slate-500">{formatRupiah(s.hargaJual)}</Td>
                    <Td className="text-right font-mono font-semibold text-slate-800">{isGudang ? formatRupiah(s.nilaiAset) : "🔒 Dibatasi"}</Td>
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
