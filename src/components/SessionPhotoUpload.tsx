"use client";

import { useState } from "react";
import type { Copy } from "@/lib/content";

type Props = {
  session: string;
  copy: Copy["archive"]["photos"];
};

/** Long edge after shrinking. Plenty for a phone screen, a fraction of the original. */
const LONG_EDGE = 1600;

/** Matches MAX_PHOTOS_PER_UPLOAD in session-photos.ts; the server is the one that enforces it. */
const MAX_FILES = 5;

/**
 * Shrinks and re-encodes one photo in the browser, the way the avatar picker
 * does.
 *
 * Three things fall out of the canvas round trip: a phone's several-megabyte
 * HEIC becomes a JPEG of a few hundred kilobytes; the picture is turned the
 * right way up (createImageBitmap applies the EXIF orientation); and the EXIF
 * itself — GPS, device serial, timestamp — is not carried over, because a
 * canvas has nowhere to keep it.
 */
async function shrinkToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("toBlob failed");
  return blob;
}

type Status = { kind: "idle" } | { kind: "working" } | { kind: "done"; n: number } | { kind: "error"; text: string };

export function SessionPhotoUpload({ session, copy }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Bumped after a successful upload so the file input remounts empty.
  const [inputKey, setInputKey] = useState(0);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!consent) {
      setStatus({ kind: "error", text: copy.errors.no_consent });
      return;
    }
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      setStatus({ kind: "error", text: copy.errors.too_many_files });
      return;
    }

    setStatus({ kind: "working" });

    try {
      const body = new FormData();
      body.append("session", session);
      body.append("consent", "yes");

      for (const [index, file] of files.entries()) {
        let blob: Blob;
        try {
          blob = await shrinkToJpeg(file);
        } catch {
          setStatus({ kind: "error", text: copy.errors.bad_type });
          return;
        }
        // The name is ours, not the person's: the server never stores it, and
        // nothing a visitor typed into a filename should travel anywhere.
        body.append("photo", new File([blob], `photo-${index + 1}.jpg`, { type: "image/jpeg" }));
      }

      const response = await fetch("/api/session-photos", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { saved?: number; error?: string };

      if (!response.ok) {
        const known = result.error && result.error in copy.errors ? result.error : "generic";
        setStatus({ kind: "error", text: copy.errors[known as keyof typeof copy.errors] });
        return;
      }

      setFiles([]);
      setConsent(false);
      setInputKey((key) => key + 1);
      setStatus({ kind: "done", n: result.saved ?? files.length });
    } catch {
      setStatus({ kind: "error", text: copy.errors.generic });
    }
  }

  const working = status.kind === "working";

  return (
    <form className="card stack-3" onSubmit={onSubmit} style={{ maxWidth: "36rem" }}>
      <h3>{copy.uploadTitle}</h3>
      <p className="body-sm">{copy.uploadLede}</p>

      <label className="consent">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
        />
        <span>{copy.consent}</span>
      </label>

      <div className="stack-2">
        <label className="label" htmlFor={`photos-${session}`}>
          {copy.pick}
        </label>
        <input
          key={inputKey}
          id={`photos-${session}`}
          type="file"
          accept="image/*"
          multiple
          disabled={working}
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            setStatus({ kind: "idle" });
          }}
        />
        {files.length > 0 && <p className="hint">{copy.picked.replace("{n}", String(files.length))}</p>}
      </div>

      <div>
        <button className="btn btn--primary" type="submit" disabled={working || files.length === 0}>
          {working ? copy.working : copy.submit}
        </button>
      </div>

      {status.kind === "done" && (
        <p className="alert alert--success" role="status">
          {copy.done.replace("{n}", String(status.n))}
        </p>
      )}
      {status.kind === "error" && (
        <p className="alert alert--error" role="alert">
          {status.text}
        </p>
      )}
    </form>
  );
}
