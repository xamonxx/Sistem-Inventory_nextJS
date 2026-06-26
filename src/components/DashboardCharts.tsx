"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatRupiah } from "@/lib/utils";

type ChartProps = {
  revenueTrend: { tanggal: string; omset: number; margin: number }[];
  topItems: { nama: string; qty: number }[];
  projectSales: { nama: string; total: number }[];
  showMargin?: boolean;
};

export function DashboardCharts({ revenueTrend, topItems, projectSales, showMargin = true }: ChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-64 flex items-center justify-center text-sm text-muted">Memuat grafik...</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Revenue & Margin Trend */}
      <div className={`rounded-[18px] border border-border bg-white p-6 shadow-[var(--shadow-card)] ${!showMargin ? "lg:col-span-2" : ""}`}>
        <h3 className="mb-4 text-xs font-bold text-slate-800 uppercase tracking-wider">
          {showMargin ? "Tren Omset & Margin Kotor" : "Tren Omset"}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorOmset" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
                {showMargin && (
                  <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : `${v / 1000}rb`)}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                labelStyle={{ fontWeight: "bold", color: "#0f172a" }}
                formatter={(v: number) => [formatRupiah(v), undefined]} 
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area name="Omset" type="monotone" dataKey="omset" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorOmset)" />
              {showMargin && (
                <Area name="Margin" type="monotone" dataKey="margin" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorMargin)" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales by Project */}
      <div className="rounded-[18px] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-xs font-bold text-slate-800 uppercase tracking-wider">Omset Berdasarkan Proyek</h3>
        <div className="h-72">
          {projectSales.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">Belum ada data penjualan proyek.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectSales} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v / 1_000_000}jt`} />
                <YAxis type="category" dataKey="nama" width={80} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}
                  formatter={(v: number) => [formatRupiah(v), undefined]} 
                />
                <Bar name="Omset" dataKey="total" fill="#059669" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Selling Items */}
      <div className="rounded-[18px] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-xs font-bold text-slate-800 uppercase tracking-wider">10 Barang Terlaris (Qty)</h3>
        <div className="h-72">
          {topItems.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">Belum ada data penjualan.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="nama" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }} />
                <Bar name="Qty Terjual" dataKey="qty" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Margin Trend (%) */}
      {showMargin && (
        <div className="rounded-[18px] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-xs font-bold text-slate-800 uppercase tracking-wider">Tren Persentase Margin Kotor (%)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend.map(d => ({ ...d, marginPct: d.omset > 0 ? Math.round((d.margin / d.omset) * 100) : 0 }))} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}
                  formatter={(v: number) => [`${v}%`, "Margin (%)"]} 
                />
                <Line name="Margin %" type="monotone" dataKey="marginPct" stroke="#ef4444" strokeWidth={2.5} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
