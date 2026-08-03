"use client";

import { useId, useState } from "react";
import type { Copy, Lang } from "@/lib/content";

type SessionOption = { value: string; label: string };

type Props = {
  lang: Lang;
  copy: Copy["signup"];
  sessions: SessionOption[];
};

type Status = "idle" | "sending" | "done" | "error";

export function SignupForm({ lang, copy, sessions }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // useId keeps label/input wiring unique and stable across server and client
  // renders, which is what makes tapping a label focus the right field.
  const uid = useId();
  const fieldId = (field: string) => `${uid}-${field}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();

    if (!name || !email) {
      setStatus("error");
      setMessage(copy.errorRequired);
      return;
    }

    setStatus("sending");
    setMessage(null);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          wechat: data.get("wechat"),
          building: data.get("building"),
          demoIntent: data.get("demoIntent"),
          firstSession: data.get("firstSession"),
          source: data.get("source"),
          company: data.get("company"),
          lang,
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setMessage(result?.error === "invalid_email" ? copy.errorEmail : copy.errorGeneric);
        return;
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
      <div className="card card--accent stack-3" role="status">
        <h3 className="h3">{copy.successTitle}</h3>
        <p>{copy.successBody}</p>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form className="stack-6" onSubmit={handleSubmit} noValidate>
      {/* Honeypot. Hidden from sighted users and skipped by screen readers and
          keyboard tabbing, so only automated submissions ever fill it. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor={fieldId("company")}>Company</label>
        <input id={fieldId("company")} name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

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
            {copy.fields.email} <span className="required">*</span>
          </label>
          <input
            className="field"
            id={fieldId("email")}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder={copy.fields.emailPlaceholder}
          />
          <p className="hint">{copy.fields.emailHint}</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={fieldId("wechat")}>
          {copy.fields.wechat}
        </label>
        <input
          className="field"
          id={fieldId("wechat")}
          name="wechat"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={copy.fields.wechatPlaceholder}
        />
        <p className="hint">{copy.fields.wechatHint}</p>
      </div>

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
