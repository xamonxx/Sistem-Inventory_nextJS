"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FB] px-6 text-center">
      <div className="w-full max-w-md space-y-6">
        {/* Visual Icon Header */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shadow-xs">
          <ShieldAlert size={32} />
        </div>

        {/* Content details */}
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">404</h1>
          <h2 className="text-lg font-bold text-slate-700">Halaman Tidak Ditemukan</h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Maaf, halaman yang Anda cari tidak dapat ditemukan atau telah dipindahkan ke alamat lain.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Link href="/">
            <Button className="mx-auto shadow-sm">
              <ArrowLeft size={16} />
              Kembali ke Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
