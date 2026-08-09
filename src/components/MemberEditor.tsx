"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { Copy } from "@/lib/content";
import type { Member } from "@/lib/db";
import {
  ASSET_KINDS,
  LIMITS,
  PLATFORMS,
  PRODUCT_STAGES,
  ROLES,
  type AssetKind,
  type Platform,
  type ProductStage,
  type Role,
} from "@/lib/members";

type Props = {
  member: Member;
  copy: Copy["editor"];
  /** Shared label dictionaries, so the editor and the wall never disagree. */
  labels: Copy["members"];
  lang: "zh" | "en";
};

/** An asset while it is being edited — every field is a string the form owns. */
type DraftAsset = {
  kind: AssetKind;
  title: string;
  tagline: string;
  url: string;
  stage: ProductStage | "";
  platform: Platform | "";
};

function toDraft(member: Member): DraftAsset[] {
  return member.assets.map((asset) => ({
    kind: asset.kind,
    title: asset.title,
    tagline: asset.tagline ?? "",
    url: asset.url ?? "",
    stage: asset.stage ?? "",
    platform: asset.platform ?? "",
  }));
}

export function MemberEditor({ member, copy, labels, lang }: Props) {
  const router = useRouter();
  const uid = useId();

  const [displayName, setDisplayName] = useState(member.display_name);
  const [slug, setSlug] = useState(member.slug);
  const [headline, setHeadline] = useState(member.headline ?? "");
  const [bio, setBio] = useState(member.bio ?? "");
  const [roles, setRoles] = useState<Role[]>(member.roles);
  const [lookingFor, setLookingFor] = useState(member.looking_for ?? "");
  const [canHelp, setCanHelp] = useState(member.can_help ?? "");
  const [tags, setTags] = useState(member.tags.join(", "));
  const [hidden, setHidden] = useState(member.hidden);
  const [assets, setAssets] = useState<DraftAsset[]>(toDraft(member));

  const [published, setPublished] = useState(member.published);
  const [savedSlug, setSavedSlug] = useState(member.slug);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const field = (name: string) => `${uid}-${name}`;

  function toggleRole(role: Role) {
    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  }

  function updateAsset(index: number, patch: Partial<DraftAsset>) {
    setAssets((current) => current.map((asset, i) => (i === index ? { ...asset, ...patch } : asset)));
  }

  async function save(publish: boolean) {
    if (!displayName.trim()) {
      setStatus("error");
      setMessage(copy.errorName);
      return;
    }

    setStatus("saving");
    setMessage(null);

    try {
      const response = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          slug,
          headline,
          bio,
          roles,
          lookingFor,
          canHelp,
          // Split here rather than server-side so what you typed and what you
          // get back are obviously the same list.
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          hidden,
          publish,
          assets: assets.map((asset) => ({
            ...asset,
            stage: asset.stage || null,
            platform: asset.platform || null,
          })),
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setMessage(
          result?.error === "slug_taken"
            ? copy.errorSlug
            : result?.error === "missing_name"
              ? copy.errorName
              : copy.errorGeneric,
        );
        return;
      }

      const result = (await response.json()) as { slug: string; published: boolean };

      // The server may have replaced an unusable handle with the generated one,
      // so the box shows what was actually stored rather than what was typed.
      setSlug(result.slug);
      setSavedSlug(result.slug);
      setPublished(result.published);
      setStatus("saved");
      setMessage(copy.saved);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage(copy.errorGeneric);
    }
  }

  async function signOut() {
    await fetch("/api/me", { method: "DELETE" });
    router.refresh();
    router.push(lang === "en" ? "/members?lang=en" : "/members");
  }

  const saving = status === "saving";
  const cardHref = `/members/${savedSlug}${lang === "en" ? "?lang=en" : ""}`;

  return (
    <div className="stack-8">
      <div className={`alert${published ? " alert--success" : ""}`}>
        {published ? copy.liveNote : copy.draftNote}
        {published && (
          <>
            {" "}
            <a href={cardHref}>{copy.viewCard} ↗</a>
          </>
        )}
      </div>

      {/* Reachable before publishing too: the badge is worth something on the
          day even if the card is still a draft, and it is the reason most
          people will bother finishing the card at all. */}
      <a className="btn btn--secondary" href={lang === "en" ? "/badge?lang=en" : "/badge"}>
        {copy.badgeCta}
      </a>

      {/* ── Identity ─────────────────────────────────────────────── */}
      <div className="grid-auto">
        <div>
          <label className="label" htmlFor={field("name")}>
            {copy.displayName} <span className="required">*</span>
          </label>
          <input
            className="field"
            id={field("name")}
            value={displayName}
            maxLength={LIMITS.displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor={field("slug")}>
            {copy.handle}
          </label>
          <div className="prefixed">
            <span className="prefixed__prefix mono">{copy.handlePrefix}</span>
            <input
              className="field"
              id={field("slug")}
              value={slug}
              maxLength={LIMITS.slug}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          <p className="hint">{copy.handleHint}</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={field("headline")}>
          {copy.headline}
        </label>
        <input
          className="field"
          id={field("headline")}
          value={headline}
          maxLength={LIMITS.headline}
          placeholder={copy.headlinePlaceholder}
          onChange={(event) => setHeadline(event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor={field("bio")}>
          {copy.bio}
        </label>
        <textarea
          className="field"
          id={field("bio")}
          rows={4}
          value={bio}
          maxLength={LIMITS.bio}
          placeholder={copy.bioPlaceholder}
          onChange={(event) => setBio(event.target.value)}
        />
      </div>

      {/* ── Roles ────────────────────────────────────────────────── */}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">{copy.roles}</legend>
        <div className="choice-group">
          {ROLES.map((role) => (
            <label className="choice" key={role}>
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              <span>{labels.roles[role]}</span>
            </label>
          ))}
        </div>
        <p className="hint">{copy.rolesHint}</p>
      </fieldset>

      {/* ── The two lines that actually match people ─────────────── */}
      <div className="grid-auto">
        <div>
          <label className="label" htmlFor={field("looking")}>
            {copy.lookingFor}
          </label>
          <textarea
            className="field"
            id={field("looking")}
            rows={2}
            value={lookingFor}
            maxLength={LIMITS.lookingFor}
            placeholder={copy.lookingForPlaceholder}
            onChange={(event) => setLookingFor(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor={field("help")}>
            {copy.canHelp}
          </label>
          <textarea
            className="field"
            id={field("help")}
            rows={2}
            value={canHelp}
            maxLength={LIMITS.canHelp}
            placeholder={copy.canHelpPlaceholder}
            onChange={(event) => setCanHelp(event.target.value)}
          />
        </div>
      </div>

      <p className="privacy-note">{copy.matchHint}</p>

      <div>
        <label className="label" htmlFor={field("tags")}>
          {copy.tags}
        </label>
        <input
          className="field"
          id={field("tags")}
          value={tags}
          placeholder={copy.tagsPlaceholder}
          onChange={(event) => setTags(event.target.value)}
        />
        <p className="hint">{copy.tagsHint}</p>
      </div>

      {/* ── Assets ───────────────────────────────────────────────── */}
      <div className="stack-4">
        <div className="stack-2">
          <span className="label" style={{ marginBottom: 0 }}>
            {copy.assets}
          </span>
          <p className="hint" style={{ marginTop: 0 }}>
            {copy.assetsHint}
          </p>
        </div>

        {assets.map((asset, index) => (
          <div className="card stack-4" key={index}>
            <div className="grid-auto">
              <div>
                <label className="label" htmlFor={field(`kind-${index}`)}>
                  {copy.assetKind}
                </label>
                <select
                  className="field"
                  id={field(`kind-${index}`)}
                  value={asset.kind}
                  onChange={(event) =>
                    updateAsset(index, {
                      kind: event.target.value as AssetKind,
                      // The extra fields belong to specific kinds; switching
                      // kind clears whichever no longer applies.
                      stage: "",
                      platform: "",
                    })
                  }
                >
                  {ASSET_KINDS.map((kind) => (
                    <option value={kind} key={kind}>
                      {labels.kinds[kind]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={field(`title-${index}`)}>
                  {copy.assetTitle}
                </label>
                <input
                  className="field"
                  id={field(`title-${index}`)}
                  value={asset.title}
                  maxLength={LIMITS.assetTitle}
                  placeholder={copy.assetTitlePlaceholder}
                  onChange={(event) => updateAsset(index, { title: event.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor={field(`tagline-${index}`)}>
                {copy.assetTagline}
              </label>
              <input
                className="field"
                id={field(`tagline-${index}`)}
                value={asset.tagline}
                maxLength={LIMITS.assetTagline}
                placeholder={copy.assetTaglinePlaceholder}
                onChange={(event) => updateAsset(index, { tagline: event.target.value })}
              />
            </div>

            <div className="grid-auto">
              <div>
                <label className="label" htmlFor={field(`url-${index}`)}>
                  {copy.assetUrl}
                </label>
                <input
                  className="field"
                  id={field(`url-${index}`)}
                  value={asset.url}
                  maxLength={LIMITS.url}
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={copy.assetUrlPlaceholder}
                  onChange={(event) => updateAsset(index, { url: event.target.value })}
                />
              </div>

              {asset.kind === "product" && (
                <div>
                  <label className="label" htmlFor={field(`stage-${index}`)}>
                    {copy.assetStage}
                  </label>
                  <select
                    className="field"
                    id={field(`stage-${index}`)}
                    value={asset.stage}
                    onChange={(event) =>
                      updateAsset(index, { stage: event.target.value as ProductStage | "" })
                    }
                  >
                    <option value="">—</option>
                    {PRODUCT_STAGES.map((stage) => (
                      <option value={stage} key={stage}>
                        {labels.stages[stage]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(asset.kind === "media" || asset.kind === "profile") && (
                <div>
                  <label className="label" htmlFor={field(`platform-${index}`)}>
                    {copy.assetPlatform}
                  </label>
                  <select
                    className="field"
                    id={field(`platform-${index}`)}
                    value={asset.platform}
                    onChange={(event) =>
                      updateAsset(index, { platform: event.target.value as Platform | "" })
                    }
                  >
                    <option value="">—</option>
                    {PLATFORMS.map((platform) => (
                      <option value={platform} key={platform}>
                        {labels.platforms[platform]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {asset.kind === "product" && <p className="hint">{copy.assetUrlHint}</p>}

            <button
              type="button"
              className="link-button"
              onClick={() => setAssets((current) => current.filter((_, i) => i !== index))}
            >
              {copy.removeAsset}
            </button>
          </div>
        ))}

        {assets.length < LIMITS.assets && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() =>
              setAssets((current) => [
                ...current,
                { kind: "product", title: "", tagline: "", url: "", stage: "", platform: "" },
              ])
            }
          >
            {copy.addAsset}
          </button>
        )}
      </div>

      {/* ── Visibility and save ──────────────────────────────────── */}
      <div>
        <label className="choice" style={{ maxWidth: "24rem" }}>
          <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
          <span>{copy.hidden}</span>
        </label>
        <p className="hint">{copy.hiddenHint}</p>
      </div>

      {message && (
        <p className={`alert ${status === "error" ? "alert--error" : "alert--success"}`} role="status">
          {message}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        {published ? (
          <button className="btn btn--primary" type="button" disabled={saving} onClick={() => save(true)}>
            {saving ? copy.saving : copy.update}
          </button>
        ) : (
          <>
            <button className="btn btn--primary" type="button" disabled={saving} onClick={() => save(true)}>
              {saving ? copy.saving : copy.publish}
            </button>
            <button className="btn btn--secondary" type="button" disabled={saving} onClick={() => save(false)}>
              {copy.saveDraft}
            </button>
          </>
        )}

        <button type="button" className="link-button" onClick={signOut}>
          {copy.signOut}
        </button>
      </div>
    </div>
  );
}
