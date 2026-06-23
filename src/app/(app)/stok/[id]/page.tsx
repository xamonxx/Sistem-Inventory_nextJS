import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { Badge, Card, Table, Th, Td } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

const TIPE_TONE: Record<string, "green" | "red" | "blue" | "amber"> = {
  MASUK: "green", KELUAR: "red", RETUR: "blue", KOREKSI: "amber",
};

export default async function KartuStokPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id: Number(id) } });
  if (!item) notFound();

  const ledgers = await prisma.stockLedger.findMany({
    where: { itemId: item.id },
    orderBy: { id: "asc" },
    include: { user: true },
  });

  // saldo berjalan mulai dari stok awal
  let saldo = item.stokAwal;
  const rows = ledgers.map((l) => {
    saldo += l.qty;
    return { ...l, saldo };
  }).reverse();

  const masuk = ledgers.filter((l) => l.tipe === "MASUK").reduce((a, l) => a + l.qty, 0);
  const keluar = ledgers.filter((l) => l.tipe === "KELUAR").reduce((a, l) => a + Math.abs(l.qty), 0);
  const retur = ledgers.filter((l) => l.tipe === "RETUR").reduce((a, l) => a + l.qty, 0);

  return (
    <div className="space-y-6">
      <Link href="/barang" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} /> Kembali ke Master Barang
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{item.nama}</h1>
        <p className="font-mono text-sm text-muted">{item.kode}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card><p className="text-xs text-muted">Stok Awal</p><p className="text-lg font-bold">{item.stokAwal}</p></Card>
        <Card><p className="text-xs text-muted">Total Masuk</p><p className="text-lg font-bold text-emerald-600">+{masuk}</p></Card>
        <Card><p className="text-xs text-muted">Total Keluar</p><p className="text-lg font-bold text-red-600">-{keluar}</p></Card>
        <Card><p className="text-xs text-muted">Total Retur</p><p className="text-lg font-bold text-blue-600">+{retur}</p></Card>
        <Card><p className="text-xs text-muted">Stok Akhir</p><p className={`text-lg font-bold ${saldo < item.minStok ? "text-red-600" : ""}`}>{saldo}</p></Card>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Riwayat Lengkap (Kartu Stok)</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <thead>
              <tr><Th>Tanggal</Th><Th>Tipe</Th><Th className="text-right">Qty</Th><Th className="text-right">Saldo</Th><Th>Keterangan</Th><Th>Oleh</Th></tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <Td>{formatTanggal(l.tanggal)}</Td>
                  <Td><Badge tone={TIPE_TONE[l.tipe]}>{l.tipe}</Badge></Td>
                  <Td className={`text-right font-medium ${l.qty < 0 ? "text-red-600" : "text-emerald-600"}`}>{l.qty > 0 ? `+${l.qty}` : l.qty}</Td>
                  <Td className="text-right font-semibold">{l.saldo}</Td>
                  <Td className="text-muted">{l.keterangan ?? "-"}</Td>
                  <Td className="text-muted">{l.user?.nama ?? "-"}</Td>
                </tr>
              ))}
              {rows.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">Belum ada pergerakan. Stok = stok awal ({item.stokAwal}).</Td></tr>}
            </tbody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-muted">Harga beli saat ini: {formatRupiah(item.hargaBeli)} · Harga jual: {formatRupiah(item.hargaJual)}</p>
    </div>
  );
}
