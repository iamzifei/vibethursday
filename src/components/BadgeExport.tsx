"use client";

import { useEffect, useState } from "react";
import type { Copy } from "@/lib/content";

type Props = {
  copy: Copy["badge"];
  name: string;
  headline: string | null;
  lookingFor: string | null;
  roles: string[];
  /** Shown as the footer line so a screenshot still says where to find them. */
  cardUrl: string;
  /** The same QR this page displays, generated server-side. */
  qrSvg: string;
};

/* 3:4, which is the ratio WeChat shows without cropping in both chat and
   Moments. Big enough that the QR survives being re-compressed on the way. */
const W = 1080;
const H = 1440;
const PAD = 88;

const INK = "#0a0b0d";
const FG1 = "#f2f5f3";
const FG2 = "#a4acb4";
const FG3 = "#6b7480";
const ACCENT = "#c6ff3d";

/** The site's font stack, so the exported image matches what is on screen. */
const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, "PingFang SC", monospace';

/**
 * Wraps by measuring, because the text is mixed Chinese and English.
 *
 * Breaking on spaces alone would never break a Chinese line at all; breaking on
 * every character would split English words. So: try word boundaries first, and
 * fall back to per-character when a single "word" is itself too wide.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
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

/**
 * Lays out the text block, and optionally paints it.
 *
 * Run once with `paint: false` to learn how tall the block is, then again with
 * the offset that centres it. Without this a short card leaves a third of the
 * image empty in the middle, which reads as broken rather than as spacious.
 */
function textBlock(
  ctx: CanvasRenderingContext2D,
  props: Props,
  top: number,
  paint: boolean,
): number {
  const { name, headline, lookingFor, roles } = props;
  const maxWidth = W - PAD * 2;
  let y = top;

  const put = (text: string, x: number) => {
    if (paint) ctx.fillText(text, x, y);
  };

  ctx.textBaseline = "top";

  ctx.fillStyle = FG1;
  ctx.font = `700 96px ${SANS}`;
  for (const line of wrap(ctx, name, maxWidth, 2)) {
    put(line, PAD);
    y += 112;
  }

  if (headline) {
    y += 16;
    ctx.fillStyle = ACCENT;
    ctx.font = `500 44px ${SANS}`;
    for (const line of wrap(ctx, headline, maxWidth, 3)) {
      put(line, PAD);
      y += 60;
    }
  }

  if (lookingFor) {
    y += 36;
    const start = y;
    ctx.fillStyle = FG1;
    ctx.font = `400 40px ${SANS}`;
    for (const line of wrap(ctx, `🔎 ${lookingFor}`, maxWidth - 32, 3)) {
      put(line, PAD + 32);
      y += 56;
    }
    if (paint) {
      ctx.fillStyle = ACCENT;
      ctx.fillRect(PAD, start, 5, y - start - 12);
    }
  }

  if (roles.length > 0) {
    y += 28;
    ctx.fillStyle = FG3;
    ctx.font = `400 32px ${MONO}`;
    put(wrap(ctx, roles.join("  ·  "), maxWidth, 1)[0] ?? "", PAD);
    y += 44;
  }

  return y - top;
}

function draw(ctx: CanvasRenderingContext2D, props: Props, qr: HTMLImageElement) {
  const { cardUrl } = props;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  const plate = 440;
  const gap = 96;

  // Measure first, then centre the text + QR as one block.
  const blockHeight = textBlock(ctx, props, 0, false);
  const total = blockHeight + gap + plate;
  const top = Math.max(PAD, Math.round((H - total) / 2));

  textBlock(ctx, props, top, true);

  // ── QR on a white plate, with the footer beside it ────────────────
  const plateY = top + blockHeight + gap;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(PAD, plateY, plate, plate, 24);
  ctx.fill();
  ctx.drawImage(qr, PAD + 28, plateY + 28, plate - 56, plate - 56);

  const textX = PAD + plate + 48;
  let fy = plateY + 84;

  ctx.fillStyle = FG2;
  ctx.font = `500 38px ${SANS}`;
  ctx.fillText("Vibe Thursday", textX, fy);
  fy += 58;

  ctx.fillStyle = FG3;
  ctx.font = `400 28px ${MONO}`;
  ctx.fillText("悉尼 · 每周四 10:00", textX, fy);
  fy += 56;

  // Each wrapped line needs its own baseline — without the increment they were
  // painted on top of one another.
  ctx.fillStyle = ACCENT;
  ctx.font = `400 26px ${MONO}`;
  for (const line of wrap(ctx, cardUrl.replace(/^https?:\/\//, ""), W - textX - PAD, 3)) {
    ctx.fillText(line, textX, fy);
    fy += 36;
  }
}

export function BadgeExport(props: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /**
   * The generated image, shown on the page after export.
   *
   * This is the only route that works inside WeChat's in-app browser, which is
   * where most of this community opens links: it supports neither
   * `navigator.share` with files nor `<a download>`, so a button that only did
   * those two silently did nothing. Putting the picture on the page lets the
   * normal WeChat gesture take over — long-press, save or forward.
   */
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function exportImage() {
    setBusy(true);
    setNote(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");

      // The QR carries a viewBox but no width/height. An Image fed an SVG with
      // no intrinsic size renders at the browser's default rather than at the
      // size asked for, so the dimensions are injected first.
      const sized = props.qrSvg.replace(/<svg /, '<svg width="720" height="720" ');
      const qr = new Image();
      qr.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
      await qr.decode();

      draw(ctx, props, qr);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("toBlob failed");

      const file = new File([blob], `vibe-thursday-${props.name}.png`, { type: "image/png" });

      // Shown first and always: whatever happens next, the image is on the page
      // and can be long-pressed. Everything below is a shortcut, not the path.
      const url = URL.createObjectURL(blob);
      setPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });

      // The share sheet is the nicest route where it exists — iOS Safari and
      // Android Chrome — because it can hand the file straight to WeChat.
      if (navigator.canShare?.({ files: [file] })) {
        setNote(props.copy.exportLongPress);
        await navigator.share({ files: [file] });
        return;
      }

      // Desktop: a download is still the most useful thing. In WeChat this
      // quietly does nothing, which is exactly why the preview above exists.
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      setNote(props.copy.exportLongPress);
    } catch (error) {
      // AbortError is the person dismissing the share sheet, not a failure.
      if ((error as Error)?.name !== "AbortError") {
        console.error("[badge] export failed", error);
        setNote(props.copy.exportFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="badge__export">
      <div className="badge__export-row">
        <button type="button" className="btn btn--secondary" onClick={exportImage} disabled={busy}>
          {busy ? props.copy.exporting : preview ? props.copy.exportAgain : props.copy.exportCta}
        </button>
        {note && (
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            {note}
          </span>
        )}
      </div>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="badge__preview" src={preview} alt={props.copy.exportAlt} />
      )}
    </div>
  );
}
