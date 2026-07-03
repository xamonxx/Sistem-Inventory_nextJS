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
    const now = new Date();

    // 1. Get stock alerts
    const items = await prisma.item.findMany({ where: { aktif: true } });
    const stokMap = await getStokAkhirMap(items.map(i => i.id));
    let lowStockCount = 0;
    let negativeStockCount = 0;
    const lowStockItemsList: string[] = [];
    const negativeStockItemsList: string[] = [];

    items.forEach(it => {
      const stok = stokMap[it.id] ?? it.stokAwal;
      if (stok < 0) {
        negativeStockCount++;
        negativeStockItemsList.push(`• ${it.nama} → ${stok} unit`);
      } else if (stok < it.minStok) {
        lowStockCount++;
        lowStockItemsList.push(`• ${it.nama} → sisa ${stok} (min: ${it.minStok})`);
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
        description: `${shortText}${moreText}\n\nSegera periksa mutasi gudang & lakukan koreksi stok.`,
        expandedDescription: negativeStockCount > 4 ? `${fullText}\n\nSegera periksa mutasi gudang & lakukan koreksi stok.` : undefined,
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



    // 3. Get recent user activities (Skip for Cashier role)
    if (role !== "ADMIN_KASIR") {
      const logs = await prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: true }
      });

      logs.forEach(log => {
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

/* ================================================================
   Helper: Parse detail JSON safely
   ================================================================ */
function parseDetail(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/* ================================================================
   Helper: Format activity log into human-readable notification
   ================================================================ */
function formatActivityLog(aksi: string, operator: string, detail: Record<string, any>): {
  title: string;
  description: string;
  link: string;
} {
  switch (aksi) {
    // ── Barang (Item) ──
    case "CREATE_BARANG":
      return {
        title: "Barang Baru Ditambahkan",
        description: `${operator} menambahkan barang baru "${detail.nama ?? "—"}" dengan kode ${detail.kode ?? "—"} ke katalog.`,
        link: "/barang",
      };
    case "UPDATE_BARANG":
      return {
        title: "Data Barang Diperbarui",
        description: `${operator} mengubah informasi barang (harga/stok) di katalog.`,
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
        description: `${operator} mencetak label barcode/QR untuk barang "${detail.nama ?? "—"}".`,
        link: "/barang",
      };

    // ── Stok ──
    case "BARANG_MASUK":
      return {
        title: "Stok Barang Masuk",
        description: `${operator} menambahkan ${detail.qty ?? 0} unit stok masuk ke gudang.`,
        link: "/stok",
      };
    case "KOREKSI_STOK":
      return {
        title: "Koreksi Stok Dilakukan",
        description: `${operator} melakukan koreksi stok dari ${detail.dari ?? "—"} menjadi ${detail.ke ?? "—"} unit.`,
        link: "/stok",
      };
    case "STOCK_IN_BATCH":
      return {
        title: "Stok Masuk Batch",
        description: `${operator} mencatat penerimaan ${detail.itemsCount ?? 0} jenis barang dari supplier ${detail.supplier ? `"${detail.supplier}"` : "—"}${detail.ref ? ` (Ref: ${detail.ref})` : ""}.`,
        link: "/stok/masuk",
      };

    // ── Transaksi (Kasir) ──
    case "CREATE_TRANSAKSI":
      return {
        title: "Transaksi Baru",
        description: `${operator} membuat transaksi ${detail.noTransaksi ?? "—"}${detail.tipe ? ` (${detail.tipe})` : ""} — total Rp ${Number(detail.total ?? 0).toLocaleString("id-ID")}.`,
        link: "/kasir",
      };

    // ── Invoice ──
    case "BAYAR_INVOICE": {
      const statusBayar = detail.lunas ? "Lunas ✓" : "Cicilan";
      return {
        title: "Pembayaran Invoice",
        description: `${operator} mencatat pembayaran ${detail.tipe ?? "—"} Rp ${Number(detail.bayar ?? 0).toLocaleString("id-ID")} — status: ${statusBayar}.`,
        link: "/invoice",
      };
    }
    case "UPDATE_INVOICE":
      return {
        title: "Invoice Diperbarui",
        description: `${operator} mengubah data invoice ${detail.noInvoice ?? "—"}.`,
        link: "/invoice",
      };
    case "UPDATE_INVOICE_DAN_BARANG":
      return {
        title: "Invoice & Barang Diperbarui",
        description: `${operator} mengubah rincian invoice ${detail.noInvoice ?? "—"} (${detail.itemsCount ?? 0} item).`,
        link: "/invoice",
      };
    case "HAPUS_INVOICE":
      return {
        title: "Invoice Dihapus",
        description: `${operator} menghapus invoice ${detail.noInvoice ?? "—"} beserta seluruh data transaksi terkait.`,
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
        description: `Invoice berhasil diverifikasi oleh pelanggan melalui tautan QR Code.`,
        link: "/invoice",
      };

    // ── Retur / Tukar ──
    case "RETUR_BARANG":
      return {
        title: "Retur Barang",
        description: `${operator} memproses retur ${detail.noReturn ?? "—"} (${detail.itemCount ?? 0} item)${detail.selisih ? ` — selisih Rp ${Number(detail.selisih).toLocaleString("id-ID")}` : ""}.`,
        link: "/retur",
      };
    case "TUKAR_BARANG":
      return {
        title: "Tukar Barang",
        description: `${operator} memproses penukaran ${detail.noReturn ?? "—"} (${detail.itemCount ?? 0} item)${detail.selisih ? ` — selisih Rp ${Number(detail.selisih).toLocaleString("id-ID")}` : ""}.`,
        link: "/retur",
      };

    // ── Pengguna ──
    case "CREATE_USER":
      return {
        title: "Pengguna Baru Ditambahkan",
        description: `${operator} menambahkan pengguna "${detail.username ?? "—"}" dengan role ${detail.role ?? "—"}.`,
        link: "/pengguna",
      };
    case "UPDATE_USER":
      return {
        title: "Data Pengguna Diperbarui",
        description: `${operator} mengubah data pengguna "${detail.username ?? "—"}" (role: ${detail.role ?? "—"}).`,
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

    // ── Log ──
    case "CLEAR_LOGS":
      return {
        title: "Log Aktivitas Dibersihkan",
        description: `${operator} membersihkan seluruh riwayat log aktivitas sistem.`,
        link: "/log-aktivitas",
      };

    // ── Fallback ──
    default:
      return {
        title: `Aktivitas: ${aksi.replace(/_/g, " ")}`,
        description: `${operator} melakukan tindakan "${aksi}" pada sistem.`,
        link: "/log-aktivitas",
      };
  }
}
