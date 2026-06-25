import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PenggunaForm } from "./PenggunaForm";
import { PenggunaClient } from "./PenggunaClient";

export default async function PenggunaPage() {
  const currentUser = await requireUser();

  if (currentUser.role !== "ADMIN_GUDANG") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-800">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-red-700">
          Menu Manajemen Pengguna hanya diizinkan untuk <strong>Admin Gudang</strong>.
        </p>
      </div>
    );
  }

  const canEdit = currentUser.role === "ADMIN_GUDANG";

  // Fetch all accounts from database
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    username: u.username,
    nama: u.nama,
    role: u.role as "ADMIN_KASIR" | "ADMIN_GUDANG",
    aktif: u.aktif,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Pengguna</h1>
          <p className="text-sm text-muted">Kelola akun otorisasi kasir dan administrator gudang.</p>
        </div>
        {canEdit && (
          <div className="flex items-center">
            <PenggunaForm />
          </div>
        )}
      </div>

      <PenggunaClient
        users={formattedUsers}
        currentUserId={currentUser.id}
        canEdit={canEdit}
      />
    </div>
  );
}
