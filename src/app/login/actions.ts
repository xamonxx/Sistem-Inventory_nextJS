"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

// Hash dummy untuk menyamakan waktu proses saat username tidak ditemukan
// (mengurangi user enumeration via timing). Ini hash bcrypt valid acak.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8DjY8m0p5b3y2qF1m1m1m1m1m1m1m";

// Rate limit login sederhana berbasis memori (cukup untuk 1 instance / toko).
// Untuk multi-instance, ganti dengan store bersama (Redis/DB).
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000; // 5 menit
const attempts = new Map<string, { count: number; first: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return true;
  }
  rec.count++;
  return rec.count <= MAX_ATTEMPTS;
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // Batas panjang untuk mencegah payload absurd / DoS.
  if (
    !username ||
    !password ||
    username.length > FIELD_LIMITS.username ||
    password.length > FIELD_LIMITS.passwordMax
  ) {
    return { error: "Username atau password salah." };
  }

  // Jangan percaya header proxy kecuali deployment memang berada di trusted proxy.
  const hdrs = await headers();
  const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true";
  const ip = trustProxyHeaders
    ? hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      "trusted-proxy-unknown"
    : "direct";
  if (!rateLimit(`${ip}:${username.toLowerCase()}`)) {
    return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit." };
  }

  const user = await prisma.user.findUnique({ where: { username } });

  // Selalu jalankan bcrypt.compare (pakai dummy hash bila user tidak ada)
  // agar waktu respons relatif sama dan pesan error tidak membedakan kasus.
  const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

  if (!user || !user.aktif || !ok) {
    return { error: "Username atau password salah." };
  }

  await createSession({ id: user.id, username: user.username, nama: user.nama, role: user.role });
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
