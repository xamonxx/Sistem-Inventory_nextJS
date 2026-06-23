"use client";

import { useMemo, useState } from "react";
import { Table, Th, Td, Badge, Input, Select, Card, Label } from "@/components/ui";
import { formatTanggal } from "@/lib/utils";
import { Search, ArrowDownCircle, ArrowUpCircle, RefreshCcw, Landmark, RotateCcw } from "lucide-react";

type ItemOption = { id: number; kode: string; nama: string };
type LedgerRow = {
  id: number;
  itemId: number;
  itemName: string;
  itemKode: string;
  itemMinStok: number;
  itemStokAwal: number;
  tanggal: string;
  tipe: "MASUK" | "KELUAR" | "RETUR" | "KOREKSI";
  qty: number;
  keterangan: string | null;
  userId: number | null;
  userName: string;
};

const TIPE_TONE = {
  MASUK: "green" as const,
  KELUAR: "red" as const,
  RETUR: "blue" as const,
  KOREKSI: "amber" as const,
};

export function StokClient({
  initialLedgers,
  items,
}: {
  initialLedgers: LedgerRow[];
  items: ItemOption[];
}) {
  const [selectedItemId, setSelectedItemId] = useState<number | "">("");
  const [tipeFilter, setTipeFilter] = useState<"ALL" | "MASUK" | "KELUAR" | "RETUR" | "KOREKSI">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Process data & compute running balances dynamically if filtered by a single item
  const processedRows = useMemo(() => {
    // 1. Sort chronologically (asc) to calculate running balance correctly
    const sorted = [...initialLedgers].reverse();
    
    // Track running balance map per item
    const balanceTracker = new Map<number, number>();
    // Set initial balance to the item's stokAwal
    
    const mapped = sorted.map((row) => {
      const current = balanceTracker.get(row.itemId) ?? row.itemStokAwal;
      const nextBalance = current + row.qty;
      balanceTracker.set(row.itemId, nextBalance);
      return {
        ...row,
        runningBalance: nextBalance,
      };
    });

    // Reverse back to desc for list display
    const finalRows = mapped.reverse();

    // Apply UI Filters
    return finalRows.filter((r) => {
      const matchesItem = selectedItemId === "" || r.itemId === Number(selectedItemId);
      const matchesTipe = tipeFilter === "ALL" || r.tipe === tipeFilter;
      const matchesSearch =
        searchQuery === "" ||
        r.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.keterangan && r.keterangan.toLowerCase().includes(searchQuery.toLowerCase()));

      const rowDate = new Date(r.tanggal);
      const matchesStart = startDate === "" || rowDate >= new Date(startDate);
      const matchesEnd = endDate === "" || rowDate <= new Date(endDate + "T23:59:59");

      return matchesItem && matchesTipe && matchesSearch && matchesStart && matchesEnd;
    });
  }, [initialLedgers, selectedItemId, tipeFilter, searchQuery, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Filtering Toolbar Card */}
      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-5 p-5">
        <div>
          <Label>Pilih Barang (Kartu Stok)</Label>
          <Select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— Semua Barang —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.kode} &middot; {it.nama}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Tipe Mutasi</Label>
          <Select value={tipeFilter} onChange={(e) => setTipeFilter(e.target.value as any)}>
            <option value="ALL">Semua Mutasi</option>
            <option value="MASUK">MASUK (+)</option>
            <option value="KELUAR">KELUAR (-)</option>
            <option value="RETUR">RETUR (+)</option>
            <option value="KOREKSI">KOREKSI (Penyesuaian)</option>
          </Select>
        </div>
        <div>
          <Label>Mulai Tanggal</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label>Hingga Tanggal</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <Label>Cari Detail / Keterangan</Label>
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-3 text-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nomor PC / referensi..."
              className="pl-8"
            />
          </div>
        </div>
      </Card>

      {/* Main Stock Ledger Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <thead>
            <tr>
              <Th className="w-40">Tanggal</Th>
              <Th>Barang</Th>
              <Th className="w-32">Mutasi</Th>
              <Th className="text-right w-24">Stok Masuk</Th>
              <Th className="text-right w-24">Stok Keluar</Th>
              <Th className="text-right w-32">
                {selectedItemId !== "" ? "Saldo Berjalan" : "Posisi Mutasi"}
              </Th>
              <Th>Keterangan / Ref</Th>
              <Th className="w-28">Operator</Th>
            </tr>
          </thead>
          <tbody>
            {processedRows.map((l) => {
              const isPositive = l.qty > 0;
              const isZero = l.qty === 0;

              return (
                <tr key={l.id} className="hover:bg-slate-50/50">
                  <Td className="text-slate-500 font-medium text-xs">
                    {formatTanggal(l.tanggal)}
                  </Td>
                  <Td>
                    <div className="font-semibold text-slate-800">{l.itemName}</div>
                    <div className="font-mono text-[10px] text-muted">{l.itemKode}</div>
                  </Td>
                  <Td>
                    <Badge tone={TIPE_TONE[l.tipe]}>
                      <span className="flex items-center gap-1">
                        {l.tipe === "MASUK" && <ArrowUpCircle size={12} />}
                        {l.tipe === "KELUAR" && <ArrowDownCircle size={12} />}
                        {l.tipe === "RETUR" && <RotateCcw size={12} />}
                        {l.tipe === "KOREKSI" && <RefreshCcw size={12} />}
                        {l.tipe}
                      </span>
                    </Badge>
                  </Td>
                  <Td className="text-right font-semibold font-mono text-emerald-600">
                    {isPositive ? `+${l.qty}` : "-"}
                  </Td>
                  <Td className="text-right font-semibold font-mono text-red-600">
                    {!isPositive && !isZero ? l.qty : "-"}
                  </Td>
                  <Td className="text-right font-bold font-mono">
                    {selectedItemId !== "" ? (
                      <span className={l.runningBalance < l.itemMinStok ? "text-red-600" : "text-slate-800"}>
                        {l.runningBalance}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">pilih barang</span>
                    )}
                  </Td>
                  <Td className="text-slate-600 text-xs">
                    {l.keterangan ?? "Penyesuaian Manual"}
                  </Td>
                  <Td className="text-slate-500 text-xs font-medium">
                    {l.userName}
                  </Td>
                </tr>
              );
            })}
            {processedRows.length === 0 && (
              <tr>
                <Td colSpan={8} className="py-12 text-center text-muted">
                  Belum ada pergerakan stok untuk saringan ini.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
