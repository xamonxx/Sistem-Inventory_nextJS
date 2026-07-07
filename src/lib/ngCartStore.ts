import { create } from "zustand";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

export type NgPaymentStatus = "LUNAS" | "TEMPO";
export type NgPaymentMethod = "CASH" | "TRANSFER";

export type NgCartLine = {
  produkId: number;
  nama: string;
  namaToko: string;
  hargaBeli: number;
  hargaJual: number;
  qty: number;
  kategori?: string | null;
  satuan?: string | null;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeQty(qty: number) {
  return Math.min(FIELD_LIMITS.maxQty, Math.max(1, Math.trunc(qty || 1)));
}

type NgCartState = {
  tanggal: string;
  tokoSumber: string;
  cart: NgCartLine[];
  namaKonsumen: string;
  namaGrup: string;
  alamat: string;
  namaWorkshop: string;
  paymentStatus: NgPaymentStatus;
  paymentMethod: NgPaymentMethod;
  namaBank: string;
  noRekening: string;
  atasNama: string;
  setTanggal: (value: string) => void;
  setTokoSumber: (value: string) => void;
  setNamaKonsumen: (value: string) => void;
  setNamaGrup: (value: string) => void;
  setAlamat: (value: string) => void;
  setNamaWorkshop: (value: string) => void;
  setPaymentStatus: (value: NgPaymentStatus) => void;
  setPaymentMethod: (value: NgPaymentMethod) => void;
  setNamaBank: (value: string) => void;
  setNoRekening: (value: string) => void;
  setAtasNama: (value: string) => void;
  addToCart: (item: Omit<NgCartLine, "qty">) => boolean;
  upsertCartLine: (item: NgCartLine) => boolean;
  removeFromCart: (produkId: number) => void;
  updateQty: (produkId: number, qty: number) => void;
  clearForStore: (tokoSumber: string) => void;
  clearCart: () => void;
};

export const useNgCartStore = create<NgCartState>((set) => ({
  tanggal: todayString(),
  tokoSumber: "",
  cart: [],
  namaKonsumen: "",
  namaGrup: "",
  alamat: "",
  namaWorkshop: "",
  paymentStatus: "LUNAS",
  paymentMethod: "CASH",
  namaBank: "",
  noRekening: "",
  atasNama: "",

  setTanggal: (tanggal) => set({ tanggal }),
  setTokoSumber: (tokoSumber) => set({ tokoSumber }),
  setNamaKonsumen: (namaKonsumen) => set({ namaKonsumen }),
  setNamaGrup: (namaGrup) => set({ namaGrup }),
  setAlamat: (alamat) => set({ alamat }),
  setNamaWorkshop: (namaWorkshop) => set({ namaWorkshop }),
  setPaymentStatus: (paymentStatus) => set({ paymentStatus }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setNamaBank: (namaBank) => set({ namaBank }),
  setNoRekening: (noRekening) => set({ noRekening }),
  setAtasNama: (atasNama) => set({ atasNama }),

  addToCart: (item) => {
    let added = false;
    set((state) => {
      if (state.tokoSumber && state.tokoSumber !== item.namaToko) {
        return state;
      }

      const existing = state.cart.find((line) => line.produkId === item.produkId);
      added = true;

      if (existing) {
        return {
          tokoSumber: state.tokoSumber || item.namaToko,
          cart: state.cart.map((line) =>
            line.produkId === item.produkId ? { ...line, qty: normalizeQty(line.qty + 1) } : line
          ),
        };
      }

      return {
        tokoSumber: state.tokoSumber || item.namaToko,
        cart: [...state.cart, { ...item, qty: 1 }],
      };
    });
    return added;
  },

  upsertCartLine: (item) => {
    let applied = false;
    set((state) => {
      if (state.tokoSumber && state.tokoSumber !== item.namaToko) {
        return state;
      }

      applied = true;
      const existing = state.cart.find((line) => line.produkId === item.produkId);

      if (existing) {
        return {
          tokoSumber: state.tokoSumber || item.namaToko,
          cart: state.cart.map((line) =>
            line.produkId === item.produkId ? { ...item, qty: normalizeQty(item.qty) } : line
          ),
        };
      }

      return {
        tokoSumber: state.tokoSumber || item.namaToko,
        cart: [...state.cart, { ...item, qty: normalizeQty(item.qty) }],
      };
    });
    return applied;
  },

  removeFromCart: (produkId) =>
    set((state) => ({
      cart: state.cart.filter((line) => line.produkId !== produkId),
    })),

  updateQty: (produkId, qty) =>
    set((state) => ({
      cart: state.cart.map((line) =>
        line.produkId === produkId ? { ...line, qty: normalizeQty(qty) } : line
      ),
    })),

  clearForStore: (tokoSumber) =>
    set({
      tanggal: todayString(),
      tokoSumber,
      cart: [],
      namaKonsumen: "",
      namaGrup: "",
      alamat: "",
      namaWorkshop: "",
      paymentStatus: "LUNAS",
      paymentMethod: "CASH",
      namaBank: "",
      noRekening: "",
      atasNama: "",
    }),

  clearCart: () =>
    set({
      tanggal: todayString(),
      tokoSumber: "",
      cart: [],
      namaKonsumen: "",
      namaGrup: "",
      alamat: "",
      namaWorkshop: "",
      paymentStatus: "LUNAS",
      paymentMethod: "CASH",
      namaBank: "",
      noRekening: "",
      atasNama: "",
    }),
}));
