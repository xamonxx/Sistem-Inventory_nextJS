import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogAktivitasClient } from "./LogAktivitasClient";

export default async function LogAktivitasPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  // Audit logs are restricted to ADMIN_GUDANG accounts (acting as super admins/operators)
  if (user.role !== "ADMIN_GUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-800">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700">
          Menu Log Aktivitas (Audit Trail) hanya diizinkan untuk <strong>Admin Gudang / Operator Utama</strong>.
        </p>
      </div>
    );
  }

  // Query database logs including operator user accounts
  const logs = await prisma.activityLog.findMany({
    orderBy: { id: "desc" },
    take: 200,
    include: {
      user: true,
    },
  });

  const formattedLogs = logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    userName: l.user?.nama ?? "Sistem Otomatis",
    userRole: l.user?.role === "ADMIN_GUDANG" ? "Admin Gudang" : l.user?.role === "ADMIN_KASIR" ? "Admin Kasir" : "System",
    aksi: l.aksi,
    entitas: l.entitas,
    entitasId: l.entitasId,
    detail: l.detail,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail / Log Aktivitas</h1>
        <p className="text-sm text-muted">
          Pantau rekam jejak audit sistem termasuk perubahan harga master, penyesuaian stok manual, penjualan POS, dan aktivitas login.
        </p>
      </div>

      <LogAktivitasClient initialLogs={formattedLogs} />
    </div>
  );
}
