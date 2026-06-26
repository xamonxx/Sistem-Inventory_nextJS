import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getStokAkhirMap } from "@/lib/stock";
import { BarangForm } from "./BarangForm";
import { BarangClient } from "./BarangClient";

// Cache barang page for 120 seconds (item list is relatively static)
export const revalidate = 120;

export default async function BarangPage() {
  const user = await requireUser();

  if (user.role !== "ADMIN_GUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-800">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700">
          Menu Master Barang hanya diizinkan untuk <strong>Admin Gudang / Owner</strong>.
        </p>
      </div>
    );
  }

  const canEdit = user.role === "ADMIN_GUDANG";

  // Fetch all items from database
  const items = await prisma.item.findMany({
    orderBy: { kode: "asc" },
  });
  
  const stokMap = await getStokAkhirMap(items.map((i) => i.id));

  // Format dataset for UI client
  const data = items.map((it) => ({
    id: it.id,
    kode: it.kode,
    nama: it.nama,
    hargaBeli: Number(it.hargaBeli),
    hargaJual: Number(it.hargaJual),
    stokAwal: it.stokAwal,
    minStok: it.minStok,
    aktif: it.aktif,
    stok: stokMap[it.id] ?? it.stokAwal,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Master Barang</h1>
          <p className="text-sm text-muted">Katalog persediaan barang, plywood, dan harga material.</p>
        </div>
        {canEdit && (
          <div className="flex items-center">
            <BarangForm canEdit={canEdit} />
          </div>
        )}
      </div>

      <BarangClient initialItems={data} canEdit={canEdit} />
    </div>
  );
}
