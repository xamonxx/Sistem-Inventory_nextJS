"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTransaction } from "./actions";
import { useKasirStore, type CartLine } from "@/lib/kasirStore";
import { computeCart } from "@/lib/cart";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge } from "@/components/ui";
import { formatRupiah, cn } from "@/lib/utils";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  Printer,
  Keyboard,
  ShoppingBag,
  FileText,
  Bookmark,
  AlertTriangle,
  FolderOpen,
  X,
  CreditCard,
  Percent,
} from "lucide-react";
import { Nota, type NotaData } from "@/components/Nota";
import { ModernDialog } from "@/components/ModernDialog";
import { printArea } from "@/lib/print";
import { toast } from "sonner";

type Item = { id: number; kode: string; nama: string; hargaJual: number; stok: number };

const QUICK_CASH = [20000, 50000, 100000, 200000, 500000];

export function KasirClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastAddRef = useRef(0);

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
    globalDiscount,
    globalDiscountType,
    setTipe,
    setNamaClient,
    setAlamat,
    setNamaWs,
    setProjectNama,
    setProjectGroupNama,
    setPaymentMethod,
    setBuatInvoice,
    setGlobalDiscount,
    setGlobalDiscountType,
    addToCart,
    removeFromCart,
    updateQty,
    updateDiscount,
    updateDiscountType,
    clearCart,
  } = useKasirStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [q, setQ] = useState("");
  const [cashReceived, setCashReceived] = useState(0);
  const [error, setError] = useState("");
  const [nota, setNota] = useState<NotaData | null>(null);
  const [pending, start] = useTransition();

  // Hold Transaction State
  const [heldCarts, setHeldCarts] = useState<{ id: string; name: string; date: string; cart: CartLine[] }[]>([]);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdCartName, setHoldCartName] = useState("");
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Split Payment State
  const [isSplitActive, setIsSplitActive] = useState(false);
  const [splitCash, setSplitCash] = useState(0);
  const [splitTransfer, setSplitTransfer] = useState(0);
  const [splitCredit, setSplitCredit] = useState(0);

  // Load held transactions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("si_held_carts");
    if (stored) {
      try {
        setHeldCarts(JSON.parse(stored));
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  // Sync held transactions to localStorage
  const saveHeldCarts = (newCarts: typeof heldCarts) => {
    setHeldCarts(newCarts);
    localStorage.setItem("si_held_carts", JSON.stringify(newCarts));
  };

  // Filter items matching query or popular list
  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) {
      // Display first 12 popular items as default grid
      return items.slice(0, 12);
    }
    return items.filter((i) => i.nama.toLowerCase().includes(s) || i.kode.toLowerCase().includes(s));
  }, [q, items]);

  // Cart math computations (Discounts removed entirely)
  const computed = useMemo(
    () =>
      computeCart(
        cart.map((l) => ({ harga: l.harga, qty: l.qty, discount: 0, discountType: "RP" })),
        0,
        "RP"
      ),
    [cart]
  );

  const totalItemCount = cart.length;
  const totalQtyCount = cart.reduce((acc, x) => acc + x.qty, 0);
  const subtotalCost = computed.subtotal;
  const totalLineDiscount = computed.totalLineDiscount;
  const globalDiscountRp = computed.globalDiscount;
  const totalDiscount = totalLineDiscount + globalDiscountRp;
  const grandTotalCost = computed.grandTotal;

  // Split payments sum validation
  const splitTotal = splitCash + splitTransfer + splitCredit;
  const isSplitValid = Math.abs(splitTotal - grandTotalCost) < 5; // close to exact match

  const hasNegativeStock = cart.some((x) => x.qty > x.stok);
  const isCash = paymentMethod === "CASH" && !isSplitActive;
  const kembalian = isSplitActive ? splitCash - (grandTotalCost - splitTransfer - splitCredit) : cashReceived - grandTotalCost;
  const cashShort = (isCash && cashReceived > 0 && kembalian < 0) || (isSplitActive && splitCash > 0 && kembalian < 0);

  // Auto-scan barcode logic
  function tryExactAdd(val: string): boolean {
    const code = val.trim().toLowerCase();
    if (code.length < 3) return false;
    const exact = items.find((i) => i.kode.toLowerCase() === code);
    if (exact) {
      addToCart(exact);
      setQ("");
      lastAddRef.current = Date.now();
      toast.success(`${exact.nama} dimasukkan ke keranjang`);
      setStep(1); // Auto switch to step 1 to show the added item
      return true;
    }
    return false;
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQ(val);
    tryExactAdd(val);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (Date.now() - lastAddRef.current < 250) return;
    if (tryExactAdd(e.currentTarget.value)) return;
    if (filtered.length > 0) {
      const item = filtered[0];
      addToCart(item);
      setQ("");
      toast.success(`${item.nama} dimasukkan ke keranjang`);
      setStep(1); // Auto switch to step 1 to show the added item
    }
  }

  // Keyboard shortcut handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        setStep(1);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        toast.info("Pencarian barang difokuskan");
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (step === 1) {
          if (cart.length > 0) {
            setStep(2);
            toast.info("Lanjut ke Data Pelanggan");
          } else {
            toast.error("Keranjang masih kosong");
          }
        } else if (step === 2) {
          if (tipe === "PROJECT" && !namaClient.trim()) {
            toast.warning("Transaksi proyek wajib menyertakan Nama Client");
          } else {
            setStep(3);
            toast.info("Lanjut ke Pembayaran");
          }
        } else if (step === 3) {
          submitCheckout();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, tipe, namaClient, alamat, namaWs, projectNama, projectGroupNama, paymentMethod, buatInvoice, globalDiscount, globalDiscountType, cashReceived, isSplitActive, splitCash, splitTransfer, splitCredit, step]);

  // Hold transaction logic
  function handleHoldCart() {
    if (cart.length === 0) {
      return toast.error("Keranjang kosong, tidak dapat menangguhkan transaksi.");
    }
    const name = holdCartName.trim() || `Held Trx #${heldCarts.length + 1}`;
    const newHold = {
      id: Math.random().toString(36).substring(7),
      name,
      date: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " - " + new Date().toLocaleDateString("id-ID"),
      cart: [...cart],
    };
    saveHeldCarts([newHold, ...heldCarts]);
    clearCart();
    setHoldCartName("");
    setCashReceived(0);
    setStep(1);
    toast.success(`Transaksi "${name}" berhasil ditangguhkan`);
  }

  function handleRestoreCart(id: string) {
    const selected = heldCarts.find((x) => x.id === id);
    if (!selected) return;
    
    // Clear and restore
    clearCart();
    selected.cart.forEach((item) => {
      // Re-add lines manually
      for (let i = 0; i < item.qty; i++) {
        addToCart({ id: item.itemId, kode: item.kode, nama: item.nama, hargaJual: item.harga, stok: item.stok });
      }
      // Apply discounts
      updateDiscount(item.itemId, item.discount);
      updateDiscountType(item.itemId, item.discountType);
    });

    // Remove from held list
    saveHeldCarts(heldCarts.filter((x) => x.id !== id));
    setIsHoldModalOpen(false);
    setStep(1);
    toast.success(`Transaksi "${selected.name}" berhasil dikembangkan ke keranjang`);
  }

  function handleDeleteHeldCart(id: string) {
    saveHeldCarts(heldCarts.filter((x) => x.id !== id));
    toast.info("Penangguhan transaksi dihapus");
  }

  // Submit checkout transaction
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
    if (isCash && cashReceived > 0 && kembalian < 0) {
      toast.error("Uang tunai diterima belum mencukupi total belanja");
      return setError("Uang tunai yang diterima belum mencukupi total belanja.");
    }
    if (isSplitActive && !isSplitValid) {
      toast.error("Jumlah split pembayaran tidak sesuai dengan total belanja");
      return setError("Jumlah gabungan split pembayaran harus sama dengan Total Akhir.");
    }

    const bayar = isCash ? cashReceived : isSplitActive ? splitCash : null;
    const kembali = isCash ? Math.max(0, cashReceived - grandTotalCost) : isSplitActive ? Math.max(0, splitCash - (grandTotalCost - splitTransfer - splitCredit)) : null;

    // Compose split description for notes if active
    let dynamicCatatan = paymentMethod === "CREDIT"
      ? `Metode: Kredit/Tempo (Invoice: ${buatInvoice ? "Terbuat" : "Draft"})`
      : `Metode: ${paymentMethod}`;

    if (isSplitActive) {
      dynamicCatatan = `Gabungan Split -> Tunai: ${formatRupiah(splitCash)}, Transfer: ${formatRupiah(splitTransfer)}, Tempo: ${formatRupiah(splitCredit)}`;
    }

    start(async () => {
      const payments = isSplitActive
        ? [
            ...(splitCash > 0 ? [{ tipe: "CASH" as const, jumlah: splitCash }] : []),
            ...(splitTransfer > 0 ? [{ tipe: "TRANSFER" as const, jumlah: splitTransfer }] : []),
            ...(splitCredit > 0 ? [{ tipe: "CREDIT" as const, jumlah: splitCredit }] : []),
          ]
        : [];

      const res = await createTransaction({
        tipe,
        namaClient,
        alamat,
        namaWs,
        projectNama,
        projectGroupNama,
        paymentMethod: isSplitActive ? (splitCredit > 0 ? "CREDIT" : "TRANSFER") : paymentMethod,
        payments,
        buatInvoice: isSplitActive ? (splitCredit > 0 || buatInvoice) : buatInvoice,
        items: cart.map((l, i) => ({ itemId: l.itemId, qty: l.qty, discount: computed.lines[i].finalDiscount })),
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
          items: cart.map((l, i) => ({
            nama: l.nama,
            harga: l.harga,
            qty: l.qty,
            subtotal: computed.lines[i].finalSubtotal,
          })),
          total: res.grandTotal,
          diskon: totalDiscount,
          bayar: bayar ?? undefined,
          kembali: kembali ?? undefined,
          judul: "NOTA TRANSAKSI ERP",
          catatan: dynamicCatatan,
        });
        clearCart();
        setQ("");
        setCashReceived(0);
        setIsSplitActive(false);
        setSplitCash(0);
        setSplitTransfer(0);
        setSplitCredit(0);
        setStep(1); // Reset back to step 1 for the next customer
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Modals & Dialogs */}
      <ModernDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={() => {
          clearCart();
          setCashReceived(0);
          setStep(1);
          toast.info("Keranjang direset");
        }}
        title="Reset Keranjang Belanja?"
        description="Aksi ini akan mengosongkan seluruh barang yang ada di keranjang kasir saat ini. Tindakan ini tidak dapat dibatalkan."
        variant="danger"
      />

      {/* Held Transactions List Modal */}
      {isHoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsHoldModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[20px] bg-white p-6 shadow-[var(--shadow-modal)] border border-border anim-rise">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FolderOpen size={18} className="text-[var(--primary)]" /> Daftar Transaksi Ditangguhkan
              </h3>
              <button onClick={() => setIsHoldModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {heldCarts.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-slate-50/50 p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                    <p className="text-[10px] text-slate-450 font-medium">Ditangguhkan: {item.date} • {item.cart.reduce((a, b) => a + b.qty, 0)} unit</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleRestoreCart(item.id)}>
                      Kembalikan
                    </Button>
                    <button
                      onClick={() => handleDeleteHeldCart(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 transition cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}

              {heldCarts.length === 0 && (
                <p className="text-center text-sm text-slate-450 py-8">Tidak ada transaksi yang ditangguhkan.</p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setIsHoldModalOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Guided Stepper Progress Bar */}
      <div className="bg-white rounded-[18px] border border-border p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between max-w-3xl mx-auto relative px-4">
          {/* Background Connector Line */}
          <div className="absolute left-[10%] right-[10%] top-[30%] h-[3px] bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
          {/* Active Connector Line */}
          <div
            className="absolute left-[10%] top-[30%] h-[3px] bg-gradient-to-r from-[var(--primary)] to-emerald-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-in-out"
            style={{
              width: step === 1 ? "0%" : step === 2 ? "40%" : "80%",
            }}
          />

          {/* Step 1 Indicator */}
          <button
            onClick={() => cart.length > 0 && setStep(1)}
            disabled={cart.length === 0}
            className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none group cursor-pointer disabled:cursor-not-allowed"
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border shadow-xs",
              step === 1
                ? "bg-[var(--primary)] border-[var(--primary)] text-white ring-4 ring-[var(--primary)]/15 scale-110"
                : cart.length > 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 font-extrabold"
                  : "bg-white border-slate-200 text-slate-400"
            )}>
              {cart.length > 0 && step > 1 ? "✓" : "1"}
            </div>
            <span className={cn(
              "text-[10px] sm:text-xs font-bold tracking-tight transition-colors",
              step === 1 ? "text-slate-900 font-extrabold" : "text-slate-400 group-hover:text-slate-650"
            )}>
              Barang &amp; Keranjang
            </span>
          </button>

          {/* Step 2 Indicator */}
          <button
            onClick={() => cart.length > 0 && setStep(2)}
            disabled={cart.length === 0}
            className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none group cursor-pointer disabled:cursor-not-allowed"
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border shadow-xs",
              step === 2
                ? "bg-[var(--primary)] border-[var(--primary)] text-white ring-4 ring-[var(--primary)]/15 scale-110"
                : step > 2
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 font-extrabold"
                  : "bg-white border-slate-200 text-slate-400"
            )}>
              {step > 2 ? "✓" : "2"}
            </div>
            <span className={cn(
              "text-[10px] sm:text-xs font-bold tracking-tight transition-colors",
              step === 2 ? "text-slate-900 font-extrabold" : "text-slate-400 group-hover:text-slate-650"
            )}>
              Data Pelanggan
            </span>
          </button>

          {/* Step 3 Indicator */}
          <button
            onClick={() => cart.length > 0 && (tipe !== "PROJECT" || namaClient.trim()) && setStep(3)}
            disabled={cart.length === 0 || (tipe === "PROJECT" && !namaClient.trim())}
            className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none group cursor-pointer disabled:cursor-not-allowed"
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border shadow-xs",
              step === 3
                ? "bg-emerald-500 border-emerald-500 text-white ring-4 ring-emerald-500/15 scale-110"
                : "bg-white border-slate-200 text-slate-400"
            )}>
              3
            </div>
            <span className={cn(
              "text-[10px] sm:text-xs font-bold tracking-tight transition-colors",
              step === 3 ? "text-emerald-700 font-extrabold" : "text-slate-400 group-hover:text-slate-650"
            )}>
              Metode Pembayaran
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid Checkout Layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* LEFT SECTION (70%): Product Grid, Search, Cart depending on STEP */}
        <div className="min-w-0 xl:col-span-2 space-y-6">
          {step === 1 && (
            <div className="space-y-6 anim-rise">
              {/* Search Bar & Favorite Grid */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 leading-none">
                    <Search size={16} className="text-primary" /> Katalog Barang POS
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Keyboard size={10} /> <kbd className="bg-slate-100 px-1 rounded">F2</kbd> Cari | <kbd className="bg-slate-100 px-1 rounded">F4</kbd> Bayar
                  </span>
                </div>

                {/* Instant Search Bar */}
                <div className="relative">
                  <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    id="search-item"
                    ref={searchInputRef}
                    value={q}
                    onChange={handleSearchChange}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Scan barcode atau ketik nama material... (Klik item di grid untuk memasukkan langsung)"
                    className="h-11 w-full rounded-xl border border-border bg-slate-50/50 pl-10 pr-4 text-sm outline-none transition-all focus:border-[var(--primary)] focus:bg-white focus:ring-4 focus:ring-[var(--primary)]/10"
                  />
                </div>

                {/* Dynamic Grid of Items */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                  {filtered.slice(0, 8).map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        addToCart(it);
                        toast.success(`${it.nama} masuk keranjang`);
                      }}
                      className="flex flex-col justify-between rounded-xl border border-border bg-white p-3 text-left transition hover:border-[var(--primary)] hover:shadow-xs active:scale-[0.98] cursor-pointer"
                    >
                      <div>
                        <p className="line-clamp-2 text-xs font-bold text-slate-800 leading-snug">{it.nama}</p>
                        <p className="font-mono text-[9px] text-slate-400 mt-1">{it.kode}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2 w-full">
                        <span className="font-mono text-xs font-bold text-[var(--primary)]">{formatRupiah(it.hargaJual)}</span>
                        <Badge tone={it.stok < 10 ? "red" : "slate"} className="text-[8px] px-1 py-0 select-none">
                          stok {it.stok}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Modern Cart List */}
              <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between border-b border-border px-6 py-4.5 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-900 leading-none">Keranjang Belanja</h3>
                  <Badge tone="blue" className="text-xs select-none">
                    {totalQtyCount} item
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <Th className="w-12 text-center">#</Th>
                        <Th>Barang</Th>
                        <Th className="text-right">Harga</Th>
                        <Th className="text-center w-36">Kuantitas</Th>
                        <Th className="text-right">Subtotal</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((l, i) => {
                        const isOverStock = l.qty > l.stok;
                        const lineSubtotal = computed.lines[i].base;
                        return (
                          <tr key={l.itemId} className="hover:bg-slate-50/20">
                            <Td className="text-center">
                              <button
                                type="button"
                                onClick={() => removeFromCart(l.itemId)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-650 transition cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </Td>
                            <Td>
                              <div className="font-bold text-slate-800 text-xs sm:text-sm">{l.nama}</div>
                              <div className="font-mono text-[9px] text-slate-400 flex items-center gap-1.5 mt-1 select-none">
                                <span>{l.kode}</span>
                                {isOverStock && (
                                  <Badge tone="red" className="text-[7px] px-1 py-0">
                                    ⚠️ Stok Minus (Tersedia: {l.stok})
                                  </Badge>
                                )}
                              </div>
                            </Td>
                            <Td className="text-right font-mono text-xs">{formatRupiah(l.harga)}</Td>
                            <Td>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateQty(l.itemId, l.qty - 1)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-650 hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                                >
                                  <Minus size={13} />
                                </button>
                                <input
                                  type="number"
                                  value={l.qty}
                                  min={1}
                                  onChange={(e) => updateQty(l.itemId, parseInt(e.target.value) || 1)}
                                  className="h-8 w-11 rounded-lg border border-border text-center text-xs font-semibold font-mono outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => addToCart({ id: l.itemId, kode: l.kode, nama: l.nama, hargaJual: l.harga, stok: l.stok })}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-650 hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </Td>
                            <Td className="text-right font-bold font-mono text-slate-800 text-xs">{formatRupiah(lineSubtotal)}</Td>
                          </tr>
                        );
                      })}
                      {cart.length === 0 && (
                        <tr>
                          <Td colSpan={5} className="py-16 text-center text-slate-400 select-none">
                            <ShoppingBag className="mx-auto text-slate-200 mb-2" size={32} />
                            <p className="font-semibold text-sm">Keranjang Belanja Kosong</p>
                            <p className="text-xs">Browse atau cari barang di katalog atas untuk transaksi.</p>
                          </Td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 anim-rise">
              {/* Spacious Customer / CRM Details */}
              <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-3.5 bg-slate-50/20 -mx-6 px-6 -mt-6 pt-5 rounded-t-[18px]">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingBag size={18} className="text-[var(--primary)]" /> Langkah 2: Data Pelanggan &amp; Proyek
                  </h3>
                  <Badge tone="blue" className="text-xs">CRM &amp; Referensi</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column CRM */}
                  <div className="space-y-4.5">
                    <div>
                      <Label className="text-xs font-bold text-slate-650">Tipe Transaksi Pelanggan</Label>
                      <Select
                        value={tipe}
                        onChange={(e) => setTipe(e.target.value as "RETAIL" | "PROJECT")}
                        className="mt-1.5 w-full h-10 px-3 rounded-xl text-xs font-semibold outline-none"
                      >
                        <option value="RETAIL">Eceran (Retail)</option>
                        <option value="PROJECT">Proyek (Project)</option>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-slate-655">
                        Nama Klien / Pelanggan {tipe === "PROJECT" && <span className="text-rose-500 font-bold">*</span>}
                      </Label>
                      <Input
                        value={namaClient}
                        onChange={(e) => setNamaClient(e.target.value)}
                        placeholder="Nama klien (Ibu Indah / Toko Plywood)"
                        className="mt-1.5 h-10 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-slate-655">Referensi Bengkel / Workshop</Label>
                      <Input
                        value={namaWs}
                        onChange={(e) => setNamaWs(e.target.value)}
                        placeholder="Nama Workshop (Budi Carpenter) - Opsional"
                        className="mt-1.5 h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Right Column Project Mapping (dynamic) */}
                  <div className="space-y-4.5">
                    {tipe === "PROJECT" ? (
                      <div className="space-y-4.5 anim-rise">
                        <div>
                          <Label className="text-xs font-bold text-slate-655">Nama Proyek</Label>
                          <Input
                            value={projectNama}
                            onChange={(e) => setProjectNama(e.target.value)}
                            placeholder="Nama Proyek (Renov Cluster A)"
                            className="mt-1.5 h-10 rounded-xl"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-655">Grup Proyek</Label>
                          <Input
                            value={projectGroupNama}
                            onChange={(e) => setProjectGroupNama(e.target.value)}
                            placeholder="Nama Group Proyek (Ciputra Group) - Opsional"
                            className="mt-1.5 h-10 rounded-xl"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-655">Alamat Pengiriman</Label>
                          <Input
                            value={alamat}
                            onChange={(e) => setAlamat(e.target.value)}
                            placeholder="Alamat lengkap tujuan material dikirim"
                            className="mt-1.5 h-10 rounded-xl"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col justify-center items-center p-6 border border-dashed border-slate-200 rounded-[18px] bg-slate-50/40 text-slate-400 select-none text-center min-h-[220px]">
                        <ShoppingBag size={32} className="text-slate-350 mb-2.5" />
                        <p className="text-xs font-bold text-slate-600">Pelanggan Eceran / Non-Proyek</p>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                          Pembelian kasir umum. Form isian proyek, grup proyek, dan alamat pengiriman logistik dinonaktifkan untuk transaksi retail.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2.5 pt-5 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="outline" type="button" onClick={() => setStep(1)} className="w-full sm:w-auto h-10 px-4.5 rounded-xl gap-1.5 text-xs font-semibold">
                    &larr; Kembali ke Keranjang
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={tipe === "PROJECT" && !namaClient.trim()}
                    className="w-full sm:w-auto h-10 px-5 rounded-xl gap-1.5 text-xs font-bold"
                  >
                    Lanjut ke Pembayaran &rarr;
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 anim-rise">
              {/* Spacious Payment Details */}
              <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-3.5 bg-slate-50/20 -mx-6 px-6 -mt-6 pt-5 rounded-t-[18px]">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard size={18} className="text-emerald-600" /> Langkah 3: Selesaikan Pembayaran
                  </h3>
                  <Badge tone="green" className="text-xs">Kasir Checkout</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Method details */}
                  <div className="space-y-4.5">
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-650 mb-0">Metode Pembayaran Utama</Label>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSplitActive}
                            onChange={(e) => setIsSplitActive(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-350 text-[var(--primary)] focus:ring-transparent cursor-pointer"
                          />
                          Split Payment
                        </label>
                      </div>

                      {!isSplitActive ? (
                        <Select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "TRANSFER" | "CREDIT")}
                          className="mt-1.5 w-full h-10 px-3 rounded-xl text-xs font-semibold outline-none"
                        >
                          <option value="CASH">Tunai (Cash)</option>
                          <option value="TRANSFER">Transfer Bank</option>
                          <option value="CREDIT">Kredit / Piutang (Tempo)</option>
                        </Select>
                      ) : (
                        <div className="mt-2.5 space-y-3 rounded-xl border border-dashed border-border bg-slate-50/50 p-3.5">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px] font-bold text-slate-500">Tunai</Label>
                              <input
                                type="number"
                                value={splitCash || ""}
                                onChange={(e) => setSplitCash(parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="h-9 w-full rounded-lg border border-border bg-white text-center text-xs font-semibold font-mono outline-none"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-500">Transfer</Label>
                              <input
                                type="number"
                                value={splitTransfer || ""}
                                onChange={(e) => setSplitTransfer(parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="h-9 w-full rounded-lg border border-border bg-white text-center text-xs font-semibold font-mono outline-none"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-500">Tempo</Label>
                              <input
                                type="number"
                                value={splitCredit || ""}
                                onChange={(e) => setSplitCredit(parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="h-9 w-full rounded-lg border border-border bg-white text-center text-xs font-semibold font-mono outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold border-t border-slate-100 pt-2 select-none">
                            <span className="text-slate-500">Jumlah Terisi:</span>
                            <span className={isSplitValid ? "text-emerald-600" : "text-red-500 font-extrabold"}>
                              {formatRupiah(splitTotal)} / {formatRupiah(grandTotalCost)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Auto invoice toggle */}
                    <label className="flex items-center gap-2 text-[10px] text-slate-650 bg-slate-50 p-3 rounded-xl border border-border select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={buatInvoice}
                        onChange={(e) => setBuatInvoice(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-transparent cursor-pointer"
                      />
                      <span className="font-semibold">Otomatis buat Faktur Tagihan (Invoice)</span>
                    </label>
                  </div>

                  {/* Right: Cash received & Change due */}
                  <div className="space-y-4">
                    {(isCash || (isSplitActive && splitCash > 0)) ? (
                      <div className="space-y-2.5 rounded-xl bg-slate-50/70 p-4 border border-border">
                        <Label className="text-xs font-bold text-slate-650">Uang Tunai Diterima</Label>
                        <Input
                          type="number"
                          min={0}
                          value={cashReceived || ""}
                          onChange={(e) => setCashReceived(parseInt(e.target.value) || 0)}
                          placeholder="Jumlah uang diterima..."
                          className="h-10 text-right text-base font-bold font-mono rounded-xl bg-white"
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5 select-none">
                          <button
                            type="button"
                            onClick={() => setCashReceived(isSplitActive ? splitCash : grandTotalCost)}
                            className="rounded border border-emerald-250 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                          >
                            Uang Pas
                          </button>
                          {QUICK_CASH.map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setCashReceived(amt)}
                              className="rounded border border-border bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-650 hover:bg-slate-100 font-mono cursor-pointer"
                            >
                              {amt >= 1000 ? `${amt / 1000}k` : amt}
                            </button>
                          ))}
                        </div>
                        <div className={cn(
                          "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-bold mt-3 select-none",
                          cashShort ? "bg-red-50 text-red-750 border border-red-100" : "bg-emerald-50 text-emerald-750 border border-emerald-100"
                        )}>
                          <span>{cashShort ? "Kurang Bayar:" : "Uang Kembalian:"}</span>
                          <span className="font-mono font-extrabold text-sm">{formatRupiah(Math.abs(kembalian))}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col justify-center items-center p-6 border border-dashed border-slate-200 rounded-[18px] bg-slate-50/40 text-slate-400 select-none text-center min-h-[160px]">
                        <CreditCard size={32} className="text-slate-350 mb-2.5" />
                        <p className="text-xs font-bold text-slate-600">Pembayaran Non-Tunai / Tempo</p>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                          Transaksi diproses menggunakan metode {paymentMethod === "CREDIT" ? "Tempo (Hutang Dagang)" : "Transfer Bank"}. Kalkulator uang kembalian dinonaktifkan.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                  <Button variant="outline" type="button" onClick={() => setStep(2)} className="h-10 px-4.5 rounded-xl gap-1.5 text-xs font-semibold">
                    &larr; Kembali ke Pelanggan
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* RIGHT SECTION (30%): Pricing Summary & Navigation Actions */}
        <div className="min-w-0 space-y-6">
          <div className="sticky top-6 space-y-6">
            {/* Summary Pricing Card (Black Capsule Theme) */}
            <Card className="space-y-4 bg-slate-900 text-white shadow-xl rounded-[20px] border-slate-800 p-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-bold text-slate-450 tracking-wider uppercase">Ringkasan Pembayaran</h3>
                <Badge tone="slate" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] font-bold">
                  LANGKAH {step} DARI 3
                </Badge>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-450">Total Baris</span>
                  <span className="font-semibold">{totalItemCount} baris</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">Total Kuantitas</span>
                  <span className="font-semibold">{totalQtyCount} unit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">Subtotal Belanja</span>
                  <span className="font-semibold font-mono">{formatRupiah(subtotalCost)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <span className="text-xs font-bold text-slate-400">TOTAL AKHIR</span>
                <span className="text-2xl font-extrabold font-mono text-emerald-400">{formatRupiah(grandTotalCost)}</span>
              </div>
            </Card>

            {/* Wizard Navigation Panel */}
            <Card className="p-5 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-600 tracking-wide uppercase border-b border-slate-100 pb-2">Aksi Alur Pembayaran</h4>
              
              {step === 1 && (
                <div className="space-y-3 anim-rise">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={cart.length === 0}
                    className="w-full h-11 text-xs font-bold gap-1.5"
                  >
                    Lanjut ke Pelanggan →
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsResetConfirmOpen(true)}
                    disabled={cart.length === 0}
                    className="w-full h-9 text-xs"
                  >
                    Reset Keranjang
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3 anim-rise">
                  <Button
                    onClick={() => setStep(3)}
                    disabled={tipe === "PROJECT" && !namaClient.trim()}
                    className="w-full h-11 text-xs font-bold gap-1.5"
                  >
                    Lanjut ke Pembayaran &rarr;
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full h-9 text-xs gap-1"
                  >
                    &larr; Kembali ke Keranjang
                  </Button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3 anim-rise">
                  <Button
                    onClick={submitCheckout}
                    disabled={pending || cart.length === 0 || cashShort || (isSplitActive && !isSplitValid)}
                    className="w-full h-11 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-md"
                  >
                    {pending ? "Menyimpan..." : "Selesaikan & Cetak Nota (F4)"}
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full h-9 text-xs gap-1"
                  >
                    &larr; Kembali ke Pelanggan
                  </Button>
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 p-2.5 text-[11px] text-red-650 font-semibold leading-relaxed border border-red-100">{error}</p>
              )}
            </Card>

            {/* Hold/Pause Transactions (Only in Step 1 to keep things uncluttered) */}
            {step === 1 && (
              <Card className="p-4 space-y-3.5 anim-rise">
                <h4 className="text-xs font-bold text-slate-600 tracking-wide uppercase border-b border-slate-100 pb-2">Penangguhan Struk</h4>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={holdCartName}
                    onChange={(e) => setHoldCartName(e.target.value)}
                    placeholder="Label nama hold..."
                    className="h-9 w-full rounded-xl border border-border bg-slate-50/50 px-2.5 text-xs outline-none focus:border-[var(--primary)] focus:bg-white focus:ring-4 focus:ring-[var(--primary)]/10"
                  />
                  <Button size="sm" variant="outline" className="h-9 shrink-0 text-xs px-3 rounded-xl gap-1" onClick={handleHoldCart} disabled={cart.length === 0}>
                    <Bookmark size={12} /> Hold
                  </Button>
                </div>

                {heldCarts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsHoldModalOpen(true)}
                    className="w-full flex justify-center items-center gap-2 rounded-xl bg-orange-50/70 border border-orange-200 py-2 text-xs font-bold text-[var(--primary)] hover:bg-orange-100 transition cursor-pointer select-none"
                  >
                    <FolderOpen size={13} /> Ada {heldCarts.length} Struk Ditangguhkan
                  </button>
                )}
              </Card>
            )}

            {/* Shopping Cart Review (In Step 2 & Step 3) */}
            {step > 1 && (
              <Card className="p-4 space-y-3 bg-slate-50/70 border border-border anim-rise">
                <h4 className="text-xs font-bold text-slate-700 border-b border-slate-200 pb-1.5 select-none">Review Belanjaan ({totalQtyCount} item)</h4>
                <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                  {cart.map((l) => (
                    <div key={l.itemId} className="flex justify-between items-start text-[11px] gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate leading-snug">{l.nama}</p>
                        <p className="text-[9px] text-slate-450 font-mono mt-0.5">{l.qty} unit @ {formatRupiah(l.harga)}</p>
                      </div>
                      <span className="font-bold font-mono text-slate-700 text-right shrink-0">
                        {formatRupiah(l.qty * l.harga)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Printing Modal */}
      {nota && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setNota(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[20px] bg-white shadow-2xl border border-border"
          >
            <div className="print-area">
              <Nota data={nota} />
            </div>
            <div className="no-print flex flex-wrap sm:flex-nowrap justify-between gap-1.5 border-t border-border p-4 bg-slate-50 rounded-b-[20px]">
              <Button onClick={() => printArea({ thermal: true })} variant="outline" size="sm" className="flex-1 min-w-[75px]">
                <Printer size={14} /> Thermal (80mm)
              </Button>
              <Button onClick={() => printArea({ className: "print-format-a4" })} size="sm" className="flex-1 min-w-[75px]">
                <FileText size={14} /> Cetak A4 PDF
              </Button>
              <Button variant="outline" size="sm" className="flex-1 min-w-[75px]" onClick={() => setNota(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
