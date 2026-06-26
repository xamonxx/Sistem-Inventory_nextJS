import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StokForm } from "./StokForm";
import { StokClient } from "./StokClient";

// Cache stok page for 45 seconds (balances dynamic filters with performance)
export const revalidate = 45;

export default async function StokPage({
  searchParams,
}: {
  searchParams: Promise<{
    itemId?: string;
    tipe?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}) {
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
  const params = await searchParams;

  // Parse filters from search params
  const itemIdFilter = params.itemId ? parseInt(params.itemId) : undefined;
  const tipeFilter = params.tipe && params.tipe !== "ALL" ? params.tipe : undefined;
  const searchQuery = params.search?.trim() || undefined;
  const startDate = params.startDate || undefined;
  const endDate = params.endDate || undefined;

  // Fetch items for selection options
  const items = await prisma.item.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
    select: { id: true, kode: true, nama: true },
  });

  // Build WHERE clause for server-side filtering
  const where: any = {};
  
  if (itemIdFilter) {
    where.itemId = itemIdFilter;
  }
  
  if (tipeFilter) {
    where.tipe = tipeFilter;
  }
  
  if (searchQuery) {
    where.OR = [
      { item: { nama: { contains: searchQuery } } },
      { keterangan: { contains: searchQuery } },
    ];
  }
  
  if (startDate || endDate) {
    where.tanggal = {};
    if (startDate) {
      where.tanggal.gte = new Date(startDate);
    }
    if (endDate) {
      where.tanggal.lte = new Date(endDate + "T23:59:59");
    }
  }

  // Fetch filtered stock ledgers (server-side filtering reduces data transfer)
  // If filtering by single item, fetch all records for accurate running balance
  // Otherwise, limit to recent 300 records
  const take = itemIdFilter ? undefined : 300;
  
  const ledgers = await prisma.stockLedger.findMany({
    where,
    orderBy: { id: "desc" },
    take,
    include: {
      item: true,
      user: true,
    },
  });

  // Get total count for pagination info
  const totalCount = await prisma.stockLedger.count({ where });

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

      <StokClient 
        initialLedgers={formattedLedgers} 
        items={items} 
        canEdit={canEdit}
        totalCount={totalCount}
      />
    </div>
  );
}
