"use server";

import { prisma } from "@/lib/prisma";
import { getStokAkhirMap } from "@/lib/stock";
import { requireUser } from "@/lib/auth";

export type SystemNotification = {
  id: string;
  type: "low_stock" | "negative_stock" | "overdue_invoice" | "activity";
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

    if (role !== "ADMIN_KASIR") {
      const logs = await prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: role === "ADMIN_NONGUDANG" ? 15 : 5,
        include: { user: true },
      });

      logs.forEach((log) => {
        if (!canViewActivityNotification(role, log.aksi)) {
          return;
        }

        const operator = log.user?.nama ?? "Sistem";
        const detail = parseDetail(log.detail);
        const { title, description, link } = formatActivityLog(log.aksi, operator, detail);

        notifications.push({
          id: `log-${log.id}`,
          type: "activity",
          title,
          description,
          time: new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          severity: "info",
          link,
        });
      });
    }

    return notifications;
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return [];
  }
}

function canViewActivityNotification(role: string, aksi: string) {
  if (role === "ADMIN_GUDANG") return true;
  if (role === "ADMIN_NONGUDANG") {
    return ["CREATE_NG_PRODUK", "UPDATE_NG_PRODUK", "TOGGLE_NG_PRODUK", "DELETE_NG_PRODUK", "CREATE_NG_INVOICE"].includes(aksi);
  }
  return false;
}

function parseDetail(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function formatActivityLog(
  aksi: string,
  operator: string,
  detail: Record<string, unknown>
): {
  title: string;
  description: string;
  link: string;
} {
  switch (aksi) {
    case "CREATE_BARANG":
      return {
        title: "Barang Baru Ditambahkan",
        description: `${operator} menambahkan barang baru "${detail.nama ?? "-"}" dengan kode ${detail.kode ?? "-"}.`,
        link: "/barang",
      };
    case "UPDATE_BARANG":
      return {
        title: "Data Barang Diperbarui",
        description: `${operator} mengubah informasi barang di katalog.`,
        link: "/barang",
      };
    case "TOGGLE_BARANG": {
      const status = detail.aktif ? "mengaktifkan" : "menonaktifkan";
      return {
        title: detail.aktif ? "Barang Diaktifkan" : "Barang Dinonaktifkan",
        description: `${operator} ${status} status barang di katalog.`,
        link: "/barang",
      };
    }
    case "PRINT_BARCODE":
      return {
        title: "Label Barcode Dicetak",
        description: `${operator} mencetak label barcode atau QR untuk barang "${detail.nama ?? "-"}".`,
        link: "/barang",
      };
    case "BARANG_MASUK":
      return {
        title: "Stok Barang Masuk",
        description: `${operator} menambahkan ${detail.qty ?? 0} unit stok masuk ke gudang.`,
        link: "/stok",
      };
    case "KOREKSI_STOK":
      return {
        title: "Koreksi Stok Dilakukan",
        description: `${operator} melakukan koreksi stok dari ${detail.dari ?? "-"} menjadi ${detail.ke ?? "-"} unit.`,
        link: "/stok",
      };
    case "STOCK_IN_BATCH":
      return {
        title: "Stok Masuk Batch",
        description: `${operator} mencatat penerimaan ${detail.itemsCount ?? 0} jenis barang dari supplier ${detail.supplier ? `"${detail.supplier}"` : "-"}.`,
        link: "/stok/masuk",
      };
    case "CREATE_TRANSAKSI":
      return {
        title: "Transaksi Baru",
        description: `${operator} membuat transaksi ${detail.noTransaksi ?? "-"}${detail.tipe ? ` (${detail.tipe})` : ""}.`,
        link: "/kasir",
      };
    case "BAYAR_INVOICE": {
      const statusBayar = detail.lunas ? "Lunas" : "Cicilan";
      return {
        title: "Pembayaran Invoice",
        description: `${operator} mencatat pembayaran ${detail.tipe ?? "-"} Rp ${Number(detail.bayar ?? 0).toLocaleString("id-ID")} dengan status ${statusBayar}.`,
        link: "/invoice",
      };
    }
    case "UPDATE_INVOICE":
      return {
        title: "Invoice Diperbarui",
        description: `${operator} mengubah data invoice ${detail.noInvoice ?? "-"}.`,
        link: "/invoice",
      };
    case "UPDATE_INVOICE_DAN_BARANG":
      return {
        title: "Invoice dan Barang Diperbarui",
        description: `${operator} mengubah rincian invoice ${detail.noInvoice ?? "-"} (${detail.itemsCount ?? 0} item).`,
        link: "/invoice",
      };
    case "HAPUS_INVOICE":
      return {
        title: "Invoice Dihapus",
        description: `${operator} menghapus invoice ${detail.noInvoice ?? "-"}.`,
        link: "/invoice",
      };
    case "HAPUS_INVOICE_MASSAL":
      return {
        title: "Invoice Dihapus Massal",
        description: `${operator} menghapus ${detail.count ?? 0} invoice sekaligus dari sistem.`,
        link: "/invoice",
      };
    case "VERIFIKASI_INVOICE":
      return {
        title: "Invoice Diverifikasi",
        description: "Invoice berhasil diverifikasi oleh pelanggan melalui tautan QR Code.",
        link: "/invoice",
      };
    case "RETUR_BARANG":
      return {
        title: "Retur Barang",
        description: `${operator} memproses retur ${detail.noReturn ?? "-"} (${detail.itemCount ?? 0} item).`,
        link: "/retur",
      };
    case "TUKAR_BARANG":
      return {
        title: "Tukar Barang",
        description: `${operator} memproses penukaran ${detail.noReturn ?? "-"} (${detail.itemCount ?? 0} item).`,
        link: "/retur",
      };
    case "CREATE_USER":
      return {
        title: "Pengguna Baru Ditambahkan",
        description: `${operator} menambahkan pengguna "${detail.username ?? "-"}" dengan role ${detail.role ?? "-"}.`,
        link: "/pengguna",
      };
    case "UPDATE_USER":
      return {
        title: "Data Pengguna Diperbarui",
        description: `${operator} mengubah data pengguna "${detail.username ?? "-"}" (role: ${detail.role ?? "-"}).`,
        link: "/pengguna",
      };
    case "TOGGLE_USER": {
      const statusUser = detail.status ? "mengaktifkan" : "menonaktifkan";
      return {
        title: detail.status ? "Pengguna Diaktifkan" : "Pengguna Dinonaktifkan",
        description: `${operator} ${statusUser} akun pengguna.`,
        link: "/pengguna",
      };
    }
    case "RESET_PASSWORD_USER":
      return {
        title: "Password Direset",
        description: `${operator} mereset password pengguna.`,
        link: "/pengguna",
      };
    case "CREATE_NG_PRODUK":
      return {
        title: "Barang Non-Gudang Ditambahkan",
        description: `${operator} menambahkan barang non-gudang "${detail.nama ?? "-"}" dari toko ${detail.namaToko ?? "-"}.`,
        link: "/non-gudang/barang",
      };
    case "UPDATE_NG_PRODUK":
      return {
        title: "Barang Non-Gudang Diperbarui",
        description: `${operator} memperbarui data barang non-gudang "${detail.nama ?? "-"}".`,
        link: "/non-gudang/barang",
      };
    case "TOGGLE_NG_PRODUK": {
      const statusProduk = detail.aktif ? "mengaktifkan" : "menonaktifkan";
      return {
        title: "Status Barang Non-Gudang Diubah",
        description: `${operator} ${statusProduk} barang pada katalog non-gudang.`,
        link: "/non-gudang/barang",
      };
    }
    case "DELETE_NG_PRODUK":
      return {
        title: "Barang Non-Gudang Dihapus",
        description: `${operator} menghapus ${detail.dihapus ?? 0} barang dari katalog non-gudang.`,
        link: "/non-gudang/barang",
      };
    case "CREATE_NG_INVOICE":
      return {
        title: "Invoice Non-Gudang Dibuat",
        description: `${operator} membuat invoice ${detail.noInvoice ?? "-"} untuk toko ${detail.namaToko ?? "-"} dengan total ${Number(detail.totalPenjualan ?? 0).toLocaleString("id-ID")}.`,
        link: "/non-gudang/buat-invoice",
      };
    case "CLEAR_LOGS":
      return {
        title: "Log Aktivitas Dibersihkan",
        description: `${operator} membersihkan seluruh riwayat log aktivitas sistem.`,
        link: "/log-aktivitas",
      };
    default:
      return {
        title: `Aktivitas: ${aksi.replace(/_/g, " ")}`,
        description: `${operator} melakukan tindakan "${aksi}" pada sistem.`,
        link: "/log-aktivitas",
      };
  }
}
