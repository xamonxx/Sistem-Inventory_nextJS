import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Helper untuk langkah SETELAH transaksi database commit.
 *
 * Data sudah tersimpan pada titik ini, jadi kegagalan langkah pendukung
 * (invalidasi cache, URL verifikasi) tidak boleh dikembalikan sebagai error
 * mutasi: operator bisa mengulang transaksi dan membuat duplikasi (AUD-003).
 */

export function invalidateAfterCommit(opts: { paths?: string[]; tags?: string[] }) {
  for (const path of opts.paths ?? []) {
    try {
      revalidatePath(path);
    } catch (error) {
      console.error(`[after-commit] revalidatePath(${path}) gagal`, error);
    }
  }
  for (const tag of opts.tags ?? []) {
    try {
      revalidateTag(tag);
    } catch (error) {
      console.error(`[after-commit] revalidateTag(${tag}) gagal`, error);
    }
  }
}

export async function afterCommit<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[after-commit] ${label} gagal`, error);
    return null;
  }
}
