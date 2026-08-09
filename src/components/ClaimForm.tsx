"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { Copy } from "@/lib/content";

type Props = {
  copy: Copy["claim"];
  /** Where to land once the card is claimed, language included. */
  nextHref: string;
};

export function ClaimForm({ copy, nextHref }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const uid = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const contact = String(data.get("contact") ?? "").trim();

    if (!name || !contact) {
      setStatus("error");
      setMessage(copy.errorRequired);
      return;
    }

    setStatus("sending");
    setMessage(null);

    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setMessage(result?.error === "not_found" ? copy.errorNotFound : copy.errorGeneric);
        return;
      }

      // The editor is a server component reading a cookie the API just set, so
      // the cached router tree has to be dropped before navigating or it would
      // render the signed-out version.
      router.refresh();
      router.push(nextHref);
    } catch {
      setStatus("error");
      setMessage(copy.errorGeneric);
    }
  }

  const sending = status === "sending";

  return (
    <form className="stack-6" onSubmit={handleSubmit} noValidate>
      <div className="grid-auto">
        <div>
          <label className="label" htmlFor={`${uid}-name`}>
            {copy.nameLabel} <span className="required">*</span>
          </label>
          <input
            className="field"
            id={`${uid}-name`}
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder={copy.namePlaceholder}
          />
        </div>

        <div>
          <label className="label" htmlFor={`${uid}-contact`}>
            {copy.contactLabel} <span className="required">*</span>
          </label>
          <input
            className="field"
            id={`${uid}-contact`}
            name="contact"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={copy.contactPlaceholder}
          />
        </div>
      </div>

      <p className="privacy-note">{copy.privacy}</p>

      {message && (
        <p className="alert alert--error" role="alert">
          {message}
        </p>
      )}

      <button className="btn btn--primary btn--block" type="submit" disabled={sending}>
        {sending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
