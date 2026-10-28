import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { fitToLetter } from "@shared/pdfLayout";

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
  // US Letter portrait. Placement comes from shared/pdfLayout so the print
  // preview shows exactly this layout.
  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const { x, y, w, h } = fitToLetter(img.width, img.height);
  pdf.addImage(dataUrl, "PNG", x, y, w, h);
  pdf.save(`${slug(title)}.pdf`);
}
