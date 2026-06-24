"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { bayarInvoice } from "./actions";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { MessageCircle, Wallet, Printer, X, Download, Mail, Link2 } from "lucide-react";
import { toast } from "sonner";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { printArea } from "@/lib/print";

export type InvoiceItem = {
  kode: string;
  nama: string;
  qty: number;
  harga: number;
  subtotal: number;
  kategori?: string;
  satuan?: string;
  diskon?: number;
};

export type InvoiceRow = {
  id: number;
  noInvoice: string;
  namaClient: string;
  alamat: string | null;
  namaWs: string | null;
  total: number;
  totalDibayar: number;
  status: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  tanggal: string;
  items: InvoiceItem[];
  qrDataUrl?: string;
  verifyUrl?: string;
};

export function InvoiceActions({ inv, canBayar }: { inv: InvoiceRow; canBayar: boolean }) {
  const router = useRouter();
  const [openPay, setOpenPay] = useState(false);
  const [openPrint, setOpenPrint] = useState(false);
  const [jumlah, setJumlah] = useState<number>(inv.total - inv.totalDibayar);
  const [metode, setMetode] = useState<"CASH" | "TRANSFER">("CASH");
  const [pending, start] = useTransition();
  const docRef = useRef<HTMLDivElement>(null);

  // Auto-fit dokumen invoice agar full terlihat di preview (tidak mempengaruhi print)
  useEffect(() => {
    if (!openPrint) return;
    const fit = () => {
      const el = docRef.current;
      if (!el) return;
      el.style.zoom = "1";
      const natural = el.offsetHeight;
      const avail = window.innerHeight * 0.82 - 56; // dikurangi toolbar
      const z = Math.max(0.32, Math.min(1, avail / natural));
      el.style.zoom = String(z);
    };
    const t = setTimeout(fit, 80);
    window.addEventListener("resize", fit);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", fit);
    };
  }, [openPrint]);

  const sisa = inv.total - inv.totalDibayar;

  // Generate WhatsApp billing reminder
  function kirimWA() {
    let no = window.prompt("Nomor WhatsApp pelanggan (mis. 08123456789):", "");
    if (!no) return;
    no = no.replace(/[^0-9]/g, "");
    if (no.startsWith("0")) no = "62" + no.slice(1);
    
    // Virtual due date: 30 days from invoice date
    const dueDate = new Date(inv.tanggal);
    dueDate.setDate(dueDate.getDate() + 30);

    const pesan =
      `Halo Bapak/Ibu ${inv.namaClient},\n` +
      `Kami menginfokan tagihan invoice yang berjalan di PUTRA CORPORATION HARDWARE.\n\n` +
      `*Detail Tagihan:*\n` +
      `Nomor Invoice : *${inv.noInvoice}*\n` +
      `Tanggal Invoice: ${formatTanggal(inv.tanggal)}\n` +
      `Jatuh Tempo    : *${formatTanggal(dueDate.toISOString())}*\n` +
      `Total Tagihan  : *${formatRupiah(inv.total)}*\n` +
      `Sudah Dibayar  : ${formatRupiah(inv.totalDibayar)}\n` +
      `Sisa Piutang   : *${formatRupiah(sisa)}*\n\n` +
      `Mohon segera menyelesaikan pembayaran sebelum jatuh tempo. Terima kasih.`;

    window.open(`https://wa.me/${no}?text=${encodeURIComponent(pesan)}`, "_blank");
    toast.success("WhatsApp web dibuka.");
  }

  function handleBayar() {
    if (jumlah <= 0) return toast.error("Jumlah bayar tidak valid");
    if (jumlah > sisa) {
      toast.warning(`Pembayaran melebihi sisa piutang (${formatRupiah(sisa)})`);
      setJumlah(sisa);
      return;
    }

    start(async () => {
      const res = await bayarInvoice(inv.id, jumlah);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pembayaran sebesar ${formatRupiah(jumlah)} sukses dicatat!`);
      setOpenPay(false);
      router.refresh();
    });
  }

  function cetak() {
    printArea({ className: "print-format-a4" });
  }

  function kirimEmail() {
    const subject = `Invoice ${inv.noInvoice} — PUTRA CORPORATION HARDWARE`;
    const body =
      `Halo ${inv.namaClient},\n\n` +
      `Berikut detail invoice Anda:\n` +
      `Nomor Invoice : ${inv.noInvoice}\n` +
      `Tanggal       : ${formatTanggal(inv.tanggal)}\n` +
      `Total Tagihan : ${formatRupiah(inv.total)}\n` +
      `Sisa Piutang  : ${formatRupiah(sisa)}\n\n` +
      (inv.verifyUrl ? `Verifikasi: ${inv.verifyUrl}\n\n` : "") +
      `Terima kasih.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function salinLink() {
    const link = inv.verifyUrl ?? `${typeof window !== "undefined" ? window.location.origin : ""}/invoice`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link invoice disalin ke clipboard.");
    } catch {
      toast.error("Gagal menyalin link.");
    }
  }

  return (
    <div className="flex justify-center gap-1.5">
      {/* View/Print Trigger */}
      <Button size="sm" variant="outline" onClick={() => setOpenPrint(true)}>
        <Printer size={13} /> Cetak
      </Button>

      {/* WhatsApp Trigger */}
      <Button size="sm" variant="success" onClick={kirimWA}>
        <MessageCircle size={13} /> WhatsApp
      </Button>

      {/* Record Payment Trigger */}
      {canBayar && inv.status !== "PAID" && (
        <Button size="sm" variant="primary" onClick={() => { setJumlah(sisa); setOpenPay(true); }}>
          <Wallet size={13} /> Bayar
        </Button>
      )}

      {/* Payment Recording Modal */}
      {openPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs" onClick={() => setOpenPay(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="font-bold text-slate-900">Catat Pembayaran Piutang</h3>
              <button onClick={() => setOpenPay(false)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs space-y-1 bg-slate-50 border border-border p-3 rounded-lg">
                <div className="flex justify-between"><span className="text-muted">No. Invoice:</span> <strong className="font-mono">{inv.noInvoice}</strong></div>
                <div className="flex justify-between"><span className="text-muted">Total Tagihan:</span> <span>{formatRupiah(inv.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Sisa Piutang:</span> <strong className="text-amber-700">{formatRupiah(sisa)}</strong></div>
              </div>

              <div>
                <Label>Jumlah Nominal Bayar (Rp)</Label>
                <Input
                  type="number"
                  value={jumlah}
                  onChange={(e) => setJumlah(parseInt(e.target.value) || 0)}
                  className="font-mono font-semibold h-11 text-base text-right pr-3"
                />
              </div>

              <div>
                <Label>Metode Pembayaran</Label>
                <Select value={metode} onChange={(e) => setMetode(e.target.value as any)}>
                  <option value="CASH">Tunai</option>
                  <option value="TRANSFER">Transfer Bank</option>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleBayar} disabled={pending} className="flex-1">
                  {pending ? "Memproses..." : "Simpan Pembayaran"}
                </Button>
                <Button variant="outline" onClick={() => setOpenPay(false)}>Batal</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal — Enterprise Invoice A4 */}
      {openPrint && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-xs" onClick={() => setOpenPrint(false)}>
          <div onClick={(e) => e.stopPropagation()} className="my-4 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Toolbar */}
            <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--paper-2)] px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Pratinjau Invoice <span className="font-mono text-[var(--primary)]">{inv.noInvoice}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" onClick={cetak}><Printer size={14} /> Print</Button>
                <Button size="sm" variant="outline" onClick={cetak}><Download size={14} /> PDF</Button>
                <Button size="sm" variant="success" onClick={kirimWA}><MessageCircle size={14} /> WhatsApp</Button>
                <Button size="sm" variant="outline" onClick={kirimEmail}><Mail size={14} /> Email</Button>
                <Button size="sm" variant="outline" onClick={salinLink}><Link2 size={14} /> Salin Link</Button>
                <Button size="sm" variant="ghost" onClick={() => setOpenPrint(false)}><X size={16} /></Button>
              </div>
            </div>

            {/* Document (auto-fit ke layar) */}
            <div className="overflow-auto bg-[var(--paper-2)] p-4 sm:p-5" style={{ maxHeight: "calc(100vh - 120px)" }}>
              <div
                ref={docRef}
                style={{ zoom: 1 }}
                className="print-area mx-auto w-[800px] max-w-full origin-top overflow-hidden rounded-xl border border-border bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.18)]"
              >
                <InvoiceDocument inv={inv} qrDataUrl={inv.qrDataUrl} verifyUrl={inv.verifyUrl} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
