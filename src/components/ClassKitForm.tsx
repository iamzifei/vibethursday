"use client";

import { useEffect, useState } from "react";
import { cardText, KIT_FIELDS, packMarkdown, profileMarkdown, type KitKind, type KitValues } from "@/lib/class-kit";

/** Today in Sydney as YYYY-MM-DD, for the date line at the top of a file. */
function sydneyDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

/** What each form turns into. The spec has no output of its own: it is handed in as typed. */
function output(kind: KitKind, values: KitValues): string {
  if (kind === "profile") return profileMarkdown(values, sydneyDate());
  if (kind === "pack") return packMarkdown(values, sydneyDate());
  if (kind === "card") return cardText(values);
  return "";
}

const FILE_NAMES: Partial<Record<KitKind, string>> = {
  profile: "业务档案.md",
  pack: "行业知识包.md",
};

const SUBMIT_ERRORS: Record<string, string> = {
  invalid: "带 * 的格子还没填。",
  rate: "这个网络上交得太多了，过一会儿再试；急的话举手找助教。",
  large: "内容太长了，删掉一些再交。",
};

/**
 * One workbook form (class-kit.ts).
 *
 * Saves to this browser as you type, so a reload or a closed tab keeps
 * everything. The profile and the pack are turned into a Markdown file to
 * download or copy and are never sent anywhere; the card and the spec can be
 * handed in with the button at the bottom.
 *
 * Copy is offered next to every download because the browser inside WeChat
 * cannot save files: on a phone, copying and pasting into the platform's
 * "new note" is the way through.
 */
export function ClassKitForm({ kind, submit }: { kind: KitKind; submit?: boolean }) {
  const fields = KIT_FIELDS[kind];
  const storageKey = `class-kit:${kind}`;
  const [values, setValues] = useState<KitValues>({});
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [inWeChat, setInWeChat] = useState(false);
  const [copyHint, setCopyHint] = useState(false);
  const [touch, setTouch] = useState(false);

  // Read back what this browser saved. In an effect, not in the initial
  // state, so the server render and the first client render agree.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time setup from the browser after mount */
    setMounted(true);
    // WeChat's in-app browser cannot save files, so there the copy button leads.
    setInWeChat(/MicroMessenger/i.test(navigator.userAgent));
    // On a phone the file would land in the phone's downloads, nowhere near the
    // laptop the platform is open on: copy leads there, download is second.
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        const restored: KitValues = {};
        for (const [key, value] of Object.entries(saved)) if (typeof value === "string") restored[key] = value;
        setValues(restored);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Private mode or blocked storage: the form still works, it just forgets.
    }
  }, [storageKey]);

  const update = (name: string, value: string) => {
    const next = { ...values, [name]: value };
    setValues(next);
    setCopied(false);
    if (state === "sent" || state === "error") setState("idle");
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // See above.
    }
  };

  // Nothing to show until something is typed, and only after mount: the file
  // carries today's date, which the prerendered HTML would otherwise fix at build time.
  const hasInput = Object.values(values).some((value) => value.trim());
  const text = mounted && hasInput ? output(kind, values) : "";
  const fileName = inWeChat ? undefined : FILE_NAMES[kind];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyHint(false);
    } catch {
      // Older in-app browsers: select the preview so a long-press copies it.
      const preview = document.getElementById(`kit-preview-${kind}`) as HTMLTextAreaElement | null;
      preview?.focus();
      preview?.select();
      preview?.setSelectionRange(0, text.length);
      setCopyHint(true);
    }
  };

  const download = () => {
    if (!fileName) return;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadButton = (variant: string) => (
    <button className={`btn ${variant} btn--block`} type="button" onClick={download}>
      下载 {fileName}（电脑上用：下载后拖进平台）
    </button>
  );

  const send = async () => {
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/class-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, values }),
      });
      if (response.ok) {
        setState("sent");
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(SUBMIT_ERRORS[body?.error ?? ""] ?? "没交上，请再试一次；还不行就举手找助教。");
      setState("error");
    } catch {
      setError("网络断了，请再试一次。");
      setState("error");
    }
  };

  return (
    <div className="stack-8">
      {fields.map((field) => {
        const id = `kit-${kind}-${field.name}`;
        const value = values[field.name] ?? "";
        return field.type === "choice" ? (
          <fieldset className="stack-3" key={field.name}>
            <legend className="label">{field.label}</legend>
            <div className="choice-group choice-group--compact">
              {(field.options ?? []).map((option) => (
                <label className="choice" key={option}>
                  <input type="radio" name={id} value={option} checked={value === option} onChange={() => update(field.name, option)} />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div key={field.name}>
            <label className="label" htmlFor={id}>
              {field.label}
              {field.required ? " *" : ""}
            </label>
            {field.type === "line" ? (
              <input
                className="field"
                id={id}
                value={value}
                maxLength={field.max}
                placeholder={field.placeholder}
                autoComplete="off"
                onChange={(event) => update(field.name, event.target.value)}
              />
            ) : (
              <textarea
                className="field"
                id={id}
                value={value}
                rows={field.type === "long" ? 12 : 3}
                maxLength={field.max}
                placeholder={field.placeholder}
                onChange={(event) => update(field.name, event.target.value)}
              />
            )}
            {field.hint && <p className="field-hint">{field.hint}</p>}
          </div>
        );
      })}

      <p className="field-hint">填的内容自动存在这台设备的浏览器里，刷新、关掉再打开都还在。</p>

      {text && (
        <div className="stack-3">
          <label className="label" htmlFor={`kit-preview-${kind}`}>
            {fileName ? `生成的文件：${fileName}` : "整理好的文字"}
          </label>
          <textarea className="field mono" id={`kit-preview-${kind}`} value={text} readOnly rows={Math.min(16, text.split("\n").length + 1)} />
          <div className="stack-3">
            {fileName && !touch && downloadButton("btn--primary")}
            <button className={`btn ${(fileName && !touch) || submit ? "btn--secondary" : "btn--primary"} btn--block`} type="button" onClick={copy}>
              {copied ? "已复制 ✓" : FILE_NAMES[kind] ? "复制全文，粘贴到平台的「新建笔记」" : "复制这几行"}
            </button>
            {fileName && touch && downloadButton("btn--secondary")}
            {copyHint && <p className="field-hint">没能自动复制：上面的文字已经选中，长按它选「复制」。</p>}
            {inWeChat && FILE_NAMES[kind] && <p className="field-hint">微信里下载不了文件。要文件的话，点右上角「…」用浏览器打开，或者在电脑上打开这一页。</p>}
          </div>
        </div>
      )}

      {submit && (
        <div className="stack-3">
          {state === "error" && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}
          {state === "sent" ? (
            <p className="alert alert--success" role="status">
              交上了，谢谢。改了以后可以再交一次。
            </p>
          ) : (
            <button className="btn btn--primary btn--block" type="button" onClick={send} disabled={state === "sending"}>
              {state === "sending" ? "正在交……" : kind === "spec" ? "交给 James" : "交给 James（现场会挑几张念）"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
