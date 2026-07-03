import { z } from "zod";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { dbId } from "@/lib/validation";

export const invoiceItemPayloadSchema = z
  .array(
    z.object({
      itemId: dbId,
      qty: z.coerce
        .number({ invalid_type_error: "Qty harus angka." })
        .int("Qty harus bilangan bulat.")
        .min(0, "Qty tidak boleh negatif.")
        .max(FIELD_LIMITS.maxQty, "Qty terlalu besar."),
    })
  )
  .min(1, "Minimal 1 barang wajib dikirim.")
  .max(500, "Terlalu banyak item.")
  .superRefine((items, ctx) => {
    const seen = new Set<number>();
    let hasActiveLine = false;

    for (const [index, item] of items.entries()) {
      if (item.qty > 0) hasActiveLine = true;
      if (seen.has(item.itemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "itemId"],
          message: "Barang duplikat di rincian invoice.",
        });
      }
      seen.add(item.itemId);
    }

    if (!hasActiveLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invoice harus memiliki minimal 1 barang aktif.",
      });
    }
  });
