export type ReturnLineForPairing = {
  transactionItemId: number;
  itemId: number;
  namaSnapshot: string;
  hargaSnapshot: number;
  qtyReturned: number;
};

export type ReplacementLineForPairing = {
  itemId: number;
  nama: string;
  hargaJual: number;
  qtyReplacement: number;
};

export type ReturnItemCreateData = {
  transactionItemId: number;
  itemId: number;
  namaSnapshot: string;
  hargaSnapshot: number;
  qtyReturned: number;
  subtotal: number;
  itemGantiId?: number | null;
  namaGantiSnapshot?: string | null;
  hargaGantiSnapshot?: number | null;
  qtyGanti?: number | null;
  subtotalGanti?: number | null;
};

export type ReturnItemPairingResult =
  | { ok: true; createData: ReturnItemCreateData[] }
  | { ok: false; error: string };

export function buildReturnItemCreateData(input: {
  tipe: "RETUR" | "TUKAR";
  returnItems: ReturnLineForPairing[];
  replacementItems: ReplacementLineForPairing[];
}): ReturnItemPairingResult {
  if (input.tipe === "TUKAR" && input.returnItems.length !== input.replacementItems.length) {
    return {
      ok: false,
      error:
        "Jumlah barang pengganti harus sama dengan jumlah baris barang retur agar histori tukar barang akurat.",
    };
  }

  return {
    ok: true,
    createData: input.returnItems.map((ri, index) => {
      const replacement = input.tipe === "TUKAR" ? input.replacementItems[index] : undefined;
      return {
        transactionItemId: ri.transactionItemId,
        itemId: ri.itemId,
        namaSnapshot: ri.namaSnapshot,
        hargaSnapshot: ri.hargaSnapshot,
        qtyReturned: ri.qtyReturned,
        subtotal: ri.hargaSnapshot * ri.qtyReturned,
        ...(replacement
          ? {
              itemGantiId: replacement.itemId,
              namaGantiSnapshot: replacement.nama,
              hargaGantiSnapshot: replacement.hargaJual,
              qtyGanti: replacement.qtyReplacement,
              subtotalGanti: replacement.hargaJual * replacement.qtyReplacement,
            }
          : {}),
      };
    }),
  };
}
