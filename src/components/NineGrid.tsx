"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { JPEG_QUALITY, squareFor, TALL, TALL_PIECE_TOP, tallPhotoPlacement, tilePlacement, TILE, type Fit } from "@/lib/nine-grid";

/**
 * The Moments nine-grid tool (/tools/grid, 2026-11-18): drop in one picture,
 * get nine square JPEGs that WeChat Moments shows as one big picture.
 *
 * Everything happens in the browser — the picture is never uploaded, which is
 * also why this works with no account and no server route.
 *
 * Phone first, and WeChat's in-app browser first among phones, because that
 * is where a link to this page gets opened. That browser supports neither
 * `navigator.share` with files nor `<a download>`, so the nine pieces are
 * always shown on the page as real images: long-press, "save image", in
 * order. The save button is the shortcut where the browser has one (iOS
 * Safari and Android Chrome: the share sheet saves all nine at once; a
 * computer: nine downloads).
 *
 * Pieces are data: URLs rather than blob: URLs so that long-press saving does
 * not depend on how a given WebView treats object URLs.
 */

type Source = { image: HTMLImageElement; width: number; height: number; name: string };

/** WeChat's in-app browser, where only long-press saving works. */
function inWeChat(): boolean {
  return typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent);
}

/** The user agent never changes, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};

/** Decodes a picture with the browser's own decoder. */
async function decode(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    // Browsers apply the photo's EXIF rotation here (image-orientation:
    // from-image is the default), so a portrait phone photo stays upright.
    await image.decode();
  } finally {
    // The decoded image stays usable for drawImage after the URL is revoked.
    URL.revokeObjectURL(url);
  }
  return image;
}

/** An iPhone camera photo (HEIC/HEIF), judged by type or, when the browser leaves the type empty, by name. */
function looksLikeHeic(file: File): boolean {
  return /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Loads the picture, converting an iPhone HEIC photo when the browser cannot
 * read it (2026-11-18).
 *
 * Safari reads HEIC itself, and iOS usually hands the page a JPEG anyway, so
 * the browser's decoder is always tried first. Chrome, Android and WeChat on
 * Android cannot, so for those the photo is converted to JPEG on the phone
 * with libheif (`heic-to`). That library is about 3 MB, so it is fetched only
 * when a HEIC photo actually needs it — never for a JPEG or PNG. The `csp`
 * build is used because it needs no `unsafe-eval`.
 */
async function loadImage(file: File, onConverting: () => void): Promise<Source> {
  const name = file.name.replace(/\.[^.]+$/, "");
  let image: HTMLImageElement;
  try {
    image = await decode(file);
  } catch (error) {
    if (!looksLikeHeic(file)) throw error;
    onConverting();
    const { heicTo } = await import("heic-to/csp");
    // Near-lossless: this JPEG is only an intermediate, cut again below.
    const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
    image = await decode(jpeg);
  }
  return { image, width: image.naturalWidth, height: image.naturalHeight, name };
}

/**
 * Cuts the nine pieces, row by row, as JPEG data URLs.
 *
 * `tall`: each piece is a 1:6 picture whose middle square is the grid piece
 * and whose first screen is the whole photo, so tapping a piece in Moments
 * opens to the whole photo (`TALL` in nine-grid.ts). Otherwise each piece is
 * just the square.
 */
function cut(source: Source, fit: Fit, position: number, padColour: string, tall: boolean): string[] {
  const square = squareFor(source.width, source.height, fit, position);
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = tall ? TALL.height : TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Where the square piece goes on the canvas: the top, or the middle of a tall one.
  const pieceTop = tall ? TALL_PIECE_TOP : 0;
  const photo = tallPhotoPlacement(source.width, source.height);

  const pieces: string[] = [];
  for (let index = 0; index < 9; index++) {
    if (tall) {
      ctx.fillStyle = TALL.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // The whole photo, on the pad colour in case it is a transparent PNG.
      ctx.fillStyle = padColour;
      ctx.fillRect(photo.dx, photo.dy, photo.dw, photo.dh);
      ctx.drawImage(source.image, photo.dx, photo.dy, photo.dw, photo.dh);
    }

    // The grid piece, clipped to its square so nothing spills above or below.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, pieceTop, TILE, TILE);
    ctx.clip();
    // JPEG has no transparency: paint the background first so a transparent
    // PNG comes out on the chosen colour rather than on black.
    ctx.fillStyle = padColour;
    ctx.fillRect(0, pieceTop, TILE, TILE);
    const { dx, dy, dw, dh } = tilePlacement(square, source.width, source.height, index);
    ctx.drawImage(source.image, dx, dy + pieceTop, dw, dh);
    ctx.restore();

    pieces.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
  }
  return pieces;
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const bytes = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new File([buffer], name, { type: "image/jpeg" });
}

export function NineGrid() {
  const [source, setSource] = useState<Source | null>(null);
  const [fit, setFit] = useState<Fit>("crop");
  const [position, setPosition] = useState(0.5);
  const [padColour, setPadColour] = useState("#ffffff");
  /** Tall pieces that open to the whole photo (the default since 2026-11-18). */
  const [tall, setTall] = useState(true);
  const [pieces, setPieces] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Set while a picture is being read; says so when a HEIC photo is being converted. */
  const [loading, setLoading] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // False on the server (no user agent there), the real answer once hydrated.
  const wechat = useSyncExternalStore(noSubscribe, inWeChat, () => false);

  // Re-cut whenever the picture or a setting changes. Debounced so dragging
  // the position slider does not cut nine JPEGs on every pixel of movement.
  useEffect(() => {
    if (!source) return;
    const timer = window.setTimeout(() => {
      try {
        setPieces(cut(source, fit, position, padColour, tall));
        setError(null);
      } catch (err) {
        console.error("[grid] cut failed", err);
        setError("切图失败了，换一张图试试。");
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [source, fit, position, padColour, tall]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNote(null);
    setPieces([]);
    setLoading("正在读取图片…");
    try {
      const loaded = await loadImage(file, () => setLoading("正在转换 iPhone 照片格式（HEIC），第一次要几秒…"));
      setSource(loaded);
      setPosition(0.5);
    } catch (err) {
      console.error("[grid] could not read the picture", err);
      setSource(null);
      setError("这张图打不开。换成 JPG、PNG 或 HEIC 照片再试，或者先截个屏再传截图。");
    } finally {
      setLoading(null);
    }
  }

  async function saveAll() {
    if (pieces.length !== 9 || !source) return;
    setSaving(true);
    setNote(null);
    try {
      const files = pieces.map((piece, i) => dataUrlToFile(piece, `九宫格-${i + 1}.jpg`));

      // Phones: one share sheet saves all nine, in order.
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files });
        setNote("存好后，发朋友圈时按 1→9 的顺序勾选。");
        return;
      }

      // Computers: nine downloads. Spaced out, because browsers drop
      // downloads started in the same instant.
      for (const [i, piece] of pieces.entries()) {
        const anchor = document.createElement("a");
        anchor.href = piece;
        anchor.download = `九宫格-${i + 1}.jpg`;
        anchor.click();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      setNote("电脑上会下载 9 张（浏览器问要不要允许下载多个文件，点允许）。没看到下载的话，长按或右键每张图保存。");
    } catch (err) {
      // AbortError is the person closing the share sheet, not a failure.
      if ((err as Error)?.name !== "AbortError") {
        console.error("[grid] save failed", err);
        setNote("没能一键保存，长按下面每张图保存也一样。");
      }
    } finally {
      setSaving(false);
    }
  }

  const square = source ? source.width === source.height : true;
  const landscape = source ? source.width > source.height : false;

  return (
    <div className="grid-tool stack-6">
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          // Let the same file be picked again after "换一张".
          event.target.value = "";
        }}
      />

      {loading ? (
        <div className="grid-tool__drop" role="status">
          <span className="grid-tool__drop-title">{loading}</span>
        </div>
      ) : !source ? (
        <button type="button" className="grid-tool__drop" onClick={() => input.current?.click()}>
          <span className="grid-tool__drop-icon" aria-hidden="true">＋</span>
          <span className="grid-tool__drop-title">选一张图</span>
          <span className="body-sm">从相册选，或者拍一张；JPG、PNG、iPhone 的 HEIC 都可以</span>
        </button>
      ) : (
        <>
          {!square && (
            <div className="stack-4">
              <div className="grid-tool__seg" role="radiogroup" aria-label="不是正方形的图怎么处理">
                {([["crop", "裁成正方形"], ["pad", "留边补齐"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={fit === value}
                    className={fit === value ? "is-on" : undefined}
                    onClick={() => setFit(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {fit === "crop" ? (
                <label className="stack-2">
                  <span className="body-sm">拖动选保留哪一块（{landscape ? "左 ↔ 右" : "上 ↔ 下"}）</span>
                  <input
                    className="grid-tool__range"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={position}
                    onChange={(event) => setPosition(Number(event.target.value))}
                  />
                </label>
              ) : (
                <div className="grid-tool__seg" role="radiogroup" aria-label="补边颜色">
                  {([["#ffffff", "白边"], ["#000000", "黑边"]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={padColour === value}
                      className={padColour === value ? "is-on" : undefined}
                      onClick={() => setPadColour(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="stack-2">
            <div className="grid-tool__seg" role="radiogroup" aria-label="点开单张图时看到什么">
              {([[true, "点开看完整图"], [false, "只切九宫格"]] as const).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={tall === value}
                  className={tall === value ? "is-on" : undefined}
                  onClick={() => setTall(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="body-sm" style={{ margin: 0 }}>
              {tall
                ? "朋友圈里拼成一张大图；点开任意一张，看到的是完整原图。"
                : "每张就是大图的九分之一，点开单张只看到局部。"}
            </p>
          </div>

          {/* A Moments post as it looks in WeChat (light mode): avatar, name,
              then the nine pictures as square thumbnails on white, with white
              gaps between them — the gaps are what the big picture is seen
              through, so the preview shows them. */}
          <div className="moment" aria-label="朋友圈效果预览">
            <div className="moment__avatar" aria-hidden="true" />
            <div className="moment__body">
              <p className="moment__name">我</p>
              <div className="moment__grid-wrap">
                <div className="grid-tool__grid" aria-label="切好的九张图，按发朋友圈的顺序排列">
                  {pieces.length === 9
                    ? pieces.map((piece, i) => (
                        <figure key={i} className="grid-tool__cell">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={piece} alt={`第 ${i + 1} 张`} />
                          <span className="grid-tool__n mono" aria-hidden="true">{i + 1}</span>
                        </figure>
                      ))
                    : Array.from({ length: 9 }, (_, i) => <div key={i} className="grid-tool__cell grid-tool__cell--wait" />)}
                </div>
              </div>
              <p className="moment__time">1分钟前</p>
            </div>
          </div>
          <p className="body-sm" style={{ margin: 0 }}>上面是朋友圈里的样子；左上角的编号只在这里显示，保存的图上没有。</p>

          {wechat ? (
            <div className="card card--accent stack-2">
              <p style={{ margin: 0, fontWeight: 700 }}>微信里请长按保存</p>
              <p style={{ margin: 0 }}>
                从第 1 张开始，依次长按每张图 →「保存图片」。想一键存 9 张：点右上角「···」→「在浏览器打开」。
              </p>
            </div>
          ) : (
            <button type="button" className="btn btn--primary btn--block" onClick={saveAll} disabled={saving || pieces.length !== 9}>
              {saving ? "正在保存…" : "一键保存 9 张"}
            </button>
          )}
          {note && <p className="body-sm" style={{ margin: 0 }}>{note}</p>}

          <button type="button" className="btn btn--secondary btn--block" onClick={() => input.current?.click()}>
            换一张图
          </button>
        </>
      )}

      {error && <p className="alert" role="alert">{error}</p>}
    </div>
  );
}
