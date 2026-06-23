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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => (v >= 1_000_000 ? `${v / 1_000_000}jt` : `${v / 1000}rb`)}
          width={48}
        />
        <Tooltip formatter={(v: number) => formatRupiah(v)} />
        <Bar dataKey="omset" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
