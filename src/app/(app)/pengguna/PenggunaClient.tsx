"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleUser, resetPassword } from "./actions";
import { Button, Card, Input, Label, Badge } from "@/components/ui";
import { Drawer } from "@/components/Drawer";
import { formatTanggal } from "@/lib/utils";
import { Shield, User, Power, KeyRound, Activity, Check, X } from "lucide-react";
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
        
        // Update local state if the drawer is open
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({
            ...selectedUser,
            aktif: !currentStatus
          });
        }
        
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
        setNewPasswordVal("");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat meriset password.");
    } finally {
      setResetting(false);
    }
  }

  const getInitials = (nama: string) => {
    return nama
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Users Grid */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const initials = getInitials(u.nama);
          const avatarColor = u.role === "ADMIN_GUDANG" 
            ? "bg-amber-50 text-amber-700 border-amber-200" 
            : "bg-blue-50 text-blue-700 border-blue-200";

          return (
            <Card key={u.id} className="relative flex flex-col justify-between overflow-hidden hover:border-slate-350 transition-all duration-200 p-5">
              
              {/* Header card info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge tone={u.role === "ADMIN_GUDANG" ? "amber" : "blue"}>
                    <span className="flex items-center gap-1.5 text-[10px]">
                      <Shield size={12} />
                      {u.role === "ADMIN_GUDANG" ? "Admin Gudang" : "Admin Kasir"}
                    </span>
                  </Badge>
                  {isSelf && (
                    <Badge tone="slate" className="text-[9px] uppercase font-bold tracking-wider">
                      Akun Anda
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full font-bold text-sm border shadow-xs ${avatarColor}`}>
                      {initials}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${u.aktif ? "bg-emerald-500" : "bg-slate-350"}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-none">{u.nama}</h3>
                    <p className="font-mono text-xs text-slate-400 mt-1">@{u.username}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-450 pt-3 border-t border-slate-100">
                  <span>Terdaftar: {formatTanggal(u.createdAt)}</span>
                  <span className="font-semibold text-slate-400 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${u.aktif ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {u.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedUser(u)}
                    className="text-xs h-8 rounded-lg"
                  >
                    <KeyRound size={12} /> Atur Akun
                  </Button>
                ) : (
                  <div className="text-[10.5px] text-slate-400 italic flex items-center gap-1 py-1">
                    <Shield size={12} /> Lihat Saja
                  </div>
                )}

                {/* Audit Monitor link */}
                <Link
                  href={`/log-aktivitas?q=${u.nama}`}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-650 hover:bg-slate-50 transition ml-auto shadow-xs active:scale-95"
                >
                  <Activity size={12} /> Log Aktivitas
                </Link>
              </div>
            </Card>
          );
        })}
      </section>

      {/* Account Settings Drawer */}
      <Drawer
        isOpen={selectedUser !== null}
        onClose={() => {
          setSelectedUser(null);
          setNewPasswordVal("");
        }}
        title="Pengaturan Hak Akses & Keamanan"
        size="small"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Profile Summary */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-base border shadow-xs ${
                selectedUser.role === "ADMIN_GUDANG" 
                  ? "bg-amber-100 text-amber-800 border-amber-250" 
                  : "bg-blue-100 text-blue-800 border-blue-250"
              }`}>
                {getInitials(selectedUser.nama)}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 leading-none">{selectedUser.nama}</h4>
                <p className="font-mono text-xs text-slate-450 mt-1">@{selectedUser.username}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge tone={selectedUser.role === "ADMIN_GUDANG" ? "amber" : "blue"}>
                    {selectedUser.role === "ADMIN_GUDANG" ? "Admin Gudang" : "Admin Kasir"}
                  </Badge>
                  {selectedUser.id === currentUserId && (
                    <Badge tone="slate">Anda</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle Status Keaktifan */}
            {canEdit && (
              <div className="space-y-2">
                <Label>Status Akun</Label>
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800">Aktifkan Pengguna</span>
                    <p className="text-[10px] text-slate-400">Menentukan apakah user bisa login ke sistem.</p>
                  </div>
                  <button
                    type="button"
                    disabled={selectedUser.id === currentUserId || pending}
                    onClick={() => handleToggleStatus(selectedUser.id, selectedUser.aktif)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                      selectedUser.aktif
                        ? "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-650 border-slate-300 hover:bg-slate-200"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Power size={13} /> {selectedUser.aktif ? "Aktif" : "Nonaktif"}
                  </button>
                </div>
              </div>
            )}

            {/* Permission Checklist Summary */}
            <div className="space-y-2">
              <Label>Hak Akses (Permissions)</Label>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <p className="text-[10px] text-slate-400">
                  Berikut hak akses yang diizinkan untuk peran <strong className="text-slate-600">{selectedUser.role === "ADMIN_GUDANG" ? "Admin Gudang" : "Admin Kasir"}</strong>:
                </p>
                <div className="space-y-2.5">
                  {[
                    {
                      desc: "Mengelola persediaan (Tambah/Restok/Koreksi Stok)",
                      allowed: selectedUser.role === "ADMIN_GUDANG"
                    },
                    {
                      desc: "Edit harga jual & beli barang master",
                      allowed: selectedUser.role === "ADMIN_GUDANG"
                    },
                    {
                      desc: "Akses menu Laporan Margin & Nilai Aset",
                      allowed: selectedUser.role === "ADMIN_GUDANG"
                    },
                    {
                      desc: "Proses transaksi kasir & checkout POS",
                      allowed: true
                    },
                    {
                      desc: "Melakukan pengajuan & approval retur",
                      allowed: true
                    },
                    {
                      desc: "Manajemen Pengguna (Ganti Password/Edit User)",
                      allowed: selectedUser.role === "ADMIN_GUDANG"
                    }
                  ].map((perm, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      {perm.allowed ? (
                        <div className="flex items-center justify-center w-4 h-4 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 mt-0.5">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-4 h-4 rounded bg-slate-100 text-slate-400 border border-slate-200 mt-0.5">
                          <X size={11} strokeWidth={3} />
                        </div>
                      )}
                      <span className={perm.allowed ? "text-slate-700 font-medium" : "text-slate-400 line-through"}>
                        {perm.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reset Password Form */}
            {canEdit && (
              <div className="space-y-3 pt-4 border-t border-slate-150">
                <Label>Reset Password Keamanan</Label>
                <div className="space-y-3">
                  <Input
                    type="password"
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="Masukkan password baru (min 4 karakter)..."
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleResetPassword} 
                      disabled={resetting || newPasswordVal.length < 4}
                      className="flex-1 text-xs h-10"
                    >
                      {resetting ? "Mengubah..." : "Ubah Password"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setNewPasswordVal("")} 
                      className="text-xs h-10 border-slate-200"
                    >
                      Reset Input
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

