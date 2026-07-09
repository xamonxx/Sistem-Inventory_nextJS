"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceAndItems } from "./actions";
import { Button, Card, Input, Label, Badge, LabelWithCounter } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  FileText,
  Hash,
  Calendar,
  User,
  MapPin,
  Building2,
  Landmark,
  CreditCard,
  UserCheck,
  ShoppingBag,
  ShoppingCart,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { InvoiceRow, InvoiceItem } from "./InvoiceClient";

export type CatalogItem = {
  id: number;
  kode: string;
  nama: string;
  hargaJual: number;
  stok: number;
};

interface EditInvoiceClientProps {
  invoice: InvoiceRow;
  catalogItems: CatalogItem[];
}

export function EditInvoiceClient({ invoice, catalogItems }: EditInvoiceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Metadata Form States
  const [metadata, setMetadata] = useState({
    noInvoice: invoice.noInvoice,
    tanggal: invoice.tanggal.substring(0, 10),
    namaClient: invoice.namaClient,
    alamat: invoice.alamat || "",
    namaWs: invoice.namaWs || "",
    namaBank: invoice.namaBank || "",
    noRekening: invoice.noRekening || "",
    atasNama: invoice.atasNama || "",
  });

  // Items Editor States
  const [items, setItems] = useState<InvoiceItem[]>(invoice.items);

  // Search Catalog States
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter catalog items
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return catalogItems.filter(
      (it) =>
        it.nama.toLowerCase().includes(query) ||
        it.kode.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [catalogItems, searchQuery]);

  // Add catalog item to invoice items
  function handleAddItem(catalogItem: CatalogItem) {
    const existing = items.find((x) => x.itemId === catalogItem.id);
    if (existing) {
      setItems((prev) =>
        prev.map((x) =>
          x.itemId === catalogItem.id ? { ...x, qty: x.qty + 1, subtotal: (x.qty + 1) * x.harga } : x
        )
      );
      toast.success(`Kuantitas ${catalogItem.nama} bertambah!`);
    } else {
      setItems((prev) => [
        ...prev,
        {
          itemId: catalogItem.id,
          kode: catalogItem.kode,
          nama: catalogItem.nama,
          qty: 1,
          harga: catalogItem.hargaJual,
          subtotal: catalogItem.hargaJual,
        },
      ]);
      toast.success(`${catalogItem.nama} ditambahkan ke daftar.`);
    }
    setSearchQuery("");
    setShowDropdown(false);
  }

  // Remove item from invoice
  function handleRemoveItem(itemId: number, namaBarang: string) {
    setItems((prev) => prev.filter((x) => x.itemId !== itemId));
    toast.success(`"${namaBarang}" dihapus dari daftar.`);
  }

  // Update item quantity
  function handleQtyChange(itemId: number, qty: number) {
    const validQty = Math.max(0, qty);
    setItems((prev) =>
      prev.map((x) =>
        x.itemId === itemId ? { ...x, qty: validQty, subtotal: validQty * x.harga } : x
      )
    );
  }

  // Calculate dynamic totals
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + it.qty * it.harga, 0);
  }, [items]);

  const sisa = useMemo(() => {
    return Math.max(0, subtotal - invoice.totalDibayar);
  }, [subtotal, invoice.totalDibayar]);

  // Submit invoice changes
  function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!metadata.noInvoice.trim()) {
      return toast.error("Nomor invoice wajib diisi.");
    }
    if (!metadata.namaClient.trim()) {
      return toast.error("Nama klien/pelanggan wajib diisi.");
    }

    startTransition(async () => {
      const res = await updateInvoiceAndItems(
        invoice.id,
        metadata,
        items.map((it) => ({ itemId: it.itemId, qty: it.qty }))
      );

      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }

      toast.success("Invoice & barang berhasil diperbarui!");
      router.push("/invoice");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Left Column: Metadata & Search catalog */}
      <div className="lg:col-span-2 space-y-6">
        {/* Metadata Card */}
        <Card className="p-6 border border-border shadow-sm rounded-2xl">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-foreground tracking-tight text-sm uppercase">Detail Faktur &amp; Klien</h3>
              <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Informasi klien dan nomor faktur</p>
            </div>
          </div>

          <form onSubmit={handleSave} id="edit-invoice-form" className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            <div>
              <Label htmlFor="noInvoice" className="text-xs font-bold text-slate-650">Nomor Invoice</Label>
              <div className="relative mt-1">
                <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="noInvoice"
                  required
                  disabled
                  value={metadata.noInvoice}
                  onChange={(e) => setMetadata({ ...metadata, noInvoice: e.target.value })}
                  className="pl-10 font-bold text-xs"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="tanggal" className="text-xs font-bold text-slate-650">Tanggal</Label>
              <div className="mt-1">
                <DatePicker
                  value={metadata.tanggal}
                  onChange={(val) => setMetadata({ ...metadata, tanggal: val })}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <LabelWithCounter value={metadata.namaClient} max={FIELD_LIMITS.namaClient} className="text-xs font-bold text-slate-650">
                Nama Pelanggan / Klien
              </LabelWithCounter>
              <div className="relative mt-1">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="namaClient"
                  required
                  maxLength={FIELD_LIMITS.namaClient}
                  value={metadata.namaClient}
                  onChange={(e) => setMetadata({ ...metadata, namaClient: e.target.value })}
                  className="pl-10 font-bold text-xs"
                />
              </div>
            </div>
            <div>
              <LabelWithCounter value={metadata.alamat} max={FIELD_LIMITS.alamat} className="text-xs font-bold text-slate-650">
                Alamat
              </LabelWithCounter>
              <div className="relative mt-1">
                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="alamat"
                  maxLength={FIELD_LIMITS.alamat}
                  value={metadata.alamat}
                  onChange={(e) => setMetadata({ ...metadata, alamat: e.target.value })}
                  placeholder="Alamat pelanggan"
                  className="pl-10 font-bold text-xs"
                />
              </div>
            </div>
            <div>
              <LabelWithCounter value={metadata.namaWs} max={FIELD_LIMITS.namaWs} className="text-xs font-bold text-slate-650">
                Bengkel / Workshop (WS)
              </LabelWithCounter>
              <div className="relative mt-1">
                <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="namaWs"
                  maxLength={FIELD_LIMITS.namaWs}
                  value={metadata.namaWs}
                  onChange={(e) => setMetadata({ ...metadata, namaWs: e.target.value })}
                  placeholder="Nama bengkel"
                  className="pl-10 font-bold text-xs"
                />
              </div>
            </div>

            {/* Info Pembayaran (opsional) — tampil di bagian PEMBAYARAN invoice/nota */}
            <div className="md:col-span-2 mt-1 border-t border-dashed border-slate-150 pt-4">
              <div className="flex items-center gap-2">
                <Landmark size={14} className="text-slate-400" />
                <p className="text-xs font-bold text-slate-650">Info Pembayaran <span className="font-semibold text-slate-400">(Opsional)</span></p>
              </div>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-450">Ditampilkan pada bagian PEMBAYARAN di faktur & nota. Kosongkan bila tunai.</p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <LabelWithCounter value={metadata.namaBank} max={FIELD_LIMITS.namaBank} className="text-xs font-bold text-slate-650">
                    Nama Bank
                  </LabelWithCounter>
                  <div className="relative mt-1">
                    <Landmark size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="namaBank"
                      maxLength={FIELD_LIMITS.namaBank}
                      value={metadata.namaBank}
                      onChange={(e) => setMetadata({ ...metadata, namaBank: e.target.value })}
                      placeholder="mis. BCA"
                      className="pl-10 font-bold text-xs"
                    />
                  </div>
                </div>
                <div>
                  <LabelWithCounter value={metadata.noRekening} max={FIELD_LIMITS.noRekening} className="text-xs font-bold text-slate-650">
                    No. Rekening
                  </LabelWithCounter>
                  <div className="relative mt-1">
                    <CreditCard size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="noRekening"
                      maxLength={FIELD_LIMITS.noRekening}
                      value={metadata.noRekening}
                      onChange={(e) => setMetadata({ ...metadata, noRekening: e.target.value })}
                      placeholder="mis. 1234567890"
                      className="pl-10 font-bold text-xs"
                    />
                  </div>
                </div>
                <div>
                  <LabelWithCounter value={metadata.atasNama} max={FIELD_LIMITS.atasNama} className="text-xs font-bold text-slate-650">
                    Atas Nama
                  </LabelWithCounter>
                  <div className="relative mt-1">
                    <UserCheck size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="atasNama"
                      maxLength={FIELD_LIMITS.atasNama}
                      value={metadata.atasNama}
                      onChange={(e) => setMetadata({ ...metadata, atasNama: e.target.value })}
                      placeholder="Atas nama"
                      className="pl-10 font-bold text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Card>

        {/* Item Search & Catalog Selector */}
        <Card className="p-6 border border-border shadow-sm rounded-2xl">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-foreground tracking-tight text-sm uppercase">Cari &amp; Tambah Barang</h3>
              <p className="text-[10px] text-[var(--text-muted-2)] font-semibold mt-0.5">Cari barang di katalog untuk ditambahkan ke faktur</p>
            </div>
          </div>
          
          <div className="relative mt-4">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[var(--text-soft)]" />
            <Input
              value={searchQuery}
              maxLength={FIELD_LIMITS.search}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Cari nama atau kode barang..."
              className="pl-10 h-11 rounded-xl text-xs"
            />
            {showDropdown && searchQuery.trim() && (
              <div className="absolute z-20 w-full mt-2 bg-card border border-slate-150 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-border animate-in fade-in slide-in-from-top-1 duration-150">
                {filteredCatalog.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    className="flex justify-between items-center p-3.5 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-bold text-foreground truncate">{item.nama}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">{item.kode}</span>
                        {item.stok > 10 ? (
                          <Badge tone="green" className="text-[8px] px-1.5 py-0.5">Stok: {item.stok}</Badge>
                        ) : item.stok > 0 ? (
                          <Badge tone="amber" className="text-[8px] px-1.5 py-0.5">Stok tipis: {item.stok}</Badge>
                        ) : (
                          <Badge tone="red" className="text-[8px] px-1.5 py-0.5">Stok Habis</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-foreground">{formatRupiah(item.hargaJual)}</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 flex items-center justify-center rounded-lg hover:bg-primary hover:text-white transition active:scale-90">
                        <Plus size={13} className="stroke-[2.5]" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredCatalog.length === 0 && (
                  <p className="text-center py-5 text-xs text-slate-450 italic">Barang tidak ditemukan.</p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Right Column: Checkout list & Summary - Sticky on Desktop */}
      <div className="space-y-6 lg:sticky lg:top-6">
        {/* Checkout List */}
        <Card className="p-6 border border-border shadow-sm rounded-2xl">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <ShoppingCart size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-foreground tracking-tight text-sm uppercase">Daftar Barang</h3>
              <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Total {items.length} jenis barang</p>
            </div>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 mt-4">
            {items.map((item, idx) => {
              const isRetur = item.nama.startsWith("[RETUR]");
              const isGanti = item.nama.startsWith("[GANTI]");
              const cleanNama = item.nama.replace(/^\[(RETUR|GANTI)\]\s*/, "");

              return (
                <div
                  key={`${item.itemId}-${idx}`}
                  className={`p-3 rounded-xl border text-xs space-y-3 flex flex-col transition-all ${
                    isRetur
                      ? "bg-red-50/20 border-red-100/60"
                      : isGanti
                      ? "bg-primary-50/20 border-primary-100/60"
                      : "bg-slate-50/40 border-border/60"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isRetur && <Badge tone="red" className="text-[8px] px-1.5 py-0.25">Retur</Badge>}
                        {isGanti && <Badge tone="green" className="text-[8px] px-1.5 py-0.25">Pengganti</Badge>}
                        <p className="font-bold text-foreground truncate">{cleanNama}</p>
                      </div>
                      <p className="font-mono text-[9px] text-slate-450">{item.kode} · {formatRupiah(item.harga)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.itemId, cleanNama)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-card text-red-650 hover:bg-red-50 transition cursor-pointer shrink-0 active:scale-95 shadow-xs"
                      title="Batalkan barang (kembalikan ke stok)"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/80">
                    <div className="inline-flex items-center bg-card border border-border rounded-lg p-0.5 overflow-hidden shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item.itemId, item.qty - 1)}
                        className="h-6 w-6 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground rounded transition cursor-pointer active:scale-90"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={(e) => handleQtyChange(item.itemId, parseInt(e.target.value) || 0)}
                        className="w-10 text-center font-mono font-bold text-xs bg-transparent border-0 outline-none p-0 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item.itemId, item.qty + 1)}
                        className="h-6 w-6 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground rounded transition cursor-pointer active:scale-90"
                      >
                        +
                      </button>
                    </div>
                    <p className={`font-mono font-extrabold ${isRetur ? "text-red-650" : "text-foreground"}`}>
                      {isRetur ? "-" : ""}{formatRupiah(Math.abs(item.subtotal))}
                    </p>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="text-center py-10 text-slate-400 select-none">
                <Trash2 className="mx-auto text-slate-200 mb-2" size={32} />
                <p className="font-semibold text-xs">Keranjang Kosong</p>
                <p className="text-[10px] text-slate-400">Cari &amp; tambah barang dari katalog sebelah kiri.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Pricing Summary */}
        <Card className="p-6 border border-border shadow-sm rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="p-2 bg-primary-50 text-primary-600 rounded-xl">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-foreground tracking-tight text-sm uppercase">Ringkasan Pembayaran</h3>
              <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Detail kalkulasi biaya &amp; piutang</p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs text-slate-650 mt-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-500">Subtotal Penjualan</span>
              <span className="font-mono font-bold text-foreground">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-primary-600 bg-primary-50/30 px-3 py-2 rounded-xl border border-primary-100/30">
              <span className="font-medium">Pembayaran Masuk</span>
              <span className="font-mono font-extrabold">− {formatRupiah(invoice.totalDibayar)}</span>
            </div>
            <div className="pt-3.5 border-t border-dashed border-border flex justify-between items-center">
              <span className="font-bold text-foreground uppercase tracking-wide">Sisa Piutang</span>
              <span className="font-mono font-extrabold text-lg text-amber-700">{formatRupiah(sisa)}</span>
            </div>
          </div>

          {sisa > 0 ? (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-amber-800 text-[10px] leading-relaxed">
              <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
              <p>Invoice ini memiliki sisa piutang sebesar <strong>{formatRupiah(sisa)}</strong> yang perlu dilunasi oleh pelanggan.</p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 bg-primary-50/50 border border-primary-100 rounded-xl text-primary-800 text-[10px] leading-relaxed">
              <CheckCircle2 size={14} className="shrink-0 text-primary-600 mt-0.5" />
              <p>Invoice ini telah <strong>LUNAS</strong> sepenuhnya. Klien tidak memiliki tanggungan piutang.</p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-3 border-t border-border">
            <Button
              type="submit"
              form="edit-invoice-form"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-1.5 font-bold h-11 rounded-xl shadow-xs"
            >
              <Save size={15} /> {isPending ? "Sedang Menyimpan..." : "Simpan Perubahan"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/invoice")}
              className="w-full h-11 rounded-xl text-xs font-bold"
            >
              Batal &amp; Kembali
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
