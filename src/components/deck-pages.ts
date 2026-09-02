/**
 * Turning whatever the presenter chose into deck pages.
 *
 * A page is a JPEG, always — that is what makes the whole feature work in a
 * room with no wifi, because it means a phone fetches one small picture at a
 * time instead of running somebody's deck. So everything accepted here is
 * converted to one on the way in, and nothing downstream ever learns what it
 * started as.
 *
 * **PDF is here and PowerPoint is not, on purpose.** Keynote, PowerPoint,
 * Google Slides, Figma and Canva all export a PDF in one keystroke, and that
 * PDF is a perfect rendering of the deck. Reading .pptx directly would mean
 * either an immature browser parser that mangles fonts and masters, or a
 * headless LibreOffice in the container — several hundred megabytes to arrive
 * somewhere worse than the export button the presenter already has.
 */

/**
 * Longest edge of a stored page, and its quality.
 *
 * About a retina phone's worth of detail for something displayed at the width
 * of a hand. Shrinking happens here rather than on the server because the
 * upload is the slow part: this runs minutes before somebody speaks, on the
 * venue's mobile data.
 */
export const SLIDE_MAX_EDGE = 1600;
export const SLIDE_QUALITY = 0.85;

/** A page that has not been rendered yet. Deferred so a forty-page PDF is not
 *  held in memory as forty bitmaps while the first one uploads. */
export type PageSource = () => Promise<Blob>;

export function isPdf(file: File): boolean {
  // The extension as well as the type: some Android file pickers hand over
  // an empty `type` for anything they did not choose from a gallery.
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/**
 * Filename order, numerically aware.
 *
 * The picker returns files in selection order, which on a phone is the order
 * somebody's thumb happened to touch them. `slide-2` must come before
 * `slide-10`, so this is not a plain string sort.
 */
export function sortByName<T extends { name: string }>(files: T[]): T[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      SLIDE_QUALITY,
    );
  });
}

/** An image the presenter picked, shrunk to the stored size. */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SLIDE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // Frees the decoded bitmap now rather than at the next collection — a
  // twenty-page deck of phone screenshots is a lot of memory to hold on iOS.
  bitmap.close();

  return toJpeg(canvas);
}

/**
 * Loads pdf.js.
 *
 * Imported dynamically and only from here, so it is in no bundle but the
 * presenter's — which is behind the admin token. None of the public pages grow
 * by a byte, which is the rule this site holds everywhere else.
 */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");

  // Assigning every time is harmless (it is a plain property) and avoids
  // module-level state that a hot reload would leave stale.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  return pdfjs;
}

/** One `PageSource` per page of a PDF, in document order. */
export async function pdfPages(file: File): Promise<PageSource[]> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  return Array.from({ length: doc.numPages }, (_unused, index) => async () => {
    const page = await doc.getPage(index + 1);

    // A PDF page is measured in points; scale so the long edge lands on the
    // stored size rather than rendering at whatever the author's page size was.
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: SLIDE_MAX_EDGE / Math.max(base.width, base.height),
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");

    // White behind the page: a PDF page is transparent where nothing is drawn,
    // and JPEG has no alpha — without this every margin comes out black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, viewport }).promise;
    page.cleanup();

    return toJpeg(canvas);
  });
}

/**
 * Everything the presenter chose, flattened into pages in the order they will
 * be shown.
 *
 * PDFs are opened first so the page count is known before any upload starts —
 * that is what lets the presenter watch "7/23" rather than a spinner that
 * could mean anything.
 */
export async function expandToPages(files: File[]): Promise<PageSource[]> {
  const pages: PageSource[] = [];

  for (const file of sortByName(files)) {
    if (isPdf(file)) pages.push(...(await pdfPages(file)));
    else pages.push(() => shrinkImage(file));
  }

  return pages;
}
