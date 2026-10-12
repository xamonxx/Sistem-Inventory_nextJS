"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  FileText,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { toast } from "sonner";
import { createNgInvoice, resolveNgProductForCart } from "./actions";
import { Nota, type NotaData } from "@/components/Nota";
import { DatePicker } from "@/components/DatePicker";
import { Badge, Button, Card, CurrencyInput, Input, Label, Select, Table, Td, Textarea, Th } from "@/components/ui";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { PageHeader } from "@/components/page";
import { useNgCartStore } from "@/lib/ngCartStore";
import { computeNgCart, type NgComputedCartLine } from "@/lib/ngMargin";
import { printArea, setPdfTitle } from "@/lib/print";
import { formatRupiah, formatTanggal } from "@/lib/utils";

type ProductOption = {
  id: number;
  nama: string;
  namaToko: string;
  kategori: string | null;
  satuan: string | null;
  hargaBeli: number;
  hargaJual: number;
};

type GeneratedInvoice = {
  id: number;
  noInvoice: string;
  tanggal: string;
  namaToko: string;
  namaKonsumen: string;
  namaGrup: string;
  alamat: string;
  namaWorkshop: string;
  status: string;
  jatuhTempo: string | null;
  paymentMethod: "CASH" | "TRANSFER";
  totalModal: number;
  totalPenjualan: number;
  totalProfit: number;
  margin: number;
  markup: number;
  items: NgComputedCartLine[];
  namaBank: string;
  noRekening: string;
  atasNama: string;
};

type StepKey = 1 | 2 | 3;

type ItemDraft = {
  nama: string;
  kategori: string;
  satuan: string;
  hargaBeli: string;
  hargaJual: string;
  qty: string;
};

const EMPTY_ITEM_DRAFT: ItemDraft = {
  nama: "",
  kategori: "",
  satuan: "",
  hargaBeli: "",
  hargaJual: "",
  qty: "1",
};

type ProductPayload = {
  tokoSumber: string;
  nama: string;
  kategori: string;
  satuan: string;
  hargaBeli: number;
  hargaJual: number;
  qty: number;
};

type PriceConflictDialog = {
  message: string;
  payload: ProductPayload;
  existing: {
    hargaBeli: number;
    hargaJual: number;
  };
  incoming: {
    hargaBeli: number;
    hargaJual: number;
  };
};

type KonsumenOption = {
  id: number;
  nama: string;
  namaGrup: string;
  alamat: string;
  namaWorkshop: string;
};

export function NgBuatInvoiceClient({
  items,
  tokoOptions,
  konsumenOptions,
}: {
  items: ProductOption[];
  tokoOptions: string[];
  konsumenOptions: KonsumenOption[];
}) {
  const [activeStep, setActiveStep] = useState<StepKey>(1);
  const [q, setQ] = useState("");
  const [storeInput, setStoreInput] = useState("");
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [konsumenId, setKonsumenId] = useState<number | null>(null);
  const [konsumenDropdownOpen, setKonsumenDropdownOpen] = useState(false);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(EMPTY_ITEM_DRAFT);
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const [catalogItems, setCatalogItems] = useState<ProductOption[]>(items);
  const [knownStores, setKnownStores] = useState<string[]>(tokoOptions);
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState<GeneratedInvoice | null>(null);
  const [priceConflict, setPriceConflict] = useState<PriceConflictDialog | null>(null);
  const [pendingStoreChange, setPendingStoreChange] = useState<string | null>(null);
  const [printFormat, setPrintFormat] = useState<"a4" | "thermal">("a4");

  const {
    tanggal,
    tokoSumber,
    cart,
    namaKonsumen,
    namaGrup,
    alamat,
    namaWorkshop,
    paymentStatus,
    paymentMethod,
    namaBank,
    noRekening,
    atasNama,
    setTanggal,
    setTokoSumber,
    setNamaKonsumen,
    setNamaGrup,
    setAlamat,
    setNamaWorkshop,
    setPaymentStatus,
    setPaymentMethod,
    setNamaBank,
    setNoRekening,
    setAtasNama,
    upsertCartLine,
    removeFromCart,
    updateQty,
    clearForStore,
    clearCart,
  } = useNgCartStore();

  const computed = useMemo(() => computeNgCart(cart), [cart]);
  const computedTotalQty = useMemo(() => computed.lines.reduce((sum, line) => sum + line.qty, 0), [computed.lines]);

  const filteredStoreSuggestions = useMemo(() => {
    const keyword = storeInput.trim().toLowerCase();
    if (!keyword) return knownStores.slice(0, 8);
    return knownStores.filter((toko) => toko.toLowerCase().includes(keyword)).slice(0, 8);
  }, [storeInput, knownStores]);

  const filteredKonsumen = useMemo(() => {
    const keyword = namaKonsumen.trim().toLowerCase();
    if (!keyword) return konsumenOptions.slice(0, 8);
    return konsumenOptions
      .filter((k) => k.nama.toLowerCase().includes(keyword) || k.namaGrup.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [namaKonsumen, konsumenOptions]);

  function handleChooseKonsumen(k: KonsumenOption) {
    setNamaKonsumen(k.nama);
    setNamaGrup(k.namaGrup);
    setAlamat(k.alamat);
    setNamaWorkshop(k.namaWorkshop);
    setKonsumenId(k.id);
    setKonsumenDropdownOpen(false);
  }

  const storeCatalog = useMemo(
    () => catalogItems.filter((item) => (tokoSumber ? item.namaToko === tokoSumber : false)),
    [catalogItems, tokoSumber]
  );

  const filteredItems = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return storeCatalog.slice(0, 10);
    return storeCatalog
      .filter(
        (item) =>
          item.nama.toLowerCase().includes(keyword) ||
          (item.kategori ?? "").toLowerCase().includes(keyword) ||
          (item.satuan ?? "").toLowerCase().includes(keyword)
      )
      .slice(0, 10);
  }, [q, storeCatalog]);

  const itemNameSuggestions = useMemo(() => {
    const keyword = itemDraft.nama.trim().toLowerCase();
    const source = keyword
      ? storeCatalog.filter((item) => item.nama.toLowerCase().includes(keyword))
      : storeCatalog;
    return source.slice(0, 8);
  }, [itemDraft.nama, storeCatalog]);

  useEffect(() => {
    setStoreInput(tokoSumber);
  }, [tokoSumber]);

  useEffect(() => {
    if (!generated) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".print-preview-scroll")?.scrollTo({ top: 0, left: 0 });
    });
  }, [generated, printFormat]);

  function setDraft<K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) {
    setItemDraft((prev) => ({ ...prev, [key]: value }));
  }

  function syncCatalogItem(product: {
    id: number;
    nama: string;
    namaToko: string;
    kategori: string;
    satuan: string;
    hargaBeli: number;
    hargaJual: number;
  }) {
    setCatalogItems((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      const next = exists
        ? prev.map((item) => (item.id === product.id ? { ...item, ...product } : item))
        : [...prev, product];
      return next.sort((a, b) => a.nama.localeCompare(b.nama));
    });
    setKnownStores((prev) =>
      prev.includes(product.namaToko) ? prev : [...prev, product.namaToko].sort((a, b) => a.localeCompare(b))
    );
  }

  function applyProductToCart(
    product: {
      id: number;
      nama: string;
      namaToko: string;
      kategori: string;
      satuan: string;
      hargaBeli: number;
      hargaJual: number;
      qty: number;
    },
    mergeQty: boolean
  ) {
    const existingLine = cart.find((line) => line.produkId === product.id);
    const nextQty = mergeQty && existingLine ? existingLine.qty + product.qty : product.qty;

    upsertCartLine({
      produkId: product.id,
      nama: product.nama,
      namaToko: product.namaToko,
      kategori: product.kategori,
      satuan: product.satuan,
      hargaBeli: product.hargaBeli,
      hargaJual: product.hargaJual,
      qty: nextQty,
    });
  }

  function prefillDraftFromCatalog(item: ProductOption) {
    setSelectedCatalogId(item.id);
    setItemDraft((prev) => {
      const isSameDraft =
        selectedCatalogId === item.id ||
        (prev.nama.trim().toLowerCase() === item.nama.toLowerCase() &&
          Number(prev.hargaBeli || 0) === item.hargaBeli &&
          Number(prev.hargaJual || 0) === item.hargaJual);
      const currentQty = Math.max(0, Math.trunc(Number(prev.qty || 0)));
      const nextQty = isSameDraft ? Math.min(FIELD_LIMITS.maxQty, currentQty + 1) : 1;

      return {
        nama: item.nama,
        kategori: item.kategori ?? "",
        satuan: item.satuan ?? "",
        hargaBeli: String(item.hargaBeli),
        hargaJual: String(item.hargaJual),
        qty: String(nextQty),
      };
    });
    toast.info(`Data "${item.nama}" diisi ke form barang.`);
  }

  function handleChooseStore(nextStore: string) {
    const normalizedStore = nextStore.trim();
    setStoreDropdownOpen(false);
    if (!normalizedStore) {
      setStoreInput("");
      if (cart.length === 0) setTokoSumber("");
      return;
    }

    if (normalizedStore === tokoSumber) {
      setStoreInput(normalizedStore);
      if (activeStep < 2) setActiveStep(2);
      return;
    }

    if (cart.length > 0) {
      setPendingStoreChange(normalizedStore);
      return;
    }

    applyStoreChange(normalizedStore, false);
  }

  function applyStoreChange(normalizedStore: string, resetCart: boolean) {
    if (resetCart) {
      clearForStore(normalizedStore);
      setQ("");
      setItemDraft(EMPTY_ITEM_DRAFT);
      setSelectedCatalogId(null);
      toast.info(`Keranjang dikosongkan untuk toko ${normalizedStore}.`);
    } else {
      setTokoSumber(normalizedStore);
    }
    setStoreInput(normalizedStore);
    setKnownStores((prev) =>
      prev.includes(normalizedStore) ? prev : [...prev, normalizedStore].sort((a, b) => a.localeCompare(b))
    );
    setActiveStep(2);
  }

  function handleResetCart() {
    clearCart();
    setQ("");
    setStoreInput("");
    setItemDraft(EMPTY_ITEM_DRAFT);
    setSelectedCatalogId(null);
    setActiveStep(1);
    toast.info("Keranjang Invoice dibersihkan.");
  }

  function handleAddOrUpdateItem() {
    if (!tokoSumber) {
      toast.warning("Pilih toko sumber terlebih dahulu.");
      return;
    }
    if (!itemDraft.nama.trim()) {
      toast.warning("Nama barang wajib diisi.");
      return;
    }

    const payload: ProductPayload = {
      tokoSumber,
      nama: itemDraft.nama.trim(),
      kategori: itemDraft.kategori.trim(),
      satuan: itemDraft.satuan.trim(),
      hargaBeli: Number(itemDraft.hargaBeli || 0),
      hargaJual: Number(itemDraft.hargaJual || 0),
      qty: Number(itemDraft.qty || 0),
    };

    startTransition(async () => {
      const resolved = await resolveNgProductForCart(payload);

      if (resolved && "error" in resolved && resolved.error) {
        toast.error(resolved.error);
        return;
      }

      if (resolved && "conflict" in resolved && resolved.conflict) {
        setPriceConflict({
          message: resolved.message,
          payload,
          existing: resolved.existing,
          incoming: resolved.incoming,
        });
        return;
      }

      if (resolved && "ok" in resolved && resolved.ok) {
        syncCatalogItem(resolved.product);
        applyProductToCart(resolved.product, true);
        setItemDraft(EMPTY_ITEM_DRAFT);
        setSelectedCatalogId(null);
        setItemDropdownOpen(false);
        toast.success(
          resolved.updatedExisting
            ? `Barang "${resolved.product.nama}" diperbarui lalu ditambahkan ke invoice.`
            : `Barang "${resolved.product.nama}" ditambahkan ke invoice.`
        );
      }
    });
  }

  function handleConfirmPriceConflict() {
    if (!priceConflict) return;
    const payload = priceConflict.payload;

    startTransition(async () => {
      const forced = await resolveNgProductForCart({ ...payload, forceUpdate: true });
      if (forced && "error" in forced && forced.error) {
        toast.error(forced.error);
        return;
      }
      if (forced && "ok" in forced && forced.ok) {
        syncCatalogItem(forced.product);
        applyProductToCart(forced.product, true);
        setItemDraft(EMPTY_ITEM_DRAFT);
        setSelectedCatalogId(null);
        setItemDropdownOpen(false);
        setPriceConflict(null);
        toast.success(`Barang "${forced.product.nama}" diperbarui dan ditambahkan ke invoice.`);
      }
    });
  }

  function handleCreateInvoice() {
    if (!tokoSumber) {
      toast.warning("Pilih toko sumber terlebih dahulu.");
      return;
    }
    if (cart.length === 0) {
      toast.warning("Keranjang Invoice masih kosong.");
      return;
    }

    startTransition(async () => {
      const result = await createNgInvoice({
        tanggal,
        namaToko: tokoSumber,
        konsumenId,
        namaKonsumen,
        namaGrup,
        alamat,
        namaWorkshop,
        paymentStatus,
        paymentMethod,
        namaBank,
        noRekening,
        atasNama,
        items: cart.map((line) => ({ produkId: line.produkId, qty: line.qty })),
      });

      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      if (result && "ok" in result && result.ok) {
        setGenerated(result.invoice);
        setPrintFormat("a4");
        clearCart();
        setQ("");
        setStoreInput("");
        setItemDraft(EMPTY_ITEM_DRAFT);
        setKonsumenId(null);
        setActiveStep(1);
        toast.success(`Invoice ${result.invoice.noInvoice} berhasil dibuat.`);
      }
    });
  }

  function openPrintPreview() {
    if (!generated) return;
    const isThermal = printFormat === "thermal";
    setPdfTitle(generated.noInvoice, generated.namaKonsumen || "Konsumen", isThermal);
    printArea(isThermal ? { thermal: true } : { className: "print-format-a4" });
  }

  async function handleSaveToImage() {
    if (!generated) return;
    const element = document.querySelector<HTMLElement>(".print-area");
    if (!element) {
      toast.error("Pratinjau nota belum siap. Tutup lalu buka lagi pratinjau, kemudian coba cetak/simpan ulang.");
      return;
    }

    const prevZoom = element.style.zoom;
    try {
      toast.info("Sedang mengambil gambar...");
      element.style.zoom = "1";
      void element.offsetWidth;
      const { toPng } = await import("html-to-image");
      const imgDataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: element.scrollWidth,
        height: element.scrollHeight,
        cacheBust: true,
        style: { margin: "0", borderRadius: "0", zoom: "1" },
      });
      const safeName = (generated.namaKonsumen || "Konsumen").replace(/[\\/:*?"<>|]/g, "").trim();
      const suffix = printFormat === "thermal" ? "-THERMAL" : "";
      const link = document.createElement("a");
      link.download = `${generated.noInvoice}-${safeName}${suffix}.png`;
      link.href = imgDataUrl;
      link.click();
      toast.success("Gambar berhasil disimpan.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan gambar. Coba lagi, atau gunakan tombol Cetak untuk simpan sebagai PDF.");
    } finally {
      element.style.zoom = prevZoom;
    }
  }

  function buildNotaData(invoice: GeneratedInvoice): NotaData {
    return {
      noInvoice: invoice.noInvoice,
      tanggal: invoice.tanggal,
      jatuhTempo: invoice.jatuhTempo,
      namaClient: invoice.namaKonsumen || "Konsumen",
      alamat: invoice.alamat,
      namaWs: invoice.namaWorkshop,
      namaBank: invoice.namaBank,
      noRekening: invoice.noRekening,
      atasNama: invoice.atasNama,
      items: invoice.items.map((line) => ({
        nama: line.nama,
        harga: line.hargaJual,
        qty: line.qty,
        subtotal: line.subtotalPenjualan,
      })),
      total: invoice.totalPenjualan,
      bayar: invoice.status === "LUNAS" ? invoice.totalPenjualan : 0,
      sisaTagihan: invoice.status === "LUNAS" ? 0 : invoice.totalPenjualan,
      judul: "INVOICE NON-GUDANG",
      metodePembayaran: invoice.paymentMethod === "TRANSFER" ? "Transfer" : "Cash",
      catatan:
        invoice.status === "LUNAS"
          ? "Pembayaran lunas. Terima kasih atas kepercayaan Anda."
          : `Tempo 7 hari${invoice.jatuhTempo ? `, jatuh tempo ${formatTanggal(invoice.jatuhTempo)}` : ""}.`,
    };
  }

  const showStep1FloatingNext = activeStep === 1 && !!tokoSumber;
  const showStep2FloatingNext = activeStep === 2 && cart.length > 0;
  const showStep3FloatingActions = activeStep === 3 && cart.length > 0;
  // Bar navigasi bawah tampil untuk: step 1 (jika toko sudah dipilih), atau step 2/3.
  // Dipakai desktop (floating) & mobile/tablet (fixed) — beri padding bawah agar
  // konten terakhir tidak tertutup bar.
  const showBottomNav = activeStep === 1 ? !!tokoSumber : true;
  const hasFloatingActions = showBottomNav;

  return (
    <div className={`space-y-6 ${hasFloatingActions ? "pb-24 xl:pb-28" : ""}`}>
      <PageHeader
        eyebrow="Non-Gudang"
        title="Keranjang & Buat Invoice"
        description="Pilih toko sumber, input barang, cek margin, lalu buat invoice. Barang yang sama diperbarui lewat konfirmasi."
      />

      {/* Langkah + ringkasan singkat */}
      <div className="bento-card grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
        <nav aria-label="Langkah pembuatan invoice" className="flex items-center gap-1.5 p-2.5 sm:gap-2 sm:p-3">
          <StepPill step={1} activeStep={activeStep} label="Toko" done={activeStep > 1} onClick={() => setActiveStep(1)} />
          <span className={`h-px flex-1 ${activeStep > 1 ? "bg-[var(--primary)]" : "bg-border"}`} />
          <StepPill step={2} activeStep={activeStep} label="Barang" done={activeStep > 2} onClick={() => tokoSumber && setActiveStep(2)} disabled={!tokoSumber} />
          <span className={`h-px flex-1 ${activeStep > 2 ? "bg-[var(--primary)]" : "bg-border"}`} />
          <StepPill step={3} activeStep={activeStep} label="Invoice" done={false} onClick={() => cart.length > 0 && setActiveStep(3)} disabled={cart.length === 0} />
        </nav>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border lg:border-l lg:border-t-0">
          <SlimMetric label="Toko sumber" value={tokoSumber || "–"} hint={tokoSumber ? "Siap dipakai" : "Belum dipilih"} />
          <SlimMetric label="Item" value={String(cart.length)} hint={`${computedTotalQty} qty`} />
          <SlimMetric label="Keuntungan" value={formatRupiah(computed.totalProfit)} hint={`${computed.margin}% margin`} positive />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px] xl:items-start">
        <div className="space-y-6">
          {activeStep === 1 && (
            <Card className="bento-card !overflow-visible space-y-4 !p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground">1. Pilih Toko Sumber</h2>
                  <p className="mt-1 text-xs text-slate-500">Mulai dengan memilih toko sumber terlebih dahulu.</p>
                </div>
                {tokoSumber ? <Badge tone="blue">{tokoSumber}</Badge> : <Badge tone="amber">Belum dipilih</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_160px_minmax(320px,0.95fr)] lg:items-start">
                <div className="min-w-0">
                  <Label>Toko sumber</Label>
                  <div className="relative">
                    <Input
                      value={storeInput}
                      onFocus={() => setStoreDropdownOpen(true)}
                      onChange={(e) => {
                        setStoreInput(e.target.value);
                        setStoreDropdownOpen(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setStoreDropdownOpen(false);
                          handleChooseStore(storeInput);
                        }, 120);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleChooseStore(storeInput);
                        }
                        if (e.key === "Escape") {
                          setStoreDropdownOpen(false);
                        }
                      }}
                      maxLength={FIELD_LIMITS.supplierName}
                      placeholder="Ketik nama toko..."
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setStoreDropdownOpen((open) => !open)}
                      className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-[var(--surface-hover)] hover:text-foreground"
                      aria-label="Tampilkan saran toko"
                    >
                      <ChevronDown size={16} className={`transition-transform ${storeDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {storeDropdownOpen && filteredStoreSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)]">
                        <div className="max-h-56 overflow-y-auto p-1.5">
                          {filteredStoreSuggestions.map((toko) => (
                            <button
                              key={toko}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleChooseStore(toko)}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-[var(--surface-hover)]"
                            >
                              <span className="truncate">{toko}</span>
                              {toko === tokoSumber && <Badge tone="blue">Dipakai</Badge>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Bisa diketik bebas, saran akan muncul bila toko sudah pernah dipakai.</p>
                </div>
                <div className="flex items-end lg:pt-[25px]">
                  <Button type="button" variant="outline" onClick={() => handleChooseStore(storeInput)} className="w-full min-w-[140px]">
                    Pakai
                  </Button>
                </div>
                <div className="min-w-0">
                  <Label>Tanggal invoice</Label>
                  <DatePicker value={tanggal} onChange={setTanggal} />
                </div>
              </div>
            </Card>
          )}

          {activeStep === 2 && (
            <>
              <Card className="bento-card !overflow-visible space-y-4 !p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">2. Input Barang &amp; Tambahkan ke Invoice</h2>
                    <p className="mt-1 text-xs text-slate-500">Ketik barang baru atau ambil dari saran katalog toko yang sama.</p>
                  </div>
                  <Badge tone="slate">{storeCatalog.length} katalog toko</Badge>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>Nama barang</Label>
                    <div className="relative">
                      <Input
                        value={itemDraft.nama}
                        onFocus={() => tokoSumber && setItemDropdownOpen(true)}
                        onChange={(e) => {
                          setDraft("nama", e.target.value);
                          setSelectedCatalogId(null);
                          setItemDropdownOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setItemDropdownOpen(false);
                        }}
                        maxLength={FIELD_LIMITS.namaBarang}
                        placeholder="Contoh: MDF 18mm"
                        disabled={!tokoSumber}
                        className="pr-11"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => tokoSumber && setItemDropdownOpen((open) => !open)}
                        className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-[var(--surface-hover)] hover:text-foreground disabled:opacity-40"
                        disabled={!tokoSumber}
                        aria-label="Tampilkan saran barang"
                      >
                        <ChevronDown size={16} className={`transition-transform ${itemDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {itemDropdownOpen && itemNameSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)]">
                          <div className="max-h-64 overflow-y-auto p-1.5">
                            {itemNameSuggestions.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  prefillDraftFromCatalog(item);
                                  setItemDropdownOpen(false);
                                }}
                                className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-hover)]"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-bold text-foreground">{item.nama}</span>
                                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                                    {item.kategori || "Tanpa kategori"}{item.satuan ? ` - ${item.satuan}` : ""}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right text-[11px] font-semibold text-slate-500">
                                  {formatRupiah(item.hargaJual)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Kategori</Label>
                    <Input value={itemDraft.kategori} onChange={(e) => setDraft("kategori", e.target.value)} maxLength={40} placeholder="Opsional" disabled={!tokoSumber} />
                  </div>
                  <div>
                    <Label>Satuan</Label>
                    <Input value={itemDraft.satuan} onChange={(e) => setDraft("satuan", e.target.value)} maxLength={20} placeholder="Lembar / batang / pcs" disabled={!tokoSumber} />
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input type="number" min={1} max={FIELD_LIMITS.maxQty} value={itemDraft.qty} onChange={(e) => setDraft("qty", e.target.value)} disabled={!tokoSumber} />
                  </div>
                  <div>
                    <Label>Harga beli</Label>
                    <CurrencyInput max={FIELD_LIMITS.maxMoney} value={itemDraft.hargaBeli} onValueChange={(value) => setDraft("hargaBeli", value)} placeholder="Harga modal" disabled={!tokoSumber} />
                  </div>
                  <div>
                    <Label>Harga jual</Label>
                    <CurrencyInput max={FIELD_LIMITS.maxMoney} value={itemDraft.hargaJual} onValueChange={(value) => setDraft("hargaJual", value)} placeholder="Harga jual ke konsumen" disabled={!tokoSumber} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleAddOrUpdateItem} disabled={!tokoSumber || pending}>
                    <Plus size={14} /> {pending ? "Memproses..." : "Tambahkan ke invoice"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setItemDraft(EMPTY_ITEM_DRAFT);
                      setSelectedCatalogId(null);
                      setItemDropdownOpen(false);
                    }}
                    disabled={!tokoSumber}
                  >
                    <RotateCcw size={14} /> Kosongkan Form Barang
                  </Button>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-3.5 text-xs leading-relaxed text-[var(--text-soft)]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <p>
                      Jika nama barang yang sama di toko ini dimasukkan lagi tetapi harga beli atau harga jualnya berbeda, sistem akan menampilkan konfirmasi. Jika Anda pilih lanjut, data barang lama akan diperbarui lalu item invoice mengikuti harga terbaru.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="mb-0">Saran dari katalog toko ini</Label>
                    <Badge tone="blue">{filteredItems.length} cocok</Badge>
                  </div>
                  <div className="relative">
                    <Search size={16} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[var(--text-soft)]" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={FIELD_LIMITS.search} placeholder="Cari nama barang atau kategori..." className="pl-11" disabled={!tokoSumber} />
                  </div>
                  <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                    {filteredItems.map((item) => {
                      const isSelected = selectedCatalogId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => prefillDraftFromCatalog(item)}
                          className={[
                            "relative cursor-pointer rounded-xl border px-3 py-2.5 text-left transition",
                            "bg-[var(--surface-2)]/40 hover:bg-[var(--surface-2)]/80",
                            isSelected
                              ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/15"
                              : "border-border hover:border-[var(--primary)]/35",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-foreground">{item.nama}</p>
                              <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted-2)]">
                                {item.kategori || "Tanpa kategori"}{item.satuan ? ` · ${item.satuan}` : ""}
                              </p>
                            </div>
                            {isSelected && <Badge tone="blue">Dipakai x{Math.max(1, Number(itemDraft.qty || 1))}</Badge>}
                          </div>
                          <p className="tnum mt-1.5 text-[11px] text-[var(--text-soft)]">
                            Modal {formatRupiah(item.hargaBeli)} → <span className="font-semibold text-foreground">Jual {formatRupiah(item.hargaJual)}</span>
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </Card>

              <Card className="bento-card !overflow-visible space-y-4 !p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Keranjang Invoice</h2>
                    <p className="mt-1 text-xs text-slate-500">Kalau barang yang sama diperbarui, harga di keranjang juga ikut diperbarui.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{cart.length} baris</Badge>
                    <Button size="sm" variant="outline" onClick={handleResetCart} disabled={cart.length === 0}>
                      <RotateCcw size={14} /> Reset
                    </Button>
                  </div>
                </div>
                <Table tableClassName="min-w-[780px]">
                  <thead>
                    <tr>
                      <Th>Barang</Th>
                      <Th className="text-right">Qty</Th>
                      <Th className="text-right">Modal</Th>
                      <Th className="text-right">Jual</Th>
                      <Th className="text-right">Keuntungan</Th>
                      <Th className="text-right">Margin</Th>
                      <Th className="text-right">Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.lines.map((line) => (
                      <tr key={line.produkId}>
                        <Td>
                          <div className="min-w-[180px]">
                            <p className="font-bold text-foreground">{line.nama}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {line.namaToko}
                              {line.satuan ? ` - ${line.satuan}` : ""}
                            </p>
                          </div>
                        </Td>
                        <Td className="text-right">
                          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-2 py-1 dark:bg-slate-900">
                            <button type="button" onClick={() => updateQty(line.produkId!, line.qty - 1)} className="text-slate-500 transition hover:text-foreground">
                              <Minus size={14} />
                            </button>
                            <CartQtyInput
                              qty={line.qty}
                              onCommit={(nextQty) => updateQty(line.produkId!, nextQty)}
                            />
                            <button type="button" onClick={() => updateQty(line.produkId!, line.qty + 1)} className="text-slate-500 transition hover:text-foreground">
                              <Plus size={14} />
                            </button>
                          </div>
                        </Td>
                        <Td className="text-right font-mono">{formatRupiah(line.subtotalModal)}</Td>
                        <Td className="text-right font-mono">{formatRupiah(line.subtotalPenjualan)}</Td>
                        <Td className="text-right font-mono text-emerald-600">{formatRupiah(line.subtotalProfit)}</Td>
                        <Td className="text-right">
                          <Badge tone={line.margin >= 20 ? "green" : line.margin >= 10 ? "blue" : "amber"}>{line.margin}%</Badge>
                        </Td>
                        <Td className="text-right">
                          <button
                            type="button"
                            onClick={() => removeFromCart(line.produkId!)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </Td>
                      </tr>
                    ))}
                    {cart.length === 0 && (
                      <tr>
                        <Td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                          Keranjang Invoice masih kosong.
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </Card>
            </>
          )}

          {activeStep === 3 && (
            <>
              <Card className="bento-card !overflow-visible space-y-4 !p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Keranjang Invoice</h2>
                    <p className="mt-1 text-xs text-slate-500">Tinjau ulang seluruh item sebelum invoice dibuat.</p>
                  </div>
                  <Badge tone="blue">{cart.length} baris</Badge>
                </div>
                <Table tableClassName="min-w-[680px]">
                  <thead>
                    <tr>
                      <Th>Barang</Th>
                      <Th className="text-right">Qty</Th>
                      <Th className="text-right">Modal</Th>
                      <Th className="text-right">Jual</Th>
                      <Th className="text-right">Keuntungan</Th>
                      <Th className="text-right">Margin</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.lines.map((line) => (
                      <tr key={line.produkId}>
                        <Td>
                          <div className="min-w-[180px]">
                            <p className="font-bold text-foreground">{line.nama}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {line.namaToko}
                              {line.satuan ? ` - ${line.satuan}` : ""}
                            </p>
                          </div>
                        </Td>
                        <Td className="text-right font-semibold">{line.qty}</Td>
                        <Td className="text-right font-mono">{formatRupiah(line.subtotalModal)}</Td>
                        <Td className="text-right font-mono">{formatRupiah(line.subtotalPenjualan)}</Td>
                        <Td className="text-right font-mono text-emerald-600">{formatRupiah(line.subtotalProfit)}</Td>
                        <Td className="text-right">
                          <Badge tone={line.margin >= 20 ? "green" : line.margin >= 10 ? "blue" : "amber"}>{line.margin}%</Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>

              <Card className="bento-card !overflow-visible space-y-5 !p-5 sm:!p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-foreground">3. Data Konsumen &amp; Pembayaran</h2>
                    <p className="mt-1 text-sm text-slate-500">Lengkapi data pembeli dan tentukan kondisi pembayaran sebelum invoice dibuat.</p>
                  </div>
                  <Badge tone="blue">Siap invoice</Badge>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>Nama konsumen</Label>
                    <div className="relative">
                      <Input
                        value={namaKonsumen}
                        onChange={(e) => { setNamaKonsumen(e.target.value); setKonsumenId(null); setKonsumenDropdownOpen(true); }}
                        onFocus={() => setKonsumenDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setKonsumenDropdownOpen(false), 120)}
                        maxLength={FIELD_LIMITS.namaClient}
                        placeholder="Ketik atau pilih konsumen tersimpan"
                        disabled={cart.length === 0}
                        autoComplete="off"
                      />
                      {konsumenDropdownOpen && filteredKonsumen.length > 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)]">
                          <div className="max-h-56 overflow-y-auto p-1.5">
                            {filteredKonsumen.map((k) => (
                              <button
                                key={k.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleChooseKonsumen(k)}
                                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-hover)]"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-foreground">{k.nama}</span>
                                  {k.namaGrup && <span className="block truncate text-[11px] text-slate-500">{k.namaGrup}</span>}
                                </span>
                                {konsumenId === k.id && <Badge tone="blue">Dipilih</Badge>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {konsumenId !== null ? "Terhubung ke konsumen tersimpan." : "Pilih konsumen tersimpan untuk auto-isi, atau ketik nama baru (otomatis disimpan ke master)."}
                    </p>
                  </div>
                  <div>
                    <Label>Nama grup</Label>
                    <Input value={namaGrup} onChange={(e) => setNamaGrup(e.target.value)} maxLength={FIELD_LIMITS.projectGroupNama} placeholder="Opsional" disabled={cart.length === 0} />
                  </div>
                  <div>
                    <Label>Nama bengkel</Label>
                    <Input value={namaWorkshop} onChange={(e) => setNamaWorkshop(e.target.value)} maxLength={FIELD_LIMITS.namaWs} placeholder="Opsional" disabled={cart.length === 0} />
                  </div>
                  <div>
                    <Label>Tanggal invoice</Label>
                    <DatePicker value={tanggal} onChange={setTanggal} disabled={cart.length === 0} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Alamat</Label>
                    <Textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} maxLength={FIELD_LIMITS.alamat} rows={4} placeholder="Alamat pengiriman / catatan alamat" disabled={cart.length === 0} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>Kondisi bayar</Label>
                    <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as "LUNAS" | "TEMPO")} disabled={cart.length === 0}>
                      <option value="LUNAS">Lunas</option>
                      <option value="TEMPO">Tempo 7 Hari</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Metode bayar</Label>
                    <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "TRANSFER")} disabled={cart.length === 0}>
                      <option value="CASH">Cash</option>
                      <option value="TRANSFER">Transfer</option>
                    </Select>
                  </div>
                </div>

                {paymentMethod === "TRANSFER" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <Label>Nama bank</Label>
                      <Input value={namaBank} onChange={(e) => setNamaBank(e.target.value)} maxLength={FIELD_LIMITS.namaBank} placeholder="BCA / Mandiri / dll." disabled={cart.length === 0} />
                    </div>
                    <div>
                      <Label>Nomor rekening</Label>
                      <Input value={noRekening} onChange={(e) => setNoRekening(e.target.value)} maxLength={FIELD_LIMITS.noRekening} placeholder="Nomor rekening transfer" disabled={cart.length === 0} />
                    </div>
                    <div>
                      <Label>Atas nama</Label>
                      <Input value={atasNama} onChange={(e) => setAtasNama(e.target.value)} maxLength={FIELD_LIMITS.atasNama} placeholder="Pemilik rekening" disabled={cart.length === 0} />
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                  {paymentStatus === "LUNAS"
                    ? "Invoice akan langsung berstatus LUNAS dan otomatis membuat satu catatan pembayaran penuh."
                    : "Invoice akan dibuat sebagai TEMPO dengan jatuh tempo otomatis 7 hari dari tanggal invoice."}
                </div>

              </Card>
            </>
          )}
        </div>

        <div className={activeStep === 2 || activeStep === 3 ? "space-y-6 self-start xl:sticky xl:top-6" : "space-y-6"}>
          {activeStep === 1 && (
            <Card className="bento-card !overflow-visible space-y-4 !p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-foreground">Status Langkah</h2>
                {tokoSumber ? <Badge tone="blue">Siap lanjut</Badge> : <Badge tone="amber">Menunggu toko</Badge>}
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                {tokoSumber
                  ? `Toko ${tokoSumber} sudah dipakai. Lanjutkan ke input barang invoice untuk mulai menyusun keranjang.`
                  : "Setelah toko sumber dipilih, Anda akan lanjut ke halaman input barang invoice."}
              </div>
            </Card>
          )}

          {(activeStep === 2 || activeStep === 3) && (
            <MarginSummaryCard
              totalModal={computed.totalModal}
              totalPenjualan={computed.totalPenjualan}
              totalProfit={computed.totalProfit}
              margin={computed.margin}
              markup={computed.markup}
              showReadyBadge={activeStep === 3}
            />
          )}
        </div>
      </div>

      {showStep1FloatingNext && (
        <div className="no-print fixed bottom-6 right-6 z-40 hidden items-center gap-3 xl:flex">
          <Button onClick={() => setActiveStep(2)} className="h-14 rounded-2xl px-6 text-sm font-bold shadow-lg shadow-primary-950/20">
            Lanjut ke Input Barang <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {showStep2FloatingNext && (
        <div className="no-print fixed bottom-6 right-6 z-40 hidden items-center gap-3 xl:flex">
          <Button
            variant="outline"
            onClick={() => setActiveStep(1)}
            className="h-14 rounded-2xl px-6 text-sm font-bold shadow-lg"
          >
            <ArrowLeft size={16} /> Kembali ke Toko
          </Button>
          <Button onClick={() => setActiveStep(3)} className="h-14 rounded-2xl px-6 text-sm font-bold shadow-lg shadow-primary-950/20">
            Lanjut ke Invoice <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {showStep3FloatingActions && (
        <div className="no-print fixed bottom-6 right-6 z-40 hidden items-center gap-3 xl:flex">
          <Button
            variant="outline"
            onClick={() => setActiveStep(2)}
            disabled={cart.length === 0}
            className="h-14 rounded-2xl px-6 text-sm font-bold shadow-lg"
          >
            <ArrowLeft size={16} /> Kembali ke Barang
          </Button>
          <Button
            onClick={handleCreateInvoice}
            disabled={pending || cart.length === 0 || !tokoSumber}
            className="h-14 min-w-[220px] rounded-2xl px-6 text-sm font-bold shadow-lg shadow-primary-950/20"
          >
            {pending ? "Membuat Invoice..." : "Buat Invoice"}
          </Button>
        </div>
      )}

      {/* Navigasi antar-step untuk mobile/tablet: fixed di bawah layar saat scroll
          (desktop memakai floating bar di atas). Dirender di root agar benar-benar
          menempel ke viewport, tidak terpengaruh container ber-transform. */}
      {showBottomNav && (
        <div
          className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-sky-200/70 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-sky-300/15 dark:bg-slate-950/90 xl:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-3xl flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {activeStep === 1 && (
              <Button onClick={() => setActiveStep(2)} className="w-full sm:w-auto">
                Lanjut ke Input Barang <ArrowRight size={15} />
              </Button>
            )}
            {activeStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setActiveStep(1)} className="w-full sm:w-auto">
                  <ArrowLeft size={15} /> Kembali ke Toko
                </Button>
                <Button onClick={() => setActiveStep(3)} disabled={cart.length === 0} className="w-full sm:w-auto">
                  Lanjut ke Invoice <ArrowRight size={15} />
                </Button>
              </>
            )}
            {activeStep === 3 && (
              <>
                <Button variant="outline" onClick={() => setActiveStep(2)} disabled={cart.length === 0} className="w-full sm:w-auto">
                  <ArrowLeft size={15} /> Kembali ke Barang
                </Button>
                <Button
                  onClick={handleCreateInvoice}
                  disabled={pending || cart.length === 0 || !tokoSumber}
                  className="w-full sm:w-auto"
                >
                  {pending ? "Membuat Invoice..." : "Buat Invoice"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {pendingStoreChange && (
        <div
          className="fixed inset-0 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          style={{ zIndex: 2147483002 }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPendingStoreChange(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-change-title"
            className="anim-rise w-full max-w-md overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)] dark:border-sky-400/20 dark:bg-[#102133]"
          >
            <div className="flex items-start gap-4 border-b border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 px-5 py-4 dark:border-sky-400/15 dark:from-sky-500/10 dark:via-[#102133] dark:to-cyan-500/10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-100 text-[var(--primary)] shadow-[0_12px_26px_rgba(14,165,233,0.18)] dark:border-sky-400/25 dark:bg-sky-500/15 dark:text-sky-300">
                <Store size={20} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--primary)]">
                  Ganti toko sumber
                </p>
                <h3 id="store-change-title" className="mt-1 text-base font-black leading-snug text-foreground">
                  Keranjang Invoice akan dikosongkan
                </h3>
                <p className="mt-1.5 text-sm font-medium leading-6 text-[var(--text-soft)]">
                  Mengganti toko ke <span className="font-black text-foreground">{pendingStoreChange}</span> akan mengosongkan keranjang invoice saat ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingStoreChange(null)}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/75 hover:text-foreground dark:hover:bg-white/10"
                aria-label="Tutup dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5">
              <div className="rounded-xl border border-sky-200/80 bg-sky-50 px-4 py-3 text-xs font-semibold leading-5 text-sky-900 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200">
                Data barang yang sudah masuk invoice akan dibersihkan agar tidak tercampur dengan katalog toko lain.
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2.5 border-t border-border bg-[var(--surface-2)] px-5 py-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setPendingStoreChange(null)}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => {
                  applyStoreChange(pendingStoreChange, true);
                  setPendingStoreChange(null);
                }}
              >
                Kosongkan & Ganti Toko
              </Button>
            </div>
          </div>
        </div>
      )}

      {priceConflict && (
        <div
          className="fixed inset-0 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          style={{ zIndex: 2147483002 }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !pending) {
              setPriceConflict(null);
              toast.info("Penambahan barang dibatalkan.");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-conflict-title"
            className="anim-rise w-full max-w-xl overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)] dark:border-amber-400/20 dark:bg-[#102133]"
          >
            <div className="flex items-start gap-4 border-b border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50 px-5 py-4 dark:border-amber-400/15 dark:from-amber-500/10 dark:via-[#102133] dark:to-sky-500/10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 text-amber-700 shadow-[0_12px_26px_rgba(245,158,11,0.18)] dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-300">
                <AlertTriangle size={20} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  Konfirmasi perubahan data
                </p>
                <h3 id="price-conflict-title" className="mt-1 text-base font-black leading-snug text-foreground">
                  Data barang sudah ada
                </h3>
                <p className="mt-1.5 text-sm font-medium leading-6 text-[var(--text-soft)]">
                  {priceConflict.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (pending) return;
                  setPriceConflict(null);
                  toast.info("Penambahan barang dibatalkan.");
                }}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/75 hover:text-foreground dark:hover:bg-white/10"
                aria-label="Tutup dialog"
                disabled={pending}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/85 p-4 dark:border-slate-700/60 dark:bg-slate-950/30">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Data lama</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[var(--text-soft)]">Harga beli</span>
                      <span className="font-mono font-black text-foreground">{formatRupiah(priceConflict.existing.hargaBeli)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[var(--text-soft)]">Harga jual</span>
                      <span className="font-mono font-black text-foreground">{formatRupiah(priceConflict.existing.hargaJual)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-200 bg-sky-50/85 p-4 ring-4 ring-sky-400/10 dark:border-sky-400/25 dark:bg-sky-500/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--primary)]">Data baru</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[var(--text-soft)]">Harga beli</span>
                      <span className="font-mono font-black text-foreground">{formatRupiah(priceConflict.incoming.hargaBeli)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[var(--text-soft)]">Harga jual</span>
                      <span className="font-mono font-black text-foreground">{formatRupiah(priceConflict.incoming.hargaJual)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                Jika dilanjutkan, data katalog lama akan diperbarui dan item invoice memakai harga terbaru.
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2.5 border-t border-border bg-[var(--surface-2)] px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPriceConflict(null);
                  toast.info("Penambahan barang dibatalkan.");
                }}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="button" variant="warning" onClick={handleConfirmPriceConflict} disabled={pending}>
                {pending ? "Memperbarui..." : "Perbarui Barang"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {generated &&
        (() => {
          const notaData = buildNotaData(generated);
          const previewIsA4 = printFormat === "a4";

          return (
            <div
              className="fixed inset-0 flex items-start justify-center overflow-hidden bg-slate-900/60 p-2 pt-4 backdrop-blur-sm sm:p-4"
              style={{ zIndex: 2147483001 }}
              onClick={() => setGenerated(null)}
            >
              <div
                className={`flex h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:h-[calc(100dvh-2rem)] ${
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
                      <p className="font-mono text-[11px] font-semibold text-[var(--primary-strong)]">{generated.noInvoice}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={previewIsA4 ? "primary" : "outline"}
                      onClick={() => setPrintFormat("a4")}
                    >
                      A4
                    </Button>
                    <Button
                      size="sm"
                      variant={previewIsA4 ? "outline" : "primary"}
                      onClick={() => setPrintFormat("thermal")}
                    >
                      Thermal
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setGenerated(null)}>
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
                    className="w-full justify-center gap-1.5 rounded-xl border-orange-200 bg-orange-50 font-bold text-[var(--primary)] hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 sm:w-auto"
                  >
                    <Camera size={14} /> Simpan sebagai Gambar (PNG)
                  </Button>
                  <div className={`grid gap-2.5 ${previewIsA4 ? "grid-cols-1 sm:grid-cols-[80px_minmax(170px,1fr)]" : "grid-cols-[92px_minmax(0,1fr)]"}`}>
                    <Button variant="outline" size="sm" onClick={() => setGenerated(null)} className="w-full justify-center">
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

function SlimMetric({ label, value, hint, positive }: { label: string; value: string; hint: string; positive?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-2.5 sm:px-4 lg:min-w-[150px]">
      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted-2)]">{label}</p>
      <p
        className={`tnum truncate text-sm font-bold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
        title={value}
      >
        {value}
      </p>
      <p className="truncate text-[11px] text-[var(--text-muted-2)]">{hint}</p>
    </div>
  );
}

function StepPill({
  step,
  activeStep,
  label,
  done,
  onClick,
  disabled,
}: {
  step: StepKey;
  activeStep: StepKey;
  label: string;
  done: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const active = activeStep === step;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "step" : undefined}
      className={[
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:px-3",
        active ? "bg-[var(--primary)]/12 text-[var(--primary)] dark:text-sky-300" : "text-[var(--text-soft)] hover:bg-[var(--surface-2)]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
          active
            ? "bg-[var(--primary)] text-white"
            : done
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              : "bg-[var(--surface-2)] text-[var(--text-muted-2)]",
        ].join(" ")}
      >
        {done ? <Check size={13} strokeWidth={3} /> : step}
      </span>
      {label}
    </button>
  );
}

function CartQtyInput({
  qty,
  onCommit,
}: {
  qty: number;
  onCommit: (qty: number) => void;
}) {
  const [draftQty, setDraftQty] = useState(String(qty));

  useEffect(() => {
    setDraftQty(String(qty));
  }, [qty]);

  function commitValue(rawValue: string) {
    const normalized = Math.max(1, Math.min(FIELD_LIMITS.maxQty, Math.trunc(Number(rawValue || 1))));
    setDraftQty(String(normalized));
    onCommit(normalized);
  }

  return (
    <input
      type="number"
      min={1}
      max={FIELD_LIMITS.maxQty}
      inputMode="numeric"
      value={draftQty}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraftQty(e.target.value)}
      onBlur={(e) => commitValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitValue(e.currentTarget.value);
          e.currentTarget.blur();
        }
      }}
      className="h-8 w-14 border-0 bg-transparent p-0 text-center text-xs font-bold text-foreground outline-none focus:ring-0"
    />
  );
}

function MarginSummaryCard({
  totalModal,
  totalPenjualan,
  totalProfit,
  margin,
  markup,
  showReadyBadge,
}: {
  totalModal: number;
  totalPenjualan: number;
  totalProfit: number;
  margin: number;
  markup: number;
  showReadyBadge?: boolean;
}) {
  return (
    <Card className="bento-card !overflow-visible space-y-4 !p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">Ringkasan Margin</h2>
        {showReadyBadge ? <Badge tone="blue">Siap invoice</Badge> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<Store size={16} />} label="Total Modal" value={formatRupiah(totalModal)} />
        <MetricCard icon={<ShoppingCart size={16} />} label="Total Penjualan" value={formatRupiah(totalPenjualan)} />
        <MetricCard icon={<Wallet size={16} />} label="Keuntungan" value={formatRupiah(totalProfit)} accent="text-emerald-600 dark:text-emerald-400" />
        <MetricCard icon={<FileText size={16} />} label="Margin / Markup" value={`${margin}% / ${markup}%`} />
      </div>
    </Card>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[var(--surface-2)]/40 p-3.5">
      <div className="flex items-center gap-2 text-[var(--text-muted-2)]">
        <span className="shrink-0">{icon}</span>
        <span className="truncate text-xs font-semibold">{label}</span>
      </div>
      <div data-tooltip={value} className="mt-3 min-w-0">
        <p className={`tnum truncate text-base font-extrabold tracking-tight text-foreground ${accent ?? ""}`}>{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-[var(--surface-2)]/40 px-4 py-3 text-sm">
      <span className="text-[var(--text-muted-2)]">{label}</span>
      <span className={`tnum font-bold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
