import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceClient, type InvoiceRow, type InvoiceItem } from "./InvoiceClient";

const VERIFY_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://putracorp.co.id";

export default async function InvoicePage() {
  const user = await requireUser();
  const canBayar = user.role === "ADMIN_KASIR";

  // Query invoices including projects and clients
  const invoices = await prisma.invoice.findMany({
    orderBy: { id: "desc" }, // terbaru ditambahkan tampil paling atas
    include: {
      project: true,
      client: true,
      transaction: {
        include: {
          items: { include: { item: true } },
        },
      },
      return: {
        include: {
          items: {
            include: { item: true, itemGanti: true },
          },
          transaction: true,
        },
      },
    },
  });

  // Pre-render QR verification tiap invoice (server-side, offline-safe)
  const qrMap = new Map<number, { qr: string; verifyUrl: string }>();
  await Promise.all(
    invoices.map(async (inv) => {
      const verifyUrl = `${VERIFY_BASE}/verify/${inv.noInvoice}`;
      const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
      qrMap.set(inv.id, { qr, verifyUrl });
    })
  );

  const now = new Date();

  // Format dataset for Client Component
  const formattedInvoices: InvoiceRow[] = invoices.map((inv) => {
    const totalVal = Number(inv.total);
    const paidVal = Number(inv.totalDibayar);
    const sisa = totalVal - paidVal;
    
    // Virtual due date: tanggal + 30 days
    const dueDate = new Date(inv.tanggal);
    dueDate.setDate(dueDate.getDate() + 30);
    const isOverdue = sisa > 0 && dueDate.getTime() < now.getTime();

    // Resolve dynamic status: Draft, Pending, Partial, Paid, Overdue
    let computedStatus: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" = "PENDING";
    if (inv.status === "DRAFT") {
      computedStatus = "DRAFT";
    } else if (paidVal >= totalVal) {
      computedStatus = "PAID";
    } else if (isOverdue) {
      computedStatus = "OVERDUE";
    } else if (paidVal > 0 && paidVal < totalVal) {
      computedStatus = "PARTIAL";
    }

    let items: InvoiceItem[] = [];
    if (inv.transaction) {
      items = inv.transaction.items.map((it) => ({
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
          kode: ri.item.kode,
          nama: `[RETUR] ${ri.namaSnapshot}`,
          qty: ri.qtyReturned,
          harga: Number(ri.hargaSnapshot),
          subtotal: -(Number(ri.subtotal)),
        });
        if (ri.itemGanti && ri.qtyGanti) {
          items.push({
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
      total: totalVal,
      totalDibayar: paidVal,
      status: computedStatus,
      tanggal: inv.tanggal.toISOString(),
      items,
      qrDataUrl: qrMap.get(inv.id)?.qr,
      verifyUrl: qrMap.get(inv.id)?.verifyUrl,
      projectName: inv.project?.nama ?? undefined,
      noTransaksi: inv.transaction?.noTransaksi ?? inv.return?.transaction?.noTransaksi ?? undefined,
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

      <InvoiceClient initialInvoices={formattedInvoices} canBayar={canBayar} />
    </div>
  );
}
