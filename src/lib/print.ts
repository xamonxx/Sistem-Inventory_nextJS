type PrintOptions = {
  className?: string;
  thermal?: boolean;
};

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
    window.print();
    if (bodyClass) document.body.classList.remove(bodyClass);
    clone.remove();
    pageStyle?.remove();
  }, 50);
}
