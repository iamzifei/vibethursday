"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import type { Copy, Lang } from "@/lib/content";

type SessionOption = { value: string; label: string };

type Props = {
  lang: Lang;
  copy: Copy["signup"];
  sessions: SessionOption[];
  /** Absent when Turnstile is not configured; the widget is then not rendered. */
  turnstileSiteKey: string | null;
};

type Status = "idle" | "sending" | "done" | "error";

/** What we remember locally so a returning attendee only picks a session. */
type SavedProfile = { name: string; email: string; wechat: string; building: string };

const PROFILE_KEY = "vt.profile";

/**
 * Reads the profile left by this browser's last successful signup.
 *
 * Deliberately localStorage and not an account: this form has no login, no
 * password and no payment behind it, and only a third of signups even leave an
 * email, so email is not a usable identity here. Keeping it on the device
 * means a returning regular taps twice, and nobody can look up anyone else's
 * details by guessing a WeChat ID.
 */
function readProfile(): SavedProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedProfile>;
    if (!parsed.name || (!parsed.wechat && !parsed.email)) return null;
    return {
      name: parsed.name,
      email: parsed.email ?? "",
      wechat: parsed.wechat ?? "",
      building: parsed.building ?? "",
    };
  } catch {
    // Private mode and locked-down browsers throw on access rather than
    // returning null; a returning visitor just sees the full form.
    return null;
  }
}

export function SignupForm({ lang, copy, sessions, turnstileSiteKey }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [botCheckGaveUp, setBotCheckGaveUp] = useState(false);
  const [profile, setProfile] = useState<SavedProfile | null>(null);
  const [editing, setEditing] = useState(false);

  // Read after mount, never during render: localStorage does not exist on the
  // server, and reading it in the first client render would mismatch the
  // server HTML and get thrown away by hydration.
  useEffect(() => setProfile(readProfile()), []);

  // Compact mode: known visitor, and they have not asked to edit their details.
  const returning = profile !== null && !editing;

  // Stable identity so the widget is not torn down and re-rendered on every
  // keystroke in the form above it.
  const handleToken = useCallback((token: string | null) => setTurnstileToken(token), []);

  // Turnstile does not always complete — WeChat's in-app browser is the case
  // that bit us, and it happens to be this community's main sharing channel.
  // After the grace period the widget is removed and the form is submitted
  // without a token rather than leaving someone stuck on a spinner forever.
  // Signing up must never depend on the bot check succeeding.
  useEffect(() => {
    if (!turnstileSiteKey || turnstileToken) return;

    const timer = setTimeout(() => setBotCheckGaveUp(true), 8_000);
    return () => clearTimeout(timer);
  }, [turnstileSiteKey, turnstileToken]);

  // useId keeps label/input wiring unique and stable across server and client
  // renders, which is what makes tapping a label focus the right field.
  const uid = useId();
  const fieldId = (field: string) => `${uid}-${field}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    // In compact mode the identity fields are not rendered, so they come from
    // the saved profile instead of the form.
    const name = returning ? profile!.name : String(data.get("name") ?? "").trim();
    const email = returning ? profile!.email : String(data.get("email") ?? "").trim();
    const wechat = returning ? profile!.wechat : String(data.get("wechat") ?? "").trim();
    const building = returning ? profile!.building : String(data.get("building") ?? "").trim();

    // The Chinese form asks for a WeChat ID, the English one for an email —
    // that audience split is real, so the required field follows the language.
    const missingRequired =
      !name || (copy.fields.emailRequired && !email) || (copy.fields.wechatRequired && !wechat);

    if (missingRequired) {
      setStatus("error");
      setMessage(copy.errorRequired);
      return;
    }

    // Whichever language, one contact method has to be there.
    if (!email && !wechat) {
      setStatus("error");
      setMessage(copy.errorNeedContact);
      return;
    }

    setStatus("sending");
    setMessage(null);

    const post = (token: string | null) =>
      fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          wechat,
          building,
          demoIntent: data.get("demoIntent"),
          topic: data.get("topic"),
          firstSession: data.get("firstSession"),
          source: data.get("source"),
          company: data.get("company"),
          turnstileToken: token,
          lang,
        }),
      });

    try {
      let response = await post(turnstileToken);

      // A token is single-use and expires after a few minutes, so the common
      // cause of this rejection is a stale token from someone who took their
      // time filling the form — not a bot. Retry once without it, which lands
      // in exactly the same place as a browser that never solved the challenge
      // at all. This gives nothing away: omitting the token was already an
      // accepted path, so a bot gains nothing it did not already have.
      if (response.status === 403 && turnstileToken) {
        setTurnstileToken(null);
        response = await post(null);
      }

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setMessage(
          result?.error === "invalid_email"
            ? copy.errorEmail
            : result?.error === "failed_bot_check"
              ? copy.errorRobot
              : copy.errorGeneric,
        );
        setTurnstileToken(null);
        return;
      }

      // Remember them so the next session is a two-tap job. Written only after
      // the server accepted the signup, so a failed submission never leaves a
      // profile behind that was never actually registered.
      try {
        window.localStorage.setItem(
          PROFILE_KEY,
          JSON.stringify({ name, email, wechat, building } satisfies SavedProfile),
        );
      } catch {
        // Storage disabled or full. Signing up still worked, which is the part
        // that matters; they will just fill the form again next time.
      }

      setStatus("done");
      form.reset();
    } catch {
      setStatus("error");
      setMessage(copy.errorGeneric);
    }
  }

  if (status === "done") {
    return (
      <div className="card card--accent stack-4" role="status">
        <h3 className="h3">{copy.successTitle}</h3>
        <p>{copy.successBody}</p>

        {/* The one moment where claiming a card is not a chore: the signup it
            needs was created seconds ago, and the details are still in mind. */}
        <p className="body-sm">{copy.successClaimBody}</p>
        <a className="btn btn--primary" href={lang === "en" ? "/claim?lang=en" : "/claim"}>
          {copy.successClaimCta}
        </a>
      </div>
    );
  }

  const sending = status === "sending";

  // The widget stays mounted after it succeeds. Unmounting it on success would
  // also throw away Turnstile's expiry callback, and tokens expire in a few
  // minutes — long enough for someone to still be writing the "what are you
  // working on" box. It is only removed once the grace period has passed with
  // no token, because a spinner that never resolves reads as a broken page.
  const showBotCheck = Boolean(turnstileSiteKey) && !botCheckGaveUp;

  return (
    <form className="stack-6" onSubmit={handleSubmit} noValidate>
      {/* Honeypot. Hidden from sighted users and skipped by screen readers and
          keyboard tabbing, so only automated submissions ever fill it. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor={fieldId("company")}>Company</label>
        <input id={fieldId("company")} name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {returning ? (
        /* Known visitor: greeting plus the one thing that changes each week. */
        <div className="returning">
          <p className="returning__hello">{copy.returning.hello.replace("{name}", profile!.name)}</p>
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            {copy.returning.notYou}
          </button>
        </div>
      ) : (
        <>
        <div className="grid-auto">
          <div>
            <label className="label" htmlFor={fieldId("name")}>
              {copy.fields.name} <span className="required">*</span>
            </label>
            <input
              className="field"
              id={fieldId("name")}
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder={copy.fields.namePlaceholder}
            />
          </div>

          <div>
            <label className="label" htmlFor={fieldId("email")}>
              {copy.fields.email}
              {copy.fields.emailRequired && <span className="required"> *</span>}
            </label>
            <input
              className="field"
              id={fieldId("email")}
              name="email"
              type="email"
              required={copy.fields.emailRequired}
              autoComplete="email"
              inputMode="email"
              placeholder={copy.fields.emailPlaceholder}
            />
          </div>

          <div>
            <label className="label" htmlFor={fieldId("wechat")}>
              {copy.fields.wechat}
              {copy.fields.wechatRequired && <span className="required"> *</span>}
            </label>
            <input
              className="field"
              id={fieldId("wechat")}
              name="wechat"
              type="text"
              required={copy.fields.wechatRequired}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={copy.fields.wechatPlaceholder}
            />
          </div>
        </div>

        {/* One note under both contact fields rather than a hint on each — the
            reassurance is about the pair, and repeating it dilutes it. */}
        <p className="privacy-note">{copy.fields.contactPrivacy}</p>

        <div>
          <label className="label" htmlFor={fieldId("building")}>
            {copy.fields.building}
          </label>
          <textarea
            className="field"
            id={fieldId("building")}
            name="building"
            rows={3}
            placeholder={copy.fields.buildingPlaceholder}
          />
        </div>
        </>
      )}

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">{copy.fields.demoIntent}</legend>
        <div className="choice-group">
          {copy.fields.demoOptions.map((option, index) => (
            <label className="choice" key={option.value}>
              <input
                type="radio"
                name="demoIntent"
                value={option.value}
                defaultChecked={index === copy.fields.demoOptions.length - 1}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Rendered in both modes: unlike name or WeChat this genuinely changes
          week to week, so a returning visitor should be asked again. */}
      <div>
        <label className="label" htmlFor={fieldId("topic")}>
          {copy.fields.topic}
        </label>
        <textarea
          className="field"
          id={fieldId("topic")}
          name="topic"
          rows={2}
          placeholder={copy.fields.topicPlaceholder}
        />
        <p className="field-hint">{copy.fields.topicHint}</p>
      </div>

      <div className="grid-auto">
        <div>
          <label className="label" htmlFor={fieldId("session")}>
            {copy.fields.session}
          </label>
          <select className="field" id={fieldId("session")} name="firstSession" defaultValue={sessions[0]?.value}>
            {sessions.map((session) => (
              <option key={session.value} value={session.value}>
                {session.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor={fieldId("source")}>
            {copy.fields.source}
          </label>
          <input
            className="field"
            id={fieldId("source")}
            name="source"
            type="text"
            placeholder={copy.fields.sourcePlaceholder}
          />
        </div>
      </div>

      {showBotCheck && (
        <Turnstile siteKey={turnstileSiteKey!} lang={lang} onToken={handleToken} />
      )}

      {message && (
        <p className="alert alert--error" role="alert">
          {message}
        </p>
      )}

      {/* Never disabled by the bot check — only while a submission is in
          flight. A failed challenge must not be able to block a signup. */}
      <button className="btn btn--primary btn--block" type="submit" disabled={sending}>
        {sending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
