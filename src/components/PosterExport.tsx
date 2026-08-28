"use client";

import { useEffect, useState } from "react";
import { ACCENT, CHIP, FG1, FG2, FG3, INK, MONO, SANS, SPARK, wrap } from "@/components/canvas-kit";

export type PosterQuestion = {
  text: string;
  name: string;
};

type Props = {
  /** "9月3日（周四）", already formatted and already Sydney's date. */
  date: string;
  /** "10:00 开门 · 10:30 开始". */
  time: string;
  /** "Vogue Cafe · 达令港". */
  venue: string;
  /** How many have signed up for this one so far. */
  signups: number;
  /** What is on the Wharf for this session, longest-standing first. */
  questions: PosterQuestion[];
  /** Who answered something in the last week, and what. */
  answers: PosterQuestion[];
  /** Rendered server-side by `qrcode`, same as the badge's. */
  qrSvg: string;
  /** Printed under the QR, so a screenshot still says where to go. */
  url: string;
};

/* 3:4 — the ratio WeChat shows without cropping in both a chat and Moments.
   Same reasoning, and the same numbers, as the phone badge. */
const W = 1080;
const H = 1440;
const PAD = 88;

/**
 * The week's poster, for pasting into the WeChat group.
 *
 * This exists because of something the site cannot do: it has no way to tell
 * anyone anything. No mail, no push, no webhook — five dependencies, none of
 * them a mailer — and most people never left an email address anyway. The
 * group is the channel, and a poster is what actually gets read there.
 *
 * ★ The half worth having is the questions. A poster that only says when and
 * where is a calendar reminder; one that says "these four things are what
 * people want to ask about on Thursday" gives somebody a reason to come who
 * had not thought about it, and it is the one thing this meetup's site knows
 * that a Luma page never would.
 *
 * Drawn in the browser rather than served from a route — the Vibe Coding Club
 * site does the same job at `/api/sessions/<id>/poster` — because the text is
 * Chinese and a server-rendered image would mean shipping a CJK font with the
 * deployment. See `canvas-kit.ts`.
 */
export function PosterExport(props: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function exportImage() {
    setBusy(true);
    setFailed(false);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");

      // The QR carries a viewBox but no width or height, and an Image fed an
      // SVG with no intrinsic size renders at the browser's default instead of
      // the size asked for. Same fix as the badge: inject the dimensions.
      const sized = props.qrSvg.replace(/<svg /, '<svg width="720" height="720" ');
      const qr = new Image();
      qr.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
      await qr.decode();

      draw(ctx, props, qr);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("toBlob failed");

      // On the page first and always. This is normally opened on a phone, and
      // inside WeChat's browser a download does nothing — long-pressing the
      // picture is the only route that works. Everything else is a shortcut.
      const url = URL.createObjectURL(blob);
      setPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });

      const file = new File([blob], `vibe-thursday-${props.date}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
    } catch (error) {
      // AbortError is the share sheet being dismissed, not a failure.
      if ((error as Error)?.name !== "AbortError") {
        console.error("[poster] export failed", error);
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-3">
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn--primary" onClick={exportImage} disabled={busy}>
          {busy ? "画……" : preview ? "重画一张" : "生成本周海报"}
        </button>
        <span className="body-sm" style={{ color: "var(--fg3)" }}>
          {failed
            ? "没画出来，看一眼 console"
            : preview
              ? "手机上长按图片保存或转发；电脑上已经下载了"
              : `${props.questions.length} 个问题${props.answers.length > 0 ? ` · ${props.answers.length} 条这周的回答` : ""}会印在上面`}
        </span>
      </div>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={`${props.date} 的海报`}
          style={{
            display: "block",
            width: "min(320px, 70vw)",
            height: "auto",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-default)",
          }}
        />
      )}
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, props: Props, qr: HTMLImageElement) {
  const { date, time, venue, signups, questions, answers, url } = props;
  const maxWidth = W - PAD * 2;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";

  let y = PAD + 16;

  ctx.fillStyle = SPARK;
  ctx.font = `500 30px ${MONO}`;
  ctx.fillText("SYDNEY · EVERY THURSDAY", PAD, y);
  y += 74;

  ctx.fillStyle = FG1;
  ctx.font = `700 112px ${SANS}`;
  ctx.fillText(date, PAD, y);
  y += 138;

  ctx.fillStyle = ACCENT;
  ctx.font = `600 44px ${SANS}`;
  ctx.fillText(time, PAD, y);
  y += 66;

  ctx.fillStyle = FG2;
  ctx.font = `400 40px ${SANS}`;
  ctx.fillText(venue, PAD, y);
  y += 62;

  // Only when somebody has actually signed up. "已报名 0 人" on a poster meant
  // to get people to come is an argument against coming.
  if (signups > 0) {
    ctx.fillStyle = FG3;
    ctx.font = `400 34px ${SANS}`;
    ctx.fillText(`已报名 ${signups} 人`, PAD, y);
    y += 54;
  }

  y += 26;
  ctx.fillStyle = "#2a3038";
  ctx.fillRect(PAD, y, maxWidth, 2);
  y += 44;

  // ── The Wharf ────────────────────────────────────────────────────
  // The QR plate is pinned to the bottom, so this is all the room the list
  // has. Which questions fit is worked out before anything is painted: the
  // heading has to say how many are actually on the poster, and an earlier
  // version announced three and then drew two.
  // 260 rather than 300: a QR this size is still comfortably scannable off a
  // phone screen, and the 40px it gives back is often one more question.
  const plate = 260;
  const plateY = H - PAD - plate;

  const QUESTION_FONT = `600 38px ${SANS}`;
  const headingHeight = 62;
  const limit = plateY - 44;

  ctx.font = QUESTION_FONT;

  const laid: { lines: string[]; name: string }[] = [];
  let used = y + headingHeight;

  for (const question of questions) {
    const lines = wrap(ctx, question.text, maxWidth - 34, 3);
    const height = lines.length * 52 + 38 + 26;

    if (used + height > limit) break;

    laid.push({ lines, name: question.name });
    used += height;
  }

  const hidden = questions.length - laid.length;

  ctx.fillStyle = CHIP;
  ctx.font = `500 30px ${MONO}`;
  ctx.fillText(laid.length > 0 ? `码头上这周挂了 ${laid.length} 个问题` : "码头", PAD, y);
  y += headingHeight;

  if (questions.length === 0) {
    ctx.fillStyle = FG2;
    ctx.font = `400 38px ${SANS}`;
    for (const line of wrap(ctx, "这周还没人挂问题。报名的时候写一句「最想问什么」，它就会出现在这儿。", maxWidth, 3)) {
      ctx.fillText(line, PAD, y);
      y += 54;
    }
  }

  for (const question of laid) {
    const start = y;

    ctx.fillStyle = FG1;
    ctx.font = QUESTION_FONT;
    for (const line of question.lines) {
      ctx.fillText(line, PAD + 34, y);
      y += 52;
    }

    ctx.fillStyle = FG3;
    ctx.font = `400 30px ${SANS}`;
    ctx.fillText(`— ${question.name}`, PAD + 34, y);
    y += 38;

    ctx.fillStyle = CHIP;
    ctx.fillRect(PAD, start, 5, y - start - 8);
    y += 26;
  }

  // Said out loud rather than quietly truncated: a poster that shows three of
  // eight and does not mention the other five is telling people the board is
  // nearly empty.
  if (hidden > 0) {
    ctx.fillStyle = FG3;
    ctx.font = `400 30px ${SANS}`;
    ctx.fillText(`还有 ${hidden} 个在码头上 →`, PAD + 34, y);
    y += 46;
  }

  // ★ Who answered this week. It goes under the open questions rather than
  // above them, because the poster's first job is still to get somebody to
  // come — but it is on here at all because being named in front of the whole
  // group is the only reward this site can actually give for answering.
  if (answers.length > 0 && y + 120 < limit) {
    y += 16;
    ctx.fillStyle = ACCENT;
    ctx.font = `500 28px ${MONO}`;
    ctx.fillText(`这周有人答了 ${answers.length} 条`, PAD, y);
    y += 48;

    for (const answer of answers) {
      if (y + 40 > limit) break;

      ctx.fillStyle = FG2;
      ctx.font = `400 30px ${SANS}`;
      const line = wrap(ctx, `${answer.name} → ${answer.text}`, maxWidth - 20, 1)[0] ?? "";
      ctx.fillText(line, PAD + 20, y);
      y += 42;
    }
  }

  // ── QR on a white plate, with the address beside it ───────────────
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(PAD, plateY, plate, plate, 20);
  ctx.fill();
  ctx.drawImage(qr, PAD + 20, plateY + 20, plate - 40, plate - 40);

  const textX = PAD + plate + 44;
  let fy = plateY + 44;

  ctx.fillStyle = FG1;
  ctx.font = `700 46px ${SANS}`;
  ctx.fillText("Vibe Thursday", textX, fy);
  fy += 64;

  ctx.fillStyle = FG2;
  ctx.font = `400 32px ${SANS}`;
  ctx.fillText("扫码看这周大家想问什么", textX, fy);
  fy += 52;

  ctx.fillStyle = ACCENT;
  ctx.font = `400 28px ${MONO}`;
  for (const line of wrap(ctx, url.replace(/^https?:\/\//, ""), W - textX - PAD, 2)) {
    ctx.fillText(line, textX, fy);
    fy += 38;
  }
}
