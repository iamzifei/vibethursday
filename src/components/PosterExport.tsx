"use client";

import { useEffect, useState } from "react";
import { ACCENT, CHIP, FG1, FG2, FG3, MONO, SANS, SPARK, wrap } from "@/components/canvas-kit";
import { drawCardFallback, drawCardFrame, drawCardImage, tintColor } from "@/components/poster-art";
import { cardArt, posterCard } from "@/lib/poster-card";

export type PosterQuestion = {
  text: string;
  name: string;
};

type Props = {
  /**
   * The session's own ISO date, e.g. "2026-09-24".
   *
   * `date` below is already formatted for reading; this is the one the card is
   * derived from — which picture, which tint, which number.
   */
  session: string;
  /** "9月3日（周四）", already formatted and already Sydney's date. */
  date: string;
  /** "10:30 开门 · 开门就开始". */
  time: string;
  /** "The Avenue · Chatswood". */
  venue: string;
  /** How many have signed up for this one so far. */
  signups: number;
  /** What is on the Wharf for this session, longest-standing first. */
  questions: PosterQuestion[];
  /** Who answered something in the last week, and what. */
  answers: PosterQuestion[];
  /**
   * The check-in code for this session, rendered server-side by `qrcode`.
   *
   * ⚠️ Not a link to the Wharf, which is what this used to be. Scanning it on
   * the day checks somebody in; scanning it on any other day lands on "this
   * code is not today's", which is why `url` below still has to be an address
   * that works all week.
   */
  qrSvg: string;
  /** Printed beside the QR, so a screenshot still says where to go. */
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
 * ★ Every week's is a different card: its own Sydney picture, its own tint and
 * a serial number, all derived from the session's date in `poster-card.ts` and
 * drawn in `poster-art.ts`. A notice gets read once and scrolled past; the
 * point of a numbered set is that the eighth one is worth keeping next to the
 * seventh. Nothing about it is random — the same Thursday draws the same card.
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
  // Shown next to the button so the organiser knows which card is coming out
  // before pressing anything. Same call the drawing makes, same answer.
  const card = posterCard(props.session);

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

      // The week's picture, same-origin so it cannot taint the canvas and
      // `toBlob` keeps working. If it will not load the poster still comes out,
      // on bare ink — everything that makes it worth sending is text.
      let art: HTMLImageElement | null = null;

      try {
        const plate = new Image();
        plate.src = cardArt(posterCard(props.session).scene);
        await plate.decode();
        art = plate;
      } catch (error) {
        console.warn("[poster] card art did not load; drawing on bare ink", error);
      }

      draw(ctx, props, qr, art);

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
              : `NO.${String(card.no).padStart(2, "0")} ${card.scene.zh} · ${props.questions.length} 个问题${props.answers.length > 0 ? ` · ${props.answers.length} 条这周的回答` : ""}会印在上面`}
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

function draw(
  ctx: CanvasRenderingContext2D,
  props: Props,
  qr: HTMLImageElement,
  art: HTMLImageElement | null,
) {
  const { date, time, venue, signups, questions, answers, url } = props;
  const maxWidth = W - PAD * 2;

  // Which card this is. Everything the backdrop does follows from the session's
  // date, so this line is the whole reason two weeks look different.
  const card = posterCard(props.session);
  const tint = tintColor(card);

  if (art) drawCardImage(ctx, art, W, H);
  else drawCardFallback(ctx, W, H);

  ctx.textBaseline = "top";

  let y = PAD + 16;

  ctx.fillStyle = SPARK;
  ctx.font = `500 30px ${MONO}`;
  ctx.fillText("SYDNEY · EVERY THURSDAY", PAD, y);

  // ★ The serial and what the picture is, as one lockup against the eyebrow.
  // ⚠️ Same size class on purpose. These two lines are the only thing on the
  // poster that says it is one of a set, and in the first version the scene's
  // name was set smaller and greyer than everything around it — the review
  // could not read it at thumbnail size on any of the seven cards, which is
  // the size the whole conceit has to survive.
  ctx.textAlign = "right";

  ctx.fillStyle = tint;
  ctx.font = `600 36px ${MONO}`;
  ctx.fillText(`NO.${String(card.no).padStart(2, "0")}`, W - PAD, y - 6);

  ctx.fillStyle = FG1;
  ctx.font = `500 32px ${SANS}`;
  ctx.fillText(card.scene.zh, W - PAD, y + 40);

  ctx.textAlign = "left";
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

  // ⚠️ There used to be a rule across the page here. It is gone deliberately:
  // a line under the picture fenced the art into the top third and turned the
  // card into a masthead with a notice under it. The plate now runs the full
  // height and fades instead.
  y += 70;

  // ── The Wharf ────────────────────────────────────────────────────
  // The QR plate is pinned to the bottom, so this is all the room the list
  // has, and which questions fit is worked out before anything is painted —
  // the line under the list has to say how many did.
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

  // ⚠️ The heading counts what is on the WHARF, and the line after the list
  // says how many of them fit here. It used to count what fit, which made the
  // two sentences contradict each other on every poster that had to truncate:
  // "the Wharf has 2 questions this week" directly above "2 more are on the
  // Wharf". Whichever number the reader trusts, one of them was a lie.
  ctx.fillStyle = CHIP;
  ctx.font = `500 30px ${MONO}`;
  ctx.fillText(questions.length > 0 ? `码头上这周挂了 ${questions.length} 个问题` : "码头", PAD, y);
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
    ctx.fillText(`这里印了 ${laid.length} 个 · 还有 ${hidden} 个在码头上 →`, PAD + 34, y);
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
  let fy = plateY + 32;

  ctx.fillStyle = FG1;
  ctx.font = `700 46px ${SANS}`;
  ctx.fillText("Vibe Thursday", textX, fy);
  fy += 62;

  // ⚠️ Says what the code actually does, and says it in the loudest voice in
  // this block. It is the check-in code and it only works on the day. The
  // first version set this line small and grey and put the Wharf address under
  // it in lime monospace — so the brightest text beside the code named the one
  // place the code does not go, and the review read the whole block as "scan
  // this for the questions".
  ctx.fillStyle = ACCENT;
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText("当天到场 · 扫码签到", textX, fy);
  fy += 54;

  // The address, quiet. It is the fallback for the six days when the code is
  // dead, not the headline.
  ctx.fillStyle = FG3;
  ctx.font = `400 26px ${MONO}`;
  for (const line of wrap(ctx, `这周的问题：${url.replace(/^https?:\/\//, "")}`, W - textX - PAD, 2)) {
    ctx.fillText(line, textX, fy);
    fy += 34;
  }

  // Last, over everything: the border and the corner ticks are the card's edge.
  drawCardFrame(ctx, card, W, H);
}
