"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { safeError, type ActionResult } from "@/lib/validation";

export async function clearActivityLogs(): Promise<ActionResult> {
  const user = await requireRole("ADMIN_GUDANG");

  try {
    // Delete all logs
    await prisma.activityLog.deleteMany();

    // Log the clear action itself as the first new log
    await logActivity({
      userId: user.id,
      aksi: "CLEAR_LOGS",
      entitas: "ActivityLog",
      entitasId: undefined,
      detail: "Semua log aktivitas sebelumnya dibersihkan oleh admin.",
    });

    return { ok: true };
  } catch (error) {
    return safeError(error, "Gagal membersihkan log aktivitas.");
  }
}
