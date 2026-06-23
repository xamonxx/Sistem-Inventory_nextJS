"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTransaction } from "./actions";
import { useKasirStore } from "@/lib/kasirStore";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge } from "@/components/ui";
import { formatRupiah } from "@/lib/utils";
import { Search, Trash2, Plus, Minus, Printer, Keyboard, ShoppingBag, FileText } from "lucide-react";
import { Nota, type NotaData } from "@/components/Nota";
import { toast } from "sonner";

type Item = { id: number; kode: string; nama: string; hargaJual: number; stok: number };

export function KasirClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const {
    cart,
    tipe,
    namaClient,
    alamat,
    namaWs,
    projectNama,
    projectGroupNama,
    paymentMethod,
    buatInvoice,
    setTipe,
    setNamaClient,
    setAlamat,
    setNamaWs,
    setProjectNama,
    setProjectGroupNama,
    setPaymentMethod,
    setBuatInvoice,
    addToCart,
    removeFromCart,
    updateQty,
    updateDiscount,
    clearCart,
  } = useKasirStore();

  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [nota, setNota] = useState<NotaData | null>(null);
  const [pending, start] = useTransition();

  // Filter items matching query
  const filtered = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    return items.filter((i) => i.nama.toLowerCase().includes(s) || i.kode.toLowerCase().includes(s)).slice(0, 8);
  }, [q, items]);

  // Keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        toast.info("Pencarian barang difokuskan");
      }
      if (e.key === "F4") {
        e.preventDefault();
        submitCheckout();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, tipe, namaClient, alamat, namaWs, projectNama, projectGroupNama, paymentMethod, buatInvoice]);

  // Handle barcode/enter on search input
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      // Add first filtered result
      const item = filtered[0];
      addToCart(item);
      setQ("");
      toast.success(`${item.nama} dimasukkan ke keranjang`);
    }
  }

  // Aggregate stats
  const totalItemCount = cart.length;
  const totalQtyCount = cart.reduce((acc, x) => acc + x.qty, 0);
  const subtotalCost = cart.reduce((acc, x) => acc + x.harga * x.qty, 0);
  const totalDiscount = cart.reduce((acc, x) => acc + x.discount, 0);
  const grandTotalCost = Math.max(0, subtotalCost - totalDiscount);

  const hasNegativeStock = cart.some((x) => x.qty > x.stok);

  function submitCheckout() {
    setError("");
    if (cart.length === 0) {
      toast.error("Keranjang masih kosong");
      return setError("Keranjang masih kosong.");
    }
    if (tipe === "PROJECT" && !namaClient.trim()) {
      toast.warning("Transaksi proyek wajib menyertakan Nama Client");
      return setError("Transaksi proyek wajib menyertakan Nama Client.");
    }

    start(async () => {
      const res = await createTransaction({
        tipe,
        namaClient,
        alamat,
        namaWs,
        projectNama,
        projectGroupNama,
        paymentMethod,
        buatInvoice,
        items: cart.map((l) => ({ itemId: l.itemId, qty: l.qty, discount: l.discount })),
      });
      
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return setError(res.error);
      }
      
      if (res && "ok" in res) {
        toast.success("Transaksi berhasil disimpan!");
        setNota({
          noTransaksi: res.noTransaksi,
          noInvoice: res.invoiceNo ?? null,
          tanggal: new Date().toISOString(),
          namaClient,
          alamat,
          namaWs,
          items: cart.map((l) => ({
            nama: l.nama,
            harga: l.harga,
            qty: l.qty,
            subtotal: l.harga * l.qty - l.discount,
          })),
          total: res.grandTotal,
          judul: "NOTA TRANSAKSI ERP",
          catatan: paymentMethod === "CREDIT" ? `Metode: Kredit/Tempo (Invoice: ${res.invoiceNo})` : `Metode: ${paymentMethod}`,
        });
        clearCart();
        setQ("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* LEFT SECTION (Transaction profile, Search, Cart Table) */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Transaction Profile Card */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShoppingBag size={16} className="text-primary" /> Profil &amp; Info Transaksi
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted flex items-center gap-1">
                <Keyboard size={12} /> <kbd className="bg-slate-100 px-1 rounded text-[10px]">F2</kbd> Cari | <kbd className="bg-slate-100 px-1 rounded text-[10px]">F4</kbd> Bayar
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label>Tipe Transaksi</Label>
              <Select value={tipe} onChange={(e) => setTipe(e.target.value as "RETAIL" | "PROJECT")}>
                <option value="RETAIL">Eceran (Bayar Langsung)</option>
                <option value="PROJECT">Proyek (Kontrak / Grosir)</option>
              </Select>
            </div>
            <div>
              <Label>Nama Klien / Pelanggan</Label>
              <Input
                value={namaClient}
                onChange={(e) => setNamaClient(e.target.value)}
                placeholder="mis. Toko Plywood Jaya / Ibu Indah"
              />
            </div>
            <div>
              <Label>Referensi Bengkel / Workshop (WS)</Label>
              <Input
                value={namaWs}
                onChange={(e) => setNamaWs(e.target.value)}
                placeholder="mis. WS Budi Carpenter"
              />
            </div>
          </div>

          {tipe === "PROJECT" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2 border-t border-dashed border-border">
              <div>
                <Label>Nama Proyek</Label>
                <Input
                  value={projectNama}
                  onChange={(e) => setProjectNama(e.target.value)}
                  placeholder="mis. Renovasi Cluster A"
                />
              </div>
              <div>
                <Label>Grup Proyek</Label>
                <Input
                  value={projectGroupNama}
                  onChange={(e) => setProjectGroupNama(e.target.value)}
                  placeholder="mis. Perumahan Agung Podomoro"
                />
              </div>
              <div>
                <Label>Alamat Pengiriman</Label>
                <Input
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="mis. Jln. Rancaekek No. 4"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Item Search Card */}
        <Card className="space-y-3">
          <Label htmlFor="search-item">Cari Barang (Kode / Nama / Barcode)</Label>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-muted" />
            <Input
              id="search-item"
              ref={searchInputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Fokus cari barang... (Tekan enter untuk langsung memasukkan item pertama)"
              className="pl-10 h-11"
            />
          </div>

          {q.trim() && (
            <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border bg-white shadow-lg">
              {filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    addToCart(it);
                    setQ("");
                    searchInputRef.current?.focus();
                  }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition"
                >
                  <span className="flex flex-col">
                    <span className="font-semibold text-slate-800">{it.nama}</span>
                    <span className="font-mono text-xs text-muted flex items-center gap-2">
                      {it.kode} &middot; 
                      <span className={it.stok < 10 ? "text-red-500 font-bold" : "text-slate-500"}>
                        stok {it.stok}
                      </span>
                    </span>
                  </span>
                  <span className="font-semibold text-primary">{formatRupiah(it.hargaJual)}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted text-center">Barang tidak ditemukan.</p>
              )}
            </div>
          )}
        </Card>

        {/* Item Cart Table */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <thead>
              <tr>
                <Th className="w-12 text-center">#</Th>
                <Th>Barang</Th>
                <Th className="text-right">Harga</Th>
                <Th className="text-center w-36">Qty</Th>
                <Th className="text-right w-36">Diskon (Rp)</Th>
                <Th className="text-right">Subtotal</Th>
              </tr>
            </thead>
            <tbody>
              {cart.map((l) => {
                const isOverStock = l.qty > l.stok;
                const lineSubtotal = l.harga * l.qty - l.discount;
                return (
                  <tr key={l.itemId} className="hover:bg-slate-50/50">
                    <Td className="text-center">
                      <button
                        type="button"
                        onClick={() => removeFromCart(l.itemId)}
                        className="text-red-500 hover:text-red-700 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </Td>
                    <Td>
                      <div className="font-medium text-slate-800">{l.nama}</div>
                      <div className="font-mono text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
                        <span>{l.kode}</span>
                        {isOverStock && (
                          <Badge tone="amber" className="px-1 py-0 text-[8px]">
                            ⚠️ Stok Minus (Tersedia: {l.stok})
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td className="text-right font-mono">{formatRupiah(l.harga)}</Td>
                    <Td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(l.itemId, l.qty - 1)}
                          className="rounded border border-border p-1 bg-white hover:bg-slate-50"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={l.qty}
                          min={1}
                          onChange={(e) => updateQty(l.itemId, parseInt(e.target.value) || 1)}
                          className="h-8 w-14 rounded border border-border text-center text-sm font-semibold font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => addToCart({ id: l.itemId, kode: l.kode, nama: l.nama, hargaJual: l.harga, stok: l.stok })}
                          className="rounded border border-border p-1 bg-white hover:bg-slate-50"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </Td>
                    <Td>
                      <input
                        type="number"
                        value={l.discount}
                        onChange={(e) => updateDiscount(l.itemId, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="h-8 w-full rounded border border-border px-2 text-right text-sm font-mono"
                      />
                    </Td>
                    <Td className="text-right font-semibold font-mono">{formatRupiah(lineSubtotal)}</Td>
                  </tr>
                );
              })}
              {cart.length === 0 && (
                <tr>
                  <Td colSpan={6} className="py-12 text-center text-muted">
                    Keranjang belanja kosong. Masukkan barang dari panel pencarian di atas.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* RIGHT SECTION (Sticky Summary Card & Payments Options) */}
      <div className="space-y-6">
        <div className="sticky top-20 space-y-6">
          
          {/* Summary Pricing Card */}
          <Card className="space-y-4 bg-slate-900 text-white shadow-xl">
            <h3 className="text-sm font-semibold text-slate-300 tracking-wider uppercase">Ringkasan Pembayaran</h3>
            
            <div className="space-y-2 border-b border-slate-800 pb-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Macam Barang</span>
                <span className="font-semibold">{totalItemCount} baris</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Kuantitas</span>
                <span className="font-semibold">{totalQtyCount} unit</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal Belanja</span>
                <span className="font-semibold font-mono">{formatRupiah(subtotalCost)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Total Diskon</span>
                <span className="font-semibold font-mono">-{formatRupiah(totalDiscount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Total Akhir</span>
              <span className="text-2xl font-black font-mono text-emerald-400">{formatRupiah(grandTotalCost)}</span>
            </div>
          </Card>

          {/* Payment Terms & Actions */}
          <Card className="space-y-4">
            <div>
              <Label>Syarat / Metode Pembayaran</Label>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "TRANSFER" | "CREDIT")}>
                <option value="CASH">Tunai (Cash)</option>
                <option value="TRANSFER">Transfer Bank</option>
                <option value="CREDIT">Kredit / Piutang (Tempo)</option>
              </Select>
            </div>

            {(paymentMethod === "CREDIT" || tipe === "PROJECT") && (
              <label className="flex items-center gap-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-border">
                <input
                  type="checkbox"
                  checked={buatInvoice}
                  onChange={(e) => setBuatInvoice(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="font-medium">Otomatis buat Faktur Tagihan (Invoice Piutang)</span>
              </label>
            )}

            {hasNegativeStock && (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 border border-amber-200">
                <span className="font-bold">⚠️ Peringatan:</span> Beberapa barang dalam keranjang melebihi jumlah stok fisik gudang. Transaksi tetap dapat diselesaikan (stok akan menjadi minus).
              </div>
            )}

            {error && (
              <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 font-medium">{error}</p>
            )}

            <div className="space-y-2 pt-2">
              <Button
                onClick={submitCheckout}
                disabled={pending || cart.length === 0}
                className="w-full h-11 text-sm font-semibold"
              >
                {pending ? "Menyimpan Transaksi..." : "Proses Transaksi & Cetak (F4)"}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  if (confirm("Reset ulang keranjang?")) {
                    clearCart();
                    toast.info("Keranjang direset");
                  }
                }}
                disabled={cart.length === 0}
                className="w-full"
              >
                Reset Keranjang
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Printing Modal */}
      {nota && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setNota(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl border border-border"
          >
            <div className="print-area">
              <Nota data={nota} />
            </div>
            <div className="no-print flex flex-col sm:flex-row gap-2 border-t border-border p-4 bg-slate-50">
              <Button onClick={() => {
                document.body.classList.remove("print-format-a4");
                setTimeout(() => window.print(), 50);
              }} variant="outline" className="flex-1">
                <Printer size={14} /> Cetak Thermal (80mm)
              </Button>
              <Button onClick={() => {
                document.body.classList.add("print-format-a4");
                setTimeout(() => {
                  window.print();
                  document.body.classList.remove("print-format-a4");
                }, 50);
              }} className="flex-1">
                <FileText size={14} /> Simpan PDF / Cetak A4
              </Button>
              <Button variant="outline" onClick={() => setNota(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
