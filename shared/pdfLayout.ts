// Phase 7: one source of truth for how a rendered sheet lands on a PDF page.
// Used by exportPdf (client/src/lib/exportSheet.ts) and the print preview, so
// the preview always matches the file.

/** US Letter in PDF points. */
export const LETTER = { width: 612, height: 792 } as const;

export interface PageFit {
  pageW: number;
  pageH: number;
  /** Placement of the sheet image on the page, in points. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** True when the sheet was taller than one page and got shrunk to fit. */
  shrunk: boolean;
  /** Printed width as a fraction of the page width (1 = full width). */
  widthFraction: number;
}

/**
 * Fit an image of imgW x imgH onto one Letter page: full width, top-aligned;
 * if that is taller than the page, scale down to the page height and center
 * horizontally. Same rule exportPdf has always used.
 */
export function fitToLetter(imgW: number, imgH: number): PageFit {
  const pageW = LETTER.width;
  const pageH = LETTER.height;
  if (!(imgW > 0) || !(imgH > 0)) {
    return { pageW, pageH, x: 0, y: 0, w: pageW, h: 0, shrunk: false, widthFraction: 1 };
  }
  const ratio = imgH / imgW;
  let w = pageW;
  let h = pageW * ratio;
  let shrunk = false;
  if (h > pageH) {
    h = pageH;
    w = pageH / ratio;
    shrunk = true;
  }
  return { pageW, pageH, x: (pageW - w) / 2, y: 0, w, h, shrunk, widthFraction: w / pageW };
}
