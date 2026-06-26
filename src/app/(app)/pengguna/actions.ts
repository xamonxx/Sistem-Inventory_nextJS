"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { dbId, strictBool, requiredText, safeError, firstIssue, type ActionResult } from "@/lib/validation";

const ROLES = ["ADMIN_KASIR", "ADMIN_GUDANG"] as const;

// Username: hanya huruf, angka, titik, underscore, strip (allowlist).
const usernameField = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter")
  .max(FIELD_LIMITS.username, `Username maksimal ${FIELD_LIMITS.username} karakter`)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, underscore, dan strip");

const passwordField = z
  .string()
  .min(FIELD_LIMITS.passwordMin, `Password minimal ${FIELD_LIMITS.passwordMin} karakter`)
  .max(FIELD_LIMITS.passwordMax, `Password maksimal ${FIELD_LIMITS.passwordMax} karakter`);

const schema = z.object({
  id: dbId.optional(),
  username: usernameField,
  nama: requiredText(FIELD_LIMITS.nama, "Nama"),
  role: z.enum(ROLES, { errorMap: () => ({ message: "Role tidak valid." }) }),
  password: z.string().optional().default(""),
});

export async function saveUser(_prev: unknown, formData: FormData): Promise<ActionResult> {
  // Administrasi akun hanya untuk ADMIN_GUDANG.
  const adminUser = await requireRole("ADMIN_GUDANG");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    username: formData.get("username"),
    nama: formData.get("nama"),
    role: formData.get("role"),
    password: formData.get("password") ?? "",
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const d = parsed.data;

  // Cegah self-lockout: admin tidak boleh menurunkan role-nya sendiri.
  if (d.id && d.id === adminUser.id && d.role !== "ADMIN_GUDANG") {
    return { error: "Anda tidak dapat menurunkan role akun Anda sendiri." };
  }

  // Validasi password (jika diisi saat edit, atau wajib saat create).
  if (d.password) {
    const pw = passwordField.safeParse(d.password);
    if (!pw.success) return { error: firstIssue(pw.error) };
  }

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
      if (!d.password) {
        return { error: `Password baru minimal ${FIELD_LIMITS.passwordMin} karakter.` };
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
    return safeError(e, "Gagal menyimpan pengguna.");
  }

  revalidatePath("/pengguna");
  return { ok: true };
}

export async function toggleUser(id: number, aktif: boolean): Promise<ActionResult> {
  const adminUser = await requireRole("ADMIN_GUDANG");

  const parsed = z.object({ id: dbId, aktif: strictBool }).safeParse({ id, aktif });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  // Cegah self-lockout: admin tidak boleh menonaktifkan akunnya sendiri.
  if (parsed.data.id === adminUser.id && !parsed.data.aktif) {
    return { error: "Anda tidak dapat menonaktifkan akun Anda sendiri." };
  }

  try {
    await prisma.user.update({ where: { id: parsed.data.id }, data: { aktif: parsed.data.aktif } });
    await logActivity({
      userId: adminUser.id,
      aksi: "TOGGLE_USER",
      entitas: "User",
      entitasId: parsed.data.id,
      detail: { status: parsed.data.aktif },
    });
  } catch (e) {
    return safeError(e, "Gagal mengubah status pengguna.");
  }

  revalidatePath("/pengguna");
  return { ok: true };
}

export async function resetPassword(id: number, passBaru: string): Promise<ActionResult> {
  const adminUser = await requireRole("ADMIN_GUDANG");

  const parsed = z.object({ id: dbId, passBaru: passwordField }).safeParse({ id, passBaru });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    const hash = await bcrypt.hash(parsed.data.passBaru, 10);
    await prisma.user.update({ where: { id: parsed.data.id }, data: { password: hash } });

    await logActivity({
      userId: adminUser.id,
      aksi: "RESET_PASSWORD_USER",
      entitas: "User",
      entitasId: parsed.data.id,
    });
  } catch (e) {
    return safeError(e, "Gagal mereset password.");
  }

  return { ok: true };
}
