"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTransaction } from "./actions";
import { useKasirStore, type CartLine } from "@/lib/kasirStore";
import { computeCart } from "@/lib/cart";
import { Button, Card, Input, Label, Select, Table, Th, Td, Badge, Textarea, CharCounter } from "@/components/ui";
import { formatRupiah, cn } from "@/lib/utils";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
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
  Camera,
  PackageSearch,
} from "lucide-react";
import { Nota, type NotaData } from "@/components/Nota";
import { ModernDialog } from "@/components/ModernDialog";
import { printArea } from "@/lib/print";
import { toast } from "sonner";
import { toPng } from "html-to-image";

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
    namaBank,
    noRekening,
    atasNama,
    buatInvoice,
    setTipe,
    setNamaClient,
    setAlamat,
    setNamaWs,
    setProjectNama,
    setProjectGroupNama,
    setPaymentMethod,
    setNamaBank,
    setNoRekening,
    setAtasNama,
    setBuatInvoice,
    addToCart,
    removeFromCart,
    updateQty,
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

  // Cart math computations
  const computed = useMemo(
    () => computeCart(cart.map((l) => ({ harga: l.harga, qty: l.qty }))),
    [cart]
  );

  const totalItemCount = cart.length;
  const totalQtyCount = cart.reduce((acc, x) => acc + x.qty, 0);
  const subtotalCost = computed.subtotal;
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
  }, [cart, tipe, namaClient, alamat, namaWs, projectNama, projectGroupNama, paymentMethod, buatInvoice, cashReceived, isSplitActive, splitCash, splitTransfer, splitCredit, step]);

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

  async function handleSaveToImage() {
    const element = document.querySelector<HTMLElement>(".print-area");
    if (!element) {
      toast.error("Elemen cetak tidak ditemukan.");
      return;
    }
    try {
      toast.info("Sedang mengambil gambar...");
      // Ukur tinggi penuh isi (scrollHeight) supaya struk panjang tidak
      // terpotong — wrapper memakai overflow-hidden.
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
      link.download = `Nota-${nota?.noInvoice ?? nota?.noTransaksi ?? "Transaksi"}.png`;
      link.href = imgDataUrl;
      link.click();
      toast.success("Gambar berhasil disimpan!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan gambar.");
    }
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
        : isCash && cashReceived > 0
          ? [{ tipe: "CASH" as const, jumlah: Math.min(cashReceived, grandTotalCost) }]
          : paymentMethod === "TRANSFER"
            ? [{ tipe: "TRANSFER" as const, jumlah: grandTotalCost }]
            : [];

      const res = await createTransaction({
        tipe,
        namaClient,
        alamat,
        namaWs,
        projectNama,
        projectGroupNama,
        paymentMethod: isSplitActive ? (splitCredit > 0 ? "CREDIT" : "TRANSFER") : paymentMethod,
        namaBank,
        noRekening,
        atasNama,
        payments,
        buatInvoice: isSplitActive ? (splitCredit > 0 || buatInvoice) : buatInvoice,
        items: cart.map((l) => ({ itemId: l.itemId, qty: l.qty })),
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
          verifyUrl: res.verifyUrl ?? null,
          tanggal: new Date().toISOString(),
          namaClient,
          alamat,
          namaWs,
          namaBank: paymentMethod !== "CASH" || isSplitActive ? namaBank : "",
          noRekening: paymentMethod !== "CASH" || isSplitActive ? noRekening : "",
          atasNama: paymentMethod !== "CASH" || isSplitActive ? atasNama : "",
          items: cart.map((l, i) => ({
            kode: l.kode,
            nama: l.nama,
            harga: l.harga,
            qty: l.qty,
            subtotal: computed.lines[i].finalSubtotal,
          })),
          total: res.grandTotal,
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
          <div className="relative w-full max-w-lg rounded-[20px] bg-card p-6 shadow-[var(--shadow-modal)] border border-border anim-rise">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <FolderOpen size={18} className="text-[var(--primary)]" /> Daftar Transaksi Ditangguhkan
              </h3>
              <button onClick={() => setIsHoldModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {heldCarts.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-800/50 p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground text-sm">{item.name}</p>
                    <p className="text-[10px] text-slate-450 font-medium">Ditangguhkan: {item.date} • {item.cart.reduce((a, b) => a + b.qty, 0)} unit</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleRestoreCart(item.id)}>
                      Kembalikan
                    </Button>
                    <button
                      onClick={() => handleDeleteHeldCart(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition cursor-pointer"
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
      <div className="bg-card rounded-[18px] border border-border p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between max-w-3xl mx-auto relative px-4">
          {/* Background Connector Line */}
          <div className="absolute left-[10%] right-[10%] top-[30%] h-[3px] bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0 rounded-full" />
          {/* Active Connector Line */}
          <div
            className="absolute left-[10%] top-[30%] h-[3px] bg-gradient-to-r from-[var(--primary)] to-primary-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-in-out"
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
                  ? "bg-primary-50 border-primary-200 text-primary-600 font-extrabold"
                  : "bg-card border-border text-slate-400"
            )}>
              {cart.length > 0 && step > 1 ? "✓" : "1"}
            </div>
            <span className={cn(
              "text-[10px] sm:text-xs font-bold tracking-tight transition-colors",
              step === 1 ? "text-foreground font-extrabold" : "text-slate-400 group-hover:text-slate-650"
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
                  ? "bg-primary-50 border-primary-200 text-primary-600 font-extrabold"
                  : "bg-card border-border text-slate-400"
            )}>
              {step > 2 ? "✓" : "2"}
            </div>
            <span className={cn(
              "text-[10px] sm:text-xs font-bold tracking-tight transition-colors",
              step === 2 ? "text-foreground font-extrabold" : "text-slate-400 group-hover:text-slate-650"
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
                ? "bg-primary-500 border-primary-500 text-white ring-4 ring-primary-500/15 scale-110"
                : "bg-card border-border text-slate-400"
            )}>
              3
            </div>
            <span className={cn(
              "text-[10px] sm:text-xs font-bold tracking-tight transition-colors",
              step === 3 ? "text-primary-700 font-extrabold" : "text-slate-400 group-hover:text-slate-650"
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
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5 leading-none">
                    <Search size={16} className="text-primary" /> Katalog Barang POS
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400 hidden sm:flex items-center gap-1 shrink-0">
                    <Keyboard size={10} /> <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">F2</kbd> Cari | <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">F4</kbd> Bayar
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
                    maxLength={FIELD_LIMITS.search}
                    placeholder="Scan barcode atau ketik nama material... (Klik item di grid)"
                    className="h-11 w-full rounded-xl border border-border bg-slate-50/50 dark:bg-slate-800/50 pl-10 pr-10 text-sm text-foreground outline-none transition-all focus:border-[var(--primary)] focus:bg-card focus:ring-4 focus:ring-[var(--primary)]/10"
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => {
                        setQ("");
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-655 cursor-pointer flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dynamic Grid of Items */}
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 py-14 px-6 text-center select-none">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500">
                      <PackageSearch size={22} />
                    </div>
                    <p className="text-sm font-bold text-foreground">Maaf, barang belum tersedia di master data</p>
                    <p className="text-xs text-muted max-w-[280px] break-words">
                      Barang dengan kata kunci &quot;{q.length > 40 ? `${q.slice(0, 40)}…` : q}&quot; tidak ditemukan. Periksa kembali ejaan atau tambahkan barang baru di Master Barang.
                    </p>
                  </div>
                ) : (
                <div className="pos-catalog-grid grid gap-3 max-h-[320px] md:max-h-[460px] overflow-y-auto p-2.5 pr-2 scrollbar-thin">
                  {filtered.slice(0, 16).map((it) => {
                    const inCartQty = cart.find((l) => l.itemId === it.id)?.qty ?? 0;
                    const isInCart = inCartQty > 0;
                    return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        addToCart(it);
                        toast.success(`${it.nama} masuk keranjang`);
                      }}
                      className={cn("pos-item-card group", isInCart && "pos-item-card-active")}
                    >
                      {isInCart && (
                        <span className="pos-item-qty-badge">{inCartQty}</span>
                      )}
                      <div className="space-y-1.5">
                        <p className="pos-item-name line-clamp-2 text-xs font-bold leading-snug">{it.nama}</p>
                        <span className="pos-item-kode inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wide">{it.kode}</span>
                      </div>
                      <div className="pos-item-divider mt-4 flex items-center justify-between border-t pt-2.5 w-full">
                        <span className="pos-item-price font-mono text-xs font-extrabold">{formatRupiah(it.hargaJual)}</span>
                        <Badge tone={it.stok <= 0 ? "red" : it.stok < 10 ? "amber" : "green"} className="text-[8px] px-1.5 py-0.5 select-none font-bold">
                          {it.stok <= 0 ? "habis" : `stok ${it.stok}`}
                        </Badge>
                      </div>
                    </button>
                    );
                  })}
                </div>
                )}
              </Card>

              {/* Modern Cart List */}
              <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50">
                  <h3 className="text-sm font-bold text-foreground leading-none">Keranjang Belanja</h3>
                  <Badge tone="blue" className="text-xs select-none">
                    {totalQtyCount} item
                  </Badge>
                </div>

                {/* Desktop/Tablet Table Layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table className="border-none shadow-none bg-transparent rounded-none">
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
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-655 transition cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </Td>
                            <Td>
                              <div className="font-bold text-foreground text-xs sm:text-sm">{l.nama}</div>
                              <div className="font-mono text-[9px] text-slate-450 flex items-center gap-1.5 mt-1 select-none">
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
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-95 transition cursor-pointer"
                                >
                                  <Minus size={13} />
                                </button>
                                <input
                                  type="number"
                                  value={l.qty}
                                  min={1}
                                  max={FIELD_LIMITS.maxQty}
                                  onChange={(e) => updateQty(l.itemId, parseInt(e.target.value) || 1)}
                                  className="h-8 w-11 rounded-lg border border-border text-center text-xs font-semibold font-mono outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => addToCart({ id: l.itemId, kode: l.kode, nama: l.nama, hargaJual: l.harga, stok: l.stok })}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-95 transition cursor-pointer"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </Td>
                            <Td className="text-right font-bold font-mono text-foreground text-xs">{formatRupiah(lineSubtotal)}</Td>
                          </tr>
                        );
                      })}
                      {cart.length === 0 && (
                        <tr>
                          <Td colSpan={5} className="py-16 text-center text-slate-400 select-none">
                            <ShoppingBag className="mx-auto text-slate-200 dark:text-slate-700 mb-2" size={32} />
                            <p className="font-semibold text-sm">Keranjang Belanja Kosong</p>
                            <p className="text-xs">Browse atau cari barang di katalog atas untuk transaksi.</p>
                          </Td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>

                {/* Mobile Card-Based List Layout */}
                <div className="block sm:hidden divide-y divide-border">
                  {cart.map((l, i) => {
                    const isOverStock = l.qty > l.stok;
                    const lineSubtotal = computed.lines[i].base;
                    return (
                      <div key={l.itemId} className="p-4 space-y-3 bg-card">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1 pr-2">
                            <div className="font-bold text-foreground text-xs leading-snug">{l.nama}</div>
                            <div className="font-mono text-[9px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-1 select-none">
                              <span>{l.kode}</span>
                              {isOverStock && (
                                <Badge tone="red" className="text-[7px] px-1 py-0">
                                  ⚠️ Stok Minus (Tersedia: {l.stok})
                                </Badge>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(l.itemId)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-655 transition cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <div className="font-mono text-xs text-slate-500 font-medium">
                            {formatRupiah(l.harga)}
                          </div>
                          
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-150">
                            <button
                              type="button"
                              onClick={() => updateQty(l.itemId, l.qty - 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-card text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer border border-border/80 shadow-xs"
                            >
                              <Minus size={11} />
                            </button>
                            <input
                              type="number"
                              value={l.qty}
                              min={1}
                              max={FIELD_LIMITS.maxQty}
                              onChange={(e) => updateQty(l.itemId, parseInt(e.target.value) || 1)}
                              className="w-9 text-center text-xs font-semibold font-mono outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => addToCart({ id: l.itemId, kode: l.kode, nama: l.nama, hargaJual: l.harga, stok: l.stok })}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-card text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer border border-border/80 shadow-xs"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                          
                          <div className="text-right font-extrabold font-mono text-foreground text-xs sm:text-sm">
                            {formatRupiah(lineSubtotal)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {cart.length === 0 && (
                    <div className="py-12 text-center text-slate-455 select-none">
                      <ShoppingBag className="mx-auto text-slate-200 dark:text-slate-700 mb-2.5" size={32} />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Keranjang Belanja Kosong</p>
                      <p className="text-xs text-slate-400 mt-1">Browse atau cari barang di katalog atas untuk transaksi.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 anim-rise">
              {/* Spacious Customer / CRM Details */}
              <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-3.5 bg-slate-50/20 dark:bg-slate-800/20 -mx-6 px-6 -mt-6 pt-5 rounded-t-[18px]">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
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
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-bold text-slate-655 mb-0">
                          Nama Klien / Pelanggan {tipe === "PROJECT" && <span className="text-rose-500 font-bold">*</span>}
                        </Label>
                        <CharCounter value={namaClient} max={FIELD_LIMITS.namaClient} />
                      </div>
                      <Input
                        id="namaClientInput"
                        value={namaClient}
                        onChange={(e) => setNamaClient(e.target.value)}
                        maxLength={FIELD_LIMITS.namaClient}
                        placeholder="Nama klien (Ibu Indah / Toko Plywood)"
                        className="mt-1.5 h-10 rounded-xl"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            document.getElementById("namaWsInput")?.focus();
                          }
                        }}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-bold text-slate-655 mb-0">Referensi Bengkel / Workshop</Label>
                        <CharCounter value={namaWs} max={FIELD_LIMITS.namaWs} />
                      </div>
                      <Input
                        id="namaWsInput"
                        value={namaWs}
                        onChange={(e) => setNamaWs(e.target.value)}
                        maxLength={FIELD_LIMITS.namaWs}
                        placeholder="Nama Workshop (Budi Carpenter) - Opsional"
                        className="mt-1.5 h-10 rounded-xl"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (tipe === "PROJECT") {
                              document.getElementById("projectNamaInput")?.focus();
                            } else {
                              document.getElementById("btnLanjutPembayaran")?.focus();
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Right Column Project Mapping (dynamic) */}
                  <div className="space-y-4.5">
                    {tipe === "PROJECT" ? (
                      <div className="space-y-4.5 anim-rise">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-bold text-slate-655 mb-0">Nama Proyek</Label>
                            <CharCounter value={projectNama} max={FIELD_LIMITS.projectNama} />
                          </div>
                          <Input
                            id="projectNamaInput"
                            value={projectNama}
                            onChange={(e) => setProjectNama(e.target.value)}
                            maxLength={FIELD_LIMITS.projectNama}
                            placeholder="Nama Proyek (Renov Cluster A)"
                            className="mt-1.5 h-10 rounded-xl"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                document.getElementById("projectGroupInput")?.focus();
                              }
                            }}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-bold text-slate-655 mb-0">Grup Proyek</Label>
                            <CharCounter value={projectGroupNama} max={FIELD_LIMITS.projectGroupNama} />
                          </div>
                          <Input
                            id="projectGroupInput"
                            value={projectGroupNama}
                            onChange={(e) => setProjectGroupNama(e.target.value)}
                            maxLength={FIELD_LIMITS.projectGroupNama}
                            placeholder="Nama Group Proyek (Ciputra Group) - Opsional"
                            className="mt-1.5 h-10 rounded-xl"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                document.getElementById("alamatInput")?.focus();
                              }
                            }}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-bold text-slate-655 mb-0">Alamat Pengiriman</Label>
                            <CharCounter value={alamat} max={FIELD_LIMITS.alamat} />
                          </div>
                          <Textarea
                            id="alamatInput"
                            value={alamat}
                            onChange={(e) => setAlamat(e.target.value)}
                            maxLength={FIELD_LIMITS.alamat}
                            rows={3}
                            placeholder="Alamat lengkap tujuan material dikirim"
                            className="mt-1.5 rounded-xl"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col justify-center items-center p-6 border border-dashed border-border rounded-[18px] bg-slate-50/40 dark:bg-slate-800/40 text-slate-400 select-none text-center min-h-[220px]">
                        <ShoppingBag size={32} className="text-slate-350 dark:text-slate-600 mb-2.5" />
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Pelanggan Eceran / Non-Proyek</p>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                          Pembelian kasir umum. Form isian proyek, grup proyek, dan alamat pengiriman logistik dinonaktifkan untuk transaksi retail.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2.5 pt-5 border-t border-border sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="outline" type="button" onClick={() => setStep(1)} className="w-full sm:w-auto h-10 px-4.5 rounded-xl gap-1.5 text-xs font-semibold">
                    &larr; Kembali ke Keranjang
                  </Button>
                  <Button
                    id="btnLanjutPembayaran"
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
                <div className="flex items-center justify-between border-b border-border pb-3.5 bg-slate-50/20 dark:bg-slate-800/20 -mx-6 px-6 -mt-6 pt-5 rounded-t-[18px]">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CreditCard size={18} className="text-primary-600" /> Langkah 3: Selesaikan Pembayaran
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
                        <div className="mt-2.5 space-y-3 rounded-xl border border-dashed border-border bg-slate-50/50 dark:bg-slate-800/50 p-3.5">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px] font-bold text-slate-500">Tunai</Label>
                              <input
                                type="number"
                                min={0}
                                max={FIELD_LIMITS.maxMoney}
                                value={splitCash || ""}
                                onChange={(e) => setSplitCash(parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="h-9 w-full rounded-lg border border-border bg-card text-center text-xs font-semibold font-mono outline-none"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-500">Transfer</Label>
                              <input
                                type="number"
                                min={0}
                                max={FIELD_LIMITS.maxMoney}
                                value={splitTransfer || ""}
                                onChange={(e) => setSplitTransfer(parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="h-9 w-full rounded-lg border border-border bg-card text-center text-xs font-semibold font-mono outline-none"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-500">Tempo</Label>
                              <input
                                type="number"
                                min={0}
                                max={FIELD_LIMITS.maxMoney}
                                value={splitCredit || ""}
                                onChange={(e) => setSplitCredit(parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="h-9 w-full rounded-lg border border-border bg-card text-center text-xs font-semibold font-mono outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold border-t border-border pt-2 select-none">
                            <span className="text-slate-500">Jumlah Terisi:</span>
                            <span className={isSplitValid ? "text-primary-600" : "text-red-500 font-extrabold"}>
                              {formatRupiah(splitTotal)} / {formatRupiah(grandTotalCost)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info bank opsional (muncul untuk Transfer / Kredit / Split) */}
                    {((!isSplitActive && paymentMethod !== "CASH") || isSplitActive) && (
                      <div className="space-y-3 rounded-xl border border-dashed border-border bg-slate-50/40 dark:bg-slate-800/40 p-3.5 anim-rise">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Info Bank (opsional) — tampil di struk
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-[10px] font-bold text-slate-500 mb-0">Nama Bank</Label>
                              <CharCounter value={namaBank} max={FIELD_LIMITS.namaBank} />
                            </div>
                            <Input
                              value={namaBank}
                              onChange={(e) => setNamaBank(e.target.value)}
                              maxLength={FIELD_LIMITS.namaBank}
                              placeholder="mis. BCA / Mandiri"
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-[10px] font-bold text-slate-500 mb-0">No. Rekening</Label>
                              <CharCounter value={noRekening} max={FIELD_LIMITS.noRekening} />
                            </div>
                            <Input
                              value={noRekening}
                              onChange={(e) => setNoRekening(e.target.value)}
                              maxLength={FIELD_LIMITS.noRekening}
                              placeholder="mis. 7720118234"
                              className="mt-1 h-9 rounded-lg text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-[10px] font-bold text-slate-500 mb-0">Atas Nama</Label>
                            <CharCounter value={atasNama} max={FIELD_LIMITS.atasNama} />
                          </div>
                          <Input
                            value={atasNama}
                            onChange={(e) => setAtasNama(e.target.value)}
                            maxLength={FIELD_LIMITS.atasNama}
                            placeholder="mis. PT Putra Corporation"
                            className="mt-1 h-9 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Auto invoice toggle */}
                    <label className="flex items-center gap-2 text-[10px] text-slate-650 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-border select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={buatInvoice}
                        onChange={(e) => setBuatInvoice(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-[var(--primary)] focus:ring-transparent cursor-pointer"
                      />
                      <span className="font-semibold">Otomatis buat Faktur Tagihan (Invoice)</span>
                    </label>
                  </div>

                  {/* Right: Cash received & Change due */}
                  <div className="space-y-4">
                    {(isCash || (isSplitActive && splitCash > 0)) ? (
                      <div className="space-y-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/70 p-4 border border-border">
                        <Label className="text-xs font-bold text-slate-650">Uang Tunai Diterima</Label>
                        <Input
                          type="number"
                          min={0}
                          max={FIELD_LIMITS.maxMoney}
                          value={cashReceived || ""}
                          onChange={(e) => setCashReceived(parseInt(e.target.value) || 0)}
                          placeholder="Jumlah uang diterima..."
                          className="h-10 text-right text-base font-bold font-mono rounded-xl bg-card"
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5 select-none">
                          <button
                            type="button"
                            onClick={() => setCashReceived(isSplitActive ? splitCash : grandTotalCost)}
                            className="rounded border border-primary-250 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/50 px-2.5 py-1 text-[10px] font-bold text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-800/50 cursor-pointer"
                          >
                            Uang Pas
                          </button>
                          {QUICK_CASH.map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setCashReceived(amt)}
                              className="rounded border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono cursor-pointer"
                            >
                              {amt >= 1000 ? `${amt / 1000}k` : amt}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setCashReceived(0)}
                            className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/50 cursor-pointer"
                          >
                            Belum Bayar
                          </button>
                        </div>
                        <div className={cn(
                          "rounded-lg px-3.5 py-2.5 text-xs mt-3 select-none space-y-1.5",
                          cashShort ? "bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800" : cashReceived === 0 ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800"
                        )}>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                            <span>Total Belanja</span>
                            <span className="font-mono font-semibold">{formatRupiah(isSplitActive ? (grandTotalCost - splitTransfer - splitCredit) : grandTotalCost)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                            <span>Uang Diterima</span>
                            <span className="font-mono font-semibold">{formatRupiah(cashReceived)}</span>
                          </div>
                          <div className="border-t border-current/15 pt-1.5">
                            <div className={cn(
                              "flex items-center justify-between font-bold",
                              cashShort ? "text-red-750 dark:text-red-300" : cashReceived === 0 ? "text-amber-700 dark:text-amber-300" : "text-primary-750 dark:text-primary-300"
                            )}>
                              <span>{cashShort ? "Kurang Bayar:" : cashReceived === 0 ? "Belum Ada Pembayaran" : "Uang Kembalian:"}</span>
                              <span className="font-mono font-extrabold text-sm">{cashReceived === 0 ? "" : formatRupiah(Math.abs(kembalian))}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col justify-center items-center p-6 border border-dashed border-border rounded-[18px] bg-slate-50/40 dark:bg-slate-800/40 text-slate-400 select-none text-center min-h-[160px]">
                        <CreditCard size={32} className="text-slate-350 dark:text-slate-600 mb-2.5" />
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Pembayaran Non-Tunai / Tempo</p>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] leading-relaxed">
                          Transaksi diproses menggunakan metode {paymentMethod === "CREDIT" ? "Tempo (Hutang Dagang)" : "Transfer Bank"}. Kalkulator uang kembalian dinonaktifkan.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-5 border-t border-border">
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
                <span className="text-2xl font-extrabold font-mono text-primary-400">{formatRupiah(grandTotalCost)}</span>
              </div>
            </Card>

            {/* Wizard Navigation Panel */}
            <Card className="p-5 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wide uppercase border-b border-border pb-2">Aksi Alur Pembayaran</h4>
              
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
                    className="w-full h-11 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white gap-1.5 shadow-md"
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
                <p className="rounded-lg bg-red-50 dark:bg-red-900/30 p-2.5 text-[11px] text-red-650 dark:text-red-300 font-semibold leading-relaxed border border-red-100 dark:border-red-800">{error}</p>
              )}
            </Card>

            {/* Hold/Pause Transactions (Only in Step 1 to keep things uncluttered) */}
            {step === 1 && (
              <Card className="p-4 space-y-3.5 anim-rise">
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wide uppercase border-b border-border pb-2">Penangguhan Struk</h4>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={holdCartName}
                    onChange={(e) => setHoldCartName(e.target.value)}
                    maxLength={60}
                    placeholder="Label nama hold..."
                    className="h-9 w-full rounded-xl border border-border bg-slate-50/50 dark:bg-slate-800/50 px-2.5 text-xs text-foreground outline-none focus:border-[var(--primary)] focus:bg-card focus:ring-4 focus:ring-[var(--primary)]/10"
                  />
                  <Button size="sm" variant="outline" className="h-9 shrink-0 text-xs px-3 rounded-xl gap-1" onClick={handleHoldCart} disabled={cart.length === 0}>
                    <Bookmark size={12} /> Hold
                  </Button>
                </div>

                {heldCarts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsHoldModalOpen(true)}
                    className="w-full flex justify-center items-center gap-2 rounded-xl bg-orange-50/70 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 py-2 text-xs font-bold text-[var(--primary)] hover:bg-orange-100 dark:hover:bg-orange-900/30 transition cursor-pointer select-none"
                  >
                    <FolderOpen size={13} /> Ada {heldCarts.length} Struk Ditangguhkan
                  </button>
                )}
              </Card>
            )}

            {/* Shopping Cart Review (In Step 2 & Step 3) */}
            {step > 1 && (
              <Card className="p-4 space-y-3 bg-slate-50/70 dark:bg-slate-800/70 border border-border anim-rise">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-border pb-1.5 select-none">Review Belanjaan ({totalQtyCount} item)</h4>
                <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                  {cart.map((l) => (
                    <div key={l.itemId} className="flex justify-between items-start text-[11px] gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground truncate leading-snug">{l.nama}</p>
                        <p className="text-[9px] text-slate-450 font-mono mt-0.5">{l.qty} unit @ {formatRupiah(l.harga)}</p>
                      </div>
                      <span className="font-bold font-mono text-slate-700 dark:text-slate-200 text-right shrink-0">
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[20px] bg-card shadow-2xl border border-border"
          >
            <div className="print-area">
              <Nota data={nota} />
            </div>
            <div className="no-print flex flex-col gap-2 border-t border-border p-4 bg-slate-50 dark:bg-slate-900 rounded-b-[20px]">
              <div className="flex flex-wrap sm:flex-nowrap justify-between gap-1.5 w-full">
                <Button onClick={() => printArea({ thermal: true })} variant="outline" size="sm" className="flex-1 min-w-[75px] h-9">
                  <Printer size={14} /> Thermal (80mm)
                </Button>
                <Button onClick={() => printArea({ className: "print-format-a4" })} size="sm" className="flex-1 min-w-[75px] h-9">
                  <FileText size={14} /> Cetak A4 PDF
                </Button>
                <Button variant="outline" size="sm" className="flex-1 min-w-[75px] h-9" onClick={() => setNota(null)}>
                  Tutup
                </Button>
              </div>
              <Button
                onClick={handleSaveToImage}
                variant="outline"
                size="sm"
                className="w-full h-9 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-[var(--primary)] font-bold gap-1.5 rounded-xl cursor-pointer"
              >
                <Camera size={14} /> Save to Image (PNG)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Dock for Mobile & Tablet (hidden on XL) */}
      {cart.length > 0 && (
        <div className="xl:hidden fixed bottom-4 left-4 right-4 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-border/80 p-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex items-center justify-between gap-4 select-none anim-rise no-print">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Belanja</span>
            <span className="text-base font-extrabold font-mono text-[var(--primary)]">{formatRupiah(grandTotalCost)}</span>
          </div>
          
          {step === 1 && (
            <Button
              onClick={() => setStep(2)}
              disabled={cart.length === 0}
              className="h-10 text-xs font-bold px-4 rounded-xl"
            >
              Lanjut &rarr;
            </Button>
          )}
          
          {step === 2 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-10 text-xs px-3 rounded-xl"
              >
                &larr;
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={tipe === "PROJECT" && !namaClient.trim()}
                className="h-10 text-xs font-bold px-4 rounded-xl"
              >
                Bayar &rarr;
              </Button>
            </div>
          )}
          
          {step === 3 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="h-10 text-xs px-3 rounded-xl"
              >
                &larr;
              </Button>
              <Button
                onClick={submitCheckout}
                disabled={pending || cart.length === 0 || cashShort || (isSplitActive && !isSplitValid)}
                className="h-10 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white px-4 rounded-xl shadow-sm"
              >
                {pending ? "..." : "Selesai (F4)"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
