"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore } from "react";
import type { Copy } from "@/lib/content";
import { profileSnapshot, subscribeProfile } from "@/lib/saved-profile";

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

  // The details this device signed up with. Claiming matches name and contact
  // exactly, and retyping them from memory is where people were failing — a
  // nickname instead of the ID, or a note that had been typed after it.
  // Null on the server and during hydration; see saved-profile for why this is
  // an external store.
  const profile = useSyncExternalStore(subscribeProfile, profileSnapshot, () => null);
  const prefillContact = profile ? profile.wechat || profile.email : "";

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
    // POST so a tap before the script loads never puts the name and contact in the URL.
    <form className="stack-6" method="post" onSubmit={handleSubmit} noValidate>
      <div className="grid-auto">
        <div>
          <label className="label" htmlFor={`${uid}-name`}>
            {copy.nameLabel} <span className="required">*</span>
          </label>
          <input
            className="field"
            id={`${uid}-name`}
            key={profile ? "prefilled" : "empty"}
            name="name"
            type="text"
            required
            autoComplete="name"
            defaultValue={profile?.name ?? ""}
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
            key={profile ? "prefilled" : "empty"}
            name="contact"
            type="text"
            required
            autoComplete="off"
            defaultValue={prefillContact}
            autoCapitalize="none"
            spellCheck={false}
            placeholder={copy.contactPlaceholder}
          />
        </div>
      </div>

      {profile && <p className="body-sm">{copy.prefilled}</p>}

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
