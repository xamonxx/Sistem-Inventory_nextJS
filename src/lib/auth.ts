import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COOKIE = "si_session";

function resolveSecret(): Uint8Array {
  const fromEnv = process.env.AUTH_SECRET;
  // Fail-closed di produksi: jangan pernah memakai secret default yang lemah,
  // karena bisa dipakai untuk memalsukan token sesi (forge JWT).
  if (process.env.NODE_ENV === "production") {
    if (!fromEnv || fromEnv.length < 32) {
      throw new Error(
        "AUTH_SECRET wajib di-set minimal 32 karakter di produksi."
      );
    }
    return new TextEncoder().encode(fromEnv);
  }
  return new TextEncoder().encode(
    fromEnv ?? "dev-secret-ganti-di-produksi-minimal-32-karakter"
  );
}

let _secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (!_secret) _secret = resolveSecret();
  return _secret;
}

export type SessionUser = {
  id: number;
  username: string;
  nama: string;
  role: Role;
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // App internal toko jalan di Laragon via HTTP. Aktifkan Secure hanya bila
    // benar-benar di belakang HTTPS (set COOKIE_SECURE=true di produksi HTTPS).
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Validasi bentuk payload — tolak token yang strukturnya tidak sesuai.
    if (
      typeof payload.id !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.nama !== "string" ||
      (payload.role !== "ADMIN_KASIR" && payload.role !== "ADMIN_GUDANG")
    ) {
      return null;
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, nama: true, role: true, aktif: true },
    });
    if (!user?.aktif) return null;

    return {
      id: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role,
    };
  } catch {
    // Token invalid/kedaluwarsa — jangan bocorkan detail.
    return null;
  }
}

/** Pakai di server component/page: lempar ke /login kalau belum login */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/** Pakai di server action: pastikan role termasuk yang diizinkan */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) {
    throw new Error("Akses ditolak: role Anda tidak diizinkan untuk aksi ini.");
  }
  return user;
}
