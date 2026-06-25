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
    const lowStockItemsList: string[] = [];
    const negativeStockItemsList: string[] = [];

    items.forEach(it => {
      const stok = stokMap.get(it.id) ?? it.stokAwal;
      if (stok < 0) {
        negativeStockCount++;
        negativeStockItemsList.push(`${it.nama} (stok: ${stok} unit)`);
      } else if (stok < it.minStok) {
        lowStockCount++;
        lowStockItemsList.push(`${it.nama} (sisa: ${stok} unit, min: ${it.minStok})`);
      }
    });

    if (negativeStockCount > 0) {
      const itemsText = negativeStockItemsList.slice(0, 3).join(", ");
      const moreText = negativeStockCount > 3 ? ` dan ${negativeStockCount - 3} barang lainnya` : "";
      const textHash = (itemsText + moreText).length;
      notifications.push({
        id: `neg-stock-${textHash}-${negativeStockCount}`,
        type: "negative_stock",
        title: "Kritis: Stok Material Minus",
        description: `Stok minus terdeteksi pada barang: ${itemsText}${moreText}. Harap segera periksa mutasi keluar gudang dan lakukan koreksi fisik penyesuaian stok.`,
        time: "Real-time",
        severity: "danger",
        link: "/stok",
      });
    }

    if (lowStockCount > 0) {
      const itemsText = lowStockItemsList.slice(0, 3).join(", ");
      const moreText = lowStockCount > 3 ? ` dan ${lowStockCount - 3} barang lainnya` : "";
      const textHash = (itemsText + moreText).length;
      notifications.push({
        id: `low-stock-${textHash}-${lowStockCount}`,
        type: "low_stock",
        title: "Perhatian: Stok Menipis",
        description: `Stok di bawah batas aman pada barang: ${itemsText}${moreText}. Harap segera lakukan pemesanan ulang (restock) ke supplier atau lakukan penyesuaian stok.`,
        time: "Real-time",
        severity: "warning",
        link: "/stok",
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

