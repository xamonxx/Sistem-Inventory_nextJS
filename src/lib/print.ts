type PrintOptions = {
  className?: string;
  thermal?: boolean;
};

/**
 * Mengubah document.title sementara agar nama file PDF saat Save = [noInvoice-namaClient].
 * Restore otomatis setelah dialog print ditutup via afterprint + focus event.
 * Menggunakan { once: true } untuk mencegah memory leak event listener menumpuk.
 */
export function setPdfTitle(noInvoice: string, namaClient: string, thermal = false): void {
  const originalTitle = document.title;
  const safeName = namaClient.replace(/[\\/:*?"<>|]/g, "").trim() || "Konsumen";
  const suffix = thermal ? "-(THERMAL)" : "";
  document.title = `${noInvoice}-${safeName}${suffix}`;

  const restore = () => {
    document.title = originalTitle;
    // Hapus kedua listener agar tidak double-restore
    window.removeEventListener("afterprint", restore);
    window.removeEventListener("focus", restore);
  };

  // afterprint: terpicu saat dialog print ditutup (semua browser modern)
  window.addEventListener("afterprint", restore, { once: true });
  // focus fallback: untuk kasus di mana afterprint tidak terpicu (browser lama)
  window.addEventListener("focus", restore, { once: true });
}

export function printArea(options: PrintOptions = {}) {
  const src = document.querySelector<HTMLElement>(".print-area");
  if (!src) return;

  const clone = src.cloneNode(true) as HTMLElement;
  clone.classList.add("print-clone");
  clone.querySelectorAll<HTMLElement>(".no-print").forEach((el) => el.remove());

  const bodyClass = options.className || (options.thermal ? "print-thermal" : "");

  // Ukuran kertas: struk thermal pakai roll 80mm dengan tinggi mengikuti isi
  // (auto) sehingga tidak tercetak kecil di tengah kertas A4. Untuk A4 dipakai
  // @page global. Style ini di-inject sementara lalu dihapus setelah cetak.
  let pageStyle: HTMLStyleElement | null = null;
  if (options.thermal) {
    pageStyle = document.createElement("style");
    pageStyle.textContent = "@page { size: 80mm auto; margin: 0 !important; }";
    document.head.appendChild(pageStyle);

    Object.assign(clone.style, {
      display: "block",
      position: "fixed",
      inset: "0 auto auto 0",
      margin: "0",
      width: "80mm",
      maxWidth: "80mm",
      background: "white",
      zIndex: "9999",
    });
  } else {
    Object.assign(clone.style, {
      display: "block",
      position: "absolute",
      left: "0",
      top: "0",
      width: "100%",
      background: "white",
      zIndex: "9999",
    });
  }

  document.body.appendChild(clone);
  if (bodyClass) document.body.classList.add(bodyClass);

  setTimeout(() => {
    try {
      window.print();
    } finally {
      if (bodyClass) document.body.classList.remove(bodyClass);
      clone.remove();
      pageStyle?.remove();
    }
  }, 50);
}
