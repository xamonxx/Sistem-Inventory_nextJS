import { create } from "zustand";
import type { DiscType } from "@/lib/cart";

export interface CartLine {
  itemId: number;
  kode: string;
  nama: string;
  harga: number;
  qty: number;
  stok: number;
  discount: number; // nilai mentah: nominal Rp atau persen (0-100)
  discountType: DiscType; // "RP" | "PERCENT"
}

export interface KasirState {
  cart: CartLine[];
  tipe: "RETAIL" | "PROJECT";
  namaClient: string;
  alamat: string;
  namaWs: string;
  projectNama: string;
  projectGroupNama: string;
  paymentMethod: "CASH" | "TRANSFER" | "CREDIT";
  namaBank: string; // opsional, untuk transfer/kredit
  noRekening: string; // opsional, untuk transfer/kredit
  atasNama: string; // opsional, untuk transfer/kredit
  buatInvoice: boolean;
  globalDiscount: number; // nilai mentah diskon total transaksi
  globalDiscountType: DiscType;

  // Actions
  setTipe: (tipe: "RETAIL" | "PROJECT") => void;
  setNamaClient: (nama: string) => void;
  setAlamat: (alamat: string) => void;
  setNamaWs: (nama: string) => void;
  setProjectNama: (nama: string) => void;
  setProjectGroupNama: (nama: string) => void;
  setPaymentMethod: (method: "CASH" | "TRANSFER" | "CREDIT") => void;
  setNamaBank: (val: string) => void;
  setNoRekening: (val: string) => void;
  setAtasNama: (val: string) => void;
  setBuatInvoice: (val: boolean) => void;
  setGlobalDiscount: (val: number) => void;
  setGlobalDiscountType: (type: DiscType) => void;

  addToCart: (item: { id: number; kode: string; nama: string; hargaJual: number; stok: number }) => void;
  removeFromCart: (itemId: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  updateDiscount: (itemId: number, discount: number) => void;
  updateDiscountType: (itemId: number, discountType: DiscType) => void;
  clearCart: () => void;
}

export const useKasirStore = create<KasirState>((set) => ({
  cart: [],
  tipe: "RETAIL",
  namaClient: "",
  alamat: "",
  namaWs: "",
  projectNama: "",
  projectGroupNama: "",
  paymentMethod: "CASH",
  namaBank: "",
  noRekening: "",
  atasNama: "",
  buatInvoice: true,
  globalDiscount: 0,
  globalDiscountType: "RP",

  setTipe: (tipe) => set({ tipe }),
  setNamaClient: (namaClient) => set({ namaClient }),
  setAlamat: (alamat) => set({ alamat }),
  setNamaWs: (namaWs) => set({ namaWs }),
  setProjectNama: (projectNama) => set({ projectNama }),
  setProjectGroupNama: (projectGroupNama) => set({ projectGroupNama }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setNamaBank: (namaBank) => set({ namaBank }),
  setNoRekening: (noRekening) => set({ noRekening }),
  setAtasNama: (atasNama) => set({ atasNama }),
  setBuatInvoice: (buatInvoice) => set({ buatInvoice }),
  setGlobalDiscount: (globalDiscount) => set({ globalDiscount: Math.max(0, globalDiscount) }),
  setGlobalDiscountType: (globalDiscountType) => set({ globalDiscountType }),

  addToCart: (item) =>
    set((state) => {
      const existingIndex = state.cart.findIndex((x) => x.itemId === item.id);
      if (existingIndex > -1) {
        const updatedCart = [...state.cart];
        updatedCart[existingIndex].qty += 1;
        return { cart: updatedCart };
      }
      return {
        cart: [
          ...state.cart,
          {
            itemId: item.id,
            kode: item.kode,
            nama: item.nama,
            harga: item.hargaJual,
            qty: 1,
            stok: item.stok,
            discount: 0,
            discountType: "RP",
          },
        ],
      };
    }),

  removeFromCart: (itemId) =>
    set((state) => ({
      cart: state.cart.filter((x) => x.itemId !== itemId),
    })),

  updateQty: (itemId, qty) =>
    set((state) => ({
      cart: state.cart.map((x) => (x.itemId === itemId ? { ...x, qty: Math.max(1, qty) } : x)),
    })),

  updateDiscount: (itemId, discount) =>
    set((state) => ({
      cart: state.cart.map((x) => (x.itemId === itemId ? { ...x, discount: Math.max(0, discount) } : x)),
    })),

  updateDiscountType: (itemId, discountType) =>
    set((state) => ({
      cart: state.cart.map((x) => (x.itemId === itemId ? { ...x, discountType, discount: 0 } : x)),
    })),

  clearCart: () =>
    set({
      cart: [],
      namaClient: "",
      alamat: "",
      namaWs: "",
      projectNama: "",
      projectGroupNama: "",
      paymentMethod: "CASH",
      namaBank: "",
      noRekening: "",
      atasNama: "",
      buatInvoice: true,
      globalDiscount: 0,
      globalDiscountType: "RP",
    }),
}));
