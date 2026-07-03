"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatRupiah } from "@/lib/utils";

export function OmsetChart({ data }: { data: { label: string; omset: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-slate-500 dark:fill-slate-400" />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => (v >= 1_000_000 ? `${v / 1_000_000}jt` : `${v / 1000}rb`)}
          width={48}
          className="fill-slate-500 dark:fill-slate-400"
        />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--foreground)" }}
          labelStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
          formatter={(v: unknown) => [formatRupiah(v as number), undefined]}
        />
        <Bar dataKey="omset" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
