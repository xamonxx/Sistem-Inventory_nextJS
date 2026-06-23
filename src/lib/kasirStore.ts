import { create } from "zustand";

export interface CartLine {
  itemId: number;
  kode: string;
  nama: string;
  harga: number;
  qty: number;
  stok: number;
  discount: number; // percentage (0-100) or nominal amount
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
  buatInvoice: boolean;
  
  // Actions
  setTipe: (tipe: "RETAIL" | "PROJECT") => void;
  setNamaClient: (nama: string) => void;
  setAlamat: (alamat: string) => void;
  setNamaWs: (nama: string) => void;
  setProjectNama: (nama: string) => void;
  setProjectGroupNama: (nama: string) => void;
  setPaymentMethod: (method: "CASH" | "TRANSFER" | "CREDIT") => void;
  setBuatInvoice: (val: boolean) => void;
  
  addToCart: (item: { id: number; kode: string; nama: string; hargaJual: number; stok: number }) => void;
  removeFromCart: (itemId: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  updateDiscount: (itemId: number, discount: number) => void;
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
  buatInvoice: false,

  setTipe: (tipe) => set({ tipe }),
  setNamaClient: (namaClient) => set({ namaClient }),
  setAlamat: (alamat) => set({ alamat }),
  setNamaWs: (namaWs) => set({ namaWs }),
  setProjectNama: (projectNama) => set({ projectNama }),
  setProjectGroupNama: (projectGroupNama) => set({ projectGroupNama }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setBuatInvoice: (buatInvoice) => set({ buatInvoice }),

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

  clearCart: () =>
    set({
      cart: [],
      namaClient: "",
      alamat: "",
      namaWs: "",
      projectNama: "",
      projectGroupNama: "",
      paymentMethod: "CASH",
      buatInvoice: false,
    }),
}));
