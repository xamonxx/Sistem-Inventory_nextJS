"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleUser, resetPassword } from "./actions";
import { Button, Card, Input, Label, Select, Badge } from "@/components/ui";
import { formatTanggal } from "@/lib/utils";
import { Shield, User, Power, KeyRound, Activity, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type UserData = {
  id: number;
  username: string;
  nama: string;
  role: "ADMIN_KASIR" | "ADMIN_GUDANG";
  aktif: boolean;
  createdAt: string;
};

export function PenggunaClient({
  users,
  currentUserId,
  canEdit,
}: {
  users: UserData[];
  currentUserId: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [resetting, setResetting] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleToggleStatus(userId: number, currentStatus: boolean) {
    if (userId === currentUserId) {
      return toast.warning("Anda tidak bisa menonaktifkan akun sendiri!");
    }
    startTransition(async () => {
      try {
        await toggleUser(userId, !currentStatus);
        toast.success("Status keaktifan pengguna diperbarui");
        router.refresh();
      } catch {
        toast.error("Gagal memperbarui status keaktifan");
      }
    });
  }

  async function handleResetPassword() {
    if (!selectedUser) return;
    if (newPasswordVal.length < 4) {
      return toast.error("Password minimal 4 karakter");
    }

    setResetting(true);
    try {
      const res = await resetPassword(selectedUser.id, newPasswordVal);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
      } else if (res && "ok" in res) {
        toast.success(`Password untuk ${selectedUser.nama} berhasil direset!`);
        setSelectedUser(null);
        setNewPasswordVal("");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat meriset password.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Users Grid */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <Card key={u.id} className="relative flex flex-col justify-between overflow-hidden shadow-md border-border bg-card">
              
              {/* Header card info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge tone={u.role === "ADMIN_GUDANG" ? "amber" : "blue"}>
                    <span className="flex items-center gap-1">
                      <Shield size={12} />
                      {u.role === "ADMIN_GUDANG" ? "Admin Gudang" : "Admin Kasir"}
                    </span>
                  </Badge>
                  {isSelf && (
                    <Badge tone="slate" className="text-[10px] uppercase font-bold">
                      Akun Anda
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{u.nama}</h3>
                    <p className="font-mono text-xs text-muted">@{u.username}</p>
                  </div>
                </div>

                <div className="text-[10px] text-muted pt-2 border-t border-dashed border-border">
                  Terdaftar: {formatTanggal(u.createdAt)}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-wrap gap-2 pt-3 border-t border-border">
                {canEdit && (
                  <>
                    {/* Toggle Status Switch */}
                    <button
                      type="button"
                      disabled={isSelf || pending}
                      onClick={() => handleToggleStatus(u.id, u.aktif)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border ${
                        u.aktif
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-600 border-slate-350 hover:bg-slate-200"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Power size={13} /> {u.aktif ? "Aktif" : "Nonaktif"}
                    </button>

                    {/* Reset Password */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedUser(u)}
                      className="text-xs"
                    >
                      <KeyRound size={12} /> Reset Sandi
                    </Button>
                  </>
                )}

                {/* Audit Monitor link */}
                <Link
                  href={`/log-aktivitas?q=${u.nama}`}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition ml-auto"
                >
                  <Activity size={12} /> Log Aktivitas
                </Link>
              </div>
            </Card>
          );
        })}
      </section>

      {/* Password reset dialog */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs" onClick={() => setSelectedUser(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="font-bold text-slate-900">Reset Password Pengguna</h3>
              <button onClick={() => setSelectedUser(null)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-muted">
                Mengubah kunci akses sandi login untuk pengguna <strong>{selectedUser.nama}</strong>.
              </p>

              <div>
                <Label>Password Baru</Label>
                <Input
                  type="password"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="Ketik minimal 4 karakter..."
                  className="h-10"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleResetPassword} disabled={resetting} className="flex-1">
                  {resetting ? "Menyimpan..." : "Reset Password"}
                </Button>
                <Button variant="outline" onClick={() => { setSelectedUser(null); setNewPasswordVal(""); }}>
                  Batal
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
