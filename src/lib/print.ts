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

  if (options.thermal) {
    Object.assign(clone.style, {
      display: "block",
      position: "fixed",
      inset: "0",
      margin: "0 auto",
      maxWidth: "380px",
      width: "auto",
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
  }, 50);
}
