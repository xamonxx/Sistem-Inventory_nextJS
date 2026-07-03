type PrintOptions = {
  className?: string;
  thermal?: boolean;
};

const A4_WIDTH = "210mm";

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

/**
 * Cetak / simpan PDF area `.print-area`.
 *
 * PENTING (bug mobile): dulu kami meng-clone `.print-area` ke <body> lalu
 * menyembunyikan sisa halaman via `@media print { body > :not(.print-clone) }`.
 * Banyak browser mobile & in-app WebView TIDAK melakukan re-layout untuk print —
 * mereka merasterisasi viewport saat ini — sehingga aturan `@media print`
 * diabaikan dan yang tercetak justru screenshot seluruh UI aplikasi
 * (drawer, modal, dsb), bukan dokumen A4.
 *
 * Solusi: render dokumen ke dalam IFRAME terisolasi yang HANYA berisi dokumen,
 * lalu panggil `iframe.contentWindow.print()`. Karena iframe cuma berisi invoice,
 * hasil cetak/PDF selalu bersih & identik di desktop maupun mobile — bahkan pada
 * browser yang mencetak lewat screenshot.
 */
export function printArea(options: PrintOptions = {}) {
  const src = document.querySelector<HTMLElement>(".print-area");
  if (!src) return;

  const clone = src.cloneNode(true) as HTMLElement;
  clone.classList.add("print-clone");
  clone.querySelectorAll<HTMLElement>(".no-print").forEach((el) => el.remove());
  // Pratinjau di layar memakai `zoom` auto-fit; netralkan agar cetak ukuran natural.
  clone.style.zoom = "1";

  const bodyClass = options.className || (options.thermal ? "print-thermal" : "");

  // Salin seluruh <style> & <link rel=stylesheet> dari head agar kelas Tailwind,
  // CSS variables, dan @font-face ikut aktif di dalam iframe.
  const headStyles = Array.from(
    document.head.querySelectorAll<HTMLElement>(
      'style, link[rel="stylesheet"], link[rel="preload"][as="style"]'
    )
  )
    .map((n) => n.outerHTML)
    .join("\n");

  // Ukuran kertas: struk thermal roll 80mm tinggi auto; selain itu A4 portrait.
  const pageCss = options.thermal
    ? "@page { size: 80mm auto; margin: 0 !important; }"
    : "@page { size: A4 portrait; margin: 0 !important; }";

  // Pertahankan CSS variabel font (--font-jakarta dsb) dari <html>, tapi buang
  // kelas `dark` supaya dokumen (yang memakai warna terang eksplisit) tidak
  // terpengaruh tema gelap.
  const htmlClass = document.documentElement.className.replace(/\bdark\b/g, "").trim();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  const cloneWidthCss = options.thermal
    ? "width:80mm;max-width:80mm;margin:0;"
    : `width:${A4_WIDTH};max-width:none;min-width:${A4_WIDTH};margin:0 auto;`;

  doc.open();
  doc.write(
    `<!DOCTYPE html><html class="${htmlClass}"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<base href="${window.location.origin}/">` +
      `<title>${document.title}</title>` +
      headStyles +
      `<style>${pageCss}` +
      `html,body{margin:0;padding:0;background:#fff;` +
      `-webkit-print-color-adjust:exact;print-color-adjust:exact;}` +
      `.print-clone{${cloneWidthCss}background:#fff;box-shadow:none!important;` +
      `border:0!important;border-radius:0!important;}` +
      `</style></head><body class="${bodyClass}"></body></html>`
  );
  doc.close();

  doc.body.appendChild(doc.importNode(clone, true));

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    // Beri jeda agar dialog print sempat membaca konten sebelum iframe dilepas.
    setTimeout(() => iframe.remove(), 500);
  };

  const doPrint = () => {
    try {
      win.focus();
      win.addEventListener("afterprint", cleanup, { once: true });
      win.print();
    } finally {
      // Fallback bila afterprint tak terpicu (mis. sebagian browser mobile).
      setTimeout(cleanup, 2000);
    }
  };

  // Tunggu web-font & gambar siap agar tata letak tidak bergeser saat dicetak.
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) {
    fonts.ready.then(() => setTimeout(doPrint, 60)).catch(() => setTimeout(doPrint, 200));
  } else {
    setTimeout(doPrint, 250);
  }
}
