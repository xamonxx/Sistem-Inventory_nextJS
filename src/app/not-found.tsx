"use client";

import Link from "next/link";
import { ArrowLeft, Compass, LayoutDashboard } from "lucide-react";

// Mengikuti token tema (--background, --foreground, dll.) agar terbaca di mode
// terang maupun gelap; sebelumnya latar di-hardcode terang sehingga teks
// `text-foreground` hilang saat mode gelap aktif.
export default function NotFound() {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[var(--background)] px-6 py-16">
      {/* Latar: cahaya lembut + grid tipis */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(40rem 22rem at 50% 30%, var(--bg-glow-1), transparent 70%), radial-gradient(30rem 18rem at 70% 80%, var(--bg-glow-2), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative w-full max-w-md text-center anim-rise">
        <p
          className="select-none font-display text-[112px] font-extrabold leading-none tracking-tighter sm:text-[136px]"
          style={{
            backgroundImage: "linear-gradient(180deg, var(--foreground) 10%, color-mix(in srgb, var(--foreground) 18%, transparent))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          404
        </p>

        <div className="mx-auto -mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-soft)] shadow-sm">
          <Compass size={13} className="text-[var(--primary)]" />
          Halaman tidak ditemukan
        </div>

        <h1 className="mt-5 font-display text-xl font-bold text-foreground sm:text-2xl">Sepertinya Anda tersesat</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-muted-2)]">
          Halaman yang Anda cari tidak ada atau sudah dipindahkan. Periksa kembali alamatnya, atau kembali ke dashboard.
        </p>

        <div className="mt-8 flex flex-col-reverse items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}
            className="btn-liquid-outline inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition"
          >
            <ArrowLeft size={16} />
            Halaman sebelumnya
          </button>
          <Link
            href="/"
            className="btn-liquid-primary inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition"
          >
            <LayoutDashboard size={16} />
            Ke Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
