"use client";

import { useActionState, useState } from "react";
import { loginAction } from "./actions";
import { Button, Input, Label } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import {
  Eye,
  EyeOff,
  User,
  Lock,
  ArrowRight,
  ShieldCheck,
  Boxes,
  ReceiptText,
  BarChart3,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES = [
  { icon: Boxes, label: "Stok gudang akurat & real-time" },
  { icon: ReceiptText, label: "Kasir POS cepat, invoice otomatis" },
  { icon: BarChart3, label: "Omset & margin terpantau tiap hari" },
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="app-shell-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* Ambient glow senada aksen aplikasi — lebih subtle di light, lebih tegas di dark */}
      <div className="pointer-events-none absolute left-[20%] top-[15%] h-[380px] w-[380px] rounded-full bg-[var(--primary)]/[0.06] blur-[110px] dark:bg-[var(--primary)]/[0.14]" />
      <div className="pointer-events-none absolute bottom-[10%] right-[15%] h-[300px] w-[300px] rounded-full bg-[#38bdf8]/[0.05] blur-[100px] dark:bg-[#38bdf8]/[0.1]" />

      <div className="anim-rise relative w-full max-w-[880px]">
        {/* Theme toggle mengambang di sudut kanan atas card */}
        <div className="absolute right-4 top-4 z-20 sm:right-5 sm:top-5">
          <ThemeToggle />
        </div>
        <div className="grid overflow-hidden rounded-[28px] border border-border bg-card shadow-[var(--shadow-modal)] md:grid-cols-[1.08fr_1fr]">
          {/* ===== PANEL BRANDING (kiri) ===== */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-[#071b2e] p-10 text-white md:flex">
            {/* Dekorasi: grid halus + glow + watermark logo */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(125,211,252,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(125,211,252,0.07) 1px, transparent 1px)",
                backgroundSize: "34px 34px",
              }}
            />
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--primary)]/25 blur-[90px]" />
            <AppLogo className="pointer-events-none absolute -bottom-14 -right-10 h-56 w-56 text-white/[0.045]" />

            {/* Brand */}
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--primary)] to-[#38bdf8] shadow-[0_0_20px_rgba(2,132,199,0.45)]">
                <AppLogo className="h-7 w-7" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-black uppercase tracking-tight">Putra Corporation</p>
                <p className="mt-0.5 w-max rounded-[4px] bg-white/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-primary-100">
                  Software Inventory
                </p>
              </div>
            </div>

            {/* Headline */}
            <div className="relative space-y-6 py-10">
              <h1
                className="max-w-[320px] text-[28px] font-black leading-[1.15] tracking-tight"
                style={{ color: "#ffffff" }}
              >
                Seluruh toko bangunan Anda,
                <span style={{ color: "#7dd3fc" }}> terkendali satu sistem.</span>
              </h1>
              <ul className="space-y-3">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3 text-[13px] font-medium" style={{ color: "rgba(240, 249, 255, 0.78)" }}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                      <Icon size={14} style={{ color: "#7dd3fc" }} />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer panel */}
            <div className="relative flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-50/40">
              <ShieldCheck size={13} className="text-[#7dd3fc]/70" />
              Akses internal &middot; Terenkripsi
            </div>
          </div>

          {/* ===== PANEL FORM (kanan) ===== */}
          <div className="flex flex-col justify-center p-8 sm:p-10">
            {/* Brand versi mobile */}
            <div className="mb-7 flex flex-col items-center text-center md:hidden">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[#38bdf8] text-white shadow-[0_0_20px_rgba(2,132,199,0.4)]">
                <AppLogo className="h-9 w-9" />
              </div>
              <p className="text-lg font-black tracking-tight text-foreground">PUTRA CORPORATION</p>
              <p className="text-xs text-muted">Sistem Inventory &amp; Kasir</p>
            </div>

            <div className="mb-6 hidden md:block">
              <h2 className="text-[22px] font-black tracking-tight text-foreground">Selamat datang kembali 👋</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Masuk dengan akun operasional Anda untuk melanjutkan.
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="username"
                    name="username"
                    maxLength={FIELD_LIMITS.username}
                    placeholder="Username"
                    autoFocus
                    className="pl-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        document.getElementById("password")?.focus();
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    maxLength={FIELD_LIMITS.passwordMax}
                    placeholder="••••••••"
                    className="pl-10 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer select-none items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-650 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {state?.error && (
                <p className="rounded-lg border border-transparent bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                  {state.error}
                </p>
              )}

              <Button type="submit" className="group h-11 w-full gap-1.5 text-sm font-bold" disabled={pending}>
                {pending ? "Memproses…" : "Masuk ke Sistem"}
                {!pending && <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />}
              </Button>
            </form>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
              &copy; {new Date().getFullYear()} Putra Corporation &middot; Jangan bagikan kredensial Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
