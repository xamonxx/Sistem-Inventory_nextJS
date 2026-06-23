"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReturn, findTransactionByCode } from "./actions";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge } from "@/components/ui";
import { formatRupiah } from "@/lib/utils";
import { Search, Printer, MessageCircle, ArrowRight, ArrowLeft, ArrowUpCircle, ArrowDownCircle, CheckCircle2, Trash2, Minus, Plus, FileText } from "lucide-react";
import { Nota, type NotaData } from "@/components/Nota";
import { toast } from "sonner";

type ItemOption = { id: number; kode: string; nama: string; hargaJual: number };
type OriginalItem = { itemId: number; nama: string; kode: string; qty: number; harga: number };
type SelectedReturn = { itemId: number; qty: number; harga: number; nama: string; kode: string };
type SelectedReplacement = { itemId: number; qty: number; harga: number; nama: string; kode: string };

export function ReturClient({ items }: { items: ItemOption[] }) {
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

  // Step 2: Return select
  const [retItems, setRetItems] = useState<SelectedReturn[]>([]);
  const [alasan, setAlasan] = useState("");

  // Step 3: Replacement select
  const [repItems, setRepItems] = useState<SelectedReplacement[]>([]);
  const [repQuery, setRepQuery] = useState("");

  // Step 4: Settlement
  const [error, setError] = useState("");
  const [nota, setNota] = useState<NotaData | null>(null);
  const [pending, start] = useTransition();

  // Search catalog for replacement B
  const repFiltered = useMemo(() => {
    if (!repQuery.trim()) return [];
    const s = repQuery.toLowerCase();
    return items.filter((i) => i.nama.toLowerCase().includes(s) || i.kode.toLowerCase().includes(s)).slice(0, 5);
  }, [repQuery, items]);

  function useMemo<T>(fn: () => T, deps: any[]): T {
    return fn();
  }

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
        // Pre-populate empty returns
        setRetItems([]);
        setStep(2);
      }
    } catch {
      toast.error("Gagal melakukan pencarian.");
    } finally {
      setSearching(false);
    }
  }

  // Helper to add item to returns
  function toggleReturnItem(item: OriginalItem, isChecked: boolean) {
    if (isChecked) {
      setRetItems((prev) => [
        ...prev,
        { itemId: item.itemId, qty: 1, harga: item.harga, nama: item.nama, kode: item.kode },
      ]);
    } else {
      setRetItems((prev) => prev.filter((x) => x.itemId !== item.itemId));
    }
  }

  function updateReturnQty(itemId: number, qty: number, maxQty: number) {
    if (qty > maxQty) {
      toast.warning(`Qty retur tidak boleh melebihi qty beli (${maxQty})`);
      qty = maxQty;
    }
    setRetItems((prev) =>
      prev.map((x) => (x.itemId === itemId ? { ...x, qty: Math.max(1, qty) } : x))
    );
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
    setRepItems((prev) =>
      prev.map((x) => (x.itemId === itemId ? { ...x, qty: Math.max(1, qty) } : x))
    );
  }

  function removeRepItem(itemId: number) {
    setRepItems((prev) => prev.filter((x) => x.itemId !== itemId));
  }

  // Calculations
  const totalRetur = retItems.reduce((acc, x) => acc + x.harga * x.qty, 0);
  const totalGanti = tipe === "TUKAR" ? repItems.reduce((acc, x) => acc + x.harga * x.qty, 0) : 0;
  const selisih = totalGanti - totalRetur; // positive: customer pays; negative: refund customer

  // Submit action
  function submitReturnExchange() {
    setError("");
    if (retItems.length === 0) return toast.error("Pilih barang yang diretur terlebih dahulu.");
    if (tipe === "TUKAR" && repItems.length === 0) return toast.error("Pilih barang pengganti terlebih dahulu.");

    // The backend `createReturn` Server Action takes a single return item ID and replacement item ID
    // We will target the first items in lists, or map them as required.
    // For compatibility with the existing single-item return action in `actions.ts`:
    const itemRetur = retItems[0];
    const itemGanti = repItems[0] ?? null;

    start(async () => {
      const res = await createReturn({
        tipe,
        itemReturId: itemRetur.itemId,
        qtyRetur: itemRetur.qty,
        itemGantiId: itemGanti ? itemGanti.itemId : null,
        qtyGanti: itemGanti ? itemGanti.qty : null,
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
        const lines = [
          {
            nama: `[RETUR] ${res.namaRetur}`,
            harga: res.hargaRetur,
            qty: res.qtyRetur,
            subtotal: -(res.hargaRetur * res.qtyRetur),
          },
        ];
        if (res.namaGanti) {
          lines.push({
            nama: `[GANTI] ${res.namaGanti}`,
            harga: res.hargaGanti,
            qty: res.qtyGanti!,
            subtotal: res.hargaGanti * res.qtyGanti!,
          });
        }

        setNota({
          noReturn: res.noReturn,
          noInvoice: res.invoiceNo ?? null,
          tanggal: new Date().toISOString(),
          namaClient: origTrx?.namaClient ?? "",
          alamat: origTrx?.alamat ?? "",
          namaWs: origTrx?.namaWs ?? "",
          items: lines,
          total: res.selisih,
          judul: tipe === "TUKAR" ? "NOTA TUKAR BARANG" : "NOTA RETUR BARANG",
          catatan:
            res.selisih > 0
              ? `Selisih wajib dibayar: ${formatRupiah(res.selisih)}`
              : res.selisih < 0
              ? `Refund ke pelanggan: ${formatRupiah(Math.abs(res.selisih))}`
              : "Tidak ada selisih.",
        });

        // Reset
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
    if (!nota) return;
    let no = window.prompt("Nomor WhatsApp pelanggan (mis. 08123456789):", "");
    if (!no) return;
    no = no.replace(/[^0-9]/g, "");
    if (no.startsWith("0")) no = "62" + no.slice(1);
    
    const pesan =
      `Halo,\n` +
      `Berikut rincian nota Retur/Tukar barang Anda.\n\n` +
      `Nomor Retur : ${nota.noReturn}\n` +
      `Total Retur : ${formatRupiah(totalRetur)}\n` +
      (tipe === "TUKAR" ? `Total Pengganti: ${formatRupiah(totalGanti)}\n` : "") +
      `Selisih     : ${formatRupiah(selisih)}\n` +
      `Keterangan  : ${selisih > 0 ? "Pelanggan membayar selisih" : selisih < 0 ? "Refund oleh toko" : "Selesai"}\n\n` +
      `Terima kasih.`;
      
    window.open(`https://wa.me/${no}?text=${encodeURIComponent(pesan)}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Stepper Wizard Indicator */}
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
        {[
          { num: 1, label: "Cari Transaksi" },
          { num: 2, label: "Barang Diretur" },
          { num: 3, label: "Barang Pengganti" },
          { num: 4, label: "Penyelesaian" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                step === s.num
                  ? "bg-primary text-white ring-4 ring-blue-100"
                  : step > s.num
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {s.num}
            </span>
            <span className={`text-xs font-semibold hidden md:inline ${step === s.num ? "text-slate-800" : "text-muted"}`}>
              {s.label}
            </span>
            {s.num < 4 && <ArrowRight size={14} className="text-muted hidden md:inline" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Find original transaction */}
      {step === 1 && (
        <Card className="max-w-md mx-auto p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-sm font-bold text-foreground">Langkah 1: Temukan Transaksi Penjualan Asli</h2>
            <p className="text-xs text-muted mt-1">Masukkan kode nota penjualan untuk memverifikasi item.</p>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <Label>Jenis Retur</Label>
              <Select value={tipe} onChange={(e) => setTipe(e.target.value as "RETUR" | "TUKAR")}>
                <option value="TUKAR">Tukar Barang (Ganti Baru / Bayar Selisih)</option>
                <option value="RETUR">Retur Biasa (Pengembalian Barang / Refund)</option>
              </Select>
            </div>

            <div>
              <Label>Nomor Transaksi Asli (PCxxxxx)</Label>
              <Input
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="mis. PC00001"
                className="h-11"
              />
            </div>

            <Button onClick={handleFindTrx} disabled={searching} className="w-full h-11">
              {searching ? "Mencari..." : "Cari Transaksi"}
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: Selected return items list */}
      {step === 2 && origTrx && (
        <Card className="space-y-6 p-6">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Langkah 2: Pilih Barang Yang Dikembalikan</h2>
              <p className="text-xs text-muted">Beri centang dan input kuantitas barang yang ditukar.</p>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-border">
              <strong>Nota Asli:</strong> {origTrx.noTransaksi} &middot; {origTrx.namaClient || "Eceran / Pelanggan Umum"}
            </div>
          </div>

          {/* Items selection list */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <thead>
                <tr>
                  <th className="w-12 text-center py-2.5 bg-slate-50 border-b border-border">Pilih</th>
                  <Th>Barang</Th>
                  <Th className="text-right">Harga Nota</Th>
                  <Th className="text-center w-24">Qty Beli</Th>
                  <Th className="text-center w-36">Qty Diretur</Th>
                  <Th className="text-right">Total Nilai</Th>
                </tr>
              </thead>
              <tbody>
                {origTrx.items.map((it) => {
                  const isSelected = retItems.some((x) => x.itemId === it.itemId);
                  const selected = retItems.find((x) => x.itemId === it.itemId);
                  return (
                    <tr key={it.itemId} className={isSelected ? "bg-blue-50/20" : ""}>
                      <td className="text-center border-b border-border">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleReturnItem(it, e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-primary"
                        />
                      </td>
                      <Td>
                        <div className="font-semibold text-slate-800">{it.nama}</div>
                        <div className="font-mono text-[10px] text-muted">{it.kode}</div>
                      </Td>
                      <Td className="text-right font-mono">{formatRupiah(it.harga)}</Td>
                      <Td className="text-center font-mono font-medium">{it.qty} unit</Td>
                      <Td>
                        {isSelected && selected ? (
                          <Input
                            type="number"
                            min={1}
                            max={it.qty}
                            value={selected.qty}
                            onChange={(e) => updateReturnQty(it.itemId, parseInt(e.target.value) || 1, it.qty)}
                            className="text-center h-8 font-mono font-semibold"
                          />
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </Td>
                      <Td className="text-right font-bold font-mono">
                        {isSelected && selected ? formatRupiah(selected.harga * selected.qty) : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-4">
            <div>
              <Label>Alasan Pengembalian / Tukar</Label>
              <Input
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="mis. ukuran tidak pas, cacat material"
              />
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800">
                <ArrowUpCircle size={22} />
                <div>
                  <p className="text-xs font-bold uppercase">Estimasi Stok Masuk (+)</p>
                  <p className="text-[10px] text-emerald-700">Barang ini akan masuk kembali ke gudang fisik.</p>
                </div>
              </div>
              <span className="text-lg font-black text-emerald-700 font-mono">{formatRupiah(totalRetur)}</span>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setStep(1)}>
              Kembali
            </Button>
            <Button onClick={() => setStep(tipe === "TUKAR" ? 3 : 4)} disabled={retItems.length === 0}>
              Lanjutkan <ArrowRight size={14} />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Replacement items list (only if TUKAR) */}
      {step === 3 && tipe === "TUKAR" && (
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-sm font-bold text-foreground">Langkah 3: Pilih Barang Pengganti (Baru)</h2>
            <p className="text-xs text-muted mt-1">Cari dan masukkan barang pengganti yang dibawa keluar oleh pelanggan.</p>
          </div>

          {/* Search bar */}
          <div className="space-y-2">
            <Label>Pencarian Barang Pengganti</Label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-muted" />
              <Input
                value={repQuery}
                onChange={(e) => setRepQuery(e.target.value)}
                placeholder="Cari berdasarkan kode / nama barang..."
                className="pl-10 h-11"
              />
            </div>
            {repQuery.trim() && (
              <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border bg-white shadow-md">
                {repFiltered.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => addRepItem(it)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition"
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold text-slate-800">{it.nama}</span>
                      <span className="font-mono text-xs text-muted">{it.kode}</span>
                    </span>
                    <span className="font-semibold text-primary">{formatRupiah(it.hargaJual)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Replacement items cart */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <thead>
                <tr>
                  <Th className="w-12 text-center">#</Th>
                  <Th>Barang Pengganti</Th>
                  <Th className="text-right">Harga Eceran</Th>
                  <Th className="text-center w-36">Kuantitas</Th>
                  <Th className="text-right">Total Nilai</Th>
                </tr>
              </thead>
              <tbody>
                {repItems.map((l) => (
                  <tr key={l.itemId}>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => removeRepItem(l.itemId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                    <Td>
                      <div className="font-semibold text-slate-800">{l.nama}</div>
                      <div className="font-mono text-[10px] text-muted">{l.kode}</div>
                    </Td>
                    <Td className="text-right font-mono">{formatRupiah(l.harga)}</Td>
                    <Td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateRepQty(l.itemId, l.qty - 1)}
                          className="rounded border border-border p-1 bg-white"
                        >
                          <Minus size={11} />
                        </button>
                        <input
                          type="number"
                          value={l.qty}
                          onChange={(e) => updateRepQty(l.itemId, parseInt(e.target.value) || 1)}
                          className="h-8 w-14 rounded border border-border text-center font-mono font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => updateRepQty(l.itemId, l.qty + 1)}
                          className="rounded border border-border p-1 bg-white"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </Td>
                    <Td className="text-right font-bold font-mono">{formatRupiah(l.harga * l.qty)}</Td>
                  </tr>
                ))}
                {repItems.length === 0 && (
                  <tr>
                    <Td colSpan={5} className="py-8 text-center text-muted">
                      Keranjang pengganti kosong. Masukkan barang dari panel pencarian di atas.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <ArrowDownCircle size={22} />
              <div>
                <p className="text-xs font-bold uppercase">Estimasi Stok Keluar (-)</p>
                <p className="text-[10px] text-red-700">Barang ini akan keluar dari stok gudang fisik.</p>
              </div>
            </div>
            <span className="text-lg font-black text-red-700 font-mono">{formatRupiah(totalGanti)}</span>
          </div>

          <div className="flex justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setStep(2)}>
              Kembali
            </Button>
            <Button onClick={() => setStep(4)} disabled={repItems.length === 0}>
              Lanjutkan <ArrowRight size={14} />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: Settlement page */}
      {step === 4 && (
        <Card className="max-w-xl mx-auto p-6 space-y-6">
          <div className="text-center border-b border-border pb-3">
            <h2 className="text-sm font-bold text-foreground">Langkah 4: Review Penyelesaian Selisih (Pembayaran/Pengembalian)</h2>
            <p className="text-xs text-muted mt-1">Verifikasi nominal selisih pengembalian barang.</p>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-border text-xs">
            <div className="flex justify-between pb-2 border-b border-dashed border-border">
              <span className="text-slate-500">Nilai Barang Retur (+)</span>
              <span className="font-bold text-emerald-600 font-mono">{formatRupiah(totalRetur)}</span>
            </div>
            {tipe === "TUKAR" && (
              <div className="flex justify-between pb-2 border-b border-dashed border-border">
                <span className="text-slate-500">Nilai Barang Pengganti (-)</span>
                <span className="font-bold text-red-600 font-mono">{formatRupiah(totalGanti)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 text-sm">
              <span className="font-semibold text-slate-800">{selisih >= 0 ? "Selisih Tagihan" : "Sisa Pengembalian (Refund)"}</span>
              <span className={`text-lg font-black font-mono ${selisih > 0 ? "text-red-600" : selisih < 0 ? "text-emerald-600" : "text-slate-800"}`}>
                {formatRupiah(Math.abs(selisih))}
              </span>
            </div>
          </div>

          <div className="rounded-lg p-3.5 border text-xs">
            {selisih > 0 ? (
              <p className="text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
                <strong>ℹ️ Kewajiban Bayar:</strong> Pelanggan wajib membayar selisih nominal sebesar <strong>{formatRupiah(selisih)}</strong>. Faktur tagihan baru (Invoice) akan diterbitkan otomatis.
              </p>
            ) : selisih < 0 ? (
              <p className="text-emerald-700 bg-emerald-50 p-2.5 rounded border border-emerald-200">
                <strong>ℹ️ Pengembalian Toko:</strong> Toko berkewajiban mengembalikan uang tunai sebesar <strong>{formatRupiah(Math.abs(selisih))}</strong> kepada pelanggan.
              </p>
            ) : (
              <p className="text-slate-700 bg-slate-100 p-2.5 rounded border border-slate-200">
                <strong>ℹ️ Selesai:</strong> Tukar barang seimbang. Tidak ada kas keluar/masuk tambahan.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded">{error}</p>}

          <div className="flex justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setStep(tipe === "TUKAR" ? 3 : 2)}>
              Kembali
            </Button>
            <Button onClick={submitReturnExchange} disabled={pending} className="font-bold" variant={selisih > 0 ? "danger" : "success"}>
              {pending ? "Memproses..." : tipe === "TUKAR" ? "Simpan & Proses Penukaran" : "Simpan & Proses Retur"}
            </Button>
          </div>
        </Card>
      )}

      {/* Thermal Receipt dialog */}
      {nota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl overflow-y-auto max-h-[90vh] shadow-2xl border border-border">
            <div className="print-area">
              <Nota data={nota} />
            </div>
            <div className="flex flex-wrap gap-1.5 p-4 border-t border-border bg-slate-50 w-full justify-between">
              <Button onClick={() => {
                document.body.classList.remove("print-format-a4");
                setTimeout(() => window.print(), 50);
              }} variant="outline" size="sm">
                <Printer size={13} /> Struk (Thermal)
              </Button>
              <Button onClick={() => {
                document.body.classList.add("print-format-a4");
                setTimeout(() => {
                  window.print();
                  document.body.classList.remove("print-format-a4");
                }, 50);
              }} size="sm">
                <FileText size={13} /> PDF (A4)
              </Button>
              <Button onClick={handleSendWA} variant="success" size="sm">
                <MessageCircle size={13} /> WhatsApp
              </Button>
              <Button variant="outline" onClick={() => setNota(null)} size="sm">
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
