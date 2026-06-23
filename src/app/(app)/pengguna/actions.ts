"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  id: z.coerce.number().optional(),
  username: z.string().trim().min(3, "Username minimal 3 karakter"),
  nama: z.string().trim().min(1, "Nama wajib diisi"),
  role: z.enum(["ADMIN_KASIR", "ADMIN_GUDANG"]),
  password: z.string().optional().default(""),
});

export async function saveUser(_prev: unknown, formData: FormData) {
  // Enforce ADMIN_GUDANG role for account administration
  const adminUser = await requireRole("ADMIN_GUDANG");
  
  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    username: formData.get("username"),
    nama: formData.get("nama"),
    role: formData.get("role"),
    password: formData.get("password") ?? "",
  });
  
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  try {
    if (d.id) {
      const data: Prisma.UserUpdateInput = { username: d.username, nama: d.nama, role: d.role };
      if (d.password) {
        data.password = await bcrypt.hash(d.password, 10);
      }
      await prisma.user.update({ where: { id: d.id }, data });
      
      await logActivity({
        userId: adminUser.id,
        aksi: "UPDATE_USER",
        entitas: "User",
        entitasId: d.id,
        detail: { username: d.username, role: d.role },
      });
    } else {
      if (!d.password || d.password.length < 4) {
        return { error: "Password baru minimal 4 karakter." };
      }
      const created = await prisma.user.create({
        data: {
          username: d.username,
          nama: d.nama,
          role: d.role,
          password: await bcrypt.hash(d.password, 10),
        },
      });
      
      await logActivity({
        userId: adminUser.id,
        aksi: "CREATE_USER",
        entitas: "User",
        entitasId: created.id,
        detail: { username: d.username, role: d.role },
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Username "${d.username}" sudah dipakai.` };
    }
    throw e;
  }

  revalidatePath("/pengguna");
  return { ok: true };
}

export async function toggleUser(id: number, aktif: boolean) {
  const adminUser = await requireRole("ADMIN_GUDANG");
  
  await prisma.user.update({ where: { id }, data: { aktif } });
  
  await logActivity({
    userId: adminUser.id,
    aksi: "TOGGLE_USER",
    entitas: "User",
    entitasId: id,
    detail: { status: aktif },
  });
  
  revalidatePath("/pengguna");
}

export async function resetPassword(id: number, passBaru: string) {
  const adminUser = await requireRole("ADMIN_GUDANG");
  if (!passBaru || passBaru.length < 4) {
    return { error: "Password baru minimal 4 karakter." };
  }
  
  const hash = await bcrypt.hash(passBaru, 10);
  await prisma.user.update({
    where: { id },
    data: { password: hash },
  });

  await logActivity({
    userId: adminUser.id,
    aksi: "RESET_PASSWORD_USER",
    entitas: "User",
    entitasId: id,
  });

  return { ok: true };
}
