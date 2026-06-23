"use client";

import { useState } from "react";
import { Table, Th, Td, Badge, Card, Button } from "@/components/ui";
import { formatRupiah } from "@/lib/utils";
import { Download, BarChart3, TrendingUp, Wallet, ShieldAlert, Archive, FileSpreadsheet, Printer } from "lucide-react";
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

export function LaporanClient({
  role,
  marginData,
  terlaris,
  stokData,
  piutangData,
}: LaporanClientProps) {
  const [activeTab, setActiveTab] = useState<"ringkasan" | "omset" | "margin" | "piutang" | "stok">("ringkasan");
  const isGudang = role === "ADMIN_GUDANG";

  // Compute summary totals
  const totalOmset = marginData.reduce((acc, r) => acc + r.omset, 0);
  const totalMargin = isGudang ? marginData.reduce((acc, r) => acc + r.margin, 0) : 0;
  const totalPiutang = piutangData.filter((p) => p.status !== "LUNAS").reduce((acc, p) => acc + p.sisa, 0);
  const totalAsetValue = stokData.reduce((acc, s) => acc + s.nilaiAset, 0);
  const stokMenipisCount = stokData.filter((s) => s.status === "MENIPIS").length;

  function triggerExport(type: string) {
    toast.success(`Mengunduh excel laporan ${type}...`);
    window.location.href = `/api/export?type=${type}`;
  }

  return (
    <div className="space-y-6">
      {/* Visual Tab menu bar */}
      <div className="flex border-b border-border bg-card rounded-lg p-1.5 shadow-xs max-w-2xl">
        <button
          onClick={() => setActiveTab("ringkasan")}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition ${
            activeTab === "ringkasan" ? "bg-primary text-white" : "text-muted hover:text-slate-800"
          }`}
        >
          Ringkasan
        </button>
        <button
          onClick={() => setActiveTab("omset")}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition ${
            activeTab === "omset" ? "bg-primary text-white" : "text-muted hover:text-slate-800"
          }`}
        >
          Penjualan &amp; Omset
        </button>
        {isGudang && (
          <button
            onClick={() => setActiveTab("margin")}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition ${
              activeTab === "margin" ? "bg-primary text-white" : "text-muted hover:text-slate-800"
            }`}
          >
            Margin Keuntungan
          </button>
        )}
        <button
          onClick={() => setActiveTab("piutang")}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition ${
            activeTab === "piutang" ? "bg-primary text-white" : "text-muted hover:text-slate-800"
          }`}
        >
          Piutang
        </button>
        <button
          onClick={() => setActiveTab("stok")}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition ${
            activeTab === "stok" ? "bg-primary text-white" : "text-muted hover:text-slate-800"
          }`}
        >
          Stok Gudang
        </button>
      </div>

      {/* Overview stats cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 bg-emerald-50/20 border-emerald-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Total Pendapatan (Omset)</p>
            <p className="text-lg font-black text-emerald-700 font-mono">{formatRupiah(totalOmset)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-blue-50/20 border-blue-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Margin Keuntungan</p>
            <p className="text-lg font-black text-blue-700 font-mono">
              {isGudang ? formatRupiah(totalMargin) : "🔒 Dibatasi"}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-amber-50/20 border-amber-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Outstanding Piutang</p>
            <p className="text-lg font-black text-amber-700 font-mono">{formatRupiah(totalPiutang)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-slate-50/20 border-slate-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Archive size={24} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Nilai Aset Persediaan</p>
            <p className="text-lg font-black text-slate-800 font-mono">
              {isGudang ? formatRupiah(totalAsetValue) : "🔒 Dibatasi"}
            </p>
          </div>
        </Card>
      </section>

      {/* Print / Export Action Header */}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer size={14} /> Cetak Halaman (PDF)
        </Button>
        <Button size="sm" variant="success" onClick={() => triggerExport(activeTab)}>
          <Download size={14} /> Ekspor Excel ({activeTab})
        </Button>
      </div>

      {/* Tab: Summary (Overview widgets) */}
      {activeTab === "ringkasan" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Best Sellers */}
          <Card className="space-y-3">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" /> Barang Terlaris (Top 10)
            </h3>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th className="w-12 text-center">#</Th>
                  <Th>Nama Barang</Th>
                  <Th className="text-center w-24">Qty Terjual</Th>
                  <Th className="text-right w-36">Total Omset</Th>
                </tr>
              </thead>
              <tbody>
                {terlaris.map((it, i) => (
                  <tr key={i}>
                    <td className="text-center font-bold text-slate-400 py-2 border-b border-border">{i + 1}</td>
                    <Td className="font-medium">{it.nama}</Td>
                    <Td className="text-center font-bold font-mono">{it.qtyTerjual} unit</Td>
                    <Td className="text-right font-mono">{formatRupiah(it.omset)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {/* Critical stock items */}
          <Card className="space-y-3">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-500" /> Stok Perlu Perhatian ({stokMenipisCount})
            </h3>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Kode</Th>
                  <Th>Nama Barang</Th>
                  <Th className="text-center w-24">Stok Akhir</Th>
                  <Th className="text-center w-24">Min Safety</Th>
                </tr>
              </thead>
              <tbody>
                {stokData
                  .filter((s) => s.status === "MENIPIS" || s.stokAkhir < 0)
                  .slice(0, 10)
                  .map((it) => (
                    <tr key={it.kode}>
                      <Td className="font-mono text-[10px]">{it.kode}</Td>
                      <Td className="font-medium">{it.nama}</Td>
                      <Td className="text-center">
                        <Badge tone={it.stokAkhir < 0 ? "red" : "amber"}>
                          {it.stokAkhir} unit
                        </Badge>
                      </Td>
                      <Td className="text-center font-mono">{it.minStok}</Td>
                    </tr>
                  ))}
                {stokMenipisCount === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted">Semua stok aman. 👍</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* Tab: Penjualan & Omset */}
      {activeTab === "omset" && (
        <Card className="space-y-4">
          <h3 className="font-semibold text-sm text-foreground">Daftar Transaksi Penjualan</h3>
          <Table className="text-xs">
            <thead>
              <tr>
                <Th>Nama Barang / Transaksi</Th>
                <Th className="text-center">Qty Terjual</Th>
                <Th className="text-right">Total Omset</Th>
              </tr>
            </thead>
            <tbody>
              {marginData.map((r) => (
                <tr key={r.nama}>
                  <Td className="font-medium">{r.nama}</Td>
                  <Td className="text-center font-mono font-semibold">{r.qtyTerjual} unit</Td>
                  <Td className="text-right font-mono font-semibold text-slate-800">{formatRupiah(r.omset)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Tab: Margin (Only for Gudang) */}
      {activeTab === "margin" && isGudang && (
        <Card className="space-y-4">
          <h3 className="font-semibold text-sm text-foreground">Analisis Profitabilitas &amp; Margin</h3>
          <Table className="text-xs">
            <thead>
              <tr>
                <Th>Nama Barang</Th>
                <Th className="text-center">Qty Terjual</Th>
                <Th className="text-right">Omset Pendapatan</Th>
                <Th className="text-right">Keuntungan Bersih (Margin)</Th>
                <Th className="text-center w-28">Margin %</Th>
              </tr>
            </thead>
            <tbody>
              {marginData.map((r) => {
                const marginPct = r.omset > 0 ? Math.round((r.margin / r.omset) * 100) : 0;
                return (
                  <tr key={r.nama}>
                    <Td className="font-medium">{r.nama}</Td>
                    <Td className="text-center font-mono">{r.qtyTerjual} unit</Td>
                    <Td className="text-right font-mono">{formatRupiah(r.omset)}</Td>
                    <Td className="text-right font-mono font-bold text-emerald-600">{formatRupiah(r.margin)}</Td>
                    <Td className="text-center font-mono font-semibold text-slate-600">
                      <Badge tone={marginPct > 15 ? "green" : marginPct > 5 ? "blue" : "amber"}>
                        {marginPct}%
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Tab: Piutang */}
      {activeTab === "piutang" && (
        <Card className="space-y-4">
          <h3 className="font-semibold text-sm text-foreground">Laporan Piutang &amp; Receivables</h3>
          <Table className="text-xs">
            <thead>
              <tr>
                <Th>No. Invoice</Th>
                <Th>Tanggal</Th>
                <Th>Pelanggan</Th>
                <Th className="text-right">Nilai Tagihan</Th>
                <Th className="text-right">Sudah Dibayar</Th>
                <Th className="text-right">Sisa Tagihan</Th>
                <Th className="text-center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {piutangData.map((p) => (
                <tr key={p.noInvoice}>
                  <Td className="font-mono font-semibold">{p.noInvoice}</Td>
                  <Td>{p.tanggal}</Td>
                  <Td className="font-medium text-slate-800">{p.client}</Td>
                  <Td className="text-right font-mono">{formatRupiah(p.total)}</Td>
                  <Td className="text-right font-mono text-emerald-600">{formatRupiah(p.dibayar)}</Td>
                  <Td className="text-right font-mono font-bold text-amber-700">{formatRupiah(p.sisa)}</Td>
                  <Td className="text-center">
                    <Badge tone={p.status === "LUNAS" ? "green" : "amber"}>
                      {p.status}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Tab: Stok */}
      {activeTab === "stok" && (
        <Card className="space-y-4">
          <h3 className="font-semibold text-sm text-foreground">Nilai Persediaan Stok Gudang</h3>
          <Table className="text-xs">
            <thead>
              <tr>
                <Th>Kode</Th>
                <Th>Nama Barang</Th>
                <Th className="text-right">Stok Fisik</Th>
                <Th className="text-right">Harga Beli</Th>
                <Th className="text-right">Nilai Aset</Th>
                <Th className="text-center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {stokData.map((s) => (
                <tr key={s.kode}>
                  <Td className="font-mono">{s.kode}</Td>
                  <Td className="font-medium text-slate-800">{s.nama}</Td>
                  <Td className="text-right font-mono font-bold">{s.stokAkhir} unit</Td>
                  <Td className="text-right font-mono">
                    {isGudang ? formatRupiah(s.hargaBeli) : "🔒 Dibatasi"}
                  </Td>
                  <Td className="text-right font-mono font-bold text-slate-800">
                    {isGudang ? formatRupiah(s.nilaiAset) : "🔒 Dibatasi"}
                  </Td>
                  <Td className="text-center">
                    <Badge tone={s.status === "AMAN" ? "green" : "amber"}>
                      {s.status}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
