"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CoachRounds, useCoach, type CoachCopy } from "@/components/QuestionCoach";
import { Turnstile } from "@/components/Turnstile";
import type { Copy, Lang } from "@/lib/content";
import { clearDraft, DRAFT_DEBOUNCE_MS, readDraft, writeDraft } from "@/lib/draft";
import {
  notifyProfile,
  PROFILE_KEY,
  profileSnapshot,
  subscribeProfile,
  type SavedProfile,
} from "@/lib/saved-profile";
import { LANG_PARAM } from "@/lib/lang";
import { looksLikeWechatId } from "@/lib/wechat-id";

/** `tuesday`: a Build Tuesday rather than a Thursday (`SPECIAL_SESSIONS`). */
type SessionOption = { value: string; label: string; full?: boolean; tuesday?: boolean };

type Props = {
  lang: Lang;
  copy: Copy["signup"];
  sessions: SessionOption[];
  /** Absent when Turnstile is not configured; the widget is then not rendered. */
  turnstileSiteKey: string | null;
  /** The follow-up-question helper's strings, or null when this deployment has no key for it. */
  coach?: CoachCopy | null;
  /**
   * Who this browser is, when the server knows from its remember cookie —
   * typically someone recognised by WeChat login on a phone that has never
   * signed up here. Used when this browser has no saved profile of its own.
   * The name only: the contact details stay on the server, which fills them
   * in when the form is sent with `fromCookie` (see the signup route).
   */
  knownProfile?: { name: string } | null;
  /** "Log in with WeChat": the link and its words, or null while login is off. */
  wechatLogin?: { href: string; label: string } | null;
};

type Status = "idle" | "sending" | "done" | "error";

/** What the success card repeats back: the session, and the values on record. */
type Receipt = {
  name: string;
  email: string;
  wechat: string;
  session: string | null;
  waitlisted: boolean;
  /** Every upcoming Thursday they are now down for, when the server could say. */
  upcoming: { label: string; waitlisted: boolean }[] | null;
  /** Waitlisted for a Thursday while a Build Tuesday still has room. */
  tuesday: { label: string; left: number } | null;
  /** The server set the "this phone remembers you" cookie, so the one-tap
      interest question below can be answered without asking who they are. */
  remembered: boolean;
};

/** Purposes that mean "I build things" — the people Build Tuesday is for. */
const BUILDER_PURPOSES = new Set(["product", "tech"]);

/**
 * Unsent form contents, kept separately from the saved profile
 * (see `@/lib/saved-profile`).
 *
 * The profile is written only after the server accepts a signup; this is the
 * half-filled state before that, so scrolling away to read the FAQ or opening
 * the member wall in the same tab does not cost someone their typing.
 */
const DRAFT_KEY = "vt.signup.draft";

/** Fields never worth keeping: the honeypot, and a token that expires anyway. */
const DRAFT_SKIP = new Set(["company", "turnstileToken"]);

/**
 * What lives inside the folded section at the bottom of the form.
 *
 * Only used to decide whether a restored draft should open it. `aiModels` is a
 * checkbox group and the draft does not round-trip those, so it is not listed —
 * see the note on `saveDraft`.
 */
const EXTRA_FIELDS = ["source", "aiSpend", "building", "email"];

export function SignupForm({ lang, copy, sessions, turnstileSiteKey, coach, knownProfile = null, wechatLogin = null }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  useEffect(() => {
    if (status === "done") doneRef.current?.focus();
  }, [status]);
  const [message, setMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // The WeChat value the nickname warning was last shown for. Submitting the
  // same value again goes through: the check is advice, never a gate.
  const [wechatWarnedFor, setWechatWarnedFor] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [botCheckGaveUp, setBotCheckGaveUp] = useState(false);
  const [editing, setEditing] = useState(false);
  // Read back from the uncontrolled session select and purpose radios, only to
  // decide whether to suggest Build Tuesday. The form still reads itself with
  // FormData on submit.
  // The nearest Thursday, never a Build Tuesday: the Tuesday sorts first in
  // the week it falls in, and someone who just presses submit meant Thursday.
  // On /tuesday every option is a Tuesday, so the first one stands.
  const defaultSession = sessions.find((session) => !session.tuesday)?.value ?? sessions[0]?.value;
  const [pickedSession, setPickedSession] = useState<string | undefined>(defaultSession);
  const [pickedPurpose, setPickedPurpose] = useState<string | null>(null);
  const sessionRef = useRef<HTMLSelectElement>(null);
  // The one-tap "what else would you come to" on the confirmation.
  const [interest, setInterest] = useState<"idle" | "sending" | "done">("idle");

  // Null on the server and during hydration, then the stored profile if there
  // is one. See the store above for why this is not a useState + useEffect.
  // Falls back to what the server knows (`knownProfile`), so someone WeChat
  // recognised gets the two-tap form too. The server render and hydration both
  // see the same fallback, so there is no mismatch.
  const stored = useSyncExternalStore(subscribeProfile, profileSnapshot, () => null);
  const profile: (SavedProfile & { fromServer?: true }) | null =
    stored ?? (knownProfile ? { name: knownProfile.name, email: "", wechat: "", building: "", fromServer: true } : null);
  // Identity comes from the server's cookie, not from anything this browser holds.
  const fromServer = profile?.fromServer === true;

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

  /* ── Draft ────────────────────────────────────────────────────────
     The inputs here are uncontrolled — the form reads itself with FormData on
     submit — so the draft is read and written through the form element rather
     than through state. That keeps a dozen fields from becoming a dozen
     useStates purely to enable autosave. */
  const formRef = useRef<HTMLFormElement>(null);

  /* The folded section at the bottom. Held so a restored draft can open it —
     see the effect below. */
  const extrasRef = useRef<HTMLDetailsElement>(null);

  /* The purpose question, so a missing answer can scroll it back into view —
     on a phone the error message sits at the bottom, far below the question. */
  const purposeRef = useRef<HTMLFieldSetElement>(null);

  /* The topic box, read when the coach button is pressed. Uncontrolled like the
     rest of the form, so the draft autosave keeps working unchanged. */
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const helper = useCoach();

  /* The confirmation replaces the form, so the button that had focus is gone
     and focus fell back to <body>; screen readers often announced nothing
     (2026-09-28 review). Focus the confirmation's heading instead. */
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const draft = readDraft<Record<string, string>>(DRAFT_KEY);
    const form = formRef.current;

    if (!draft || !form) return;

    for (const [name, value] of Object.entries(draft)) {
      const element = form.elements.namedItem(name);

      // A RadioNodeList also has a settable `value` that picks the matching
      // radio, so both cases are covered by the same assignment.
      if (element && "value" in element) {
        (element as { value: string }).value = value;
      }
    }
    // The restore writes the DOM directly, so the two values the Build Tuesday
    // nudge reads are brought back in step with what the form now shows.
    setPickedSession(sessionRef.current?.value || undefined);
    const restoredPurpose = form.elements.namedItem("purpose");
    setPickedPurpose(restoredPurpose && "value" in restoredPurpose ? (restoredPurpose as { value: string }).value || null : null);
    // Someone who opened the fold and answered something must not come back to
    // find it closed again over their own answers — that reads as the draft
    // having been lost, and re-opening to check costs more than the section
    // ever saved.
    if (EXTRA_FIELDS.some((name) => draft[name]) && extrasRef.current) {
      extrasRef.current.open = true;
    }
    // Restoring is otherwise silent: it is the visitor's own typing reappearing
    // where they left it, which needs no explanation. The editor is different —
    // there a draft can shadow something already saved.
  }, [returning]);

  const saveDraft = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const entries: Record<string, string> = {};

    // One value per name, so a checkbox group (availability, aiModels) keeps
    // only whichever box is last in the DOM — and the restore above cannot put
    // even that one back, because setting `.value` on a RadioNodeList only
    // picks a matching *radio*. Those two groups therefore do not survive a
    // draft. Known and left alone: it costs a couple of re-ticks on a path
    // almost nobody takes, and the submit path is unaffected.
    for (const [name, value] of new FormData(form).entries()) {
      if (DRAFT_SKIP.has(name) || typeof value !== "string") continue;
      entries[name] = value;
    }

    writeDraft(DRAFT_KEY, entries);
  }, []);

  // Typing into an uncontrolled input causes no re-render, so the save has to
  // hang off the form's own events rather than off the render cycle.
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleDraftSave = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(saveDraft, DRAFT_DEBOUNCE_MS);
  }, [saveDraft]);

  useEffect(() => () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
  }, []);

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
    // A server-known visitor has no contact details in this browser at all;
    // the route fills them in from the cookie, so there is nothing to check.
    const missingRequired = !fromServer || !returning
      ? !name || (copy.fields.emailRequired && !email) || (copy.fields.wechatRequired && !wechat)
      : false;

    if (missingRequired) {
      setStatus("error");
      setMessage(copy.errorRequired);
      // Put the cursor in the first empty required box: the message sits by the
      // button, and on a phone the fields are a screen or more above it.
      const firstEmpty = [
        !name && "name",
        copy.fields.emailRequired && !email && "email",
        copy.fields.wechatRequired && !wechat && "wechat",
      ].find(Boolean);
      const field = firstEmpty ? form.elements.namedItem(firstEmpty) : null;
      if (field instanceof HTMLInputElement) field.focus();
      return;
    }

    // Whichever language, one contact method has to be there.
    if (!(returning && fromServer) && !email && !wechat) {
      setStatus("error");
      setMessage(copy.errorNeedContact);
      return;
    }

    // Not for a returning visitor: their ID is already on record, and the
    // compact form gives them no field to correct it in anyway.
    if (!returning && wechat && !looksLikeWechatId(wechat) && wechatWarnedFor !== wechat) {
      setWechatWarnedFor(wechat);
      setStatus("error");
      setMessage(copy.errorWechatId);
      const wechatField = form.elements.namedItem("wechat");
      if (wechatField instanceof HTMLInputElement) wechatField.focus();
      return;
    }

    // The one required choice. Enforced here and not on the server: see the
    // PURPOSES note in the signup route. Not asked of someone who picked "no
    // morning works": the answer is stored against a session, and they have none.
    if (data.get("firstSession") !== "none" && !data.get("purpose")) {
      setStatus("error");
      setMessage(copy.errorPurpose);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      purposeRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      purposeRef.current?.querySelector("input")?.focus({ preventScroll: true });
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
          // getAll, not get: this is a checkbox group and `get` would silently
          // send only whichever box happens to be first in the DOM.
          availability: data.getAll("availability"),
          // Same reason as availability — a checkbox group, so getAll.
          aiModels: data.getAll("aiModels"),
          aiSpend: data.get("aiSpend"),
          purpose: data.get("purpose"),
          // Both optional. `get` returns null when unanswered (no radio
          // picked) and "" for the industry "skip" option; the route turns
          // either into "did not answer" (signup-profile.ts).
          aiLevel: data.get("aiLevel"),
          industry: data.get("industry"),
          // Boolean, not the browser's "on": the route only publishes on a
          // strict === true, so anything looser would silently never publish.
          publishCard: data.get("publishCard") !== null,
          source: data.get("source"),
          company: data.get("company"),
          // Identity from the remember cookie (WeChat login): the route reads
          // name and contact from the signup the cookie names, not from here.
          fromCookie: returning && fromServer,
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
      // Not for a server-known visitor: this browser never had their contact
      // details, and a saved profile without them could not sign up again.
      if (!(returning && fromServer)) try {
        window.localStorage.setItem(
          PROFILE_KEY,
          JSON.stringify({ name, email, wechat, building } satisfies SavedProfile),
        );
        // `storage` events do not fire in the tab that wrote, so the store has
        // to be told by hand.
        notifyProfile();
      } catch {
        // Storage disabled or full. Signing up still worked, which is the part
        // that matters; they will just fill the form again next time.
      }

      // The signup landed, so the half-filled copy of it is no longer anyone's
      // work in progress — leaving it would refill the form for the next person
      // on a shared device.
      clearDraft(DRAFT_KEY);

      const accepted = (await response.json().catch(() => null)) as {
        waitlisted?: boolean;
        upcoming?: { session: string; waitlisted: boolean }[];
        tuesday?: { session: string; left: number };
        remembered?: boolean;
      } | null;
      const sessionValue = String(data.get("firstSession") ?? "");
      const labelOf = (value: string) => sessions.find((option) => option.value === value)?.label ?? value;
      setReceipt({
        waitlisted: accepted?.waitlisted === true,
        name,
        email,
        wechat,
        session: sessions.find((option) => option.value === sessionValue) ? labelOf(sessionValue) : null,
        upcoming: Array.isArray(accepted?.upcoming)
          ? accepted.upcoming.map((entry) => ({ label: labelOf(entry.session), waitlisted: entry.waitlisted === true }))
          : null,
        tuesday:
          accepted?.tuesday && typeof accepted.tuesday.left === "number"
            ? { label: labelOf(accepted.tuesday.session), left: accepted.tuesday.left }
            : null,
        remembered: accepted?.remembered === true,
      });
      setInterest("idle");
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
        <h3 className="h3" ref={doneRef} tabIndex={-1}>
          {receipt?.waitlisted ? copy.waitlistTitle : copy.successTitle}
        </h3>
        {/* The pass: name, Thursday, booked or waitlisted, big enough to read in
            a screenshot. On 1 October many people could not tell whether they
            had signed up at all (James 2026-10-01); a screenshot settles it. */}
        {receipt?.session && (
          <div className="card stack-2" style={{ borderColor: "var(--accent)" }}>
            <strong className="h3" style={{ margin: 0 }}>{receipt.name}</strong>
            <span className="body-lg">
              {receipt.session} · {receipt.waitlisted ? copy.successTagWaitlist : copy.successTagBooked}
            </span>
            <span className="body-sm" style={{ color: "var(--fg3)" }}>{copy.successPassHint}</span>
          </div>
        )}
        {receipt?.waitlisted && <p>{copy.waitlistBody}</p>}
        {/* The overflow Build Tuesday exists to take: Thursday is full, the
            Tuesday is not. A link, not a booking — /my moves them in one tap. */}
        {receipt?.tuesday && (
          <p>
            {copy.tuesdayOverflow
              .replace("{date}", receipt.tuesday.label.split(" · ")[0])
              .replace("{n}", String(receipt.tuesday.left))}{" "}
            <a href={LANG_PARAM[lang] ? `/my?lang=${LANG_PARAM[lang]}` : "/my"}>{copy.tuesdayOverflowCta} →</a>
          </p>
        )}
        <p>
          {receipt?.session ? (
            <>
              {copy.successSession}
              <strong>{receipt.session}</strong>
            </>
          ) : (
            copy.successNoSession
          )}
        </p>
        {/* Everything they are down for now, not just this week: a second
            signup that added a Thursday used to be invisible, and read as
            "it signed me up twice" (2026-09-28). */}
        {receipt?.upcoming && receipt.upcoming.length > 1 && (
          <div className="stack-2">
            <p style={{ margin: 0 }}>{copy.successAll.replace("{n}", String(receipt.upcoming.length))}</p>
            <ul style={{ margin: 0 }}>
              {receipt.upcoming.map((entry) => (
                <li key={entry.label}>
                  <strong>{entry.label}</strong> · {entry.waitlisted ? copy.successTagWaitlist : copy.successTagBooked}
                </li>
              ))}
            </ul>
            <p className="field-hint">{copy.successMore}</p>
          </div>
        )}
        <p>{receipt?.email ? copy.successBody : copy.successBodyNoEmail}</p>
        <p>
          <a href={LANG_PARAM[lang] ? `/my?lang=${LANG_PARAM[lang]}` : "/my"}>{copy.successMy}</a>
        </p>

        {/* Repeated back verbatim, because claiming a card matches these as
            written and people were retyping them from memory and missing. */}
        {receipt && (
          <div className="stack-2">
            <p className="body-sm">{copy.successRecap}</p>
            <ul className="body-sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {[
                [copy.successRecapName, receipt.name],
                [copy.successRecapWechat, receipt.wechat],
                [copy.successRecapEmail, receipt.email],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <li key={label}>
                    {label}
                    {lang === "en" ? ": " : "："}
                    <strong>{value}</strong>
                  </li>
                ))}
            </ul>
            <p className="body-sm" style={{ opacity: 0.85 }}>{copy.successRecapHint}</p>
          </div>
        )}

        {/* One tap, optional: which other kind of morning they would come to.
            Only when this phone is remembered — the answer is saved against
            the signup through that cookie, never through a name typed here. */}
        {receipt?.remembered && (
          <div className="stack-2">
            <p className="body-sm" style={{ margin: 0 }}>{copy.interestTitle}</p>
            {interest === "done" ? (
              <p className="body-sm" style={{ margin: 0 }}>{copy.interestThanks}</p>
            ) : (
              <div className="choice-group choice-group--stack">
                {copy.interestOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={interest === "sending"}
                    onClick={async () => {
                      setInterest("sending");
                      try {
                        const result = await fetch("/api/signup/interest", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ interest: option.value }),
                        });
                        // A failure is not worth an error message on a
                        // confirmation screen: the signup itself went through.
                        setInterest(result.ok ? "done" : "idle");
                      } catch {
                        setInterest("idle");
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* The one moment where claiming a card is not a chore: the signup it
            needs was created seconds ago, and the details are still in mind. */}
        <p className="body-sm">{copy.successClaimBody}</p>
        <a className="btn btn--primary" href={lang === "en" ? "/claim?lang=en" : "/claim"}>
          {copy.successClaimCta}
        </a>

        {/* Text, not a button. The claim above is the one action worth pushing
            here — it feeds the member wall, which is the only thing on this
            site that accumulates. A second button would split the attention of
            the highest-intent screen there is, and win far less than it cost. */}
        <p className="body-sm" style={{ opacity: 0.85 }}>
          {copy.successSupportBody}
          <a href={lang === "en" ? "/support?lang=en" : "/support"}>{copy.successSupportCta}</a>
          {copy.successSupportTail}
        </p>
      </div>
    );
  }

  const sending = status === "sending";
  // The Tuesday to suggest: the first one offered that still has room.
  const tuesdayOption = sessions.find((session) => session.tuesday && !session.full);

  // The widget stays mounted after it succeeds. Unmounting it on success would
  // also throw away Turnstile's expiry callback, and tokens expire in a few
  // minutes — long enough for someone to still be writing the "what are you
  // working on" box. It is only removed once the grace period has passed with
  // no token, because a spinner that never resolves reads as a broken page.
  const showBotCheck = Boolean(turnstileSiteKey) && !botCheckGaveUp;

  // The email input, rendered in one of two places depending on whether this
  // language requires it (see the two call sites below).
  const emailField = (
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
  );

  return (
    <form
      className="stack-6"
      // POST even though script handles it: tapped before the script loads, a
      // method-less form becomes a GET and puts name, WeChat ID and email in
      // the address bar (2026-09-28 review).
      method="post"
      ref={formRef}
      onSubmit={handleSubmit}
      // Both events: `input` covers typing, `change` covers the radio group and
      // the session picker on the browsers that do not fire `input` for those.
      onInput={scheduleDraftSave}
      onChange={scheduleDraftSave}
      noValidate
    >
      {/* Honeypot. Hidden from sighted users and skipped by screen readers and
          keyboard tabbing, so only automated submissions ever fill it. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor={fieldId("company")}>Company</label>
        <input id={fieldId("company")} name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* The same message at the top, for sighted users whose focus has just
          jumped up to a field. Hidden from screen readers, which already get
          the role="alert" by the button. */}
      {message && (
        <p className="alert alert--error" aria-hidden="true">
          {message}
        </p>
      )}

      {returning ? (
        /* Known visitor: greeting plus the one thing that changes each week. */
        <div className="returning">
          <p className="returning__hello">{copy.returning.hello.replace("{name}", profile!.name)}</p>
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            {copy.returning.notYou}
          </button>
        </div>
      ) : (
        <div className="stack-2">
          {/* The way to skip typing: WeChat login (/login). Above the fields,
              where someone about to type their WeChat ID will see it. */}
          {wechatLogin && (
            <p className="body" style={{ margin: 0 }}>
              <a href={wechatLogin.href}>{wechatLogin.label}</a>
            </p>
          )}
          {/* Name and WeChat only. Email moved into the fold on 2026-09-28: it
              was always optional, and a claim matches on name plus WeChat ID. */}
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

            {/* ⚠️ Where email is required (the English form: WeChat is optional
                there), it must never sit in the fold — a required field nobody
                can see is a form nobody can send. Measured 2026-09-28: it did,
                and English signups failed with the fold shut. */}
            {copy.fields.emailRequired && emailField}
          </div>
          {/* field-hint, not privacy-note: that one pulls itself up under a pair of
              inputs and overlapped the single WeChat field by 8px (2026-09-28). */}
          <p className="field-hint">{copy.fields.contactPrivacy}</p>
        </div>
      )}

      {/* Which Thursday comes straight after who you are: it is the signup
          itself, and everything below it is about that morning. */}
      <div>
        <label className="label" htmlFor={fieldId("session")}>
          {copy.fields.session}
        </label>
        <select
          className="field"
          id={fieldId("session")}
          name="firstSession"
          ref={sessionRef}
          onChange={(event) => setPickedSession(event.target.value)}
          // The nearest Thursday, full or not. For one day (2026-09-28) this
          // skipped to the first session with room, and people who meant this
          // week were quietly signed up for next week instead — then signed up
          // again, and ended up down for both. A full date says so in its label
          // ("waitlist only" since 2026-10-01, when waitlisted people stopped
          // being told to come anyway), so the date they most likely meant is
          // still the right default — they can see it is full and pick another.
          defaultValue={defaultSession}
        >
          {sessions.map((session) => (
            <option key={session.value} value={session.value}>
              {session.label}
            </option>
          ))}
          {/* "none" is not a date, so the route's whitelist turns it into null
              and the row is stored with no sessions — already a valid state.
              Last, and never the default. */}
          <option value="none">{copy.fields.sessionNone}</option>
        </select>
        <p className="field-hint">{copy.fields.sessionNoneHint}</p>
      </div>

      {/* Answered by returning visitors too: it is about this morning, not about
          them. Full-width cards rather than pills — the labels are sentences, and
          on a phone a sentence-long pill wraps into something hard to tap. No
          default: a pre-selected option would count everyone who scrolled past. */}
      <fieldset ref={purposeRef} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">
          {copy.fields.purpose} <span className="required">*</span>
        </legend>
        <div className="choice-group choice-group--stack">
          {copy.fields.purposeOptions.map((option) => (
            <label className="choice" key={option.value}>
              <input type="radio" name="purpose" value={option.value} onChange={() => setPickedPurpose(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p className="field-hint">{copy.fields.purposeHint}</p>
        {/* Someone who builds things, signing up for a Thursday, while a Build
            Tuesday has room: suggest it, one tap to switch. A nudge, never a
            redirect — Thursday is still theirs if they want it. */}
        {tuesdayOption && pickedPurpose && BUILDER_PURPOSES.has(pickedPurpose) && pickedSession !== tuesdayOption.value && (
          <p className="field-hint" style={{ color: "var(--fg1)" }}>
            {copy.tuesdayHint}{" "}
            <button
              type="button"
              className="linkish"
              onClick={() => {
                if (sessionRef.current) sessionRef.current.value = tuesdayOption.value;
                setPickedSession(tuesdayOption.value);
              }}
            >
              {copy.tuesdayHintCta}
            </button>
          </p>
        )}
      </fieldset>

      {/* "How familiar with AI" and "which industry": who is in the room, so a
          morning can be planned around it. Out in the open rather than in the
          folded section — the folded AI questions are exactly the ones business
          owners left blank. Shown to returning visitors too, since nobody had
          been asked yet; a blank never overwrites an earlier answer.
          Both optional, never checked before submit, and no default: a
          pre-selected option would count everyone who scrolled past. */}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">{copy.fields.aiLevel}</legend>
        <div className="choice-group choice-group--compact">
          {copy.fields.aiLevelOptions.map((option) => (
            <label className="choice" key={option.value}>
              <input type="radio" name="aiLevel" value={option.value} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p className="field-hint">{copy.fields.aiLevelHint}</p>
      </fieldset>

      {/* A select, like the spend band: twelve options would be a wall of
          pills on a phone, and "skip" lets someone un-pick. */}
      <div>
        <label className="label" htmlFor={fieldId("industry")}>
          {copy.fields.industry}
        </label>
        <select className="field" id={fieldId("industry")} name="industry" defaultValue="">
          <option value="">{copy.fields.industrySkip}</option>
          {copy.fields.industryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="field-hint">{copy.fields.industryHint}</p>
      </div>

      {/* The one field that says what someone actually wants from the morning,
          and the one most often too vague to act on ("想了解了解"). The coach
          below asks one follow-up question; it never rewrites the sentence and
          never stands between anyone and the submit button. */}
      <div>
        <label className="label" htmlFor={fieldId("topic")}>
          {copy.fields.topic}
        </label>
        <textarea
          className="field"
          id={fieldId("topic")}
          name="topic"
          rows={2}
          ref={topicRef}
          placeholder={copy.fields.topicPlaceholder}
        />
        <p className="field-hint">{copy.fields.topicHint}</p>

        {coach && (
          <div className="stack-2" style={{ marginTop: "var(--space-3)" }}>
            <CoachRounds rounds={helper.rounds} verdict={helper.verdict} thinking={helper.thinking} copy={coach} />
            <div>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={helper.thinking}
                onClick={() => {
                  const text = topicRef.current?.value.trim() ?? "";
                  if (!text) {
                    topicRef.current?.focus();
                    return;
                  }
                  void helper.ask(text);
                }}
              >
                {helper.rounds.length > 0 ? coach.coachAgain : coach.coachCta}
              </button>
            </div>
            {/* The only third party anyone's writing reaches, and only on a press. */}
            <p className="field-hint">{coach.coachNote}</p>
          </div>
        )}
      </div>

      {/* Everything that is not needed to hold a seat, folded behind one line.
          Native <details>: opens without JavaScript, announces its own state,
          and fields inside a closed one still submit and still save to the draft.

          ⚠️ Every field lives inside `.disclosure__body`. Until 2026-09-28 four
          of them sat outside it and ran edge to edge with no inset. */}
      <details className="disclosure" ref={extrasRef}>
        <summary>{copy.fields.extras}</summary>

        <div className="disclosure__body stack-6">
          {/* New visitors only, as in the identity block this came from: a
              returning visitor has these on file, and signups merge by WeChat ID,
              so asking again could overwrite them. */}
          {!returning && (
            <>
              <div>
                <label className="label" htmlFor={fieldId("building")}>
                  {copy.fields.building}
                </label>
                <textarea
                  className="field"
                  id={fieldId("building")}
                  name="building"
                  rows={2}
                  placeholder={copy.fields.buildingPlaceholder}
                />
              </div>

              {/* Optional here, so folded; where email is required (English)
                  it stays with name above instead — see emailField. */}
              {!copy.fields.emailRequired && emailField}
            </>
          )}

          {/* Shown to returning visitors too — they are exactly the people who
              signed up before the wall existed. Unticked by default, forever:
              this is the only place anyone is told their answers can go public. */}
          <div>
            <label className="consent">
              <input type="checkbox" name="publishCard" />
              <span>{copy.fields.publishCard}</span>
            </label>
            <p className="field-hint">{copy.fields.publishCardHint}</p>
          </div>

          {/* Stored as yes / maybe / listen whatever the wording says —
              signup-stats.ts and /admin count on those values. */}
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label">{copy.fields.demoIntent}</legend>
            <div className="choice-group choice-group--compact">
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
            <p className="field-hint">{copy.fields.demoIntentHint}</p>
          </fieldset>

          {/* Asked of everyone, not only whoever picked "none": a Thursday
              regular who would also come on a Saturday counts towards whether a
              Saturday is worth running. */}
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label">{copy.fields.availability}</legend>
            <div className="choice-group choice-group--compact">
              {copy.fields.availabilityOptions.map((option) => (
                <label className="choice" key={option.value}>
                  <input type="checkbox" name="availability" value={option.value} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <p className="field-hint">{copy.fields.availabilityHint}</p>
          </fieldset>

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

          {/* One checkbox group in two labelled rows: overseas-vs-China is the
              split being measured, so showing it makes the question quick. */}
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label">{copy.fields.aiModels}</legend>
            <div className="stack-3">
              {copy.fields.aiModelGroups.map((group) => (
                <div key={group.label}>
                  <p className="choice-subhead">{group.label}</p>
                  <div className="choice-group choice-group--compact">
                    {group.options.map((option) => (
                      <label className="choice" key={option.value}>
                        <input type="checkbox" name="aiModels" value={option.value} />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="field-hint">{copy.fields.aiModelsHint}</p>
          </fieldset>

          {/* A select: one ordered scale with long labels, and it can be
              un-picked, which a radio cannot. */}
          <div>
            <label className="label" htmlFor={fieldId("aiSpend")}>
              {copy.fields.aiSpend}
            </label>
            <select className="field" id={fieldId("aiSpend")} name="aiSpend" defaultValue="">
              <option value="">{copy.fields.aiSpendSkip}</option>
              {copy.fields.aiSpendOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="field-hint">{copy.fields.aiSpendHint}</p>
          </div>
        </div>
      </details>

      {showBotCheck && (
        <Turnstile siteKey={turnstileSiteKey!} lang={lang} onToken={handleToken} />
      )}

      {message && (
        <p className="alert alert--error" role="alert">
          {message}
        </p>
      )}

      {/* A notice rather than a checkbox: being on camera is something people
          can change their mind about on the day, so the way out matters more
          than a signature. */}
      <p className="field-hint">{copy.cameraNotice}</p>

      {/* Never disabled by the bot check — only while a submission is in
          flight. A failed challenge must not be able to block a signup. */}
      <button className="btn btn--primary btn--block" type="submit" disabled={sending}>
        {sending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
