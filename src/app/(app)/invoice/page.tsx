import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceClient, type InvoiceRow, type InvoiceItem } from "./InvoiceClient";

const VERIFY_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://putracorp.co.id";

// Cache invoice page for 60 seconds (invoices don't change frequently)
export const revalidate = 60;

export default async function InvoicePage() {
  const user = await requireUser();
  const canBayar = user.role === "ADMIN_KASIR";

  // Query invoices with selective field fetching (optimized from deep includes)
  // Only fetch fields that are actually used in the UI
  const invoices = await prisma.invoice.findMany({
    orderBy: { id: "desc" },
    take: 100, // Limit to recent 100 invoices for performance
    select: {
      id: true,
      noInvoice: true,
      namaClient: true,
      alamat: true,
      namaWs: true,
      total: true,
      totalDibayar: true,
      status: true,
      tanggal: true,
      client: {
        select: { nama: true }
      },
      project: {
        select: { nama: true }
      },
      payments: {
        select: {
          id: true,
          tanggal: true,
          tipe: true,
          jumlah: true,
          keterangan: true,
        },
        orderBy: { id: "desc" },
      },
      transaction: {
        select: {
          noTransaksi: true,
          namaBank: true,
          noRekening: true,
          atasNama: true,
          items: {
            select: {
              itemId: true,
              namaSnapshot: true,
              qty: true,
              hargaSnapshot: true,
              subtotal: true,
              item: {
                select: { kode: true }
              }
            }
          }
        }
      },
      return: {
        select: {
          transaction: {
            select: {
              noTransaksi: true,
              namaBank: true,
              noRekening: true,
              atasNama: true,
            }
          },
          items: {
            select: {
              itemId: true,
              namaSnapshot: true,
              qtyReturned: true,
              hargaSnapshot: true,
              subtotal: true,
              namaGantiSnapshot: true,
              qtyGanti: true,
              hargaGantiSnapshot: true,
              subtotalGanti: true,
              item: {
                select: { kode: true }
              },
              itemGanti: {
                select: {
                  id: true,
                  kode: true,
                  nama: true,
                }
              }
            }
          }
        }
      }
    }
  });

  // Hitung jumlah verifikasi semua invoice dalam SATU query (hindari N+1).
  // QR code tidak lagi digenerate di server — dibuat lazy di klien saat
  // pratinjau cetak dibuka (lihat InvoiceDocument), jadi load halaman ringan.
  const verifAgg = await prisma.activityLog.groupBy({
    by: ["entitasId"],
    where: {
      aksi: "VERIFIKASI_INVOICE",
      entitasId: { in: invoices.map((inv) => String(inv.id)) },
    },
    _count: { _all: true },
  });
  const verifCountMap = new Map(
    verifAgg.map((v) => [v.entitasId, v._count._all])
  );

  // Format dataset for Client Component
  const formattedInvoices: InvoiceRow[] = invoices.map((inv) => {
    const totalVal = Number(inv.total);
    const paidVal = Number(inv.totalDibayar);
    const sisa = totalVal - paidVal;
    
    // Resolve dynamic status: Draft, Pending, Partial, Paid
    let computedStatus: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" = "PENDING";
    if (inv.status === "DRAFT") {
      computedStatus = "DRAFT";
    } else if (paidVal >= totalVal) {
      computedStatus = "PAID";
    } else if (paidVal > 0 && paidVal < totalVal) {
      computedStatus = "PARTIAL";
    }

    let items: InvoiceItem[] = [];
    if (inv.transaction) {
      items = inv.transaction.items.map((it) => ({
        itemId: it.itemId,
        kode: it.item?.kode ?? "-",
        nama: it.namaSnapshot,
        qty: it.qty,
        harga: Number(it.hargaSnapshot),
        subtotal: Number(it.subtotal),
      }));
    } else if (inv.return) {
      const r = inv.return;
      items = [];
      for (const ri of r.items) {
        items.push({
          itemId: ri.itemId,
          kode: ri.item.kode,
          nama: `[RETUR] ${ri.namaSnapshot}`,
          qty: ri.qtyReturned,
          harga: Number(ri.hargaSnapshot),
          subtotal: -(Number(ri.subtotal)),
        });
        if (ri.itemGanti && ri.qtyGanti) {
          items.push({
            itemId: ri.itemGanti.id,
            kode: ri.itemGanti.kode,
            nama: `[GANTI] ${ri.namaGantiSnapshot ?? ri.itemGanti.nama}`,
            qty: ri.qtyGanti,
            harga: Number(ri.hargaGantiSnapshot ?? 0),
            subtotal: Number(ri.subtotalGanti ?? 0),
          });
        }
      }
    }

    return {
      id: inv.id,
      noInvoice: inv.noInvoice,
      namaClient: inv.namaClient ?? inv.client?.nama ?? "-",
      alamat: inv.alamat,
      namaWs: inv.namaWs,
      namaBank: inv.transaction?.namaBank ?? inv.return?.transaction?.namaBank ?? null,
      noRekening: inv.transaction?.noRekening ?? inv.return?.transaction?.noRekening ?? null,
      atasNama: inv.transaction?.atasNama ?? inv.return?.transaction?.atasNama ?? null,
      total: totalVal,
      totalDibayar: paidVal,
      status: computedStatus,
      tanggal: inv.tanggal.toISOString(),
      items,
      verifyUrl: `${VERIFY_BASE}/verify/${inv.noInvoice}`,
      verifCount: verifCountMap.get(String(inv.id)) ?? 0,
      projectName: inv.project?.nama ?? undefined,
      noTransaksi: inv.transaction?.noTransaksi ?? inv.return?.transaction?.noTransaksi ?? undefined,
      payments: inv.payments.map((p) => ({
        id: p.id,
        tanggal: p.tanggal.toISOString(),
        tipe: p.tipe,
        jumlah: Number(p.jumlah),
        keterangan: p.keterangan,
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Invoices &amp; Piutang Dagang</h1>
        <p className="text-xs font-semibold text-slate-500 mt-1">
          Lacak pembayaran piutang berjalan, verifikasi tanggal jatuh tempo, dan input cicilan kas.
        </p>
      </div>

      <InvoiceClient initialInvoices={formattedInvoices} canBayar={canBayar} userName={user.nama} />
    </div>
  );
}
