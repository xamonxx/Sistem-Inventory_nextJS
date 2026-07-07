"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleUser, resetPassword } from "./actions";
import { Button, Card, Input, Label, Badge, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { Drawer } from "@/components/Drawer";
import { formatTanggal, cn } from "@/lib/utils";
import { Shield, User, Power, KeyRound, Activity, Check, X, Eye, EyeOff, Lock } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${u.aktif ? "bg-primary-500" : "bg-slate-350"}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm leading-none">{u.nama}</h3>
                    <p className="font-mono text-xs text-slate-400 mt-1">@{u.username}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-450 pt-3 border-t border-border">
                  <span>Terdaftar: {formatTanggal(u.createdAt)}</span>
                  <span className="font-semibold text-slate-400 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${u.aktif ? "bg-primary-500" : "bg-slate-400"}`} />
                    {u.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-wrap gap-2 pt-3 border-t border-border">
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
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-900 transition ml-auto shadow-xs active:scale-95"
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
          setShowPassword(false);
        }}
        title="Pengaturan Hak Akses & Keamanan"
        size="small"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Profile Summary */}
            <div className="relative overflow-hidden rounded-[20px] border border-border bg-[#f8fafc] dark:bg-slate-800/50 p-5">
              {/* Background decorative gradient circle */}
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--primary)]/5 blur-xl pointer-events-none" />

              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl font-bold text-base border shadow-xs transition-transform hover:scale-105 ${
                    selectedUser.role === "ADMIN_GUDANG"
                      ? "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/40 dark:to-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60"
                      : "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/40 dark:to-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60"
                  }`}>
                    {getInitials(selectedUser.nama)}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center ${selectedUser.aktif ? "bg-primary-500" : "bg-slate-400"}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-card animate-pulse" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-base font-extrabold text-foreground leading-none">{selectedUser.nama}</h4>
                  <p className="font-mono text-xs text-slate-400 dark:text-slate-500">@{selectedUser.username}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={selectedUser.role === "ADMIN_GUDANG" ? "amber" : "blue"} className="text-[10px] px-2 py-0.5">
                      {selectedUser.role === "ADMIN_GUDANG" ? "Admin Gudang" : "Admin Kasir"}
                    </Badge>
                    {selectedUser.id === currentUserId && (
                      <Badge tone="slate" className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider">Anda</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Toggle Status Keaktifan */}
            {canEdit && (
              <div className="space-y-2">
                <Label className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">Status Keaktifan Akun</Label>
                <div className="flex items-center justify-between p-4 rounded-[20px] border border-border bg-card shadow-xs">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-foreground">Status Akses</span>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 pr-4">Izinkan akun ini untuk melakukan login dan mengelola sistem.</p>
                  </div>
                  <button
                    type="button"
                    disabled={selectedUser.id === currentUserId || pending}
                    onClick={() => handleToggleStatus(selectedUser.id, selectedUser.aktif)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                      selectedUser.aktif ? "bg-primary-500" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow-xs ring-0 transition duration-200 ease-in-out",
                        selectedUser.aktif ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Permission Checklist Summary */}
            <div className="space-y-2">
              <Label className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">Hak Akses (Permissions)</Label>
              <div className="rounded-[20px] border border-border bg-[#f8fafc]/50 dark:bg-slate-800/40 p-5 space-y-4">
                <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">
                  Berikut hak akses otomatis yang diberikan berdasarkan peran <strong className="text-slate-700 dark:text-slate-200">{selectedUser.role === "ADMIN_GUDANG" ? "Admin Gudang" : "Admin Kasir"}</strong>:
                </p>
                <div className="grid grid-cols-1 gap-3">
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
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
                        perm.allowed
                          ? "bg-primary-50/30 dark:bg-primary-900/20 border-primary-100/40 dark:border-primary-800/40 text-slate-700 dark:text-slate-200"
                          : "bg-slate-50/50 dark:bg-slate-800/30 border-border/40 text-slate-400 dark:text-slate-500"
                      )}
                    >
                      {perm.allowed ? (
                        <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300 border border-primary-250 dark:border-primary-700 shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-slate-150 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-250 dark:border-slate-700 shrink-0">
                          <Lock size={11} />
                        </div>
                      )}
                      <span className="text-xs font-semibold">
                        {perm.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reset Password Form */}
            {canEdit && (
              <div className="space-y-3 pt-5 border-t border-border">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] mb-0">Reset Password Keamanan</Label>
                  <CharCounter value={newPasswordVal} max={FIELD_LIMITS.passwordMax} />
                </div>
                <div className="space-y-3.5">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value)}
                      minLength={FIELD_LIMITS.passwordMin}
                      maxLength={FIELD_LIMITS.passwordMax}
                      placeholder={`Password baru (min ${FIELD_LIMITS.passwordMin} karakter)`}
                      className="pr-12 bg-card rounded-xl shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition cursor-pointer select-none"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="flex gap-2.5">
                    <Button 
                      onClick={handleResetPassword} 
                      disabled={resetting || newPasswordVal.length < 4}
                      className="flex-1 text-xs h-10 rounded-xl"
                    >
                      {resetting ? "Mengubah..." : "Ubah Password"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setNewPasswordVal("");
                        setShowPassword(false);
                      }} 
                      className="text-xs h-10 border-border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      Batal
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

