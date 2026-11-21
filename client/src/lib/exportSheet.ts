import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { fitToLetter } from "@shared/pdfLayout";

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "screamsheet";
}

/**
 * html-to-image draws the sheet inside an SVG <foreignObject>, which is a
 * sandboxed image: it can NOT see the page's fonts. Unless every web font is
 * embedded in that SVG, the export silently falls back to Arial / Courier, and
 * the masthead and headlines change size, re-wrap and stack.
 *
 * So we build the @font-face CSS ourselves from the self-hosted fonts in
 * /fonts/fonts.css, inline each woff2 as a data: URL, and hand it to
 * html-to-image via `fontEmbedCSS`. Built once per page load and cached.
 */
const FONT_CSS_URL = "/fonts/fonts.css";
let fontEmbedCssPromise: Promise<string> | null = null;

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${url}: HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function buildFontEmbedCss(): Promise<string> {
  const res = await fetch(FONT_CSS_URL);
  if (!res.ok) throw new Error(`fonts.css: HTTP ${res.status}`);
  let css = await res.text();
  const urls = Array.from(new Set(Array.from(css.matchAll(/url\(([^)]+)\)/g), (m) => m[1].replace(/["']/g, ""))));
  const inlined = await Promise.all(urls.map((u) => toDataUrl(new URL(u, location.origin).href)));
  urls.forEach((u, i) => { css = css.split(u).join(inlined[i]); });
  return css;
}

function getFontEmbedCss(): Promise<string> {
  if (!fontEmbedCssPromise) {
    fontEmbedCssPromise = buildFontEmbedCss().catch((e) => {
      fontEmbedCssPromise = null; // allow a retry on the next export
      throw new Error(`Could not load fonts for export (${e instanceof Error ? e.message : e}). Check your connection and try again.`);
    });
  }
  return fontEmbedCssPromise;
}

/** Make sure every face the sheet can use is decoded, not just the ones on screen. */
async function loadAllFonts() {
  const fonts = (document as any).fonts as FontFaceSet | undefined;
  if (!fonts) return;
  const faces: string[] = [
    "400 16px Oswald", "500 16px Oswald", "600 16px Oswald", "700 16px Oswald",
    "400 16px 'Roboto Slab'", "500 16px 'Roboto Slab'", "700 16px 'Roboto Slab'",
    "400 16px 'Share Tech Mono'", "400 16px 'Special Elite'",
    "500 16px Orbitron", "700 16px Orbitron", "900 16px Orbitron",
    "400 16px Rajdhani", "500 16px Rajdhani", "600 16px Rajdhani", "700 16px Rajdhani",
  ];
  await Promise.all(faces.map((f) => fonts.load(f).catch(() => [])));
  await fonts.ready;
}

const isWebKit = typeof navigator !== "undefined" && /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

async function renderPng(node: HTMLElement): Promise<string> {
  const [fontEmbedCSS] = await Promise.all([getFontEmbedCss(), loadAllFonts()]);
  const opts = {
    pixelRatio: 2, // crisp print output
    cacheBust: true,
    backgroundColor: "#ffffff",
    width: node.offsetWidth,
    height: node.offsetHeight,
    fontEmbedCSS,
    // The sheet sits inside a scale() wrapper in the builder preview; make sure
    // the clone itself is captured untransformed at its true 816px width.
    style: { transform: "none", margin: "0" },
  };
  // Safari decodes fonts/images inside the SVG lazily, so its first draw can
  // miss them. A throwaway warm-up render fixes that.
  if (isWebKit) await toPng(node, opts);
  return toPng(node, opts);
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
