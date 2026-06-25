import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StokForm } from "./StokForm";
import { StokClient } from "./StokClient";

export default async function StokPage() {
  const user = await requireUser();

  if (user.role !== "ADMIN_GUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-800">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700">
          Menu Kartu Stok &amp; Riwayat Mutasi hanya diizinkan untuk <strong>Admin Gudang / Owner</strong>.
        </p>
      </div>
    );
  }

  const canEdit = user.role === "ADMIN_GUDANG";

  // Fetch items for selection options
  const items = await prisma.item.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
    select: { id: true, kode: true, nama: true },
  });

  // Fetch full stock ledgers movement history
  const ledgers = await prisma.stockLedger.findMany({
    orderBy: { id: "desc" },
    take: 300,
    include: {
      item: true,
      user: true,
    },
  });

  // Format ledger rows for Client Component
  const formattedLedgers = ledgers.map((l) => ({
    id: l.id,
    itemId: l.itemId,
    itemName: l.item.nama,
    itemKode: l.item.kode,
    itemMinStok: l.item.minStok,
    itemStokAwal: l.item.stokAwal,
    tanggal: l.tanggal.toISOString(),
    tipe: l.tipe as "MASUK" | "KELUAR" | "RETUR" | "KOREKSI",
    qty: l.qty,
    keterangan: l.keterangan,
    userId: l.userId,
    userName: l.user?.nama ?? "System",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kartu Stok &amp; Riwayat Mutasi</h1>
          <p className="text-sm text-muted">Lihat pergerakan persediaan barang masuk, penjualan, retur, dan penyesuaian.</p>
        </div>
      </div>

      {canEdit ? (
        <StokForm items={items} />
      ) : (
        <div className="rounded-xl bg-blue-50 p-4 border border-blue-200 text-xs text-blue-800">
          <strong>ℹ️ Mode Lihat Saja:</strong> Hanya akun <strong>Admin Gudang</strong> yang memiliki wewenang untuk memasukkan restok barang baru atau melakukan penyesuaian manual.
        </div>
      )}

      <StokClient initialLedgers={formattedLedgers} items={items} canEdit={canEdit} />
    </div>
  );
}
