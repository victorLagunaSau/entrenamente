/**
 * Convierte el reporte del tutor (un nodo ya montado) en un PDF carta y lo descarga como archivo.
 * Se usa en lugar de window.print(): en iPhone el diálogo de impresión no ofrece "Guardar como PDF".
 * Las páginas se cortan entre bloques (secciones y filas de la tabla) para no partir un renglón.
 */

const PAGE = { w: 612, h: 792 }; // carta en puntos
const MARGIN = 34; // ≈ 12 mm
/** Nitidez de la captura; baja en reportes muy largos para no pasar el límite de canvas de Safari en iPhone. */
const MAX_SCALE = 2;
const MAX_PIXELS = 14_000_000;

/** Color CSS (incluye oklch) → [r, g, b], leyéndolo de un canvas de 1 px. */
function rgb(color: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

/** Alturas (px CSS, desde el borde superior del nodo) donde se puede cortar la página sin partir un bloque. */
function cortes(el: HTMLElement): number[] {
  const top = el.getBoundingClientRect().top;
  const bloques = el.querySelectorAll<HTMLElement>(":scope > *, tr");
  return [...bloques].map((b) => b.getBoundingClientRect().bottom - top).sort((a, b) => a - b);
}

export async function downloadReportPdf(el: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  await document.fonts.ready;
  await Promise.all([...el.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));

  const background = getComputedStyle(el).backgroundColor;
  const scale = Math.min(MAX_SCALE, Math.sqrt(MAX_PIXELS / (el.offsetWidth * el.offsetHeight)));
  const canvas = await html2canvas(el, { scale, backgroundColor: background, useCORS: true, logging: false });

  const cssW = el.offsetWidth;
  const totalH = canvas.height / scale;
  const ratio = (PAGE.w - 2 * MARGIN) / cssW; // pt por px CSS
  const pageH = (PAGE.h - 2 * MARGIN) / ratio;
  const posibles = cortes(el);
  const [r, g, b] = rgb(background);

  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  let start = 0;
  let first = true;
  while (start < totalH - 1) {
    const limit = start + pageH;
    const cut = limit >= totalH ? totalH : (posibles.filter((y) => y > start + 1 && y <= limit).at(-1) ?? limit);

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.ceil((cut - start) * scale);
    slice.getContext("2d")!.drawImage(canvas, 0, -Math.floor(start * scale));

    if (!first) doc.addPage();
    first = false;
    // El fondo oscuro de la marca llega hasta el borde de la hoja.
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, PAGE.w, PAGE.h, "F");
    doc.addImage(slice, "JPEG", MARGIN, MARGIN, PAGE.w - 2 * MARGIN, (cut - start) * ratio, undefined, "FAST");
    start = cut;
  }

  doc.save(fileName);
}
