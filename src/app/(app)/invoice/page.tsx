import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { Badge, Card, Table, Th, Td } from "@/components/ui";
import { InvoiceActions, type InvoiceRow, type InvoiceItem } from "./InvoiceActions";

const VERIFY_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://putracorp.co.id";

export default async function InvoicePage() {
  const user = await requireUser();
  const canBayar = user.role === "ADMIN_KASIR";

  // Query invoices including projects and clients
  const invoices = await prisma.invoice.findMany({
    orderBy: { tanggal: "desc" },
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
          itemRetur: true,
          itemGanti: true,
        },
      },
    },
  });

  const totalPiutang = invoices
    .filter((i) => i.status !== "LUNAS")
    .reduce((a, i) => a + (Number(i.total) - Number(i.totalDibayar)), 0);

  // Pra-render QR verifikasi tiap invoice (server-side, offline-safe)
  const qrMap = new Map<number, { qr: string; verifyUrl: string }>();
  await Promise.all(
    invoices.map(async (inv) => {
      const verifyUrl = `${VERIFY_BASE}/verify/${inv.noInvoice}`;
      const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
      qrMap.set(inv.id, { qr, verifyUrl });
    })
  );

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice &amp; Piutang Klien</h1>
          <p className="text-sm text-muted">Pantau piutang berjalan, tagihan jatuh tempo, dan input pembayaran cicilan.</p>
        </div>
        <Card className="px-5 py-3 w-full sm:w-72 bg-amber-50 border border-amber-200 shadow-sm">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Total Piutang Aktif</p>
          <p className="text-2xl font-black text-amber-700 font-mono mt-1">{formatRupiah(totalPiutang)}</p>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <thead>
            <tr>
              <Th>No. Invoice</Th>
              <Th>Tanggal</Th>
              <Th>Client / Pelanggan</Th>
              <Th>Proyek</Th>
              <Th className="text-right">Total Tagihan</Th>
              <Th className="text-right">Telah Dibayar</Th>
              <Th className="text-right">Sisa Piutang</Th>
              <Th>Jatuh Tempo</Th>
              <Th className="text-center">Status</Th>
              <Th className="text-center">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
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
                items = [
                  {
                    kode: r.itemRetur.kode,
                    nama: `[RETUR] ${r.itemRetur.nama}`,
                    qty: r.qtyRetur,
                    harga: Number(r.hargaReturSnapshot),
                    subtotal: -(Number(r.hargaReturSnapshot) * r.qtyRetur),
                  },
                ];
                if (r.itemGanti && r.qtyGanti) {
                  items.push({
                    kode: r.itemGanti.kode,
                    nama: `[GANTI] ${r.itemGanti.nama}`,
                    qty: r.qtyGanti,
                    harga: Number(r.hargaGantiSnapshot ?? 0),
                    subtotal: Number(r.hargaGantiSnapshot ?? 0) * r.qtyGanti,
                  });
                }
              }

              const row: InvoiceRow = {
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
              };

              return (
                <tr key={inv.id} className="hover:bg-slate-50/50">
                  <Td className="font-mono text-xs font-bold text-slate-700">{inv.noInvoice}</Td>
                  <Td className="text-xs text-slate-500">{formatTanggal(inv.tanggal)}</Td>
                  <Td className="font-medium text-slate-900">{row.namaClient}</Td>
                  <Td className="text-xs text-slate-600">{inv.project?.nama ?? "Eceran / Pelanggan Umum"}</Td>
                  <Td className="text-right font-mono text-xs">{formatRupiah(totalVal)}</Td>
                  <Td className="text-right font-mono text-xs text-emerald-600">
                    {paidVal > 0 ? formatRupiah(paidVal) : "—"}
                  </Td>
                  <Td className="text-right font-mono text-xs font-semibold text-amber-700">
                    {sisa > 0 ? formatRupiah(sisa) : "Lunas"}
                  </Td>
                  <Td className={`text-xs ${isOverdue ? "text-red-600 font-bold" : "text-slate-500"}`}>
                    {formatTanggal(dueDate.toISOString())}
                  </Td>
                  <Td className="text-center">
                    {computedStatus === "PAID" && <Badge tone="green">Lunas</Badge>}
                    {computedStatus === "PARTIAL" && <Badge tone="blue">Partial (Cicil)</Badge>}
                    {computedStatus === "PENDING" && <Badge tone="amber">Pending</Badge>}
                    {computedStatus === "OVERDUE" && <Badge tone="red">Overdue (⚠️)</Badge>}
                    {computedStatus === "DRAFT" && <Badge tone="slate">Draft</Badge>}
                  </Td>
                  <Td className="text-center">
                    <InvoiceActions inv={row} canBayar={canBayar} />
                  </Td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <Td colSpan={10} className="py-12 text-center text-muted">
                  Belum ada invoice/tagihan piutang tercatat.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
