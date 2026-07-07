"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { bayarInvoice, updateInvoice, deleteInvoice, deleteInvoices, updateInvoiceAndItems } from "./actions";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { Drawer } from "@/components/Drawer";
import { Pagination, usePagination } from "@/components/Pagination";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { Nota } from "@/components/Nota";
import { ModernDialog } from "@/components/ModernDialog";
import { printArea } from "@/lib/print";
import { formatRupiah, formatTanggal, cn } from "@/lib/utils";
import { toPng } from "html-to-image";
import { exportInvoiceExcel } from "@/lib/export/exportInvoiceExcel";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import {
  Search,
  Download,
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
  Camera,
  Pencil,
  Trash2,
  Hash,
  DollarSign,
  User,
  Building2,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

export type InvoiceItem = {
  itemId: number;
  kode: string;
  nama: string;
  qty: number;
  harga: number;
  subtotal: number;
};

export type PaymentRow = {
  id: number;
  tanggal: string;
  tipe: "CASH" | "TRANSFER" | "CREDIT";
  jumlah: number;
  keterangan: string | null;
};

export type InvoiceRow = {
  id: number;
  noInvoice: string;
  namaClient: string;
  alamat: string | null;
  namaWs: string | null;
  namaBank?: string | null;
  noRekening?: string | null;
  atasNama?: string | null;
  total: number;
  totalDibayar: number;
  status: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  tanggal: string;
  items: InvoiceItem[];
  qrDataUrl?: string;
  verifyUrl?: string;
  verifCount?: number;
  projectName?: string;
  noTransaksi?: string;
  payments?: PaymentRow[];
};

interface InvoiceClientProps {
  initialInvoices: InvoiceRow[];
  canBayar: boolean;
  userName?: string;
}

export function InvoiceClient({ initialInvoices, canBayar, userName }: InvoiceClientProps) {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<ResolvedPeriodRange>({ preset: "all", from: "", to: "", label: "Semua Waktu" });
  
  // Payment states inside detail drawer
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [isPending, startTransition] = useTransition();
  const [printFormat, setPrintFormat] = useState<"a4" | "thermal" | null>(null);
  const a4PreviewRef = useRef<HTMLDivElement>(null);

  // Delete states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Selection states
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Lock body scroll when print preview is open
  useEffect(() => {
    if (printFormat) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [printFormat]);

  useEffect(() => {
    if (printFormat !== "a4") return;
    const previewNode = a4PreviewRef.current;
    const fit = () => {
      const el = a4PreviewRef.current;
      if (!el) return;
      el.style.zoom = "1";
      const parent = el.parentElement;
      const naturalW = el.offsetWidth;
      const naturalH = el.offsetHeight;
      const availW = parent ? parent.clientWidth - 2 : window.innerWidth - 32;
      const availH = parent ? parent.clientHeight - 2 : window.innerHeight * 0.82 - 56;
      const z = Math.max(0.32, Math.min(1, availW / naturalW, availH / naturalH));
      el.style.zoom = String(z);
    };
    const timer = window.setTimeout(fit, 80);
    window.addEventListener("resize", fit);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", fit);
      if (previewNode) previewNode.style.zoom = "1";
    };
  }, [printFormat]);

  // Column Visibility States
  const [showProject, setShowProject] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  // Calculate statistics across all invoices
  const stats = useMemo(() => {
    let totalReceivable = 0;
    let totalPaid = 0;
    let pendingCount = 0;

    initialInvoices.forEach((inv) => {
      const sisa = inv.total - inv.totalDibayar;
      totalPaid += inv.totalDibayar;

      if (inv.status === "PAID") return;

      totalReceivable += sisa;
      pendingCount++;
    });

    return { totalReceivable, totalPaid, pendingCount };
  }, [initialInvoices]);

  // Filter invoices dataset
  const filteredInvoices = useMemo(() => {
    // Rentang tanggal (inklusif). from/to = "YYYY-MM-DD"; kosong = terbuka.
    const fromMs = dateRange.from ? new Date(`${dateRange.from}T00:00:00`).getTime() : null;
    const toMs = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`).getTime() : null;

    return initialInvoices.filter((inv) => {
      const matchesSearch =
        inv.noInvoice.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.namaClient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.projectName && inv.projectName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "ALL" ||
        inv.status === statusFilter ||
        (statusFilter === "PENDING" && (inv.status === "PENDING" || inv.status === "PARTIAL"));

      let matchesDate = true;
      if (fromMs !== null || toMs !== null) {
        const t = new Date(inv.tanggal).getTime();
        if (Number.isNaN(t)) matchesDate = false;
        else {
          if (fromMs !== null && t < fromMs) matchesDate = false;
          if (toMs !== null && t > toMs) matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [initialInvoices, searchQuery, statusFilter, dateRange]);

  const invoicePg = usePagination(filteredInvoices, 10);

  // ===== Export Excel (mengikuti filter aktif: pencarian + status) =====
  const [exporting, setExporting] = useState(false);
  const statusLabelMap: Record<string, string> = {
    ALL: "Semua Tagihan",
    PENDING: "Belum Lunas (Pending)",
    PAID: "Lunas (Paid)",
    DRAFT: "Draft",
  };

  async function handleExportExcel() {
    if (exporting) return;
    if (filteredInvoices.length === 0) {
      toast.warning("Tidak ada invoice untuk diekspor pada filter ini.");
      return;
    }
    setExporting(true);
    try {
      const filterParts = [`Status: ${statusLabelMap[statusFilter] ?? statusFilter}`, `Periode: ${dateRange.label}`];
      if (searchQuery.trim()) filterParts.push(`Cari: "${searchQuery.trim()}"`);
      await exportInvoiceExcel({
        userName,
        filterLabel: filterParts.join(" • "),
        invoices: filteredInvoices,
      });
      toast.success("Export Excel berhasil");
    } catch (err) {
      console.error("Export Excel gagal:", err);
      toast.error("Export Excel gagal, silakan coba lagi");
    } finally {
      setExporting(false);
    }
  }

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
      const res = await bayarInvoice(invoice.id, paymentAmount, paymentMethod);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pembayaran sebesar ${formatRupiah(paymentAmount)} berhasil disimpan!`);
      
      // Update selected drawer model locally
      const updatedInvoice = {
        ...invoice,
        totalDibayar: invoice.totalDibayar + paymentAmount,
        status: (invoice.totalDibayar + paymentAmount >= invoice.total) ? "PAID" as const : "PARTIAL" as const,
        payments: (res && "payment" in res && res.payment) ? [res.payment as PaymentRow, ...(invoice.payments || [])] : (invoice.payments || [])
      };
      setSelectedInvoice(updatedInvoice);
      setPaymentAmount(0);
      router.refresh();
    });
  }



  // Handle delete invoice
  function handleDeleteInvoice() {
    if (!selectedInvoice) return;

    startTransition(async () => {
      const res = await deleteInvoice(selectedInvoice.id);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice berhasil dihapus!");
      setIsDeleteConfirmOpen(false);
      setSelectedInvoice(null);
      router.refresh();
    });
  }

  // Handle toggle selection for a single invoice
  function handleToggleSelect(id: number) {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Handle toggle select all on the current page
  function handleToggleSelectAll(currentPageIds: number[]) {
    const allSelected = currentPageIds.every((id) => selectedInvoiceIds.includes(id));
    if (allSelected) {
      setSelectedInvoiceIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedInvoiceIds((prev) => {
        const toAdd = currentPageIds.filter((id) => !prev.includes(id));
        return [...prev, ...toAdd];
      });
    }
  }

  // Handle bulk delete action
  function handleBulkDelete() {
    if (selectedInvoiceIds.length === 0) return;

    startTransition(async () => {
      const res = await deleteInvoices(selectedInvoiceIds);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${selectedInvoiceIds.length} invoice berhasil dihapus!`);
      setSelectedInvoiceIds([]);
      setIsBulkDeleteConfirmOpen(false);
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
      `Kami menginfokan tagihan invoice yang berjalan di PUTRA CORPORATION.\n\n` +
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

  async function handleSaveToImage() {
    const element = document.querySelector<HTMLElement>(".print-area");
    if (!element) {
      toast.error("Elemen cetak tidak ditemukan.");
      return;
    }
    // Pratinjau A4 memakai `zoom` auto-fit agar muat di layar (di mobile bisa
    // ~0.4). Chrome menghitung offsetWidth/scrollWidth mengikuti zoom, sehingga
    // tanpa reset, gambar yang ditangkap ikut mengecil / terpotong di HP.
    // Netralkan zoom ke 1 selama capture lalu kembalikan — hasil PNG jadi
    // beresolusi penuh & identik di desktop maupun mobile.
    const prevZoom = element.style.zoom;
    try {
      toast.info("Sedang mengambil gambar...");
      element.style.zoom = "1";
      void element.offsetWidth; // paksa reflow agar dimensi natural terbaca
      // Ukur tinggi penuh isi (scrollHeight) supaya struk panjang tidak
      // terpotong — wrapper memakai overflow-hidden sehingga box-nya bisa
      // lebih pendek dari konten sebenarnya.
      const fullWidth = element.scrollWidth;
      const fullHeight = element.scrollHeight;
      const imgDataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: fullWidth,
        height: fullHeight,
        cacheBust: true,
        style: { margin: "0", borderRadius: "0", zoom: "1" },
      });
      const link = document.createElement("a");
      const safeName = (selectedInvoice?.namaClient ?? "").replace(/[\\/:*?"<>|]/g, "").trim();
      const thermalSuffix = printFormat === "thermal" ? "-(THERMAL)" : "";
      link.download = `${selectedInvoice?.noInvoice ?? "Invoice"}-${safeName}${thermalSuffix}.png`;
      link.href = imgDataUrl;
      link.click();
      toast.success("Gambar berhasil disimpan!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan gambar.");
    } finally {
      element.style.zoom = prevZoom; // pulihkan zoom auto-fit pratinjau
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. Statistics Row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Total Piutang Aktif", value: formatRupiah(stats.totalReceivable), desc: "Piutang belum terbayar", icon: Wallet, tone: "amber" },
          { label: "Total Pembayaran Diterima", value: formatRupiah(stats.totalPaid), desc: "Lunas/cicilan terkumpul", icon: CheckCircle, tone: "green" },
          { label: "Invoices Pending", value: `${stats.pendingCount} invoice`, desc: "Belum lunas sepenuhnya", icon: Clock, tone: "blue" },
        ].map((card, idx, arr) => {
          const Icon = card.icon;
          const toneColors: Record<string, string> = {
            amber: "bg-amber-50 text-amber-700 border-amber-100",
            green: "bg-primary-50 text-primary-700 border-primary-100",
            blue: "bg-blue-50 text-blue-700 border-blue-100",
          };
          const isLastOdd = idx === arr.length - 1 && arr.length % 2 !== 0;
          return (
            <Card key={card.label} className={cn("flex items-center gap-3 p-4 sm:gap-4 sm:p-5 lg:gap-3 lg:p-4 xl:gap-4 xl:p-5", isLastOdd && "sm:col-span-2 lg:col-span-1")}>
              <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border ${toneColors[card.tone]}`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.3} />
              </div>
              <div className="leading-tight select-none min-w-0 flex-1">
                <p className="text-[10px] lg:text-[9px] xl:text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">{card.label}</p>
                <div data-tooltip={card.value} className="mt-1">
                  <p className="font-extrabold text-foreground font-display text-sm sm:text-base lg:text-sm xl:text-base whitespace-nowrap overflow-hidden text-ellipsis">{card.value}</p>
                </div>
                <p className="text-[10px] lg:text-[9px] xl:text-[10px] text-[var(--text-muted-2)] mt-0.5 truncate" title={card.desc}>{card.desc}</p>
              </div>
            </Card>
          );
        })}
      </section>

      {/* 2. Filter & Actions Toolbar */}
      <Card className="rounded-2xl border border-border/90 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-center lg:gap-3">
          <div className="relative w-full min-w-0 lg:w-[320px] lg:shrink-0 xl:w-[360px]">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted-2)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              maxLength={FIELD_LIMITS.search}
              placeholder="Cari invoice, klien..."
              className="h-11 rounded-2xl pl-11 pr-4"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-nowrap lg:items-center lg:gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 w-full rounded-2xl text-xs font-bold sm:w-[200px] lg:shrink-0"
            >
              <option value="ALL">Semua Tagihan</option>
              <option value="PENDING">Belum Lunas (Pending)</option>
              <option value="PAID">Lunas (Paid)</option>
              <option value="DRAFT">Draft</option>
            </Select>

            <PeriodFilter
              onChange={setDateRange}
              align="right"
              className="w-full sm:w-auto lg:shrink-0"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:ml-auto lg:flex lg:flex-nowrap lg:items-center lg:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="h-11 w-full rounded-2xl px-4 sm:w-auto lg:shrink-0"
            >
              <SlidersHorizontal size={14} /> Kolom
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={exporting}
              className="h-11 w-full rounded-2xl border-primary-200 bg-primary-50 px-4 text-primary-700 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:shrink-0"
            >
              <Download size={14} /> {exporting ? "Mengekspor..." : "Export Excel"}
            </Button>

            {canBayar && selectedInvoiceIds.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="h-11 w-full rounded-2xl bg-red-600 px-4 font-bold text-white hover:bg-red-700 sm:w-auto lg:shrink-0"
              >
                <Trash2 size={14} /> Hapus Terpilih ({selectedInvoiceIds.length})
              </Button>
            )}
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
              <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} className="h-4 w-4 rounded text-[var(--primary)] focus:ring-transparent" />
              Tampilkan Kolom Terbayar
            </label>
          </div>
        )}
      </Card>

      {/* 3. Modern Data Grid Invoice Table */}
      <div className="w-full min-w-0 space-y-3">
        <div className="space-y-3 lg:hidden">
          {invoicePg.pageData.map((inv) => {
            const sisa = inv.total - inv.totalDibayar;
            const isChecked = selectedInvoiceIds.includes(inv.id);

            return (
              <article
                key={inv.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(inv)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-mono text-sm font-extrabold text-foreground break-words">{inv.noInvoice}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--text-muted-2)]">{formatTanggal(inv.tanggal)}</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {canBayar && (
                      <input
                        type="checkbox"
                        aria-label={`Pilih invoice ${inv.noInvoice}`}
                        checked={isChecked}
                        onChange={() => handleToggleSelect(inv.id)}
                        className="h-5 w-5 rounded border-slate-350 text-[var(--primary)] focus:ring-transparent cursor-pointer"
                      />
                    )}
                    {inv.status === "PAID" && <Badge tone="green">Lunas</Badge>}
                    {inv.status === "PARTIAL" && <Badge tone="blue">Partial</Badge>}
                    {inv.status === "PENDING" && <Badge tone="amber">Pending</Badge>}
                    {inv.status === "DRAFT" && <Badge tone="slate">Draft</Badge>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                  <div>
                    <p className="font-bold uppercase tracking-wide text-[var(--text-muted-2)]">Klien</p>
                    <p className="mt-0.5 font-semibold text-foreground break-words">{inv.namaClient}</p>
                  </div>
                  {showProject && (
                    <div>
                      <p className="font-bold uppercase tracking-wide text-[var(--text-muted-2)]">Proyek</p>
                      <p className="mt-0.5 font-semibold text-[var(--text-soft)] break-words">{inv.projectName ?? "Eceran / Umum"}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-[var(--surface-2)] p-3 text-xs">
                  <div>
                    <p className="font-bold uppercase tracking-wide text-[var(--text-muted-2)]">Total</p>
                    <p className="mt-1 font-mono font-extrabold text-foreground break-words">{formatRupiah(inv.total)}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-wide text-[var(--text-muted-2)]">Sisa</p>
                    <p className="mt-1 font-mono font-extrabold text-amber-700 break-words">
                      {sisa > 0 ? formatRupiah(sisa) : <span className="text-green-600">Lunas</span>}
                    </p>
                  </div>
                  {showPaid && (
                    <div className="col-span-2">
                      <p className="font-bold uppercase tracking-wide text-[var(--text-muted-2)]">Telah Dibayar</p>
                      <p className="mt-1 font-mono font-bold text-primary-600 break-words">
                        {inv.totalDibayar > 0 ? formatRupiah(inv.totalDibayar) : "-"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(inv)} className="flex-1">
                    <Eye size={14} /> Detail
                  </Button>
                  {canBayar && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => router.push(`/invoice/edit/${inv.id}`)} className="flex-1">
                        <Pencil size={14} /> Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="flex-1"
                      >
                        <Trash2 size={14} /> Hapus
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}

          {filteredInvoices.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-slate-400 shadow-[var(--shadow-card)]">
              <FileText className="mx-auto mb-2 text-slate-300" size={32} />
              <p className="font-semibold text-sm">Tidak Ada Invoice Terdaftar</p>
              <p className="text-xs">Data tagihan kosong atau tidak cocok dengan pencarian.</p>
            </div>
          )}
        </div>

        <div className="hidden w-full lg:block">
        <Table>
          <thead>
            <tr>
              {canBayar && (
                <Th className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      invoicePg.pageData.length > 0 &&
                      invoicePg.pageData.every((inv) => selectedInvoiceIds.includes(inv.id))
                    }
                    onChange={() => handleToggleSelectAll(invoicePg.pageData.map((inv) => inv.id))}
                    className="h-4 w-4 rounded border-slate-350 text-[var(--primary)] focus:ring-transparent cursor-pointer"
                  />
                </Th>
              )}
              <Th>No. Invoice</Th>
              <Th>Tanggal</Th>
              <Th>Klien / Pelanggan</Th>
              {showProject && <Th>Proyek</Th>}
              <Th className="text-right">Total Tagihan</Th>
              {showPaid && <Th className="text-right">Telah Dibayar</Th>}
              <Th className="text-right">Sisa Piutang</Th>
              <Th className="text-center">Verifikasi</Th>
              <Th className="text-center">Status</Th>
              <Th className="text-center">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {invoicePg.pageData.map((inv) => {
              const sisa = inv.total - inv.totalDibayar;

              return (
                <tr
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className="hover:bg-[var(--surface-hover)] cursor-pointer transition-colors duration-150 group"
                >
                  {canBayar && (
                    <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.includes(inv.id)}
                        onChange={() => handleToggleSelect(inv.id)}
                        className="h-4 w-4 rounded border-slate-350 text-[var(--primary)] focus:ring-transparent cursor-pointer"
                      />
                    </Td>
                  )}
                  <Td className="group-hover:text-[var(--primary)]">
                    <div className="font-mono text-xs font-bold text-foreground">{inv.noInvoice}</div>
                    {inv.noTransaksi && (
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">{inv.noTransaksi}</div>
                    )}
                  </Td>
                  <Td className="text-xs text-[var(--text-muted-2)]">{formatTanggal(inv.tanggal)}</Td>
                  <Td className="font-semibold text-foreground max-w-[200px] truncate">{inv.namaClient}</Td>
                  {showProject && (
                    <Td className="text-xs text-[var(--text-soft)] font-medium">
                      {inv.projectName ?? "Eceran / Umum"}
                    </Td>
                  )}
                  <Td className="text-right font-mono text-xs font-semibold">{formatRupiah(inv.total)}</Td>
                  {showPaid && (
                    <Td className="text-right font-mono text-xs text-primary-600 font-semibold">
                      {inv.totalDibayar > 0 ? formatRupiah(inv.totalDibayar) : "—"}
                    </Td>
                  )}
                  <Td className="text-right font-mono text-xs font-extrabold text-amber-700">
                    {sisa > 0 ? formatRupiah(sisa) : <span className="text-green-600 font-bold">Lunas</span>}
                  </Td>
                  <Td className="text-center select-none" onClick={(e) => e.stopPropagation()}>
                    {(inv.verifCount ?? 0) > 0 ? (
                      <Badge tone="green">{(inv.verifCount ?? 0)}x</Badge>
                    ) : (
                      <Badge tone="slate">—</Badge>
                    )}
                  </Td>
                  <Td className="text-center select-none" onClick={(e) => e.stopPropagation()}>
                    {inv.status === "PAID" && <Badge tone="green">Lunas</Badge>}
                    {inv.status === "PARTIAL" && <Badge tone="blue">Partial</Badge>}
                    {inv.status === "PENDING" && <Badge tone="amber">Pending</Badge>}
                    {inv.status === "DRAFT" && <Badge tone="slate">Draft</Badge>}
                  </Td>
                  <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-border text-[var(--text-soft)] hover:bg-[var(--primary)] hover:text-white transition cursor-pointer"
                        title="Buka detail drawer"
                      >
                        <Eye size={14} />
                      </button>
                      {canBayar && (
                        <>
                          <button
                            onClick={() => {
                              router.push(`/invoice/edit/${inv.id}`);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-transparent transition cursor-pointer"
                            title="Edit Invoice & Barang"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-650 hover:text-white hover:border-transparent transition cursor-pointer"
                            title="Hapus Invoice"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}

            {filteredInvoices.length === 0 && (
              <tr>
                <Td colSpan={11} className="py-16 text-center text-slate-400 select-none">
                  <FileText className="mx-auto text-slate-200 mb-2" size={32} />
                  <p className="font-semibold text-sm">Tidak Ada Invoice Terdaftar</p>
                  <p className="text-xs">Data tagihan kosong atau tidak cocok dengan pencarian.</p>
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        </div>
        <div className="px-1 pb-3 sm:px-4">
          <Pagination page={invoicePg.page} perPage={invoicePg.perPage} total={invoicePg.total} onPage={invoicePg.setPage} onPerPage={invoicePg.setPerPage} />
        </div>
      </div>

      {/* 4. Detail Drawer (700px wide) */}
      <Drawer
        isOpen={selectedInvoice !== null}
        onClose={() => {
          setSelectedInvoice(null);
          setPrintFormat(null);
        }}
        title={selectedInvoice ? `Detail Invoice ${selectedInvoice.noInvoice}` : ""}
        size="medium"
      >
        {selectedInvoice && (
          <div className="space-y-6">
            {/* Document Codes Metadata Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[var(--surface-2)] border border-border p-3.5 rounded-2xl flex items-center justify-between shadow-3xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--surface-3)] text-[var(--text-soft)] rounded-xl">
                    <Hash size={15} />
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold text-[var(--text-muted-2)] uppercase tracking-wider">No. Invoice</span>
                    <p className="font-mono text-xs font-bold text-foreground mt-0.5">{selectedInvoice.noInvoice}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(selectedInvoice.noInvoice, "No. Invoice")}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-[var(--text-muted-2)] hover:bg-[var(--surface-hover)] hover:text-foreground transition shadow-3xs cursor-pointer active:scale-95 shrink-0"
                  title="Salin No. Invoice"
                >
                  <Copy size={12} />
                </button>
              </div>

              {selectedInvoice.noTransaksi ? (
                <div className="bg-[var(--surface-2)] border border-border p-3.5 rounded-2xl flex items-center justify-between shadow-3xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[var(--surface-3)] text-[var(--text-soft)] rounded-xl">
                      <FileText size={15} />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold text-[var(--text-muted-2)] uppercase tracking-wider">No. Transaksi Asli</span>
                      <p className="font-mono text-xs font-bold text-foreground mt-0.5">{selectedInvoice.noTransaksi}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(selectedInvoice.noTransaksi!, "No. Transaksi")}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-[var(--text-muted-2)] hover:bg-[var(--surface-hover)] hover:text-foreground transition shadow-3xs cursor-pointer active:scale-95 shrink-0"
                    title="Salin No. Transaksi"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              ) : (
                <div className="bg-[var(--surface-2)]/70 border border-dashed border-border/80 p-3.5 rounded-2xl flex items-center justify-center text-[var(--text-muted-2)] text-xs shadow-3xs">
                  Tidak Terikat Transaksi Asli
                </div>
              )}
            </div>

            {/* Status & Summary Header */}
            {(() => {
              const sisaTagihan = selectedInvoice.total - selectedInvoice.totalDibayar;
              const isPaid = selectedInvoice.status === "PAID" || sisaTagihan <= 0;
              return (
                <div className={cn(
                  "flex items-center justify-between border p-5 rounded-2xl transition-all shadow-xs",
                  isPaid 
                    ? "bg-[color:rgba(34,197,94,0.14)] border-[color:rgba(134,239,172,0.34)]"
                    : selectedInvoice.status === "PARTIAL"
                    ? "bg-[color:rgba(59,130,246,0.14)] border-[color:rgba(96,165,250,0.34)]"
                    : "bg-[color:rgba(245,158,11,0.14)] border-[color:rgba(251,191,36,0.34)]"
                )}>
                  <div>
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-wide",
                      isPaid
                        ? "text-green-300"
                        : selectedInvoice.status === "PARTIAL"
                        ? "text-blue-300"
                        : "text-amber-300"
                    )}>Status Pembayaran</p>
                    <div className="mt-1.5">
                      {isPaid && <Badge tone="green" className="px-2.5 py-1 font-bold">Lunas</Badge>}
                      {!isPaid && selectedInvoice.status === "PARTIAL" && <Badge tone="blue" className="px-2.5 py-1 font-bold">Cicilan Aktif</Badge>}
                      {!isPaid && selectedInvoice.status === "PENDING" && <Badge tone="amber" className="px-2.5 py-1 font-bold">Pending</Badge>}
                      {!isPaid && selectedInvoice.status === "DRAFT" && <Badge tone="slate" className="px-2.5 py-1 font-bold">Draft</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-wide",
                      isPaid
                        ? "text-green-300"
                        : selectedInvoice.status === "PARTIAL"
                        ? "text-blue-300"
                        : "text-amber-300"
                    )}>Sisa Tagihan</p>
                    <p className={cn(
                      "text-xl font-extrabold font-mono mt-1",
                      isPaid
                        ? "text-green-300"
                        : selectedInvoice.status === "PARTIAL"
                        ? "text-blue-300"
                        : "text-amber-300"
                    )}>
                      {formatRupiah(sisaTagihan)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-9 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs border-border" onClick={() => setPrintFormat("a4")}>
                <Printer size={14} className="stroke-[2]" /> Cetak Faktur
              </Button>
              <Button size="sm" variant="outline" className="h-9 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs border-border" onClick={() => setPrintFormat("thermal")}>
                <Printer size={14} className="stroke-[2]" /> Thermal (80mm)
              </Button>
              <Button size="sm" variant="success" className="h-9 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs bg-primary-600 hover:bg-primary-700 text-white border-transparent" onClick={() => handleSendWhatsApp(selectedInvoice)}>
                <MessageCircle size={14} className="stroke-[2]" /> Kirim WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="h-9 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs border-border" onClick={() => handleCopyLink(selectedInvoice.verifyUrl ?? "")}>
                <Link2 size={14} className="stroke-[2]" /> Salin Link Verifikasi
              </Button>
            </div>

            {/* Instalment payment panel inside drawer */}
            {canBayar && selectedInvoice.total - selectedInvoice.totalDibayar > 0 && (
              <div className="rounded-2xl border border-border bg-[var(--surface-2)] p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                    <DollarSign size={14} className="stroke-[2.5]" />
                  </div>
                  <Label className="mb-0 text-xs font-bold text-foreground">Input Pembayaran Cicilan / Piutang</Label>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-[var(--text-muted-2)] font-mono">Rp</span>
                    <input
                      type="number"
                      min={0}
                      max={FIELD_LIMITS.maxMoney}
                      value={paymentAmount || ""}
                      onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                      placeholder="Nominal cicilan"
                      className="h-10 w-full pl-9 pr-4 rounded-xl border border-border bg-card font-mono font-bold text-xs outline-none transition-all focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10"
                    />
                  </div>
                  <div className="w-full sm:w-36 shrink-0">
                    <Select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "TRANSFER")}
                      className="h-10 text-xs bg-card border border-border rounded-xl w-full"
                    >
                      <option value="CASH">Tunai (Cash)</option>
                      <option value="TRANSFER">Transfer Bank</option>
                    </Select>
                  </div>
                  <Button
                    onClick={() => handlePayInstalment(selectedInvoice)}
                    disabled={isPending || paymentAmount <= 0}
                    className="h-10 shrink-0 text-xs px-5 rounded-xl font-bold bg-primary hover:bg-primary-strong transition-all shadow-xs"
                  >
                    {isPending ? "Proses..." : "Simpan"}
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-[10px] font-semibold text-[var(--text-muted-2)]">Pintas:</span>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedInvoice.total - selectedInvoice.totalDibayar)}
                    className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10px] font-bold text-primary-700 hover:bg-primary-100 transition-all cursor-pointer shadow-2xs"
                  >
                    Bayar Lunas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(1000000)}
                    className="rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-[var(--text-soft)] hover:bg-[var(--surface-hover)] transition-all font-mono cursor-pointer shadow-2xs"
                  >
                    1jt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(5000000)}
                    className="rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-[var(--text-soft)] hover:bg-[var(--surface-hover)] transition-all font-mono cursor-pointer shadow-2xs"
                  >
                    5jt
                  </button>
                </div>
              </div>
            )}

            {/* Payment History Panel */}
            {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex justify-between items-center px-1">
                  <p className="text-[10px] font-extrabold text-[var(--text-muted-2)] uppercase tracking-wider">Riwayat Pembayaran / Cicilan</p>
                  <Badge tone="green" className="text-[9px] px-2 py-0.5 font-bold">{selectedInvoice.payments.length}x Pembayaran</Badge>
                </div>
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
                  {selectedInvoice.payments.map((pay) => (
                    <div key={pay.id} className="flex justify-between items-center p-3.5 hover:bg-[var(--surface-hover)] transition-colors text-xs">
                      <div className="space-y-1">
                        <p className="font-bold text-foreground">{formatTanggal(pay.tanggal)}</p>
                        <p className="text-[10px] text-[var(--text-muted-2)] font-semibold font-mono">ID: #{pay.id}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border shadow-3xs",
                          pay.tipe === "TRANSFER"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : "bg-primary-50 text-primary-700 border-primary-100"
                        )}>
                          {pay.tipe}
                        </span>
                        <p className="font-mono font-extrabold text-foreground text-xs">
                          {formatRupiah(pay.jumlah)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verification Status */}
            <div className="rounded-2xl border border-border p-5 bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold text-[var(--text-muted-2)] uppercase tracking-wider">Verifikasi Invoice</p>
                {(selectedInvoice.verifCount ?? 0) > 0 ? (
                  <Badge tone="green" className="text-[9px] px-2 py-0.5 font-bold">{selectedInvoice.verifCount}x Diverifikasi</Badge>
                ) : (
                  <Badge tone="slate" className="text-[9px] px-2 py-0.5 font-bold">Belum Diverifikasi</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Scan QR code pada faktur untuk verifikasi. Hasil verifikasi tercatat otomatis di audit trail.
              </p>
              {selectedInvoice.verifyUrl && (
                <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-soft)] bg-[var(--surface-2)] rounded-xl p-3 border border-border break-all font-mono shadow-3xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link2 size={13} className="shrink-0 text-[var(--text-muted-2)]" />
                    <span className="truncate">{selectedInvoice.verifyUrl}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(selectedInvoice.verifyUrl ?? "")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-[var(--text-muted-2)] hover:bg-[var(--surface-hover)] hover:text-foreground transition cursor-pointer shrink-0 shadow-3xs active:scale-95"
                    title="Salin Link Verifikasi"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Customer info card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 text-[var(--text-muted-2)]">
                  <User size={13} className="stroke-[2.5]" />
                  <p className="text-[10px] font-extrabold uppercase tracking-wider">Informasi Klien</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-foreground">{selectedInvoice.namaClient}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{selectedInvoice.alamat ?? "Tidak ada alamat tercatat."}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 text-[var(--text-muted-2)]">
                  <Building2 size={13} className="stroke-[2.5]" />
                  <p className="text-[10px] font-extrabold uppercase tracking-wider">Informasi Proyek &amp; WS</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-foreground">{selectedInvoice.projectName ?? "Eceran / Umum"}</p>
                  <p className="text-xs text-slate-500">WS: {selectedInvoice.namaWs ?? "—"}</p>
                  {selectedInvoice.noTransaksi && (
                    <div className="text-[11px] font-semibold text-[var(--text-soft)] mt-3 pt-3 border-t border-dashed border-border/80 flex justify-between items-center">
                      <span>No. Transaksi Asli:</span>
                      <span className="font-mono text-foreground font-extrabold bg-[var(--surface-2)] px-2 py-0.5 rounded-lg border border-border/80 shadow-3xs">{selectedInvoice.noTransaksi}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Line Items */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                  <ShoppingBag size={14} className="stroke-[2.5]" />
                </div>
                <Label className="mb-0 text-xs font-bold text-foreground">Daftar Barang Terbeli</Label>
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th className="h-10 text-[10px] px-4">Barang</Th>
                    <Th className="h-10 text-[10px] text-center px-4">Qty</Th>
                    <Th className="h-10 text-[10px] text-right px-4">Harga</Th>
                    <Th className="h-10 text-[10px] text-right px-4">Subtotal</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedInvoice.items.map((line, idx) => {
                    const isRetur = line.nama.startsWith("[RETUR]");
                    const isGanti = line.nama.startsWith("[GANTI]");
                    const cleanNama = line.nama.replace(/^\[(RETUR|GANTI)\]\s*/, "");

                    return (
                      <tr key={idx} className={cn("hover:bg-[var(--surface-hover)] transition-colors", isRetur && "bg-red-50/8")}>
                        <Td className="h-14 px-4 py-2 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isRetur && <Badge tone="red" className="text-[8px] px-1.5 py-0.25 font-bold">Retur</Badge>}
                              {isGanti && <Badge tone="green" className="text-[8px] px-1.5 py-0.25 font-bold">Pengganti</Badge>}
                              <span className="font-bold text-foreground text-xs">{cleanNama}</span>
                            </div>
                            <span className="font-mono text-[9px] text-[var(--text-muted-2)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded border border-border/80 w-fit mt-1">{line.kode}</span>
                          </div>
                        </Td>
                        <Td className="h-14 px-4 text-center font-mono text-xs text-slate-600 align-middle">{line.qty} unit</Td>
                        <Td className="h-14 px-4 text-right font-mono text-xs text-slate-650 align-middle">{formatRupiah(line.harga)}</Td>
                        <Td className={cn(
                          "h-14 px-4 text-right font-mono text-xs font-extrabold align-middle",
                          isRetur ? "text-red-650" : "text-foreground"
                        )}>
                          {isRetur ? "-" : ""}{formatRupiah(Math.abs(line.subtotal))}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </Drawer>

      {/* Print Document Modal view (portal ke body agar tampil di atas Drawer) */}
      {printFormat && selectedInvoice && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center overscroll-contain bg-black/60 p-3 sm:p-5 backdrop-blur-sm no-print" style={{ zIndex: 2147483001 }} onClick={() => setPrintFormat(null)}>
          <div onClick={(e) => e.stopPropagation()} className={cn("flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-modal)] border border-border anim-rise", printFormat === "a4" ? "max-w-[880px]" : "max-w-md")}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-[var(--surface-2)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary-strong)]">
                  <FileText size={15} />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-sm font-bold text-foreground truncate">
                    {printFormat === "a4" ? "Pratinjau Invoice" : "Pratinjau Struk Thermal"}
                  </p>
                  <p className="font-mono text-[11px] font-semibold text-[var(--primary-strong)]">{selectedInvoice.noInvoice}</p>
                </div>
              </div>
              <button onClick={() => setPrintFormat(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted-2)] hover:bg-[var(--surface-hover)] hover:text-foreground transition cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="print-preview-scroll min-h-0 flex-1 bg-[var(--paper-2)] p-4 sm:p-6 scrollbar-thin">
              {printFormat === "a4" ? (
                <div ref={a4PreviewRef} className="print-area print-a4-preview mx-auto origin-top overflow-visible border border-border bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.18)]">
                  <InvoiceDocument
                    inv={selectedInvoice}
                    qrDataUrl={selectedInvoice.qrDataUrl}
                  />
                </div>
              ) : (
                <div className="print-area mx-auto w-full max-w-[380px] overflow-hidden border border-border bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.18)]">
                  <Nota
                    data={{
                      noInvoice: selectedInvoice.noInvoice,
                      tanggal: selectedInvoice.tanggal,
                      namaClient: selectedInvoice.namaClient,
                      alamat: selectedInvoice.alamat,
                      namaWs: selectedInvoice.namaWs,
                      namaBank: selectedInvoice.namaBank,
                      noRekening: selectedInvoice.noRekening,
                      atasNama: selectedInvoice.atasNama,
                      items: selectedInvoice.items.map((it) => ({
                        kode: it.kode,
                        nama: it.nama,
                        harga: it.harga,
                        qty: it.qty,
                        subtotal: it.subtotal,
                      })),
                      total: selectedInvoice.total,
                      judul: "INVOICE / TAGIHAN",
                      verifyUrl: selectedInvoice.verifyUrl,
                      qrDataUrl: selectedInvoice.qrDataUrl,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-border px-5 py-3.5 bg-[var(--surface-2)]">
              <Button
                onClick={handleSaveToImage}
                variant="outline"
                size="sm"
                className="bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-[var(--primary)] font-bold gap-1.5 rounded-xl cursor-pointer"
              >
                <Camera size={14} /> Save to Image (PNG)
              </Button>
              <div className="flex flex-col sm:flex-row gap-2.5">
              <Button variant="outline" size="sm" onClick={() => setPrintFormat(null)}>Tutup</Button>
              {printFormat === "a4" ? (
                <Button size="sm" onClick={() => {
                  if (selectedInvoice) {
                    const orig = document.title;
                    const safe = selectedInvoice.namaClient.replace(/[\\/:*?"<>|]/g, "").trim();
                    document.title = `${selectedInvoice.noInvoice}-${safe}`;
                    const restore = () => { document.title = orig; window.removeEventListener("focus", restore); };
                    window.addEventListener("focus", restore);
                  }
                  printArea({ className: "print-format-a4" });
                }}>Cetak A4 PDF</Button>
              ) : (
                <Button size="sm" onClick={() => {
                  if (selectedInvoice) {
                    const orig = document.title;
                    const safe = selectedInvoice.namaClient.replace(/[\\/:*?"<>|]/g, "").trim();
                    document.title = `${selectedInvoice.noInvoice}-${safe}-(THERMAL)`;
                    const restore = () => { document.title = orig; window.removeEventListener("focus", restore); };
                    window.addEventListener("focus", restore);
                  }
                  printArea({ thermal: true });
                }}>Cetak Thermal (80mm)</Button>
              )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* Delete Invoice Confirmation Dialog */}
      {selectedInvoice && (
        <ModernDialog
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onConfirm={handleDeleteInvoice}
          title="Hapus Invoice"
          description={`Apakah Anda yakin ingin menghapus invoice ${selectedInvoice.noInvoice}? Semua riwayat cicilan/pembayaran yang terkait dengan invoice ini juga akan terhapus secara permanen.`}
          confirmText={isPending ? "Menghapus..." : "Hapus Permanen"}
          cancelText="Batal"
          variant="danger"
        />
      )}

      {/* Bulk Delete Invoices Confirmation Dialog */}
      <ModernDialog
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Hapus Beberapa Invoice Terpilih"
        description={`Apakah Anda yakin ingin menghapus ${selectedInvoiceIds.length} invoice terpilih? Semua riwayat cicilan/pembayaran yang terkait dengan invoice-invoice tersebut juga akan terhapus secara permanen.`}
        confirmText={isPending ? "Menghapus..." : "Hapus Terpilih"}
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
