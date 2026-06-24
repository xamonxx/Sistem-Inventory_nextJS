"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hook pagination ringan untuk tabel sisi-klien.
 * Memotong `data` jadi halaman berisi maksimum `perPage` baris.
 */
export function usePagination<T>(data: T[], initialPerPage = 10) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPageState] = useState(initialPerPage);
  const totalPages = Math.max(1, Math.ceil(data.length / perPage));

  // Kembali ke halaman 1 bila halaman aktif melebihi total (mis. setelah filter)
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // Ganti jumlah baris/halaman → reset ke halaman 1
  const setPerPage = (n: number) => {
    setPerPageState(n);
    setPage(1);
  };

  const pageData = useMemo(
    () => data.slice((page - 1) * perPage, page * perPage),
    [data, page, perPage]
  );

  return { page, setPage, pageData, perPage, setPerPage, total: data.length, totalPages };
}

export function Pagination({
  page,
  perPage,
  total,
  onPage,
  onPerPage,
  perPageOptions = [10, 25, 50, 100],
  className,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
  onPerPage?: (n: number) => void;
  perPageOptions?: number[];
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  // Sembunyikan navigasi bila cuma 1 halaman, tapi tetap tampilkan pemilih baris bila relevan
  if (totalPages <= 1 && !(onPerPage && total > Math.min(...perPageOptions))) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(total, page * perPage);
  const go = (p: number) => onPage(Math.min(totalPages, Math.max(1, p)));

  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-white px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer";

  return (
    <div className={cn("flex flex-col items-center justify-between gap-3 px-1 pt-3 text-xs sm:flex-row", className)}>
      <div className="flex items-center gap-3">
        <p className="text-slate-500">
          Menampilkan <span className="font-semibold text-slate-700">{start}–{end}</span> dari{" "}
          <span className="font-semibold text-slate-700">{total}</span> data
        </p>
        {onPerPage && (
          <label className="flex items-center gap-1.5 text-slate-500">
            <span className="hidden sm:inline">Baris</span>
            <select
              value={perPage}
              onChange={(e) => onPerPage(Number(e.target.value))}
              className="h-8 rounded-lg border border-border bg-white px-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              {perPageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button className={btn} onClick={() => go(1)} disabled={page === 1} title="Halaman pertama">
          <ChevronsLeft size={14} />
        </button>
        <button className={btn} onClick={() => go(page - 1)} disabled={page === 1} title="Sebelumnya">
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 font-semibold text-slate-700">
          Hal {page} / {totalPages}
        </span>
        <button className={btn} onClick={() => go(page + 1)} disabled={page === totalPages} title="Berikutnya">
          <ChevronRight size={14} />
        </button>
        <button className={btn} onClick={() => go(totalPages)} disabled={page === totalPages} title="Halaman terakhir">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
