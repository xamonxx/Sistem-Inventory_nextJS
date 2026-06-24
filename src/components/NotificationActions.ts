"use server";

import { prisma } from "@/lib/prisma";
import { getStokAkhirMap } from "@/lib/stock";

export type SystemNotification = {
  id: string;
  type: "low_stock" | "negative_stock" | "overdue_invoice" | "activity";
  title: string;
  description: string;
  time: string;
  severity: "warning" | "danger" | "info";
  link: string;
};

export async function fetchSystemNotifications(): Promise<SystemNotification[]> {
  try {
    const notifications: SystemNotification[] = [];
    const now = new Date();

    // 1. Get stock alerts
    const items = await prisma.item.findMany({ where: { aktif: true } });
    const stokMap = await getStokAkhirMap(items.map(i => i.id));
    
    let lowStockCount = 0;
    let negativeStockCount = 0;

    items.forEach(it => {
      const stok = stokMap.get(it.id) ?? it.stokAwal;
      if (stok < 0) {
        negativeStockCount++;
      } else if (stok < it.minStok) {
        lowStockCount++;
      }
    });

    if (negativeStockCount > 0) {
      notifications.push({
        id: "neg-stock",
        type: "negative_stock",
        title: "Kritis: Stok Material Minus",
        description: `Ada ${negativeStockCount} barang dengan stok fisik di bawah 0 unit. Segera periksa mutasi keluar gudang.`,
        time: "Real-time",
        severity: "danger",
        link: "/barang",
      });
    }

    if (lowStockCount > 0) {
      notifications.push({
        id: "low-stock",
        type: "low_stock",
        title: "Perhatian: Stok Menipis",
        description: `Ada ${lowStockCount} barang yang menyentuh batas minimum keamanan stok. Direkomendasikan melakukan pemesanan ulang.`,
        time: "Real-time",
        severity: "warning",
        link: "/barang",
      });
    }

    // 2. Get overdue invoices
    const unpaidInvoices = await prisma.invoice.findMany({
      where: { status: { not: "LUNAS" } },
      select: { tanggal: true, noInvoice: true }
    });

    let overdueCount = 0;
    unpaidInvoices.forEach(inv => {
      // due date is 30 days from date
      const dueDate = new Date(inv.tanggal);
      dueDate.setDate(dueDate.getDate() + 30);
      if (dueDate.getTime() < now.getTime()) {
        overdueCount++;
      }
    });

    if (overdueCount > 0) {
      notifications.push({
        id: "overdue-inv",
        type: "overdue_invoice",
        title: "Piutang Jatuh Tempo (Overdue)",
        description: `Terdapat ${overdueCount} tagihan invoice yang telah melewati batas tempo pembayaran 30 hari.`,
        time: "Harian",
        severity: "danger",
        link: "/invoice",
      });
    }

    // 3. Get recent user activities
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { user: true }
    });

    logs.forEach(log => {
      notifications.push({
        id: `log-${log.id}`,
        type: "activity",
        title: `Aktivitas: ${log.aksi}`,
        description: `Operator ${log.user?.nama ?? "System"} melakukan tindakan pada entitas ${log.entitas} (ID: ${log.entitasId ?? "—"}).`,
        time: new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        severity: "info",
        link: "/log-aktivitas",
      });
    });

    return notifications;
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return [];
  }
}

