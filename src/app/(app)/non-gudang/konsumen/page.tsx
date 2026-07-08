import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NgKonsumenClient } from "./NgKonsumenClient";

export const revalidate = 60;

export default async function NgKonsumenPage() {
  const user = await requireUser();

  if (user.role !== "ADMIN_NONGUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h1 className="text-xl font-bold text-red-800 dark:text-red-300">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          Menu ini hanya diizinkan untuk <strong>Admin Non-Gudang</strong>.
        </p>
      </div>
    );
  }

  const rows = await prisma.ngKonsumen.findMany({
    orderBy: { nama: "asc" },
    select: {
      id: true,
      namaGrup: true,
      nama: true,
      alamat: true,
      namaWorkshop: true,
      _count: { select: { invoices: true } },
    },
  });

  const data = rows.map((r) => ({
    id: r.id,
    namaGrup: r.namaGrup,
    nama: r.nama,
    alamat: r.alamat,
    namaWorkshop: r.namaWorkshop,
    invoiceCount: r._count.invoices,
  }));

  return <NgKonsumenClient initialItems={data} />;
}
