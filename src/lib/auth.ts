import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

const COOKIE = "si_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-ganti-di-produksi-minimal-32-karakter"
);

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
    .sign(secret);

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
  console.log("[DEBUG getSession] token found:", !!token);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as number,
      username: payload.username as string,
      nama: payload.nama as string,
      role: payload.role as Role,
    };
  } catch (err) {
    console.error("[DEBUG getSession] jwtVerify error:", err);
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
