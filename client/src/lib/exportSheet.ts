import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "screamsheet";
}

async function renderPng(node: HTMLElement): Promise<string> {
  // Render at 2x for crisp print output. Fonts must be loaded first.
  await (document as any).fonts?.ready;
  return toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
    width: node.offsetWidth,
    height: node.offsetHeight,
  });
}

export async function exportPng(node: HTMLElement, title: string) {
  const dataUrl = await renderPng(node);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${slug(title)}.png`;
  a.click();
}

export async function exportPdf(node: HTMLElement, title: string) {
  const dataUrl = await renderPng(node);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });
  // US Letter portrait, fit the image to the page width.
  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = img.height / img.width;
  let w = pageW;
  let h = pageW * ratio;
  // If taller than one page, scale down to fit a single page.
  if (h > pageH) {
    h = pageH;
    w = pageH / ratio;
  }
  const x = (pageW - w) / 2;
  pdf.addImage(dataUrl, "PNG", x, 0, w, h);
  pdf.save(`${slug(title)}.pdf`);
}
