export const ITEM_CATEGORIES = [
  "BAHAN UTAMA",
  "MATERIAL",
  "AKSESORIS",
  "KELISTRIKAN",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export function isItemCategory(value: string): value is ItemCategory {
  return ITEM_CATEGORIES.includes(value as ItemCategory);
}
