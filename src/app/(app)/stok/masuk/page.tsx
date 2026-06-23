import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { StockInClient } from "./StockInClient";

export default async function StockInPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  
  if (user.role !== "ADMIN_GUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-800">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700">
          Halaman penerimaan barang masuk batch hanya diizinkan untuk <strong>Admin Gudang</strong>.
        </p>
      </div>
    );
  }

  // Fetch active items metadata to populate select dropdowns
  const items = await prisma.item.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
    select: {
      id: true,
      kode: true,
      nama: true,
      hargaBeli: true,
    },
  });

  const formattedItems = items.map((it) => ({
    id: it.id,
    kode: it.kode,
    nama: it.nama,
    hargaBeli: Number(it.hargaBeli),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Penerimaan Barang / Restock Batch</h1>
        <p className="text-sm text-muted">
          Catat penerimaan material baru dari supplier. Harga beli master barang akan diperbarui otomatis sesuai input.
        </p>
      </div>

      <StockInClient items={formattedItems} />
    </div>
  );
}
