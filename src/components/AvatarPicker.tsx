"use client";

import { useRef, useState } from "react";
import type { Copy } from "@/lib/content";
import { monogram } from "@/lib/members";

type Props = {
  memberId: string;
  name: string;
  initialHasAvatar: boolean;
  initialVersion: number;
  copy: Copy["editor"];
};

/** Square, and no larger than any card will ever display it at 3x. */
const SIZE = 512;

/**
 * Resizes and re-encodes in the browser before uploading.
 *
 * A photo straight off a phone is several megabytes of HEIC or JPEG; every one
 * of those bytes would otherwise cross the network, sit in Postgres and come
 * back down to everyone browsing the wall. Doing it here also means the server
 * never has to run an image library.
 */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  // Centre crop to a square first, so nobody gets stretched.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );

  if (!blob) throw new Error("toBlob failed");
  return blob;
}

export function AvatarPicker({ memberId, name, initialHasAvatar, initialVersion, copy }: Props) {
  // Existence and version are tracked apart, because removing a photo still
  // bumps the version — a single counter cannot answer both questions.
  const [hasAvatar, setHasAvatar] = useState(initialHasAvatar);
  const [version, setVersion] = useState(initialVersion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear immediately so picking the same file twice still fires a change.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      const blob = await toSquareJpeg(file);
      const body = new FormData();
      body.append("avatar", new File([blob], "avatar.jpg", { type: "image/jpeg" }));

      const response = await fetch("/api/me/avatar", { method: "POST", body });

      if (!response.ok) {
        setError(copy.avatarFailed);
        return;
      }

      const result = (await response.json()) as { version: number };
      setVersion(result.version);
      setHasAvatar(true);
    } catch {
      setError(copy.avatarFailed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/me/avatar", { method: "DELETE" });
    setHasAvatar(false);
    setBusy(false);
  }

  return (
    <div className="stack-2">
      <span className="label" style={{ marginBottom: 0 }}>
        {copy.avatar}
      </span>

      <div className="avatar-picker">
        {hasAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="monogram monogram--lg monogram--photo"
            src={`/api/avatar/${memberId}?v=${version}`}
            alt={name}
            width={72}
            height={72}
          />
        ) : (
          <span className="monogram monogram--lg" aria-hidden="true">
            {monogram(name)}
          </span>
        )}

        <div className="avatar-picker__actions">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? copy.avatarWorking : hasAvatar ? copy.avatarReplace : copy.avatarUpload}
          </button>

          {hasAvatar && (
            <button type="button" className="link-button" disabled={busy} onClick={remove}>
              {copy.avatarRemove}
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={onPick}
        />
      </div>

      <p className="hint">{error ?? copy.avatarHint}</p>
    </div>
  );
}
