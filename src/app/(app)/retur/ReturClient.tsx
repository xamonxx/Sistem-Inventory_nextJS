"use client";

import { Fragment, useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createReturn, findTransactionByCode } from "./actions";
import { Button, Card, Input, QtyInput, Label, Select, Table, Th, Td, CharCounter } from "@/components/ui";
import { Pagination, usePagination } from "@/components/Pagination";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { formatRupiah } from "@/lib/utils";
import {
  Search,
  Printer,
  MessageCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  Minus,
  Plus,
  FileText,
  Check,
  ArrowRight,
  ArrowLeft,
  ReceiptText,
  PackageSearch,
  Repeat2,
  Wallet,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { Nota, type NotaData } from "@/components/Nota";
import { printArea } from "@/lib/print";
import { toast } from "sonner";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

type ItemOption = { id: number; kode: string; nama: string; hargaJual: number };
type OriginalItem = { transactionItemId: number; itemId: number; nama: string; kode: string; qty: number; alreadyReturned: number; availableForReturn: number; harga: number };
type SelectedReturn = { transactionItemId: number; itemId: number; qty: number; harga: number; nama: string; kode: string };
type SelectedReplacement = { itemId: number; qty: number; harga: number; nama: string; kode: string };

export function ReturClient({
  items,
  transactions = [],
}: {
  items: ItemOption[];
  transactions?: { noTransaksi: string; namaClient: string | null }[];
}) {
  const router = useRouter();

  // Stepper State (1, 2, 3, 4)
  const [step, setStep] = useState(1);
  const [tipe, setTipe] = useState<"RETUR" | "TUKAR">("TUKAR");

  // Step 1: Find transaction
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [origTrx, setOrigTrx] = useState<{
    id: number;
    noTransaksi: string;
    namaClient: string;
    alamat: string;
    namaWs: string;
    items: OriginalItem[];
  } | null>(null);

  // Suggestions state & auto-suggest logic
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = useMemo(() => {
    const query = searchCode.trim().toLowerCase();
    if (!query) return [];
    return transactions
      .filter(
        (tx) =>
          tx.noTransaksi.toLowerCase().includes(query) ||
          (tx.namaClient && tx.namaClient.toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [searchCode, transactions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Step 2: Return select
  const [retItems, setRetItems] = useState<SelectedReturn[]>([]);
  const [retItemQuery, setRetItemQuery] = useState("");
  const [alasan, setAlasan] = useState("");

  // Step 3: Replacement select
  const [repItems, setRepItems] = useState<SelectedReplacement[]>([]);
  const [repQuery, setRepQuery] = useState("");

  // Step 4: Settlement
  const [error, setError] = useState("");
  const [nota, setNota] = useState<NotaData | null>(null);
  const [waOpen, setWaOpen] = useState(false);
  const [pending, start] = useTransition();

  // Search catalog for replacement B
  const repFiltered = useMemo(() => {
    if (!repQuery.trim()) return [];
    const s = repQuery.toLowerCase();
    return items.filter((i) => i.nama.toLowerCase().includes(s) || i.kode.toLowerCase().includes(s)).slice(0, 6);
  }, [repQuery, items]);

  // Action: step 1 search original invoice
  async function handleFindTrx() {
    if (!searchCode.trim()) return toast.error("Ketik nomor transaksi");
    setSearching(true);
    try {
      const res = await findTransactionByCode(searchCode.trim());
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        setOrigTrx(null);
      } else if (res && "ok" in res) {
        toast.success("Transaksi asli ditemukan");
        setOrigTrx({
          id: res.id!,
          noTransaksi: res.noTransaksi!,
          namaClient: res.namaClient!,
          alamat: res.alamat!,
          namaWs: res.namaWs!,
          items: res.items!,
        });
        setRetItems([]);
        setRetItemQuery("");
        setStep(2);
      }
    } catch {
      toast.error("Gagal mencari transaksi. Periksa koneksi lalu coba lagi, atau pastikan nomor transaksi/invoice sudah benar.");
    } finally {
      setSearching(false);
    }
  }

  // Helper to add item to returns
  function toggleReturnItem(item: OriginalItem, isChecked: boolean) {
    if (isChecked) {
      setRetItems((prev) => [
        ...prev,
        { transactionItemId: item.transactionItemId, itemId: item.itemId, qty: 1, harga: item.harga, nama: item.nama, kode: item.kode },
      ]);
    } else {
      setRetItems((prev) => prev.filter((x) => x.transactionItemId !== item.transactionItemId));
    }
  }

  function updateReturnQty(transactionItemId: number, qty: number, maxQty: number) {
    if (qty > maxQty) {
      toast.warning(`Jumlah retur tidak boleh melebihi jumlah beli (${maxQty})`);
      qty = maxQty;
    }
    setRetItems((prev) => prev.map((x) => (x.transactionItemId === transactionItemId ? { ...x, qty: Math.max(1, qty) } : x)));
  }

  // Helper to add items to replacement B
  function addRepItem(item: ItemOption) {
    setRepItems((prev) => {
      const ex = prev.find((x) => x.itemId === item.id);
      if (ex) return prev.map((x) => (x.itemId === item.id ? { ...x, qty: x.qty + 1 } : x));
      return [...prev, { itemId: item.id, qty: 1, harga: item.hargaJual, nama: item.nama, kode: item.kode }];
    });
    setRepQuery("");
    toast.success(`${item.nama} ditambahkan sebagai pengganti`);
  }

  function updateRepQty(itemId: number, qty: number) {
    setRepItems((prev) => prev.map((x) => (x.itemId === itemId ? { ...x, qty: Math.max(1, qty) } : x)));
  }

  function removeRepItem(itemId: number) {
    setRepItems((prev) => prev.filter((x) => x.itemId !== itemId));
  }

  async function handleSaveToImage() {
    const element = document.querySelector<HTMLElement>(".print-area");
    if (!element) {
      toast.error("Pratinjau nota belum siap. Tutup lalu buka lagi pratinjau, kemudian coba cetak/simpan ulang.");
      return;
    }
    try {
      toast.info("Sedang mengambil gambar...");
      // Ukur tinggi penuh isi (scrollHeight) supaya struk panjang tidak
      // terpotong — wrapper memakai overflow-hidden.
      const { toPng } = await import("html-to-image");
      const imgDataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: element.scrollWidth,
        height: element.scrollHeight,
        cacheBust: true,
        style: { margin: "0", borderRadius: "0" },
      });
      const link = document.createElement("a");
      link.download = `Nota-Retur-${nota?.noReturn ?? "Transaksi"}.png`;
      link.href = imgDataUrl;
      link.click();
      toast.success("Gambar berhasil disimpan!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan gambar. Coba lagi, atau gunakan tombol Cetak untuk simpan sebagai PDF.");
    }
  }

  // Calculations
  const totalRetur = retItems.reduce((acc, x) => acc + x.harga * x.qty, 0);
  const totalGanti = repItems.reduce((acc, x) => acc + x.harga * x.qty, 0);
  const selisih = totalGanti - totalRetur; // positive: customer pays; negative: refund customer

  // Ringkasan untuk langkah penyelesaian
  const jumlahRetur = retItems.reduce((acc, x) => acc + x.qty, 0);
  const jumlahGanti = repItems.reduce((acc, x) => acc + x.qty, 0);
  const adaPengganti = tipe === "TUKAR" && repItems.length > 0;
  const hasilSelisih: "TAGIHAN" | "REFUND" | "PAS" = selisih > 0 ? "TAGIHAN" : selisih < 0 ? "REFUND" : "PAS";
  // Nilai pengganti jauh melebihi barang yang dikembalikan: kemungkinan salah ketik jumlah/barang.
  const nilaiJanggal = adaPengganti && totalRetur > 0 && totalGanti >= 1_000_000 && totalGanti > totalRetur * 20;

  const returnItems = useMemo(() => origTrx?.items ?? [], [origTrx?.items]);
  const showReturnItemTools = returnItems.length > 5;
  const filteredReturnItems = useMemo(() => {
    const query = retItemQuery.trim().toLowerCase();
    if (!query) return returnItems;
    return returnItems.filter((it) => it.nama.toLowerCase().includes(query) || it.kode.toLowerCase().includes(query));
  }, [returnItems, retItemQuery]);
  const {
    page: returnPage,
    setPage: setReturnPage,
    pageData: pagedReturnItems,
    perPage: returnPerPage,
    total: totalFilteredReturnItems,
  } = usePagination(filteredReturnItems, 5);

  // Submit action
  function submitReturnExchange() {
    setError("");
    if (retItems.length === 0) return toast.error("Pilih barang yang diretur terlebih dahulu.");
    if (tipe === "TUKAR" && repItems.length === 0) return toast.error("Pilih barang pengganti terlebih dahulu.");

    start(async () => {
      const res = await createReturn({
        tipe,
        transactionId: origTrx!.id,
        returnItems: retItems.map((ri) => ({
          transactionItemId: ri.transactionItemId,
          itemId: ri.itemId,
          qtyReturned: ri.qty,
          hargaSnapshot: ri.harga,
          namaSnapshot: ri.nama,
        })),
        replacementItems: repItems.map((ri) => ({
          itemId: ri.itemId,
          qtyReplacement: ri.qty,
        })),
        alasan,
        namaClient: origTrx?.namaClient ?? "",
        alamat: origTrx?.alamat ?? "",
        namaWs: origTrx?.namaWs ?? "",
      });

      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return setError(res.error);
      }

      if (res && "ok" in res) {
        toast.success("Transaksi retur/tukar berhasil disimpan!");
        const lines: { kode?: string; nama: string; harga: number; qty: number; subtotal: number }[] = [];
        for (const ri of retItems) {
          lines.push({
            kode: ri.kode,
            nama: `[RETUR] ${ri.nama}`,
            harga: ri.harga,
            qty: ri.qty,
            subtotal: -(ri.harga * ri.qty),
          });
        }
        for (const ri of repItems) {
          lines.push({
            kode: ri.kode,
            nama: `[GANTI] ${ri.nama}`,
            harga: ri.harga,
            qty: ri.qty,
            subtotal: ri.harga * ri.qty,
          });
        }

        const selisihVal = res.selisih as number;

        setNota({
          noReturn: res.noReturn,
          noInvoice: res.invoiceNo ?? null,
          verifyUrl: res.verifyUrl ?? null,
          tanggal: new Date().toISOString(),
          namaClient: origTrx?.namaClient ?? "",
          alamat: origTrx?.alamat ?? "",
          namaWs: origTrx?.namaWs ?? "",
          items: lines,
          total: selisihVal,
          judul: tipe === "TUKAR" ? "NOTA TUKAR BARANG" : "NOTA RETUR BARANG",
          catatan:
            selisihVal > 0
              ? `Selisih yang ditagihkan: ${formatRupiah(selisihVal)}`
              : selisihVal < 0
              ? `Uang dikembalikan ke pelanggan: ${formatRupiah(Math.abs(selisihVal))}`
              : "Tidak ada selisih.",
        });

        // Reset state
        setOrigTrx(null);
        setRetItems([]);
        setRepItems([]);
        setAlasan("");
        setSearchCode("");
        setStep(1);
        router.refresh();
      }
    });
  }

  function handleSendWA() {
    if (nota) setWaOpen(true);
  }

  function sendWA(no: string) {
    if (!nota) return;

    const pesan =
      `Halo,\n` +
      `Berikut rincian nota Retur/Tukar barang Anda.\n\n` +
      `Nomor Retur : ${nota.noReturn}\n` +
      `Total Retur : ${formatRupiah(totalRetur)}\n` +
      (tipe === "TUKAR" ? `Total Pengganti: ${formatRupiah(totalGanti)}\n` : "") +
      `Selisih     : ${formatRupiah(selisih)}\n` +
      `Keterangan  : ${selisih > 0 ? "Selisih ditagihkan ke pelanggan" : selisih < 0 ? "Refund oleh toko" : "Selesai"}\n\n` +
      `Terima kasih.`;

    window.open(`https://wa.me/${no}?text=${encodeURIComponent(pesan)}`, "_blank");
  }

  // ===== Visual stepper definition (RETUR melompati langkah pengganti) =====
  const stepDefs =
    tipe === "TUKAR"
      ? [
          { n: 1, label: "Cari Transaksi", Icon: ReceiptText },
          { n: 2, label: "Barang Diretur", Icon: PackageSearch },
          { n: 3, label: "Barang Pengganti", Icon: Repeat2 },
          { n: 4, label: "Penyelesaian", Icon: Wallet },
        ]
      : [
          { n: 1, label: "Cari Transaksi", Icon: ReceiptText },
          { n: 2, label: "Barang Diretur", Icon: PackageSearch },
          { n: 4, label: "Penyelesaian", Icon: Wallet },
        ];
  const currentIdx = Math.max(0, stepDefs.findIndex((s) => s.n === step));

  return (
    <div className="space-y-6">
      {/* ============ PROGRESS STEPPER (redesain) ============ */}
      <div className="overflow-hidden rounded-[20px] border border-border bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-[var(--shadow-card)] dark:from-card dark:to-card sm:p-6">
        <div className="flex min-w-0 items-start">
          {stepDefs.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <Fragment key={s.n}>
                <div className="flex min-w-0 flex-1 shrink flex-col items-center gap-2 sm:w-28">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300 ${
                      active
                        ? "scale-110 bg-[var(--primary)] text-white shadow-lg shadow-primary-200/60 dark:shadow-primary-500/20 ring-4 ring-primary-100 dark:ring-primary-500/20"
                        : done
                        ? "bg-primary-500 text-white shadow-sm"
                        : "border-2 border-border bg-card text-slate-400"
                    }`}
                  >
                    {done ? <Check size={20} /> : <s.Icon size={19} />}
                  </div>
                  <span
                    className={`max-w-full break-words text-center text-[9px] leading-tight sm:text-[11px] ${
                      active ? "font-bold text-[var(--primary)]" : done ? "font-semibold text-primary-600" : "font-semibold text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < stepDefs.length - 1 && (
                  <div
                    className={`mt-5 h-1 flex-1 rounded-full transition-all duration-500 ${
                      i < currentIdx ? "bg-[var(--primary)]" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* ============ STEP 1: Cari transaksi ============ */}
      {step === 1 && (
        <Card className="mx-auto max-w-lg p-0 overflow-visible">
          <div className="flex items-center gap-3 border-b border-border bg-slate-50/60 dark:bg-slate-900/40 px-6 py-5 rounded-t-[17px]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <ReceiptText size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Cari Penjualan Asli</h2>
              <p className="text-xs text-slate-500">Masukkan kode nota untuk memverifikasi item yang diretur.</p>
            </div>
          </div>

          <div className="space-y-5 p-6">

            <div className="relative" ref={suggestionRef}>
              <Label>Nomor Transaksi Asli (PCxxxxx) atau Nomor Invoice (INV-xxxxx)</Label>
              <div className="relative">
                <Search size={18} className="pointer-events-none absolute left-3.5 top-3 z-10 text-[var(--text-soft)]" />
                <Input
                  value={searchCode}
                  maxLength={40}
                  onChange={(e) => {
                    setSearchCode(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFindTrx();
                  }}
                  placeholder="Kode transaksi atau nama pelanggan"
                  className="h-11 pl-10"
                />
              </div>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg">
                  {filteredSuggestions.map((tx) => (
                    <button
                      key={tx.noTransaksi}
                      type="button"
                      onClick={() => {
                        setSearchCode(tx.noTransaksi);
                        setShowSuggestions(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-foreground cursor-pointer select-none"
                    >
                      <span className="font-mono text-foreground">{tx.noTransaksi}</span>
                      {tx.namaClient && (
                        <span className="max-w-[150px] truncate text-[10px] text-slate-500">{tx.namaClient}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleFindTrx} disabled={searching} className="h-11 w-full font-semibold">
              {searching ? "Mencari Transaksi..." : "Cari Transaksi"}
              {!searching && <ArrowRight size={16} />}
            </Button>
          </div>
        </Card>
      )}

      {/* ============ STEP 2: Barang diretur ============ */}
      {step === 2 && origTrx && (
        <Card className="space-y-5 overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-border bg-slate-50/60 dark:bg-slate-900/40 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <PackageSearch size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Pilih Barang Retur</h2>
                <p className="text-xs text-slate-500">Centang dan tentukan kuantitas barang yang dikembalikan.</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-slate-500">
              Nota: <span className="font-mono text-foreground">{origTrx.noTransaksi}</span> &middot;{" "}
              {origTrx.namaClient || "Pelanggan Umum"}
            </div>
          </div>

          <div className="space-y-5 px-6 pb-6">
            {showReturnItemTools && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-slate-50/70 dark:bg-slate-900/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Pencarian Barang Retur</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-muted">
                    {totalFilteredReturnItems} dari {returnItems.length} barang nota ditampilkan.
                  </p>
                </div>
                <div className="relative w-full sm:max-w-sm">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[var(--text-soft)]" />
                  <Input
                    value={retItemQuery}
                    onChange={(e) => {
                      setRetItemQuery(e.target.value);
                      setReturnPage(1);
                    }}
                    maxLength={FIELD_LIMITS.search}
                    placeholder="Cari nama atau kode barang"
                    className="h-10 pl-10 text-xs"
                  />
                </div>
              </div>
            )}

            <Table>
              <thead>
                <tr>
                  <Th className="w-12 text-center">Pilih</Th>
                  <Th>Barang</Th>
                  <Th className="text-right">Harga Nota</Th>
                  <Th className="w-28 text-center">Jumlah Beli</Th>
                  <Th className="w-36 text-center">Jumlah Diretur</Th>
                  <Th className="text-right">Total Nilai</Th>
                </tr>
              </thead>
              <tbody>
                {pagedReturnItems.map((it) => {
                  const isSelected = retItems.some((x) => x.transactionItemId === it.transactionItemId);
                  const selected = retItems.find((x) => x.transactionItemId === it.transactionItemId);
                  return (
                    <tr key={it.transactionItemId} className={isSelected ? "bg-[var(--primary)]/5" : ""}>
                      <Td className="text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleReturnItem(it, e.target.checked)}
                          disabled={it.availableForReturn <= 0}
                          className="h-4.5 w-4.5 rounded border-border text-[var(--primary)] focus:ring-transparent cursor-pointer"
                        />
                      </Td>
                      <Td>
                        <div className="text-sm font-bold text-foreground">{it.nama}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">{it.kode}</div>
                      </Td>
                      <Td className="text-right font-mono text-xs">{formatRupiah(it.harga)}</Td>
                      <Td className="text-center font-mono text-xs font-semibold">{it.qty} unit</Td>
                      <Td>
                        {isSelected && selected ? (
                          <QtyInput
                            max={it.availableForReturn}
                            value={selected.qty}
                            onCommit={(n) => updateReturnQty(it.transactionItemId, n, it.availableForReturn)}
                            className="h-9 text-center font-mono font-semibold"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">
                            {it.availableForReturn <= 0 ? "(habis)" : "—"}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right font-mono text-xs font-bold">
                        {isSelected && selected ? formatRupiah(selected.harga * selected.qty) : "—"}
                      </Td>
                    </tr>
                  );
                })}
                {pagedReturnItems.length === 0 && (
                  <tr>
                    <Td colSpan={6} className="py-12 text-center text-slate-400 select-none">
                      Barang tidak ditemukan. Coba kata kunci lain.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>

            {showReturnItemTools && (
              <Pagination
                page={returnPage}
                perPage={returnPerPage}
                total={totalFilteredReturnItems}
                onPage={setReturnPage}
                perPageOptions={[5]}
                className="rounded-xl border border-border bg-slate-50/70 dark:bg-slate-900/40 px-3 pb-3"
              />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Alasan Pengembalian / Penukaran</Label>
                  <CharCounter value={alasan} max={FIELD_LIMITS.alasan} />
                </div>
                <Input
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  maxLength={FIELD_LIMITS.alasan}
                  placeholder="mis. salah ukuran, cacat fisik"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-primary-100 dark:border-primary-500/25 bg-primary-50 dark:bg-primary-500/10 p-4">
                <div className="flex items-center gap-3 text-primary-800 dark:text-primary-300">
                  <ArrowUpCircle size={24} className="text-primary-600 dark:text-primary-400" />
                  <div>
                    <p className="text-xs font-bold uppercase">Nilai Barang Dikembalikan</p>
                    <p className="mt-0.5 text-[10px] text-primary-600 dark:text-primary-400">Stok barang akan bertambah di kartu gudang.</p>
                  </div>
                </div>
                <span className="font-mono text-lg font-extrabold text-primary-700 dark:text-primary-300">{formatRupiah(totalRetur)}</span>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft size={14} /> Kembali
              </Button>
              <Button type="button" onClick={() => setStep(3)} disabled={retItems.length === 0}>
                Lanjutkan <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ============ STEP 3: Barang pengganti (TUKAR) ============ */}
      {step === 3 && (
        <Card className="space-y-5 overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-border bg-slate-50/60 dark:bg-slate-900/40 px-6 py-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Repeat2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Pilih Barang Pengganti (Opsional)</h2>
              <p className="text-xs text-slate-500">Cari barang baru yang keluar dari gudang fisik (kosongkan jika hanya retur biasa).</p>
            </div>
          </div>

          <div className="space-y-5 px-6 pb-6">
            <div className="space-y-2">
              <Label>Pencarian Katalog Barang</Label>
              <div className="relative">
                <Search size={18} className="pointer-events-none absolute left-3.5 top-3 z-10 text-[var(--text-soft)]" />
                <Input
                  value={repQuery}
                  onChange={(e) => setRepQuery(e.target.value)}
                  maxLength={FIELD_LIMITS.search}
                  placeholder="Cari kode atau nama barang pengganti..."
                  className="h-11 pl-10"
                />
              </div>
              {repQuery.trim() && (
                <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                  {repFiltered.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => addRepItem(it)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                    >
                      <span className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">{it.nama}</span>
                        <span className="mt-0.5 font-mono text-[9px] text-slate-400">{it.kode}</span>
                      </span>
                      <span className="text-xs font-bold text-[var(--primary)]">{formatRupiah(it.hargaJual)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Table>
              <thead>
                <tr>
                  <Th className="w-12 text-center">#</Th>
                  <Th>Barang Pengganti</Th>
                  <Th className="text-right">Harga Eceran</Th>
                  <Th className="w-36 text-center">Kuantitas</Th>
                  <Th className="text-right">Total Nilai</Th>
                </tr>
              </thead>
              <tbody>
                {repItems.map((l) => (
                  <tr key={l.itemId}>
                    <Td className="text-center">
                      <button
                        type="button"
                        onClick={() => removeRepItem(l.itemId)}
                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Td>
                    <Td>
                      <div className="text-sm font-bold text-foreground">{l.nama}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">{l.kode}</div>
                    </Td>
                    <Td className="text-right font-mono text-xs">{formatRupiah(l.harga)}</Td>
                    <Td>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateRepQty(l.itemId, l.qty - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-slate-50 dark:bg-slate-900 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Minus size={14} />
                        </button>
                        <QtyInput
                          bare
                          max={FIELD_LIMITS.maxQty}
                          value={l.qty}
                          onCommit={(n) => updateRepQty(l.itemId, n)}
                          className="h-8 w-14 rounded-md border border-border text-center font-mono text-sm font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => updateRepQty(l.itemId, l.qty + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-slate-50 dark:bg-slate-900 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </Td>
                    <Td className="text-right font-mono text-xs font-bold text-foreground">{formatRupiah(l.harga * l.qty)}</Td>
                  </tr>
                ))}
                {repItems.length === 0 && (
                  <tr>
                    <Td colSpan={5} className="py-12 text-center text-slate-400 select-none">
                      Keranjang barang pengganti kosong. Pilih barang dari hasil pencarian di atas.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>

            <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 p-4">
              <div className="flex items-center gap-3 text-rose-800">
                <ArrowDownCircle size={24} className="text-rose-500" />
                <div>
                  <p className="text-xs font-bold uppercase">Nilai Barang Pengganti</p>
                  <p className="mt-0.5 text-[10px] text-rose-600">Stok barang pengganti akan berkurang dari gudang.</p>
                </div>
              </div>
              <span className="font-mono text-lg font-extrabold text-rose-700">{formatRupiah(totalGanti)}</span>
            </div>

            <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft size={14} /> Kembali
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setTipe(repItems.length > 0 ? "TUKAR" : "RETUR");
                  setStep(4);
                }}
              >
                Lanjutkan <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ============ STEP 4: Penyelesaian ============ */}
      {step === 4 && (
        <Card className="mx-auto max-w-xl space-y-6 overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-border bg-slate-50/60 dark:bg-slate-900/40 px-6 py-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Wallet size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Ringkasan &amp; Penyelesaian</h2>
              <p className="text-xs text-slate-500">Periksa kembali. Stok dan tagihan baru berubah setelah Anda menyimpan.</p>
            </div>
          </div>

          <div className="space-y-5 px-6 pb-6">
            {/* Hasil akhir */}
            <div
              className={`rounded-2xl border p-5 text-center ${
                hasilSelisih === "TAGIHAN"
                  ? "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10"
                  : hasilSelisih === "REFUND"
                  ? "border-primary-100 bg-primary-50 dark:border-primary-500/25 dark:bg-primary-500/10"
                  : "border-border bg-slate-50 dark:bg-slate-900"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {hasilSelisih === "TAGIHAN"
                  ? "Pelanggan perlu membayar tambahan"
                  : hasilSelisih === "REFUND"
                  ? "Uang dikembalikan ke pelanggan"
                  : "Tidak ada selisih"}
              </p>
              <p
                className={`mt-1 font-mono text-4xl font-extrabold ${
                  hasilSelisih === "TAGIHAN"
                    ? "text-amber-700 dark:text-amber-400"
                    : hasilSelisih === "REFUND"
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-foreground"
                }`}
              >
                {hasilSelisih === "PAS" ? formatRupiah(0) : formatRupiah(Math.abs(selisih))}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                {hasilSelisih === "TAGIHAN"
                  ? "Nilai barang pengganti lebih besar daripada barang yang dikembalikan."
                  : hasilSelisih === "REFUND"
                  ? adaPengganti
                    ? "Nilai barang yang dikembalikan lebih besar daripada barang pengganti."
                    : "Pelanggan mengembalikan barang tanpa mengambil barang pengganti."
                  : "Nilai barang yang dikembalikan sama dengan barang pengganti."}
              </p>
            </div>

            {nilaiJanggal && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  Nilai barang pengganti jauh lebih besar daripada barang yang dikembalikan. Periksa kembali jumlah dan jenis
                  barang pengganti sebelum menyimpan.
                </p>
              </div>
            )}

            {/* Perhitungan */}
            <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-xs">
              <div className="flex items-start justify-between gap-3 border-b border-dashed border-border pb-3">
                <div>
                  <p className="font-semibold text-foreground">Barang dikembalikan pelanggan</p>
                  <p className="mt-0.5 text-slate-500">{jumlahRetur} unit · {retItems.length} jenis barang</p>
                </div>
                <span className="font-mono text-sm font-bold text-foreground">{formatRupiah(totalRetur)}</span>
              </div>
              {adaPengganti && (
                <div className="flex items-start justify-between gap-3 border-b border-dashed border-border pb-3">
                  <div>
                    <p className="font-semibold text-foreground">Barang pengganti yang diambil</p>
                    <p className="mt-0.5 text-slate-500">{jumlahGanti} unit · {repItems.length} jenis barang</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-foreground">{formatRupiah(totalGanti)}</span>
                </div>
              )}

              <div className="space-y-1.5 pt-1 leading-relaxed text-slate-600 dark:text-slate-300">
                <p className="font-bold text-foreground">Yang terjadi saat disimpan:</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    Stok bertambah: <strong>{jumlahRetur} unit</strong> barang yang dikembalikan masuk kembali ke gudang.
                  </li>
                  {adaPengganti && (
                    <li>
                      Stok berkurang: <strong>{jumlahGanti} unit</strong> barang pengganti keluar dari gudang.
                    </li>
                  )}
                  {hasilSelisih === "TAGIHAN" && (
                    <li>
                      Dibuat <strong>invoice tagihan {formatRupiah(selisih)}</strong> yang belum dibayar. Pelanggan bisa
                      membayarnya nanti lewat menu Invoice &amp; Piutang.
                    </li>
                  )}
                  {hasilSelisih === "REFUND" && (
                    <li>
                      Serahkan <strong>uang tunai {formatRupiah(Math.abs(selisih))}</strong> kepada pelanggan.
                    </li>
                  )}
                  {hasilSelisih === "PAS" && <li>Tidak ada tagihan maupun pengembalian uang.</li>}
                </ul>
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 dark:bg-red-500/10 p-2.5 text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}

            <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft size={14} /> Kembali
              </Button>
              <Button type="button" onClick={submitReturnExchange} disabled={pending} className="font-bold">
                {pending
                  ? "Menyimpan..."
                  : tipe === "TUKAR"
                  ? hasilSelisih === "TAGIHAN"
                    ? "Simpan & Buat Tagihan"
                    : "Simpan Penukaran"
                  : "Simpan Retur Barang"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ============ Thermal Receipt dialog ============ */}
      {nota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-y-auto rounded-[20px] border border-border bg-card shadow-2xl max-h-[90vh]">
            <div className="print-area">
              <Nota data={nota} />
            </div>
            <div className="flex flex-col gap-2 rounded-b-[20px] border-t border-border bg-slate-50 dark:bg-slate-900 p-4">
              <div className="flex flex-wrap sm:flex-nowrap justify-between gap-1.5 w-full">
                <Button
                  onClick={() => printArea({ thermal: true })}
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[75px] h-9"
                >
                  <Printer size={13} /> Struk
                </Button>
                <Button
                  onClick={() => printArea({ className: "print-format-a4" })}
                  size="sm"
                  className="flex-1 min-w-[75px] h-9"
                >
                  <FileText size={13} /> PDF A4
                </Button>
                <Button onClick={handleSendWA} variant="success" size="sm" className="flex-1 min-w-[75px] h-9">
                  <MessageCircle size={13} /> WhatsApp
                </Button>
                <Button variant="outline" size="sm" className="flex-1 min-w-[75px] h-9" onClick={() => setNota(null)}>
                  Tutup
                </Button>
              </div>
              <Button
                onClick={handleSaveToImage}
                variant="outline"
                size="sm"
                className="w-full h-9 bg-orange-50 hover:bg-orange-100 border-orange-200 text-[var(--primary)] font-bold gap-1.5 rounded-xl cursor-pointer"
              >
                <Camera size={13} /> Simpan sebagai Gambar (PNG)
              </Button>
            </div>
          </div>
        </div>
      )}
      <WhatsAppDialog
        isOpen={waOpen}
        onClose={() => setWaOpen(false)}
        onSubmit={sendWA}
        title="Kirim Nota Retur via WhatsApp"
      />
    </div>
  );
}
