"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";

export async function loginAction(_prev: unknown, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Username dan password wajib diisi." };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.aktif) {
    return { error: "Username tidak ditemukan atau nonaktif." };
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return { error: "Password salah." };
  }

  await createSession({ id: user.id, username: user.username, nama: user.nama, role: user.role });
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
