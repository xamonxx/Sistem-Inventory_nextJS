"use server";

import { prisma } from "@/lib/prisma";
import { getStokAkhirMap } from "@/lib/stock";
import { requireUser } from "@/lib/auth";

export type SystemNotification = {
  id: string;
  type: "low_stock" | "negative_stock" | "overdue_invoice";
  title: string;
  description: string;
  expandedDescription?: string;
  time: string;
  severity: "warning" | "danger" | "info";
  link: string;
};

export async function fetchSystemNotifications(_role?: string): Promise<SystemNotification[]> {
  const user = await requireUser();
  const role = user.role;

  try {
    const notifications: SystemNotification[] = [];

    if (role === "ADMIN_GUDANG") {
      const items = await prisma.item.findMany({ where: { aktif: true } });
      const stokMap = await getStokAkhirMap(items.map((item) => item.id));
      let lowStockCount = 0;
      let negativeStockCount = 0;
      const lowStockItemsList: string[] = [];
      const negativeStockItemsList: string[] = [];

      items.forEach((item) => {
        const stok = stokMap[item.id] ?? item.stokAwal;
        if (stok < 0) {
          negativeStockCount++;
          negativeStockItemsList.push(`- ${item.nama} -> ${stok} unit`);
        } else if (stok < item.minStok) {
          lowStockCount++;
          lowStockItemsList.push(`- ${item.nama} -> sisa ${stok} (min: ${item.minStok})`);
        }
      });

      if (negativeStockCount > 0) {
        const shortText = negativeStockItemsList.slice(0, 4).join("\n");
        const moreText = negativeStockCount > 4 ? `\n...dan ${negativeStockCount - 4} barang lainnya` : "";
        const fullText = negativeStockItemsList.join("\n");
        const textHash = (shortText + moreText).length;
        notifications.push({
          id: `neg-stock-${textHash}-${negativeStockCount}`,
          type: "negative_stock",
          title: `Kritis: ${negativeStockCount} Barang Stok Minus`,
          description: `${shortText}${moreText}\n\nSegera periksa mutasi gudang dan lakukan koreksi stok.`,
          expandedDescription: negativeStockCount > 4 ? `${fullText}\n\nSegera periksa mutasi gudang dan lakukan koreksi stok.` : undefined,
          time: "Real-time",
          severity: "danger",
          link: "/stok",
        });
      }

      if (lowStockCount > 0) {
        const shortText = lowStockItemsList.slice(0, 4).join("\n");
        const moreText = lowStockCount > 4 ? `\n...dan ${lowStockCount - 4} barang lainnya` : "";
        const fullText = lowStockItemsList.join("\n");
        const textHash = (shortText + moreText).length;
        notifications.push({
          id: `low-stock-${textHash}-${lowStockCount}`,
          type: "low_stock",
          title: `Perhatian: ${lowStockCount} Barang Stok Menipis`,
          description: `${shortText}${moreText}\n\nSegera lakukan restock ke supplier.`,
          expandedDescription: lowStockCount > 4 ? `${fullText}\n\nSegera lakukan restock ke supplier.` : undefined,
          time: "Real-time",
          severity: "warning",
          link: "/stok",
        });
      }
    }

    return notifications;
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return [];
  }
}
