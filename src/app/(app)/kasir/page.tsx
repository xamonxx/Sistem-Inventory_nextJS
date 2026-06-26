import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getStokAkhirMap } from "@/lib/stock";
import { KasirClient } from "./KasirClient";

export default async function KasirPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN_KASIR") {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Kasir</h1>
        <p className="mt-2 text-sm text-amber-700">
          Menu kasir hanya untuk <b>Admin Kasir</b>. Anda login sebagai Admin Gudang.
        </p>
      </div>
    );
  }

  const items = await prisma.item.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });
  const stokMap = await getStokAkhirMap(items.map((i) => i.id));
  const data = items.map((i) => ({
    id: i.id,
    kode: i.kode,
    nama: i.nama,
    hargaJual: Number(i.hargaJual),
    stok: stokMap[i.id] ?? i.stokAwal,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kasir / Transaksi</h1>
        <p className="text-sm text-muted">Buat transaksi penjualan, stok otomatis berkurang.</p>
      </div>
      <KasirClient items={data} />
    </div>
  );
}
