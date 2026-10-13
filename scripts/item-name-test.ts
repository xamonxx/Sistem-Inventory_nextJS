import assert from "node:assert/strict";
import { itemNameForCustomer } from "../src/lib/itemDisplayName";

const cases: Array<[string, string]> = [
  ["Multi Polos 9mm", "Multi Polos 9mm"],
  ["Multi Polos 9mm (DEPOK)", "Multi Polos 9mm"],
  ["Multi Polos 9mm (LK)", "Multi Polos 9mm"],
  ["[RETUR] Multi Polos 9mm (LK)", "[RETUR] Multi Polos 9mm"],
  ["[GANTI] Multi Polos 9mm (DEPOK)", "[GANTI] Multi Polos 9mm"],
  ["Produk (LK) Edisi", "Produk (LK) Edisi"],
];

for (const [input, expected] of cases) {
  assert.equal(itemNameForCustomer(input), expected);
}

console.log(`itemNameForCustomer: ${cases.length}/${cases.length} lulus`);
