"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaggingRow } from "@/lib/db";
import {
  EMPTY_PROFILE,
  PERSON_LEVELS,
  PERSON_LEVEL_LABEL,
  PERSON_ROLES,
  PERSON_ROLE_LABEL,
  levelFromSelfReport,
  splitTags,
  type PersonLevel,
  type PersonProfile,
  type PersonRole,
} from "@/lib/person-profile";

type Option = { value: string; label: string };
type Suggestion = { value: string; count: number };
type Status = "idle" | "saving" | "saved" | "error";

type Props = {
  session: string;
  people: TaggingRow[];
  suggestions: { tags: Suggestion[]; resources: Suggestion[] };
  labels: {
    industry: Option[];
    purpose: Option[];
    aiLevel: Option[];
    bizFocus: Option[];
  };
};

type Card = {
  row: TaggingRow;
  profile: PersonProfile;
  sessionNote: string;
  tagged: boolean;
  checkedIn: boolean;
  status: Status;
};

/** Before the first tag: start from what the person said on the signup form. */
function startingProfile(row: TaggingRow): PersonProfile {
  if (row.profile) return row.profile;
  return {
    ...EMPTY_PROFILE,
    level: levelFromSelfReport(row.ai_level),
    industry: row.industry,
  };
}

const labelOf = (options: Option[], value: string | null) => options.find((option) => option.value === value)?.label ?? value;

/**
 * The tagging board (2026-10-13): one card per person, every tap saved.
 *
 * Built for speed after a morning: untagged cards are open, tagged ones fold
 * to a one-line summary, and "done, next" closes this card and opens the next
 * one still to do. Saves the whole card each time (never a diff), so two
 * saves landing out of order still leave one consistent record.
 */
export function TagBoard({ session, people, suggestions, labels }: Props) {
  const [cards, setCards] = useState<Card[]>(() =>
    people.map((row) => ({
      row,
      profile: startingProfile(row),
      sessionNote: row.session_note ?? "",
      tagged: row.profile !== null,
      checkedIn: row.checked_in,
      status: "idle",
    })),
  );
  // Only the first person still to do starts open: one card at a time, and
  // "done, next" walks down the list. Everyone else is a one-line row.
  const [open, setOpen] = useState<Set<string>>(() => {
    const first = people.find((row) => row.checked_in && !row.profile);
    return new Set(first ? [first.id] : []);
  });
  const [onlyTodo, setOnlyTodo] = useState(false);

  // Tags added on this page join the suggestions straight away.
  const [tagPool, setTagPool] = useState(suggestions);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef(cards);
  useEffect(() => {
    latest.current = cards;
  }, [cards]);

  const patch = useCallback((id: string, change: Partial<Card>) => {
    setCards((all) => all.map((card) => (card.row.id === id ? { ...card, ...change } : card)));
  }, []);

  const save = useCallback(
    async (id: string) => {
      const card = latest.current.find((item) => item.row.id === id);
      if (!card) return;
      patch(id, { status: "saving" });
      try {
        const response = await fetch("/api/admin/profile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "save", signupId: id, session, profile: card.profile, sessionNote: card.sessionNote }),
        });
        if (!response.ok) throw new Error(String(response.status));
        patch(id, { status: "saved", tagged: true });
      } catch {
        patch(id, { status: "error" });
      }
    },
    [patch, session],
  );

  /** Saves shortly after the last change, so typing a note is one request, not twenty. */
  const scheduleSave = useCallback(
    (id: string, delay = 500) => {
      const pending = timers.current.get(id);
      if (pending) clearTimeout(pending);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          void save(id);
        }, delay),
      );
    },
    [save],
  );

  const flush = useCallback(
    async (id: string) => {
      const pending = timers.current.get(id);
      if (pending) clearTimeout(pending);
      timers.current.delete(id);
      await save(id);
    },
    [save],
  );

  /** A change, or a function of the latest profile — so two quick taps never undo each other. */
  type Change = Partial<PersonProfile> | ((profile: PersonProfile) => Partial<PersonProfile>);

  const edit = (id: string, change: Change, delay?: number) => {
    setCards((all) =>
      all.map((card) =>
        card.row.id === id
          ? { ...card, profile: { ...card.profile, ...(typeof change === "function" ? change(card.profile) : change) }, status: "idle" }
          : card,
      ),
    );
    scheduleSave(id, delay);
  };

  const learnTags = (kind: "tags" | "resources", added: string[]) => {
    setTagPool((pool) => {
      const known = new Set(pool[kind].map((item) => item.value.toLowerCase()));
      const fresh = added.filter((tag) => !known.has(tag.toLowerCase())).map((value) => ({ value, count: 1 }));
      return fresh.length ? { ...pool, [kind]: [...pool[kind], ...fresh] } : pool;
    });
  };

  const arrived = cards.filter((card) => card.checkedIn);
  const absent = cards.filter((card) => !card.checkedIn);
  const done = arrived.filter((card) => card.tagged).length;

  /** Folds this card and opens the next arrived one still to do. */
  const doneAndNext = async (id: string) => {
    await flush(id);
    const order = arrived.map((card) => card.row.id);
    const next = order.slice(order.indexOf(id) + 1).concat(order.slice(0, order.indexOf(id)))
      .find((other) => !latest.current.find((card) => card.row.id === other)?.tagged);
    setOpen((current) => {
      const updated = new Set(current);
      updated.delete(id);
      if (next) updated.add(next);
      return updated;
    });
    if (next) {
      requestAnimationFrame(() => document.getElementById(`p-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const markArrival = async (id: string, here: boolean) => {
    patch(id, { checkedIn: here, status: "saving" });
    try {
      const response = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: here ? "arrived" : "absent", signupId: id, session }),
      });
      if (!response.ok) throw new Error(String(response.status));
      patch(id, { status: "idle" });
      if (here) setOpen((current) => new Set(current).add(id));
    } catch {
      patch(id, { checkedIn: !here, status: "error" });
    }
  };

  const toggle = (id: string) =>
    setOpen((current) => {
      const updated = new Set(current);
      if (updated.has(id)) updated.delete(id);
      else updated.add(id);
      return updated;
    });

  const shown = onlyTodo ? arrived.filter((card) => !card.tagged) : arrived;

  return (
    <div className="stack-6">
      <div className="tagger-progress" role="status">
        <div className="tagger-progress__row">
          <strong>
            已标 {done} / {arrived.length}
          </strong>
          <span>{arrived.length - done > 0 ? `还剩 ${arrived.length - done} 人` : arrived.length ? "这一场标完了 🎉" : "这一场还没有人签到"}</span>
          <label className="tagger-progress__filter">
            <input type="checkbox" checked={onlyTodo} onChange={(event) => setOnlyTodo(event.target.checked)} />
            只看没标的
          </label>
        </div>
        <div className="tagger-progress__bar" aria-hidden="true">
          <span style={{ width: `${arrived.length ? (done / arrived.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="stack-3">
        {shown.map((card) =>
          open.has(card.row.id) ? (
            <PersonCard
              key={card.row.id}
              card={card}
              labels={labels}
              pool={tagPool}
              onEdit={(change, delay) => edit(card.row.id, change, delay)}
              onSessionNote={(note) => {
                patch(card.row.id, { sessionNote: note, status: "idle" });
                scheduleSave(card.row.id, 800);
              }}
              onLearn={learnTags}
              onDone={() => doneAndNext(card.row.id)}
              onFold={() => toggle(card.row.id)}
              onRetry={() => flush(card.row.id)}
              onAbsent={() => markArrival(card.row.id, false)}
            />
          ) : (
            <FoldedCard key={card.row.id} card={card} labels={labels} onOpen={() => toggle(card.row.id)} />
          ),
        )}
      </div>

      {absent.length > 0 && (
        <details className="tagger-absent">
          <summary>
            报了名但没签到 {absent.length} 人 <span className="hint">来了的点「到了」，就会移到上面</span>
          </summary>
          <ul className="tagger-absent__list">
            {absent.map((card) => (
              <li key={card.row.id}>
                <span>
                  <strong>{card.row.name}</strong>
                  {card.row.building && <span className="tagger-muted"> · {card.row.building.slice(0, 40)}</span>}
                </span>
                <button type="button" className="btn btn--secondary tagger-small-btn" onClick={() => markArrival(card.row.id, true)}>
                  到了
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function SaveState({ status, onRetry }: { status: Status; onRetry: () => void }) {
  if (status === "saving") return <span className="tagger-save">保存中…</span>;
  if (status === "saved") return <span className="tagger-save tagger-save--ok">✓ 已存</span>;
  if (status === "error")
    return (
      <button type="button" className="tagger-save tagger-save--error" onClick={onRetry}>
        没存上，点这里重试
      </button>
    );
  return null;
}

function FoldedCard({ card, labels, onOpen }: { card: Card; labels: Props["labels"]; onOpen: () => void }) {
  const { profile } = card;
  return (
    <button type="button" id={`p-${card.row.id}`} className="tagger-folded" onClick={onOpen}>
      <span className="tagger-folded__name">
        {card.tagged ? "✓ " : ""}
        {card.row.name}
      </span>
      <span className="tagger-folded__summary">
        {card.tagged
          ? [
              ...profile.roles.map((role) => PERSON_ROLE_LABEL[role]),
              profile.level ? `L${profile.level}` : null,
              profile.industry ? labelOf(labels.industry, profile.industry) : null,
              ...profile.tags,
            ]
              .filter(Boolean)
              .join(" · ") || "已标，未选任何项"
          : "还没标"}
      </span>
      <span className="tagger-folded__edit">{card.tagged ? "改" : "标"}</span>
    </button>
  );
}

function PersonCard({
  card,
  labels,
  pool,
  onEdit,
  onSessionNote,
  onLearn,
  onDone,
  onFold,
  onRetry,
  onAbsent,
}: {
  card: Card;
  labels: Props["labels"];
  pool: { tags: Suggestion[]; resources: Suggestion[] };
  onEdit: (change: Partial<PersonProfile> | ((profile: PersonProfile) => Partial<PersonProfile>), delay?: number) => void;
  onSessionNote: (note: string) => void;
  onLearn: (kind: "tags" | "resources", added: string[]) => void;
  onDone: () => void;
  onFold: () => void;
  onRetry: () => void;
  onAbsent: () => void;
}) {
  const { row, profile } = card;
  const said = [
    row.building && { label: "在做", value: row.building },
    row.topic && { label: "想聊", value: row.topic },
    row.purpose && { label: "来干嘛", value: labelOf(labels.purpose, row.purpose) },
    row.ai_level && { label: "自评", value: labelOf(labels.aiLevel, row.ai_level) },
    row.industry && { label: "行业", value: labelOf(labels.industry, row.industry) },
    row.biz_focus.length > 0 && { label: "想让 AI 帮", value: row.biz_focus.map((value) => labelOf(labels.bizFocus, value)).join("、") },
  ].filter(Boolean) as { label: string; value: string | null }[];

  const toggleRole = (role: PersonRole) =>
    onEdit((latest) => ({
      roles: latest.roles.includes(role) ? latest.roles.filter((item) => item !== role) : [...latest.roles, role],
    }));

  return (
    <article id={`p-${row.id}`} className="tagger-card">
      <header className="tagger-card__head">
        <div>
          <h2 className="tagger-card__name">{row.name}</h2>
          <div className="tagger-card__meta">
            {row.wechat && <span className="mono">{row.wechat}</span>}
            <span className={row.attended <= 1 ? "tagger-badge tagger-badge--new" : "tagger-badge"}>
              {row.attended <= 1 ? "第一次来" : `来过 ${row.attended} 次`}
            </span>
            {row.demo_intent === "yes" && <span className="tagger-badge">想演示</span>}
          </div>
        </div>
        <div className="tagger-card__actions">
          <SaveState status={card.status} onRetry={onRetry} />
          <button type="button" className="tagger-link" onClick={onFold}>
            收起
          </button>
        </div>
      </header>

      {said.length > 0 && (
        <dl className="tagger-said">
          {said.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <Field label="角色" hint="可多选">
        <div className="tagger-pills">
          {PERSON_ROLES.map((role) => (
            <Pill key={role} on={profile.roles.includes(role)} onClick={() => toggleRole(role)}>
              {PERSON_ROLE_LABEL[role]}
            </Pill>
          ))}
        </div>
      </Field>

      <Field label="水平" hint="再点一下取消">
        <div className="tagger-pills">
          {PERSON_LEVELS.map((level: PersonLevel) => (
            <Pill key={level} on={profile.level === level} onClick={() => onEdit({ level: profile.level === level ? null : level })}>
              {level} {PERSON_LEVEL_LABEL[level]}
            </Pill>
          ))}
        </div>
      </Field>

      <Field label="行业">
        <div className="tagger-pills">
          {labels.industry.map((option) => (
            <Pill
              key={option.value}
              on={profile.industry === option.value}
              onClick={() => onEdit({ industry: profile.industry === option.value ? null : option.value })}
            >
              {option.label}
            </Pill>
          ))}
        </div>
      </Field>

      <Field label="专业 / 能力" hint="回车或逗号添加">
        <TagInput
          value={profile.tags}
          pool={pool.tags}
          placeholder="如：iOS、会计、投放"
          onChange={(tags, added) => {
            onEdit({ tags });
            if (added.length) onLearn("tags", added);
          }}
        />
      </Field>

      <Field label="资源" hint="能带来什么">
        <TagInput
          value={profile.resources}
          pool={pool.resources}
          placeholder="如：有客户渠道、有资金、有场地"
          onChange={(resources, added) => {
            onEdit({ resources });
            if (added.length) onLearn("resources", added);
          }}
        />
      </Field>

      <Field label="这一场" hint="一句话，比如：演示了什么、想找什么">
        <input
          className="field"
          value={card.sessionNote}
          maxLength={300}
          placeholder="演示了 …… / 想找技术合伙人"
          onChange={(event) => onSessionNote(event.target.value)}
        />
      </Field>

      <Field label="长期印象" hint="跨场次的，可不填">
        <textarea
          className="field tagger-note"
          value={profile.note ?? ""}
          maxLength={2000}
          rows={2}
          onChange={(event) => onEdit({ note: event.target.value }, 800)}
        />
      </Field>

      <footer className="tagger-card__foot">
        <button type="button" className="tagger-link" onClick={onAbsent}>
          其实没来
        </button>
        <button type="button" className="btn btn--primary" onClick={onDone}>
          标完，下一个 →
        </button>
      </footer>
    </article>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="tagger-field">
      <div className="tagger-field__label">
        {label}
        {hint && <span className="tagger-muted"> · {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={on ? "tagger-pill tagger-pill--on" : "tagger-pill"} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Free tags with suggestions. Suggestions are the tags already used on other
 * people, most used first, narrowed as you type — the cheapest guard against
 * "投放" and "广告投放" becoming two tags.
 */
function TagInput({
  value,
  pool,
  placeholder,
  onChange,
}: {
  value: string[];
  pool: Suggestion[];
  placeholder: string;
  onChange: (next: string[], added: string[]) => void;
}) {
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const known = new Set(value.map((tag) => tag.toLowerCase()));
    const added = splitTags(raw).filter((tag) => {
      const key = tag.toLowerCase();
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    setText("");
    if (added.length) onChange([...value, ...added], added);
  };

  const matches = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const have = new Set(value.map((tag) => tag.toLowerCase()));
    return pool
      .filter((item) => !have.has(item.value.toLowerCase()) && (!needle || item.value.toLowerCase().includes(needle)))
      .slice(0, 8);
  }, [pool, text, value]);

  return (
    <div className="stack-2">
      <div className="tagger-tags">
        {value.map((tag) => (
          <span key={tag} className="tagger-tag">
            {tag}
            <button
              type="button"
              aria-label={`去掉 ${tag}`}
              onClick={() => onChange(value.filter((item) => item !== tag), [])}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tagger-tags__input"
          value={text}
          placeholder={value.length ? "" : placeholder}
          onChange={(event) => {
            // A typed comma adds what came before it.
            if (/[,，、;；]$/.test(event.target.value)) add(event.target.value);
            else setText(event.target.value);
          }}
          onKeyDown={(event) => {
            // Not while a Chinese IME is still composing: that Enter picks a character.
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              if (text.trim()) add(text);
            } else if (event.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1), []);
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
      {matches.length > 0 && (
        <div className="tagger-suggest">
          {matches.map((item) => (
            <button key={item.value} type="button" className="tagger-suggest__item" onClick={() => add(item.value)}>
              + {item.value}
              <span className="tagger-muted"> {item.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
