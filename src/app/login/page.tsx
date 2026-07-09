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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      {/* Premium Background: Theme-aware gradient + subtle grid */}
      <div 
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-[#0f172a] dark:via-[#0f172a] dark:to-[#1e293b]"
      />
      <div 
        className="pointer-events-none absolute inset-0" 
        style={{ 
          backgroundImage: "radial-gradient(at 75% 20%, rgba(59, 130, 246, 0.12), transparent 50%)",
        }} 
      />
      <div 
        className="pointer-events-none absolute inset-0" 
        style={{ 
          backgroundImage: "linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px)", 
          backgroundSize: "48px 48px",
        }} 
      />

      <div className="anim-rise relative w-full max-w-[920px]">
        {/* Theme toggle - floating */}
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        {/* Premium Liquid Glass Card — Theme-aware */}
        <div
          className="grid overflow-hidden rounded-[28px] border border-border bg-card md:grid-cols-[1.1fr_1fr]"
          style={{
            boxShadow: "0 48px 96px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(59, 130, 246, 0.08)",
            // Promote the card to its own compositing layer so Chrome clips composited
            // descendants (e.g. the submit button's animated hover shadow) to the rounded
            // corners. Without this, overflow:hidden + border-radius fails to clip the
            // button's shadow layer on hover, making the bottom-right corner look square.
            transform: "translateZ(0)",
          }}
        >
          {/* ===== PANEL BRANDING (Left) — Theme-aware ===== */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-50 via-sky-50 to-white p-10 md:flex dark:from-blue-950 dark:via-slate-900 dark:to-[#0a1628]">
            {/* Subtle accent glow */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#3b82f6] opacity-[0.06] blur-[100px] dark:opacity-[0.12]" />
            
            {/* Watermark logo — theme-aware opacity */}
            <AppLogo className="pointer-events-none absolute -bottom-12 -right-8 h-52 w-52 text-blue-900/[0.04] dark:text-white/[0.04]" />

            {/* Brand Identity */}
            <div className="relative flex items-center gap-3.5">
              <div 
                className="flex h-12 w-12 items-center justify-center rounded-[14px]"
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)",
                  boxShadow: "0 8px 24px -4px rgba(59, 130, 246, 0.4)",
                }}
              >
                <AppLogo className="h-7 w-7 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight text-slate-800 dark:text-white">Putra Corporation</p>
                <p className="mt-1 rounded-md bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:bg-white/[0.08] dark:text-sky-200/90">
                  Sistem Inventory
                </p>
              </div>
            </div>

            {/* Headline */}
            <div className="relative space-y-7 py-8">
              <h1 className="max-w-[340px] text-[32px] font-bold leading-[1.12] tracking-tight text-slate-900 dark:text-white">
                Seluruh toko bangunan Anda,{" "}
                <span className="font-extrabold text-blue-600 dark:text-sky-300">terkendali satu sistem.</span>
              </h1>
              <ul className="space-y-3.5">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <li 
                    key={label} 
                    className="flex items-center gap-3 text-[14px] font-medium text-slate-600 dark:text-slate-200/90"
                  >
                    <span 
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 dark:border-white/[0.08]"
                      style={{ background: "rgba(59, 130, 246, 0.06)" }}
                    >
                      <Icon size={15} className="text-blue-600 dark:text-sky-300" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="relative flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-400/60">
              <ShieldCheck size={14} className="text-blue-500 dark:text-sky-400/70" />
              Akses Internal • Terenkripsi
            </div>
          </div>

          {/* ===== PANEL FORM (Right) — Theme-aware ===== */}
          <div className="relative flex flex-col justify-center bg-white p-8 sm:p-12 dark:bg-[#0f172a]/70">
            {/* Brand - Mobile */}
            <div className="mb-8 flex flex-col items-center text-center md:hidden">
              <div 
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white"
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)",
                  boxShadow: "0 12px 32px -8px rgba(59, 130, 246, 0.5)",
                }}
              >
                <AppLogo className="h-10 w-10" />
              </div>
              <p className="text-lg font-bold tracking-tight text-foreground">PUTRA CORPORATION</p>
              <p className="mt-1 text-xs text-muted">Sistem Inventory & Kasir</p>
            </div>

            {/* Welcome Header */}
            <div className="mb-7 hidden md:block">
              <h2 className="text-[26px] font-bold tracking-tight text-foreground">
                Selamat datang kembali
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                Masuk dengan akun operasional Anda untuk melanjutkan.
              </p>
            </div>

            {/* Form */}
            <form action={formAction} className="space-y-5">
              <div>
                <Label htmlFor="username" className="text-[13px] font-semibold">Username</Label>
                <div className="relative mt-2">
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="username"
                    name="username"
                    maxLength={FIELD_LIMITS.username}
                    placeholder="Masukkan username"
                    autoFocus
                    className="h-12 pl-10 text-[15px]"
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
                <Label htmlFor="password" className="text-[13px] font-semibold">Password</Label>
                <div className="relative mt-2">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    maxLength={FIELD_LIMITS.passwordMax}
                    placeholder="••••••••"
                    className="h-12 pl-10 pr-12 text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 cursor-pointer select-none items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {state?.error && (
                <div 
                  className="rounded-xl px-4 py-3 text-[13px] font-medium text-red-700 dark:text-red-300"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                  }}
                >
                  {state.error}
                </div>
              )}

              <Button 
                type="submit" 
                className="group h-12 w-full gap-2 text-[15px] font-semibold shadow-lg transition-all hover:shadow-xl" 
                disabled={pending}
                style={{
                  background: pending ? undefined : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                }}
              >
                {pending ? "Memproses…" : "Masuk ke Sistem"}
                {!pending && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
              </Button>
            </form>

            {/* Footer */}
            <p className="mt-8 text-center text-[11px] leading-relaxed text-muted">
              © {new Date().getFullYear()} Putra Corporation · Jangan bagikan kredensial Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
