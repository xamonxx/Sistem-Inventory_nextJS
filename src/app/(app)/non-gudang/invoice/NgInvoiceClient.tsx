"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Camera,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileText,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Store,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { bayarNgInvoice, updateNgInvoice } from "./actions";
import { Nota, type NotaData } from "@/components/Nota";
import { NETWORK_RETRY_MESSAGE, REPLAYED_MESSAGE, useRequestKey } from "@/lib/requestKey";
import { DatePicker } from "@/components/DatePicker";
import { PeriodFilter, type ResolvedPeriodRange } from "@/components/PeriodFilter";
import { Badge, Button, Card, CurrencyInput, Input, QtyInput, Label, Select, Table, Td, Th } from "@/components/ui";
import { FilterBar, IconAction, PageHeader, Panel, StatCard, StatGrid, StatusDot } from "@/components/page";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { computeNgCart } from "@/lib/ngMargin";
import { printArea, setPdfTitle } from "@/lib/print";
import { formatRupiah, formatTanggal } from "@/lib/utils";

export type NgCatalogItem = {
  id: number;
  nama: string;
  namaToko: string;
  hargaBeli: number;
  hargaJual: number;
};

export type NgInvoiceItem = {
  id: number;
  nama: string;
  namaToko: string;
  hargaBeli: number;
  hargaJual: number;
  qty: number;
  subtotalModal: number;
  subtotalPenjualan: number;
  subtotalProfit: number;
};

export type NgPaymentRow = {
  id: number;
  tanggal: string;
  tipe: "CASH" | "TRANSFER";
  jumlah: number;
  keterangan: string;
};

export type NgInvoiceRow = {
  id: number;
  noInvoice: string;
  tanggal: string;
  status: "PENDING" | "PARTIAL" | "LUNAS";
  namaToko: string;
  jatuhTempo: string | null;
  namaKonsumen: string;
  namaGrup: string;
  alamat: string;
  namaWorkshop: string;
  namaBank: string;
  noRekening: string;
  atasNama: string;
  totalModal: number;
  totalPenjualan: number;
  totalProfit: number;
  margin: number;
  markup: number;
  totalDibayar: number;
  sisa: number;
  items: NgInvoiceItem[];
  payments: NgPaymentRow[];
};

type StatusFilter = "ALL" | "PENDING" | "PARTIAL" | "LUNAS";
const TABLE_PAGE_SIZE = 10;

function localYmd(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isOverdue(row: NgInvoiceRow): boolean {
  if (row.status === "LUNAS" || !row.jatuhTempo) return false;
  return Date.now() > new Date(row.jatuhTempo).getTime();
}

function statusMeta(row: NgInvoiceRow): { label: string; tone: "green" | "amber" | "blue" | "red" } {
  if (row.status === "LUNAS") return { label: "Lunas", tone: "green" };
  if (isOverdue(row)) return { label: "Terlambat", tone: "red" };
  if (row.status === "PARTIAL") return { label: "Sebagian", tone: "blue" };
  return { label: "Tempo", tone: "amber" };
}

function buildNotaData(row: NgInvoiceRow): NotaData {
  const isTransfer = !!(row.namaBank || row.noRekening || row.atasNama);
  return {
    noInvoice: row.noInvoice,
    tanggal: row.tanggal,
    jatuhTempo: row.jatuhTempo,
    namaClient: row.namaKonsumen || "Konsumen",
    alamat: row.alamat,
    namaWs: row.namaWorkshop,
    namaBank: row.namaBank || null,
    noRekening: row.noRekening || null,
    atasNama: row.atasNama || null,
    // Salinan konsumen: HANYA harga jual/penjualan — modal & profit disembunyikan.
    items: row.items.map((it) => ({
      nama: it.nama,
      harga: it.hargaJual,
      qty: it.qty,
      subtotal: it.subtotalPenjualan,
    })),
    total: row.totalPenjualan,
    bayar: row.totalDibayar,
    sisaTagihan: row.sisa,
    judul: "INVOICE NON-GUDANG",
    metodePembayaran: isTransfer ? "Transfer" : "Cash",
    catatan:
      row.status === "LUNAS"
        ? "Pembayaran lunas. Terima kasih atas kepercayaan Anda."
        : `Sisa piutang ${formatRupiah(row.sisa)}${
            row.jatuhTempo ? `, jatuh tempo ${formatTanggal(row.jatuhTempo)}` : ""
          }.`,
  };
}

export function NgInvoiceClient({
  initialInvoices,
  catalog = [],
}: {
  initialInvoices: NgInvoiceRow[];
  catalog?: NgCatalogItem[];
  userName?: string;
}) {
  const [invoices, setInvoices] = useState<NgInvoiceRow[]>(initialInvoices);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [range, setRange] = useState<ResolvedPeriodRange | null>(null);
  const [page, setPage] = useState(1);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [payId, setPayId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [notaId, setNotaId] = useState<number | null>(null);
  const [printFormat, setPrintFormat] = useState<"a4" | "thermal">("a4");

  const detail = useMemo(() => invoices.find((i) => i.id === detailId) ?? null, [invoices, detailId]);
  const payRow = useMemo(() => invoices.find((i) => i.id === payId) ?? null, [invoices, payId]);
  const editRow = useMemo(() => invoices.find((i) => i.id === editId) ?? null, [invoices, editId]);
  const notaRow = useMemo(() => invoices.find((i) => i.id === notaId) ?? null, [invoices, notaId]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return invoices.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (range && range.preset !== "all") {
        const ymd = localYmd(row.tanggal);
        if (range.from && ymd < range.from) return false;
        if (range.to && ymd > range.to) return false;
      }
      if (keyword) {
        const hay = `${row.noInvoice} ${row.namaKonsumen} ${row.namaGrup} ${row.namaToko}`.toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      return true;
    });
  }, [invoices, q, statusFilter, range]);

  const kpi = useMemo(() => {
    let piutang = 0;
    let belumLunas = 0;
    let omzet = 0;
    for (const row of filtered) {
      omzet += row.totalPenjualan;
      if (row.status !== "LUNAS") {
        piutang += row.sisa;
        belumLunas += 1;
      }
    }
    return { piutang, belumLunas, omzet, jumlah: filtered.length };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filtered.slice(start, start + TABLE_PAGE_SIZE);
  }, [filtered, currentPage]);

  function applyPayment(res: {
    status: "PARTIAL" | "LUNAS";
    totalDibayar: number;
    sisa: number;
    payment: NgPaymentRow;
  }) {
    setInvoices((prev) =>
      prev.map((row) =>
        row.id === payId
          ? {
              ...row,
              status: res.status,
              totalDibayar: res.totalDibayar,
              sisa: res.sisa,
              payments: [res.payment, ...row.payments],
            }
          : row
      )
    );
  }

  function openNota(id: number, format: "a4" | "thermal") {
    setPrintFormat(format);
    setNotaId(id);
  }

  async function handleSaveToImage() {
    if (!notaRow) return;
    const element = document.querySelector<HTMLElement>(".print-area");
    if (!element) return;
    const prevZoom = element.style.zoom;
    element.style.zoom = "1";
    const { toPng } = await import("html-to-image");
    toPng(element, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      style: { margin: "0", borderRadius: "0", zoom: "1" },
    })
      .then((imgDataUrl) => {
        const suffix = printFormat === "thermal" ? "-THERMAL" : "";
        const safeName = (notaRow.namaKonsumen || "Konsumen").replace(/[\\/:*?"<>|]/g, "").trim();
        const link = document.createElement("a");
        link.download = `${notaRow.noInvoice}-${safeName}${suffix}.png`;
        link.href = imgDataUrl;
        link.click();
      })
      .catch(() => toast.error("Gagal menyimpan gambar. Coba lagi, atau gunakan tombol Cetak untuk simpan sebagai PDF."))
      .finally(() => {
        element.style.zoom = prevZoom;
      });
  }

  function openPrintPreview() {
    if (!notaRow) return;
    const isThermal = printFormat === "thermal";
    setPdfTitle(notaRow.noInvoice, notaRow.namaKonsumen || "Konsumen", isThermal);
    printArea(isThermal ? { thermal: true } : { className: "print-format-a4" });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Non-Gudang"
        title="Riwayat Invoice & Piutang"
        description="Kelola invoice, pantau sisa piutang, cek margin internal, dan cetak struk."
      />

      <StatGrid>
        <StatCard icon={ReceiptText} tone="slate" label="Invoice" value={String(kpi.jumlah)} hint="Sesuai filter" />
        <StatCard icon={TrendingUp} tone="sky" label="Omzet" value={formatRupiah(kpi.omzet)} hint="Nilai penjualan" />
        <StatCard icon={Wallet} tone="amber" label="Piutang" value={formatRupiah(kpi.piutang)} hint="Belum tertagih" />
        <StatCard
          icon={Clock3}
          tone={kpi.belumLunas > 0 ? "rose" : "emerald"}
          label="Belum Lunas"
          value={String(kpi.belumLunas)}
          hint={kpi.belumLunas > 0 ? "Perlu follow-up" : "Semua lunas"}
        />
      </StatGrid>

      <FilterBar>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[minmax(0,1fr)_200px] xl:grid-cols-[minmax(0,1fr)_220px_auto] xl:items-center">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted-2)]" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              maxLength={FIELD_LIMITS.search}
              placeholder="Cari no. invoice, konsumen, atau toko sumber…"
              aria-label="Cari invoice"
              className="h-10 rounded-xl pl-9 text-[13px] font-medium"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="h-10 w-full rounded-xl px-3.5 text-[13px] font-medium"
            aria-label="Filter status"
          >
            <option value="ALL">Semua status</option>
            <option value="PENDING">Tempo (belum bayar)</option>
            <option value="PARTIAL">Sebagian</option>
            <option value="LUNAS">Lunas</option>
          </Select>
          <div className="md:col-span-2 xl:col-span-1">
            <PeriodFilter
              defaultPreset="all"
              align="right"
              onChange={(nextRange) => {
                setRange(nextRange);
                setPage(1);
              }}
            />
          </div>
        </div>
      </FilterBar>

      <Panel
        title="Daftar Invoice"
        description="Klik nomor invoice untuk margin, pembayaran, edit, atau cetak."
        icon={FileText}
        flush
        action={
          <StatusDot tone={kpi.belumLunas > 0 ? "amber" : "emerald"}>
            {kpi.belumLunas > 0 ? `${kpi.belumLunas} belum lunas` : "Semua lunas"}
          </StatusDot>
        }
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FileText size={26} className="text-[var(--text-muted-2)] opacity-70" />
            <p className="text-sm font-semibold text-foreground">Tidak ada invoice yang cocok</p>
            <p className="text-xs text-[var(--text-muted-2)]">Ubah kata kunci, status, atau periode.</p>
          </div>
        ) : (
          <>
            {/* Di bawah xl: daftar ringkas */}
            <ul className="divide-y divide-border xl:hidden">
              {paginated.map((row) => {
                const meta = statusMeta(row);
                return (
                  <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailId(row.id)}
                          className="tnum cursor-pointer text-sm font-bold text-[var(--primary)] hover:underline dark:text-sky-300"
                        >
                          {row.noInvoice}
                        </button>
                        <StatusDot tone={STATUS_DOT[meta.tone]}>{meta.label}</StatusDot>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{row.namaKonsumen || "Konsumen"}</p>
                      <p className="truncate text-[11px] text-[var(--text-muted-2)]">
                        {formatTanggal(row.tanggal)} · {row.namaToko}
                      </p>
                      <p className="tnum mt-1 text-xs text-[var(--text-soft)]">
                        <span className="font-semibold text-foreground">{formatRupiah(row.totalPenjualan)}</span>
                        {row.sisa > 0 && <span className="text-amber-600 dark:text-amber-300"> · sisa {formatRupiah(row.sisa)}</span>}
                      </p>
                    </div>
                    <RowActions row={row} onDetail={setDetailId} onEdit={setEditId} onNota={openNota} />
                  </li>
                );
              })}
            </ul>

            <div className="hidden xl:block">
              <Table variant="plain" tableClassName="[&_td]:whitespace-nowrap [&_th]:px-4 [&_td]:px-4">
                <thead>
                  <tr>
                    <Th>No. Invoice</Th>
                    <Th>Tanggal</Th>
                    <Th>Konsumen</Th>
                    <Th>Toko Sumber</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Sisa</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => {
                    const meta = statusMeta(row);
                    return (
                      <tr key={row.id}>
                        <Td>
                          <button
                            type="button"
                            onClick={() => setDetailId(row.id)}
                            className="tnum cursor-pointer font-bold text-[var(--primary)] underline-offset-4 hover:underline dark:text-sky-300"
                          >
                            {row.noInvoice}
                          </button>
                        </Td>
                        <Td className="text-xs text-[var(--text-muted-2)]">{formatTanggal(row.tanggal)}</Td>
                        <Td className="max-w-[240px] truncate font-semibold text-foreground" title={row.namaKonsumen}>
                          {row.namaKonsumen || "Konsumen"}
                        </Td>
                        <Td className="text-xs text-[var(--text-soft)]">
                          <span className="inline-flex items-center gap-1.5">
                            <Store size={13} className="text-[var(--text-muted-2)]" />
                            {row.namaToko}
                          </span>
                        </Td>
                        <Td className="tnum text-right font-semibold text-foreground">{formatRupiah(row.totalPenjualan)}</Td>
                        <Td className={row.sisa > 0 ? "tnum text-right text-amber-600 dark:text-amber-300" : "tnum text-right text-[var(--text-muted-2)]"}>
                          {row.sisa > 0 ? formatRupiah(row.sisa) : "–"}
                        </Td>
                        <Td>
                          <StatusDot tone={STATUS_DOT[meta.tone]}>{meta.label}</StatusDot>
                        </Td>
                        <Td className="text-right">
                          <RowActions row={row} onDetail={setDetailId} onEdit={setEditId} onNota={openNota} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}
        {filtered.length > TABLE_PAGE_SIZE && (
          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={TABLE_PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </Panel>

      {/* Detail drawer */}
      {detail && (
        <DetailDrawer
          row={detail}
          onClose={() => setDetailId(null)}
          onPay={() => setPayId(detail.id)}
          onEdit={() => setEditId(detail.id)}
          onPrint={(format) => openNota(detail.id, format)}
        />
      )}

      {/* Payment modal */}
      {payRow && (
        <PaymentModal
          row={payRow}
          onClose={() => setPayId(null)}
          onDone={(res) => {
            applyPayment(res);
            setPayId(null);
          }}
        />
      )}

      {/* Edit modal */}
      {editRow && (
        <EditModal
          row={editRow}
          catalog={catalog}
          onClose={() => setEditId(null)}
          onDone={(updated) => {
            setInvoices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
            setEditId(null);
          }}
        />
      )}

      {/* Nota preview */}
      {notaRow &&
        (() => {
          const notaData = buildNotaData(notaRow);
          const previewIsA4 = printFormat === "a4";
          return (
            <div
              className="fixed inset-0 flex items-start justify-center overflow-hidden bg-slate-900/60 p-2 pt-4 backdrop-blur-sm sm:p-4"
              style={{ zIndex: 2147483002 }}
              onClick={() => setNotaId(null)}
            >
              <div
                className={`flex h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl ${
                  previewIsA4 ? "max-w-[880px]" : "max-w-md"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-[var(--surface-2)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary-strong)]">
                      <FileText size={15} />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <p className="text-sm font-bold leading-snug text-foreground sm:truncate">
                        {previewIsA4 ? "Pratinjau Invoice" : "Pratinjau Struk Thermal"}
                      </p>
                      <p className="font-mono text-[11px] font-semibold text-[var(--primary-strong)]">{notaRow.noInvoice}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={previewIsA4 ? "primary" : "outline"} onClick={() => setPrintFormat("a4")}>
                      A4
                    </Button>
                    <Button size="sm" variant={previewIsA4 ? "outline" : "primary"} onClick={() => setPrintFormat("thermal")}>
                      Thermal
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setNotaId(null)}>
                      Tutup
                    </Button>
                  </div>
                </div>

                <div className="print-preview-scroll min-h-0 flex-1 overflow-auto bg-[var(--paper-2)] p-4 sm:p-6">
                  {previewIsA4 ? (
                    <div className="print-area print-a4-preview mx-auto mb-8 origin-top overflow-visible border border-border bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.18)] [&_.a4-print-layout]:!block [&_.thermal-print-layout]:!hidden">
                      <Nota data={notaData} showKode={false} />
                    </div>
                  ) : (
                    <div className="print-area mx-auto mb-8 w-full max-w-[380px] overflow-hidden border border-border bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.18)]">
                      <Nota data={notaData} showKode={false} />
                    </div>
                  )}
                </div>

                <div
                  className={`grid shrink-0 grid-cols-1 gap-2.5 border-t border-border bg-[var(--surface-2)] px-4 py-3.5 sm:items-center sm:px-5 ${
                    previewIsA4 ? "sm:grid-cols-[1fr_auto]" : ""
                  }`}
                >
                  <Button
                    onClick={handleSaveToImage}
                    variant="outline"
                    size="sm"
                    className="w-full justify-center gap-1.5 rounded-md border-orange-200 bg-orange-50 font-bold text-[var(--primary)] hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 sm:w-auto"
                  >
                    <Camera size={14} /> Simpan sebagai Gambar (PNG)
                  </Button>
                  <div className={`grid gap-2.5 ${previewIsA4 ? "grid-cols-1 sm:grid-cols-[80px_minmax(170px,1fr)]" : "grid-cols-[92px_minmax(0,1fr)]"}`}>
                    <Button variant="outline" size="sm" onClick={() => setNotaId(null)} className="w-full justify-center">
                      Tutup
                    </Button>
                    <Button size="sm" onClick={openPrintPreview} className="w-full justify-center whitespace-nowrap px-3">
                      <Printer size={14} />
                      {previewIsA4 ? "Cetak A4 PDF" : "Cetak Thermal"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((p) => {
    if (totalPages <= 5) return true;
    return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
  });

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="font-medium text-[var(--text-muted-2)]">
        Menampilkan <span className="text-foreground">{start}-{end}</span> dari <span className="text-foreground">{totalItems}</span> data
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="h-8 min-h-8 px-3"
        >
          Sebelumnya
        </Button>
        {pages.map((p, index) => {
          const prev = pages[index - 1];
          const showGap = prev && p - prev > 1;
          return (
            <span key={p} className="inline-flex items-center gap-1.5">
              {showGap && <span className="px-1 font-bold text-[var(--text-muted-2)]">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                className={[
                  "tnum h-8 min-w-8 cursor-pointer rounded-lg px-2 text-xs font-bold transition",
                  p === page
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[var(--text-soft)] hover:bg-[var(--surface-2)] hover:text-foreground",
                ].join(" ")}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            </span>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="h-8 min-h-8 px-3"
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

const STATUS_DOT = { green: "emerald", red: "rose", blue: "sky", amber: "amber" } as const;

function RowActions({
  row,
  onDetail,
  onEdit,
  onNota,
}: {
  row: NgInvoiceRow;
  onDetail: (id: number) => void;
  onEdit: (id: number) => void;
  onNota: (id: number, format: "a4" | "thermal") => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center justify-end gap-0.5">
      <IconAction title="Detail invoice" onClick={(e) => { e.stopPropagation(); onDetail(row.id); }}>
        <FileText size={15} />
      </IconAction>
      <IconAction title="Edit invoice" onClick={(e) => { e.stopPropagation(); onEdit(row.id); }}>
        <Pencil size={15} />
      </IconAction>
      <IconAction title="Struk thermal (80mm)" onClick={(e) => { e.stopPropagation(); onNota(row.id, "thermal"); }}>
        <ReceiptText size={15} />
      </IconAction>
      <IconAction title="Invoice A4" onClick={(e) => { e.stopPropagation(); onNota(row.id, "a4"); }}>
        <Printer size={15} />
      </IconAction>
    </div>
  );
}

function DetailDrawer({
  row,
  onClose,
  onPay,
  onEdit,
  onPrint,
}: {
  row: NgInvoiceRow;
  onClose: () => void;
  onPay: () => void;
  onEdit: () => void;
  onPrint: (format: "a4" | "thermal") => void;
}) {
  const meta = statusMeta(row);
  const belumLunas = row.status !== "LUNAS";
  return (
    <div
      className="anim-backdrop-in fixed inset-0 z-[2147483000] flex justify-end bg-slate-950/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="anim-slide-in-right flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-sky-100 bg-slate-50 shadow-2xl dark:border-sky-900/40 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 px-5 py-5 dark:border-sky-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/45">
          <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs font-black uppercase tracking-wide text-[var(--primary-strong)]">{row.noInvoice}</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">{row.namaKonsumen || "Konsumen"}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2.5 py-1 shadow-sm dark:bg-slate-800/80">
                  <CalendarDays size={12} /> {formatTanggal(row.tanggal)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2.5 py-1 shadow-sm dark:bg-slate-800/80">
                  <Store size={12} /> {row.namaToko}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup detail invoice">
                <X size={16} />
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-4 text-xs shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:bg-slate-900/80 sm:grid-cols-2">
            <Info label="Tanggal" value={formatTanggal(row.tanggal)} />
            <Info label="Toko Sumber" value={row.namaToko} />
            <Info label="Jatuh Tempo" value={row.jatuhTempo ? formatTanggal(row.jatuhTempo) : "-"} />
            <Info label="Workshop" value={row.namaWorkshop || "-"} />
            {row.namaGrup && <Info label="Grup" value={row.namaGrup} />}
            {row.alamat && <Info label="Alamat" value={row.alamat} />}
          </div>

          {/* Items — owner view (dengan margin) */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:bg-slate-900/80">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Rincian Barang & Analisa Margin</p>
              <Badge tone="blue">{row.items.length} item</Badge>
            </div>
            <Table variant="plain" className="rounded-lg border border-border" tableClassName="min-w-[620px]">
              <thead>
                <tr>
                  <Th>Barang</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Modal</Th>
                  <Th className="text-right">Jual</Th>
                  <Th className="text-right">Keuntungan</Th>
                </tr>
              </thead>
              <tbody>
                {row.items.map((it) => (
                  <tr key={it.id}>
                    <Td>
                      <span className="font-semibold text-foreground">{it.nama}</span>
                    </Td>
                    <Td className="text-right font-semibold tabular-nums">{it.qty}</Td>
                    <Td className="whitespace-nowrap text-right font-mono text-slate-500 dark:text-slate-300">{formatRupiah(it.subtotalModal)}</Td>
                    <Td className="whitespace-nowrap text-right font-mono font-semibold">{formatRupiah(it.subtotalPenjualan)}</Td>
                    <Td className="whitespace-nowrap text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(it.subtotalProfit)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Ringkasan margin */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryStat label="Total Modal" value={formatRupiah(row.totalModal)} />
            <SummaryStat label="Total Penjualan" value={formatRupiah(row.totalPenjualan)} />
            <SummaryStat label="Total Keuntungan" value={formatRupiah(row.totalProfit)} accent />
            <SummaryStat label="Margin" value={`${row.margin.toFixed(2)}%`} />
            <SummaryStat label="Markup" value={`${row.markup.toFixed(2)}%`} />
          </div>

          {/* Pembayaran */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:bg-slate-900/80">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Pembayaran</p>
              <div className="text-right text-xs">
                <span className="text-slate-500">Sisa piutang: </span>
                <span className="font-bold text-[#991B1B] dark:text-[#f87171]">
                  {row.sisa > 0 ? formatRupiah(row.sisa) : "Lunas"}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
                <span className="text-slate-500">Telah dibayar</span>
                <span className="font-semibold">{formatRupiah(row.totalDibayar)}</span>
              </div>
              {row.payments.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-400">Belum ada pembayaran.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {row.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div>
                        <span className="font-medium">{formatTanggal(p.tanggal)}</span>
                        <span className="ml-2 text-slate-400">{p.tipe === "TRANSFER" ? "Transfer" : "Cash"}</span>
                        {p.keterangan && <span className="ml-2 text-slate-400">· {p.keterangan}</span>}
                      </div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatRupiah(p.jumlah)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-white px-5 py-3.5 dark:bg-slate-900">
          {belumLunas && (
            <Button size="sm" onClick={onPay} className="gap-1.5">
              <Wallet size={14} /> Catat Pembayaran
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5">
            <Pencil size={14} /> Edit
          </Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onPrint("thermal")}>
              Struk Thermal
            </Button>
            <Button size="sm" variant="outline" onClick={() => onPrint("a4")} className="gap-1.5">
              <Printer size={14} /> Invoice A4
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({
  row,
  onClose,
  onDone,
}: {
  row: NgInvoiceRow;
  onClose: () => void;
  onDone: (res: { status: "PARTIAL" | "LUNAS"; totalDibayar: number; sisa: number; payment: NgPaymentRow }) => void;
}) {
  const [jumlah, setJumlah] = useState<string>(String(row.sisa));
  const [tipe, setTipe] = useState<"CASH" | "TRANSFER">("CASH");
  const [tanggal, setTanggal] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [keterangan, setKeterangan] = useState("");
  const [pending, startTransition] = useTransition();

  const jumlahNum = Number(jumlah) || 0;
  const invalid = jumlahNum <= 0 || jumlahNum > row.sisa;
  const paymentKey = useRequestKey();

  function submit() {
    if (invalid) {
      toast.error(jumlahNum <= 0 ? "Jumlah bayar harus lebih dari 0." : "Jumlah melebihi sisa piutang.");
      return;
    }
    startTransition(async () => {
      // Same key on retry: a payment that already committed is not recorded twice.
      const idempotencyKey = paymentKey.get(`ng-${row.id}`);
      let res: Awaited<ReturnType<typeof bayarNgInvoice>>;
      try {
        res = await bayarNgInvoice({
          invoiceId: row.id,
          jumlah: jumlahNum,
          tipe,
          tanggal,
          keterangan: keterangan || undefined,
          idempotencyKey,
        });
      } catch (err) {
        console.error("bayarNgInvoice gagal:", err);
        toast.error(NETWORK_RETRY_MESSAGE);
        return;
      }
      paymentKey.reset();
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        if (res.replayed) toast.info(REPLAYED_MESSAGE);
        else toast.success(res.status === "LUNAS" ? "Invoice lunas." : "Pembayaran tercatat.");
        onDone({ status: res.status, totalDibayar: res.totalDibayar, sisa: res.sisa, payment: res.payment });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[2147483003] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-sky-100 bg-white shadow-2xl dark:border-sky-900/40 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 px-5 py-4 dark:border-sky-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/45">
          <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-100 text-[var(--primary-strong)] dark:bg-sky-500/10">
                <CircleDollarSign size={21} />
              </div>
              <div>
                <p className="text-base font-black text-foreground">Catat Pembayaran</p>
                <p className="font-mono text-[11px] font-semibold text-[var(--primary-strong)]">{row.noInvoice}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup pembayaran">
              <X size={16} />
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-slate-50 p-3 text-xs dark:bg-slate-950/50">
            <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900">
              <p className="text-slate-500">Total invoice</p>
              <p className="mt-1 font-black text-foreground">{formatRupiah(row.totalPenjualan)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-right shadow-sm dark:bg-amber-400/10">
              <p className="text-slate-500">Sisa Piutang</p>
              <p className="mt-1 font-black text-[#991B1B] dark:text-[#f87171]">{formatRupiah(row.sisa)}</p>
            </div>
          </div>

          <div>
            <Label>Jumlah Bayar</Label>
            <Input
              type="number"
              min={1}
              max={row.sisa}
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              className="h-12 rounded-lg text-lg font-black"
              autoFocus
            />
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => setJumlah(String(row.sisa))}
                className="rounded-md bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-[var(--primary-strong)] transition hover:bg-sky-100 dark:bg-sky-500/10 dark:hover:bg-sky-500/20"
              >
                Lunasi ({formatRupiah(row.sisa)})
              </button>
            </div>
            {invalid && jumlahNum > 0 && (
              <p className="mt-1 text-[11px] font-medium text-red-600">Tidak boleh melebihi sisa piutang.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Metode</Label>
              <Select value={tipe} onChange={(e) => setTipe(e.target.value as "CASH" | "TRANSFER")}>
                <option value="CASH">Cash</option>
                <option value="TRANSFER">Transfer</option>
              </Select>
            </div>
            <div>
              <Label>Tanggal</Label>
              <DatePicker value={tanggal} onChange={setTanggal} />
            </div>
          </div>

          <div>
            <Label>Keterangan (opsional)</Label>
            <Input
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              maxLength={FIELD_LIMITS.keterangan}
              placeholder="Mis. transfer BCA, cicilan ke-2"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-slate-50 px-5 py-3.5 dark:bg-slate-950/60">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" onClick={submit} disabled={pending || invalid} className="gap-1.5">
            <Wallet size={14} /> {pending ? "Menyimpan..." : "Simpan Pembayaran"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type EditLine = {
  key: string;
  produkId: number | null;
  nama: string;
  hargaBeli: number;
  hargaJual: number;
  qty: number;
};

let editLineSeq = 0;
function newLineKey() {
  editLineSeq += 1;
  return `l${editLineSeq}`;
}

function EditModal({
  row,
  catalog,
  onClose,
  onDone,
}: {
  row: NgInvoiceRow;
  catalog: NgCatalogItem[];
  onClose: () => void;
  onDone: (updated: NgInvoiceRow) => void;
}) {
  const [tanggal, setTanggal] = useState(() => localYmd(row.tanggal));
  const [namaKonsumen, setNamaKonsumen] = useState(row.namaKonsumen);
  const [namaGrup, setNamaGrup] = useState(row.namaGrup);
  const [alamat, setAlamat] = useState(row.alamat);
  const [namaWorkshop, setNamaWorkshop] = useState(row.namaWorkshop);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">(
    row.namaBank || row.noRekening || row.atasNama ? "TRANSFER" : "CASH"
  );
  const [namaBank, setNamaBank] = useState(row.namaBank);
  const [noRekening, setNoRekening] = useState(row.noRekening);
  const [atasNama, setAtasNama] = useState(row.atasNama);
  const [lines, setLines] = useState<EditLine[]>(() =>
    row.items.map((it) => ({
      key: newLineKey(),
      produkId: null,
      nama: it.nama,
      hargaBeli: it.hargaBeli,
      hargaJual: it.hargaJual,
      qty: it.qty,
    }))
  );
  const [addPick, setAddPick] = useState("");
  const [pending, startTransition] = useTransition();

  const tokoCatalog = useMemo(() => catalog.filter((c) => c.namaToko === row.namaToko), [catalog, row.namaToko]);

  const computed = useMemo(
    () =>
      computeNgCart(
        lines.map((l) => ({
          produkId: l.produkId ?? undefined,
          nama: l.nama,
          namaToko: row.namaToko,
          hargaBeli: l.hargaBeli,
          hargaJual: l.hargaJual,
          qty: l.qty,
        }))
      ),
    [lines, row.namaToko]
  );

  const belowPaid = computed.totalPenjualan < row.totalDibayar;
  const hasInvalidLine = lines.some((l) => !l.nama.trim() || l.qty < 1 || l.hargaJual < l.hargaBeli);
  const canSave = lines.length > 0 && !belowPaid && !hasInvalidLine;

  function patchLine(key: string, patch: Partial<EditLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }
  function addManualLine() {
    setLines((prev) => [...prev, { key: newLineKey(), produkId: null, nama: "", hargaBeli: 0, hargaJual: 0, qty: 1 }]);
  }
  function addFromCatalog(idStr: string) {
    const id = Number(idStr);
    const found = tokoCatalog.find((c) => c.id === id);
    if (!found) return;
    setLines((prev) => [
      ...prev,
      { key: newLineKey(), produkId: found.id, nama: found.nama, hargaBeli: found.hargaBeli, hargaJual: found.hargaJual, qty: 1 },
    ]);
    setAddPick("");
  }

  function submit() {
    if (paymentMethod === "TRANSFER" && !(namaBank.trim() && noRekening.trim() && atasNama.trim())) {
      toast.error("Info bank wajib diisi untuk metode transfer.");
      return;
    }
    if (belowPaid) {
      toast.error("Total invoice tidak boleh lebih kecil dari yang sudah dibayar.");
      return;
    }
    if (!canSave) {
      toast.error("Periksa kembali barang: nama, jumlah, dan harga jual ≥ harga beli.");
      return;
    }
    startTransition(async () => {
      const res = await updateNgInvoice({
        invoiceId: row.id,
        tanggal,
        namaKonsumen,
        namaGrup,
        alamat,
        namaWorkshop,
        paymentMethod,
        namaBank,
        noRekening,
        atasNama,
        items: lines.map((l) => ({
          produkId: l.produkId,
          nama: l.nama,
          hargaBeli: l.hargaBeli,
          hargaJual: l.hargaJual,
          qty: l.qty,
        })),
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        toast.success("Invoice diperbarui.");
        onDone(res.row);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[2147483004] flex items-start justify-center overflow-hidden bg-slate-950/60 p-2 pt-4 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-sky-100 bg-slate-50 shadow-2xl dark:border-sky-900/40 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 items-center justify-between overflow-hidden border-b border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 px-5 py-4 dark:border-sky-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/45">
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10" />
          <div>
            <p className="relative text-base font-black text-foreground">Edit Invoice Non-Gudang</p>
            <p className="font-mono text-[11px] font-semibold text-[var(--primary-strong)]">
              {row.noInvoice} · {row.namaToko}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="relative" aria-label="Tutup edit invoice">
            <X size={16} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4 md:p-5">
          {row.totalDibayar > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Invoice ini sudah dibayar <strong>{formatRupiah(row.totalDibayar)}</strong>. Total baru tidak boleh lebih
                kecil dari nilai tersebut. Toko sumber tidak dapat diubah.
              </span>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:bg-slate-900/80 sm:grid-cols-2">
            <div>
              <Label>Tanggal</Label>
              <DatePicker value={tanggal} onChange={setTanggal} />
            </div>
            <div>
              <Label>Nama Konsumen</Label>
              <Input value={namaKonsumen} onChange={(e) => setNamaKonsumen(e.target.value)} maxLength={FIELD_LIMITS.namaClient} />
            </div>
            <div>
              <Label>Nama Grup</Label>
              <Input value={namaGrup} onChange={(e) => setNamaGrup(e.target.value)} maxLength={FIELD_LIMITS.projectGroupNama} />
            </div>
            <div>
              <Label>Nama Workshop</Label>
              <Input value={namaWorkshop} onChange={(e) => setNamaWorkshop(e.target.value)} maxLength={FIELD_LIMITS.namaWs} />
            </div>
            <div className="sm:col-span-2">
              <Label>Alamat</Label>
              <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} maxLength={FIELD_LIMITS.alamat} />
            </div>
          </div>

          {/* Pembayaran */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:bg-slate-900/80 sm:grid-cols-2">
            <div>
              <Label>Metode Pembayaran</Label>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "TRANSFER")}>
                <option value="CASH">Cash</option>
                <option value="TRANSFER">Transfer</option>
              </Select>
            </div>
            {paymentMethod === "TRANSFER" && (
              <>
                <div>
                  <Label>Nama Bank</Label>
                  <Input value={namaBank} onChange={(e) => setNamaBank(e.target.value)} maxLength={FIELD_LIMITS.namaBank} />
                </div>
                <div>
                  <Label>No. Rekening</Label>
                  <Input value={noRekening} onChange={(e) => setNoRekening(e.target.value)} maxLength={FIELD_LIMITS.noRekening} />
                </div>
                <div>
                  <Label>Atas Nama</Label>
                  <Input value={atasNama} onChange={(e) => setAtasNama(e.target.value)} maxLength={FIELD_LIMITS.atasNama} />
                </div>
              </>
            )}
          </div>

          {/* Rincian barang */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:bg-slate-900/80">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-foreground">Rincian Barang</p>
                <p className="text-xs text-slate-500">Edit qty dan harga, atau tambahkan barang dari katalog toko yang sama.</p>
              </div>
              <div className="flex items-center gap-2">
                {tokoCatalog.length > 0 && (
                  <Select value={addPick} onChange={(e) => addFromCatalog(e.target.value)} className="h-8 w-44 text-xs">
                    <option value="">+ Dari katalog...</option>
                    {tokoCatalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama}
                      </option>
                    ))}
                  </Select>
                )}
                <Button size="sm" variant="outline" onClick={addManualLine} className="h-8 gap-1 px-2.5 text-xs">
                  <Plus size={13} /> Manual
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {lines.map((l) => {
                const profit = Math.round(l.hargaJual * l.qty) - Math.round(l.hargaBeli * l.qty);
                return (
                  <div key={l.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-200 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-sky-900">
                    <div className="flex items-start gap-2">
                      <Input
                        value={l.nama}
                        onChange={(e) => patchLine(l.key, { nama: e.target.value })}
                        maxLength={FIELD_LIMITS.namaBarang}
                        placeholder="Nama barang"
                        className="h-10 flex-1 rounded-md bg-white text-sm font-bold dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="mt-1 text-slate-400 hover:text-red-500"
                        aria-label="Hapus barang"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="text-[10px] font-semibold uppercase text-slate-400">
                        Qty
                        <QtyInput
                          max={FIELD_LIMITS.maxQty}
                          value={l.qty}
                          onCommit={(n) => patchLine(l.key, { qty: n })}
                          className="mt-0.5 h-10 rounded-md bg-white text-sm font-bold dark:bg-slate-900"
                        />
                      </label>
                      <label className="text-[10px] font-semibold uppercase text-slate-400">
                        Harga Beli
                        <CurrencyInput
                          max={FIELD_LIMITS.maxMoney}
                          value={l.hargaBeli}
                          onValueChange={(value) => patchLine(l.key, { hargaBeli: Math.max(0, Number(value) || 0) })}
                          className="mt-0.5 h-10 rounded-md bg-white text-sm font-bold dark:bg-slate-900"
                        />
                      </label>
                      <label className="text-[10px] font-semibold uppercase text-slate-400">
                        Harga Jual
                        <CurrencyInput
                          max={FIELD_LIMITS.maxMoney}
                          value={l.hargaJual}
                          onValueChange={(value) => patchLine(l.key, { hargaJual: Math.max(0, Number(value) || 0) })}
                          className={`mt-0.5 h-10 rounded-md bg-white text-sm font-bold dark:bg-slate-900 ${l.hargaJual < l.hargaBeli ? "border-red-400" : ""}`}
                        />
                      </label>
                    </div>
                    <div className="mt-1.5 text-right text-[11px] text-slate-500">
                      Subtotal jual{" "}
                      <span className="font-semibold text-foreground">{formatRupiah(Math.round(l.hargaJual * l.qty))}</span>
                      {" · "}profit{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatRupiah(profit)}</span>
                    </div>
                  </div>
                );
              })}
              {lines.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Tambah minimal 1 barang.</p>}
            </div>
          </div>

          {/* Ringkasan live */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-xs dark:border-sky-900/40 dark:bg-sky-950/20 sm:grid-cols-4">
            <div>
              <p className="text-slate-500">Total Modal</p>
              <p className="font-bold">{formatRupiah(computed.totalModal)}</p>
            </div>
            <div>
              <p className="text-slate-500">Total Penjualan</p>
              <p className="font-bold">{formatRupiah(computed.totalPenjualan)}</p>
            </div>
            <div>
              <p className="text-slate-500">Total Keuntungan</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(computed.totalProfit)}</p>
            </div>
            <div>
              <p className="text-slate-500">Margin</p>
              <p className="font-bold">{computed.margin.toFixed(2)}%</p>
            </div>
          </div>
          {belowPaid && (
            <p className="text-xs font-semibold text-red-600">
              Total penjualan ({formatRupiah(computed.totalPenjualan)}) lebih kecil dari yang sudah dibayar (
              {formatRupiah(row.totalDibayar)}).
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-white px-5 py-3.5 dark:bg-slate-900">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" onClick={submit} disabled={pending || !canSave} className="gap-1.5">
            <Pencil size={14} /> {pending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${accent ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
