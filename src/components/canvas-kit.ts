/**
 * The bits both canvas exports share.
 *
 * There are two images this site draws in the browser rather than on the
 * server: the phone badge someone props on the table, and the poster for the
 * week that gets pasted into the WeChat group. Both are drawn client-side for
 * the same reason — the text is Chinese, and the only place a Chinese font is
 * guaranteed to exist is the device already displaying Chinese. Rendering them
 * server-side would mean shipping a CJK font with the deployment, which is
 * several megabytes to solve a problem the browser does not have.
 */

/** The site's own stacks, so an exported image matches what is on screen. */
export const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, "PingFang SC", monospace';

/** The palette, as literals: canvas cannot read a CSS custom property. */
export const INK = "#0a0b0d";
export const FG1 = "#f2f5f3";
export const FG2 = "#a4acb4";
export const FG3 = "#6b7480";
export const ACCENT = "#c6ff3d";
export const SPARK = "#3ddcff";
export const CHIP = "#ffc93d";

/**
 * Wraps by measuring, because the text is mixed Chinese and English.
 *
 * Breaking on spaces alone would never break a Chinese line at all; breaking on
 * every character would split English words. So: try word boundaries first, and
 * fall back to per-character when a single "word" is itself too wide.
 */
export function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";

  const flush = () => {
    if (line) lines.push(line);
    line = "";
  };

  for (const char of text) {
    const next = line + char;

    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }

    // Prefer breaking at the last space so English words stay whole.
    const lastSpace = line.lastIndexOf(" ");

    if (lastSpace > 0 && ctx.measureText(line.slice(lastSpace + 1) + char).width < maxWidth * 0.5) {
      const carry = line.slice(lastSpace + 1);
      line = line.slice(0, lastSpace);
      flush();
      line = carry + char;
    } else {
      flush();
      line = char;
    }

    if (lines.length >= maxLines) break;
  }

  flush();

  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, "…");
  }

  return lines;
}
