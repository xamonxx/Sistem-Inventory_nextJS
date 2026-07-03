"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveUser } from "./actions";
import { Button, Input, Label, Select, CharCounter } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { Plus, X, UserPlus, Eye, EyeOff } from "lucide-react";

export function PenggunaForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveUser, null);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");
  const ref = useRef<HTMLFormElement>(null);

  function resetForm() {
    ref.current?.reset();
    setUsername("");
    setNama("");
    setPassword("");
    setShowPassword(false);
  }

  useEffect(() => {
    if (state && "ok" in state) {
      setOpen(false);
      resetForm();
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        setShowPassword(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2 shrink-0">
        <Plus size={18} /> Tambah Pengguna
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop Overlay with fade-in and blur */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={() => {
              setOpen(false);
              setShowPassword(false);
            }}
          />

          {/* Modal Card Box */}
          <div className="relative w-full max-w-lg transform rounded-[24px] bg-card p-6 md:p-8 shadow-[var(--shadow-modal)] border border-border/80 transition-all duration-300 scale-100 anim-rise z-10">
            {/* Close Button */}
            <button
              onClick={() => {
                setOpen(false);
                setShowPassword(false);
              }}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-700 transition cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="mb-6 flex gap-4 items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[var(--primary)] border border-amber-200/50 shadow-sm">
                <UserPlus size={22} />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-lg font-bold text-foreground tracking-tight leading-none">Tambah Pengguna</h2>
                <p className="text-xs text-slate-400 mt-1">Buat akun kasir atau gudang baru dengan hak akses spesifik.</p>
              </div>
            </div>

            {/* Form */}
            <form action={formAction} ref={ref} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Username</Label>
                    <CharCounter value={username} max={FIELD_LIMITS.username} />
                  </div>
                  <Input
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: kasir01"
                    required
                    minLength={3}
                    maxLength={FIELD_LIMITS.username}
                    pattern="[a-zA-Z0-9._\-]+"
                    title="Hanya huruf, angka, titik, underscore, dan strip"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Nama Lengkap</Label>
                    <CharCounter value={nama} max={FIELD_LIMITS.nama} />
                  </div>
                  <Input
                    name="nama"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Nama Lengkap"
                    required
                    maxLength={FIELD_LIMITS.nama}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Role Otorisasi</Label>
                  <Select name="role" required className="w-full">
                    <option value="ADMIN_KASIR">Admin Kasir (POS)</option>
                    <option value="ADMIN_GUDANG">Admin Gudang (Logistik)</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Password</Label>
                    <CharCounter value={password} max={FIELD_LIMITS.passwordMax} />
                  </div>
                  <div className="relative">
                    <Input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      required
                      minLength={FIELD_LIMITS.passwordMin}
                      maxLength={FIELD_LIMITS.passwordMax}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition cursor-pointer select-none"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {state && "error" in state && state.error && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs text-rose-700 font-medium">
                  {state.error}
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="px-5"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  className="px-6"
                >
                  {pending ? "Menyimpan…" : "Simpan Pengguna"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
