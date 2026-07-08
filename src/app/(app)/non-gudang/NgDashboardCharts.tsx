"use client";

import type { ReactNode } from "react";
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
import { formatRupiah } from "@/lib/utils";
import type { NgAnalisa } from "@/lib/ngReports";

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "rgba(var(--card-rgb), 0.98)",
    border: "1px solid rgba(56, 189, 248, 0.42)",
    borderRadius: "8px",
    boxShadow: "0 24px 60px rgba(8, 47, 73, 0.26)",
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
        fill="var(--text-soft)"
        fontSize={11}
        className="font-semibold"
      >
        {displayLabel}
      </text>
    </g>
  );
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 rounded-md border border-sky-100 bg-white/90 px-2.5 py-1.5 text-[11px] font-black text-slate-600 shadow-sm dark:border-sky-300/20 dark:bg-slate-950/55 dark:text-slate-100"
        >
          <span className="h-2.5 w-2.5 rounded-sm shadow-[0_0_14px_currentColor]" style={{ backgroundColor: item.color, color: item.color }} />
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

function ChartPanel({
  title,
  desc,
  icon,
  children,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="liquid-panel liquid-panel-strong overflow-hidden rounded-xl border-sky-200/70 shadow-[0_24px_70px_-48px_rgba(8,47,73,0.95)] dark:border-sky-300/18">
      <header className="flex items-center gap-2.5 border-b border-sky-100/80 bg-sky-50/70 px-4 py-3.5 dark:border-sky-300/12 dark:bg-slate-950/38 sm:px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-[var(--primary-strong)] ring-1 ring-sky-100 shadow-sm dark:bg-sky-400/16 dark:text-sky-100 dark:ring-sky-300/24">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-black leading-tight text-foreground dark:text-white">{title}</h2>
          <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-300">{desc}</p>
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function PlotSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-sky-100 bg-sky-50/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-sky-300/14 dark:bg-slate-950/28 ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function NgDashboardCharts({ tren, perToko, topProduk }: {
  tren: NgAnalisa["tren"];
  perToko: NgAnalisa["perToko"];
  topProduk: NgAnalisa["topProduk"];
}) {
  const tokoChart = perToko.slice(0, 8).map((t) => ({ name: t.namaToko, pembelian: t.totalPembelian, omzet: t.totalOmzet }));
  const produkChart = topProduk.slice(0, 8).map((p) => ({ name: p.nama, omzet: p.omzet, profit: p.profit }));

  return (
    <>
      <ChartPanel
        title="Tren Bulanan"
        desc="Pembelian, omzet, dan profit per bulan"
        icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 7v8.42a1 1 0 0 1-1.87.56l-2.26-3.4a1 1 0 0 0-1.74 0l-2.26 3.4a1 1 0 0 1-1.74 0L6.87 12.6a1 1 0 0 0-1.74 0L2.87 15.98A1 1 0 0 1 2 15.42V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Z"/></svg>
        }
      >
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
            <PlotSurface>
              <div className="h-[260px] sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tren} margin={{ top: 10, right: 16, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(125, 146, 142, 0.34)" vertical={false} />
                  <XAxis dataKey="periode" tick={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 600 }} tickMargin={8} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 600 }} width={62} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]} />
                  <Line type="monotone" dataKey="pembelian" name="Pembelian" stroke={SERIES.pembelian} strokeWidth={3} dot={{ r: 3, strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="omzet" name="Omzet" stroke={SERIES.omzet} strokeWidth={3} dot={{ r: 3, strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke={SERIES.profit} strokeWidth={3} dot={{ r: 3, strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            </PlotSurface>
          </div>
        )}
      </ChartPanel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartPanel
          title="Pembelian per Toko Sumber"
          desc="Top 8 toko berdasarkan modal beli"
          icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
          }
        >
          {tokoChart.length === 0 ? (
            <EmptyChart text="Belum ada data toko." />
          ) : (
            <div className="space-y-3">
              <ChartLegend items={[{ label: "Pembelian", color: SERIES.pembelian }]} />
              <PlotSurface>
                <div className="h-[300px] sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tokoChart} layout="vertical" margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(125, 146, 142, 0.34)" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 600 }} />
                    <YAxis type="category" dataKey="name" width={142} tick={<CustomYAxisTick />} interval={0} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]} />
                    <Bar dataKey="pembelian" name="Pembelian" radius={[0, 7, 7, 0]} barSize={28}>
                      {tokoChart.map((_, index) => (
                        <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              </PlotSurface>
            </div>
          )}
        </ChartPanel>

        <ChartPanel
          title="Top Produk (Omzet)"
          desc="Produk penyumbang omzet terbesar"
          icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          }
        >
          {produkChart.length === 0 ? (
            <EmptyChart text="Belum ada data produk." />
          ) : (
            <div className="space-y-3">
              <ChartLegend items={[{ label: "Omzet", color: SERIES.pembelian }]} />
              <PlotSurface>
                <div className="h-[300px] sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={produkChart} layout="vertical" margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(125, 146, 142, 0.34)" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 600 }} />
                    <YAxis type="category" dataKey="name" width={142} tick={<CustomYAxisTick />} interval={0} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [formatRupiah(v as number), n as string]} />
                    <Bar dataKey="omzet" name="Omzet" radius={[0, 7, 7, 0]} barSize={28}>
                      {produkChart.map((_, index) => (
                        <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                    <Bar dataKey="profit" name="Profit" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              </PlotSurface>
            </div>
          )}
        </ChartPanel>
      </div>
    </>
  );
}
