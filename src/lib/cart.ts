// Sumber kebenaran tunggal perhitungan keranjang kasir.
// Dipakai bersama oleh tampilan ringkasan, nota, dan payload server agar
// angka diskon/total selalu konsisten. Semua dalam Rupiah bulat (integer).

export type DiscType = "RP" | "PERCENT";

export interface ComputableLine {
  harga: number;
  qty: number;
  discount: number; // nilai mentah: nominal Rp atau persen (0-100) tergantung discountType
  discountType: DiscType;
}

export interface ComputedLine {
  base: number; // harga * qty
  lineDiscount: number; // diskon per baris dalam Rupiah (nominal/persen yang sudah dihitung)
  globalShare: number; // bagian diskon global yang dialokasikan ke baris ini (Rupiah)
  finalDiscount: number; // lineDiscount + globalShare — nilai yang dikirim ke server
  finalSubtotal: number; // base - finalDiscount
}

export interface ComputedCart {
  lines: ComputedLine[];
  subtotal: number; // total harga sebelum diskon apa pun
  totalLineDiscount: number; // total diskon per-baris
  afterLineDiscount: number; // subtotal - totalLineDiscount
  globalDiscount: number; // diskon global dalam Rupiah (sesudah dihitung dari persen bila perlu)
  grandTotal: number; // total akhir yang dibayar
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Diskon satu baris dalam Rupiah, sudah di-clamp agar tidak melebihi nilai baris. */
export function lineDiscountRupiah(l: ComputableLine): number {
  const base = Math.max(0, Math.round(l.harga * l.qty));
  const raw =
    l.discountType === "PERCENT"
      ? Math.round((base * (l.discount || 0)) / 100)
      : Math.round(l.discount || 0);
  return clamp(raw, 0, base);
}

/**
 * Hitung seluruh keranjang. Diskon global didistribusikan proporsional terhadap
 * subtotal tiap baris (setelah diskon baris), dengan sisa pembulatan dilempar ke
 * baris terbesar agar penjumlahan tetap presisi.
 */
export function computeCart(
  cart: ComputableLine[],
  globalDiscountRaw: number,
  globalDiscountType: DiscType
): ComputedCart {
  const bases = cart.map((l) => Math.max(0, Math.round(l.harga * l.qty)));
  const lineDiscounts = cart.map((l) => lineDiscountRupiah(l));
  const afterLine = bases.map((b, i) => b - lineDiscounts[i]);

  const subtotal = bases.reduce((a, b) => a + b, 0);
  const totalLineDiscount = lineDiscounts.reduce((a, b) => a + b, 0);
  const afterLineDiscount = afterLine.reduce((a, b) => a + b, 0);

  // Diskon global (Rupiah), tidak boleh melebihi total setelah diskon baris.
  const globalRaw =
    globalDiscountType === "PERCENT"
      ? Math.round((afterLineDiscount * (globalDiscountRaw || 0)) / 100)
      : Math.round(globalDiscountRaw || 0);
  const globalDiscount = clamp(globalRaw, 0, afterLineDiscount);

  // Distribusi proporsional.
  const shares = new Array(cart.length).fill(0);
  if (globalDiscount > 0 && afterLineDiscount > 0) {
    let allocated = 0;
    let largestIdx = 0;
    for (let i = 0; i < cart.length; i++) {
      shares[i] = Math.floor((globalDiscount * afterLine[i]) / afterLineDiscount);
      allocated += shares[i];
      if (afterLine[i] > afterLine[largestIdx]) largestIdx = i;
    }
    shares[largestIdx] += globalDiscount - allocated; // sisa pembulatan
  }

  const lines: ComputedLine[] = cart.map((_, i) => {
    const finalDiscount = lineDiscounts[i] + shares[i];
    return {
      base: bases[i],
      lineDiscount: lineDiscounts[i],
      globalShare: shares[i],
      finalDiscount,
      finalSubtotal: bases[i] - finalDiscount,
    };
  });

  return {
    lines,
    subtotal,
    totalLineDiscount,
    afterLineDiscount,
    globalDiscount,
    grandTotal: afterLineDiscount - globalDiscount,
  };
}
