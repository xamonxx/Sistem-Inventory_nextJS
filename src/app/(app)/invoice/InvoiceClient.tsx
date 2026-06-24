"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { bayarInvoice } from "./actions";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge } from "@/components/ui";
import { Drawer } from "@/components/Drawer";
import { Pagination, usePagination } from "@/components/Pagination";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { printArea } from "@/lib/print";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import {
  Search,
  Wallet,
  Printer,
  MessageCircle,
  Mail,
  Link2,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  SlidersHorizontal,
  FileText,
  X,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export type InvoiceItem = {
  kode: string;
  nama: string;
  qty: number;
  harga: number;
  subtotal: number;
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
  projectName?: string;
  noTransaksi?: string;
};

interface InvoiceClientProps {
  initialInvoices: InvoiceRow[];
  canBayar: boolean;
}

export function InvoiceClient({ initialInvoices, canBayar }: InvoiceClientProps) {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  // Payment states inside detail drawer
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Column Visibility States
  const [showProject, setShowProject] = useState(true);
  const [showDue, setShowDue] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  // Calculate statistics across all invoices
  const stats = useMemo(() => {
    let totalReceivable = 0;
    let totalOverdue = 0;
    let totalPaid = 0;
    let pendingCount = 0;
    const now = new Date();

    initialInvoices.forEach((inv) => {
      const sisa = inv.total - inv.totalDibayar;
      totalPaid += inv.totalDibayar;

      if (inv.status === "PAID") return;

      totalReceivable += sisa;
      pendingCount++;

      const dueDate = new Date(inv.tanggal);
      dueDate.setDate(dueDate.getDate() + 30);
      if (dueDate.getTime() < now.getTime()) {
        totalOverdue += sisa;
      }
    });

    return { totalReceivable, totalOverdue, totalPaid, pendingCount };
  }, [initialInvoices]);

  // Filter invoices dataset
  const filteredInvoices = useMemo(() => {
    return initialInvoices.filter((inv) => {
      const matchesSearch =
        inv.noInvoice.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.namaClient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.projectName && inv.projectName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "ALL" ||
        inv.status === statusFilter ||
        (statusFilter === "OVERDUE" && inv.status === "OVERDUE") ||
        (statusFilter === "PENDING" && (inv.status === "PENDING" || inv.status === "PARTIAL"));

      return matchesSearch && matchesStatus;
    });
  }, [initialInvoices, searchQuery, statusFilter]);

  const invoicePg = usePagination(filteredInvoices, 10);

  // Handle instalment payment
  function handlePayInstalment(invoice: InvoiceRow) {
    const sisa = invoice.total - invoice.totalDibayar;
    if (paymentAmount <= 0) return toast.error("Ketik jumlah nominal bayar yang valid");
    if (paymentAmount > sisa) {
      toast.warning(`Pembayaran melebihi sisa piutang (${formatRupiah(sisa)})`);
      setPaymentAmount(sisa);
      return;
    }

    startTransition(async () => {
      const res = await bayarInvoice(invoice.id, paymentAmount);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pembayaran sebesar ${formatRupiah(paymentAmount)} berhasil disimpan!`);
      
      // Update selected drawer model locally
      const updatedInvoice = {
        ...invoice,
        totalDibayar: invoice.totalDibayar + paymentAmount,
        status: (invoice.totalDibayar + paymentAmount >= invoice.total) ? "PAID" as const : "PARTIAL" as const
      };
      setSelectedInvoice(updatedInvoice);
      setPaymentAmount(0);
      router.refresh();
    });
  }

  // Handle copy text to clipboard
  function handleCopyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} (${text}) berhasil disalin ke clipboard!`);
  }

  // Trigger WhatsApp reminder share
  function handleSendWhatsApp(inv: InvoiceRow) {
    let no = window.prompt("Nomor WhatsApp pelanggan (mis. 08123456789):", "");
    if (!no) return;
    no = no.replace(/[^0-9]/g, "");
    if (no.startsWith("0")) no = "62" + no.slice(1);
    
    const sisa = inv.total - inv.totalDibayar;
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
    toast.success("Membuka WhatsApp web...");
  }

  async function handleCopyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link invoice disalin ke clipboard.");
    } catch {
      toast.error("Gagal menyalin link.");
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. Statistics Row */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Piutang Aktif", value: formatRupiah(stats.totalReceivable), desc: "Piutang belum terbayar", icon: Wallet, tone: "amber" },
          { label: "Tagihan Jatuh Tempo (Overdue)", value: formatRupiah(stats.totalOverdue), desc: "Lewat batas kredit 30 hari", icon: AlertTriangle, tone: "red" },
          { label: "Total Pembayaran Diterima", value: formatRupiah(stats.totalPaid), desc: "Lunas/cicilan terkumpul", icon: CheckCircle, tone: "green" },
          { label: "Invoices Pending", value: `${stats.pendingCount} invoice`, desc: "Belum lunas sepenuhnya", icon: Clock, tone: "blue" },
        ].map((card) => {
          const Icon = card.icon;
          const toneColors: Record<string, string> = {
            amber: "bg-amber-50 text-amber-700 border-amber-100",
            red: "bg-rose-50 text-rose-700 border-rose-100",
            green: "bg-emerald-50 text-emerald-700 border-emerald-100",
            blue: "bg-blue-50 text-blue-700 border-blue-100",
          };
          return (
            <Card key={card.label} className="flex items-center gap-4.5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${toneColors[card.tone]}`}>
                <Icon size={20} strokeWidth={2.3} />
              </div>
              <div className="leading-tight select-none min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450">{card.label}</p>
                <p className="mt-1 font-extrabold text-slate-800 font-display text-sm sm:text-base">{card.value}</p>
                <p className="text-[10px] text-slate-450 mt-0.5">{card.desc}</p>
              </div>
            </Card>
          );
        })}
      </section>

      {/* 2. Filter & Actions Toolbar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan Nomor Invoice, Klien, atau nama Proyek..."
              className="pl-9 h-10 rounded-xl"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-44 rounded-xl text-xs font-bold"
            >
              <option value="ALL">Semua Tagihan</option>
              <option value="PENDING">Belum Lunas (Pending)</option>
              <option value="PAID">Lunas (Paid)</option>
              <option value="OVERDUE">Jatuh Tempo (Overdue)</option>
              <option value="DRAFT">Draft</option>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="h-10 rounded-xl px-3"
            >
              <SlidersHorizontal size={14} /> Kolom
            </Button>
          </div>
        </div>

        {/* Column configuration drawer toggle */}
        {showConfig && (
          <div className="flex flex-wrap gap-4 pt-3 border-t border-dashed border-border text-xs text-slate-650 font-bold select-none anim-rise">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showProject} onChange={(e) => setShowProject(e.target.checked)} className="h-4 w-4 rounded text-[var(--primary)] focus:ring-transparent" />
              Tampilkan Kolom Proyek
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showDue} onChange={(e) => setShowDue(e.target.checked)} className="h-4 w-4 rounded text-[var(--primary)] focus:ring-transparent" />
              Tampilkan Jatuh Tempo
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} className="h-4 w-4 rounded text-[var(--primary)] focus:ring-transparent" />
              Tampilkan Kolom Terbayar
            </label>
          </div>
        )}
      </Card>

      {/* 3. Modern Data Grid Invoice Table */}
      <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-[var(--shadow-card)]">
        <Table>
          <thead>
            <tr>
              <Th>No. Invoice</Th>
              <Th>Tanggal</Th>
              <Th>Klien / Pelanggan</Th>
              {showProject && <Th>Proyek</Th>}
              <Th className="text-right">Total Tagihan</Th>
              {showPaid && <Th className="text-right">Telah Dibayar</Th>}
              <Th className="text-right">Sisa Piutang</Th>
              {showDue && <Th>Jatuh Tempo</Th>}
              <Th className="text-center">Status</Th>
              <Th className="text-center">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {invoicePg.pageData.map((inv) => {
              const sisa = inv.total - inv.totalDibayar;
              const dueDate = new Date(inv.tanggal);
              dueDate.setDate(dueDate.getDate() + 30);
              const now = new Date();
              const isOverdue = sisa > 0 && dueDate.getTime() < now.getTime();

              return (
                <tr
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className="hover:bg-slate-50/50 cursor-pointer transition-colors duration-150 group"
                >
                  <Td className="group-hover:text-[var(--primary)]">
                    <div className="font-mono text-xs font-bold text-slate-850">{inv.noInvoice}</div>
                    {inv.noTransaksi && (
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">{inv.noTransaksi}</div>
                    )}
                  </Td>
                  <Td className="text-xs text-slate-450">{formatTanggal(inv.tanggal)}</Td>
                  <Td className="font-semibold text-slate-900">{inv.namaClient}</Td>
                  {showProject && (
                    <Td className="text-xs text-slate-650 font-medium">
                      {inv.projectName ?? "Eceran / Umum"}
                    </Td>
                  )}
                  <Td className="text-right font-mono text-xs font-semibold">{formatRupiah(inv.total)}</Td>
                  {showPaid && (
                    <Td className="text-right font-mono text-xs text-emerald-600 font-semibold">
                      {inv.totalDibayar > 0 ? formatRupiah(inv.totalDibayar) : "—"}
                    </Td>
                  )}
                  <Td className="text-right font-mono text-xs font-extrabold text-amber-700">
                    {sisa > 0 ? formatRupiah(sisa) : <span className="text-emerald-600 font-bold">Lunas</span>}
                  </Td>
                  {showDue && (
                    <Td className={`text-xs ${isOverdue ? "text-red-500 font-bold" : "text-slate-450"}`}>
                      {formatTanggal(dueDate.toISOString())}
                    </Td>
                  )}
                  <Td className="text-center select-none" onClick={(e) => e.stopPropagation()}>
                    {inv.status === "PAID" && <Badge tone="green">Lunas</Badge>}
                    {inv.status === "PARTIAL" && <Badge tone="blue">Partial</Badge>}
                    {inv.status === "PENDING" && <Badge tone="amber">Pending</Badge>}
                    {inv.status === "OVERDUE" && <Badge tone="red">Overdue</Badge>}
                    {inv.status === "DRAFT" && <Badge tone="slate">Draft</Badge>}
                  </Td>
                  <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-border text-slate-500 hover:bg-[var(--primary)] hover:text-white transition mx-auto cursor-pointer"
                      title="Buka detail drawer"
                    >
                      <Eye size={14} />
                    </button>
                  </Td>
                </tr>
              );
            })}

            {filteredInvoices.length === 0 && (
              <tr>
                <Td colSpan={10} className="py-16 text-center text-slate-400 select-none">
                  <FileText className="mx-auto text-slate-200 mb-2" size={32} />
                  <p className="font-semibold text-sm">Tidak Ada Invoice Terdaftar</p>
                  <p className="text-xs">Data tagihan kosong atau tidak cocok dengan pencarian.</p>
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <div className="px-4 pb-3">
          <Pagination page={invoicePg.page} perPage={invoicePg.perPage} total={invoicePg.total} onPage={invoicePg.setPage} onPerPage={invoicePg.setPerPage} />
        </div>
      </div>

      {/* 4. Detail Drawer (700px wide) */}
      <Drawer
        isOpen={selectedInvoice !== null}
        onClose={() => {
          setSelectedInvoice(null);
          setIsPrintOpen(false);
        }}
        title={selectedInvoice ? `Detail Invoice ${selectedInvoice.noInvoice}` : ""}
        size="medium"
      >
        {selectedInvoice && (
          <div className="space-y-6">
            {/* Document Codes Metadata Panel */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 bg-slate-50/50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">No. Invoice</span>
                  <p className="font-mono text-sm font-bold text-slate-800 mt-0.5">{selectedInvoice.noInvoice}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(selectedInvoice.noInvoice, "No. Invoice")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-450 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                  title="Salin No. Invoice"
                >
                  <Copy size={13} />
                </button>
              </div>

              {selectedInvoice.noTransaksi && (
                <div className="flex-1 bg-slate-50/50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">No. Transaksi Asli</span>
                    <p className="font-mono text-sm font-bold text-slate-800 mt-0.5">{selectedInvoice.noTransaksi}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(selectedInvoice.noTransaksi!, "No. Transaksi")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-450 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                    title="Salin No. Transaksi"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Status & Summary Header */}
            <div className="flex items-center justify-between bg-slate-50 border border-border p-4 rounded-xl">
              <div>
                <p className="text-[10px] font-bold text-slate-450 uppercase">Status Pembayaran</p>
                <div className="mt-1 flex items-center gap-2">
                  {selectedInvoice.status === "PAID" && <Badge tone="green">Lunas</Badge>}
                  {selectedInvoice.status === "PARTIAL" && <Badge tone="blue">Cicilan Aktif</Badge>}
                  {selectedInvoice.status === "PENDING" && <Badge tone="amber">Pending</Badge>}
                  {selectedInvoice.status === "OVERDUE" && <Badge tone="red">Lewat Tempo (⚠️)</Badge>}
                  {selectedInvoice.status === "DRAFT" && <Badge tone="slate">Draft</Badge>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-450 uppercase">Sisa Tagihan</p>
                <p className="text-lg font-extrabold text-slate-800 font-mono mt-0.5">
                  {formatRupiah(selectedInvoice.total - selectedInvoice.totalDibayar)}
                </p>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsPrintOpen(true)}>
                <Printer size={13} /> Cetak Faktur
              </Button>
              <Button size="sm" variant="success" onClick={() => handleSendWhatsApp(selectedInvoice)}>
                <MessageCircle size={13} /> Kirim WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleCopyLink(selectedInvoice.verifyUrl ?? "")}>
                <Link2 size={13} /> Salin Link Verifikasi
              </Button>
            </div>

            {/* Print Document Modal view */}
            {isPrintOpen && (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-xs" onClick={() => setIsPrintOpen(false)}>
                <div onClick={(e) => e.stopPropagation()} className="my-4 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <div className="no-print flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">
                      Pratinjau Invoice <span className="font-mono text-[var(--primary)]">{selectedInvoice.noInvoice}</span>
                    </p>
                    <button onClick={() => setIsPrintOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-450 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="overflow-auto bg-[var(--paper-2)] p-4 sm:p-5" style={{ maxHeight: "calc(100vh - 120px)" }}>
                    <div className="print-area mx-auto w-[800px] max-w-full origin-top overflow-hidden rounded-xl border border-border bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.18)]">
                      <InvoiceDocument
                        inv={selectedInvoice}
                        qrDataUrl={selectedInvoice.qrDataUrl}
                      />
                    </div>
                  </div>
                  <div className="no-print flex justify-end gap-2.5 border-t border-border px-4 py-3">
                    <Button variant="outline" onClick={() => setIsPrintOpen(false)}>Tutup</Button>
                    <Button onClick={() => printArea({ className: "print-format-a4" })}>Cetak A4 PDF</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Customer info card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-4 bg-white">
                <p className="text-[10px] font-bold text-slate-450 uppercase mb-1">Informasi Klien</p>
                <p className="text-sm font-bold text-slate-850">{selectedInvoice.namaClient}</p>
                <p className="text-xs text-slate-500 mt-1">{selectedInvoice.alamat ?? "Tidak ada alamat tercatat."}</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-white">
                <p className="text-[10px] font-bold text-slate-450 uppercase mb-1">Informasi Proyek &amp; WS</p>
                <p className="text-sm font-bold text-slate-800">{selectedInvoice.projectName ?? "Eceran / Umum"}</p>
                <p className="text-xs text-slate-500 mt-1">WS: {selectedInvoice.namaWs ?? "—"}</p>
                {selectedInvoice.noTransaksi && (
                  <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-dashed border-slate-100 flex justify-between">
                    <span>No. Transaksi Asli:</span>
                    <span className="font-mono text-slate-800 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">{selectedInvoice.noTransaksi}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Invoice Line Items */}
            <div className="space-y-2">
              <Label>Daftar Barang Terbeli</Label>
              <div className="overflow-hidden rounded-xl border border-border bg-white">
                <Table>
                  <thead>
                    <tr>
                      <Th>Barang</Th>
                      <Th className="text-center">Qty</Th>
                      <Th className="text-right">Harga</Th>
                      <Th className="text-right">Subtotal</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((line, idx) => (
                      <tr key={idx}>
                        <Td>
                          <div className="font-bold text-slate-850 text-xs">{line.nama}</div>
                          <div className="font-mono text-[9px] text-slate-400 mt-0.5">{line.kode}</div>
                        </Td>
                        <Td className="text-center font-mono text-xs">{line.qty} unit</Td>
                        <Td className="text-right font-mono text-xs">{formatRupiah(line.harga)}</Td>
                        <Td className="text-right font-mono text-xs font-bold">{formatRupiah(line.subtotal)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>

            {/* Instalment payment panel inside drawer */}
            {canBayar && selectedInvoice.total - selectedInvoice.totalDibayar > 0 && (
              <div className="rounded-xl border border-dashed border-border bg-slate-50 p-4.5 space-y-3">
                <Label>Input Pembayaran Cicilan / Piutang</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                    placeholder="Ketik nominal cicilan..."
                    className="h-10 font-mono font-bold text-sm bg-white"
                  />
                  <Button
                    onClick={() => handlePayInstalment(selectedInvoice)}
                    disabled={isPending || paymentAmount <= 0}
                    className="h-10 shrink-0 text-xs px-4"
                  >
                    {isPending ? "Proses..." : "Simpan Cicilan"}
                  </Button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setPaymentAmount(selectedInvoice.total - selectedInvoice.totalDibayar)}
                    className="rounded border border-emerald-250 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                  >
                    Bayar Lunas
                  </button>
                  <button
                    onClick={() => setPaymentAmount(1000000)}
                    className="rounded border border-border bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-650 hover:bg-slate-100 font-mono cursor-pointer"
                  >
                    1jt
                  </button>
                  <button
                    onClick={() => setPaymentAmount(5000000)}
                    className="rounded border border-border bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-650 hover:bg-slate-100 font-mono cursor-pointer"
                  >
                    5jt
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
