import Link from "next/link";
import type { Member, MemberAsset } from "@/lib/db";
import type { Copy, Lang } from "@/lib/content";
import { monogram } from "@/lib/members";

type MembersCopy = Copy["members"];

/** English is a query param, so every internal link has to carry it along. */
export function langSuffix(lang: Lang, hasQuery = false): string {
  if (lang !== "en") return "";
  return hasQuery ? "&lang=en" : "?lang=en";
}

/**
 * The label in front of an asset.
 *
 * A media account or a profile link is better identified by where it lives than
 * by its category — "Xiaohongshu" says more than "Channel" — so those two use
 * the platform when one was picked.
 */
export function assetLabel(asset: MemberAsset, copy: MembersCopy): string {
  if (asset.platform) return copy.platforms[asset.platform];
  return copy.kinds[asset.kind];
}

/** One asset as a single line: what it is, what it is called, how far along. */
export function AssetLine({ asset, copy }: { asset: MemberAsset; copy: MembersCopy }) {
  return (
    <li className="asset">
      <span className="asset__kind">{assetLabel(asset, copy)}</span>
      <span className="asset__title">{asset.title}</span>
      {/* Stage sits next to the name rather than in a corner: on this wall
          "runs locally" is part of what the thing is, not a caveat. */}
      {asset.stage && <span className="asset__stage">{copy.stages[asset.stage]}</span>}
    </li>
  );
}

type Props = {
  member: Member;
  copy: MembersCopy;
  lang: Lang;
};

/** Up to this many assets on the wall; the rest are on the member's own page. */
const ASSETS_ON_CARD = 3;

export function MemberCard({ member, copy, lang }: Props) {
  const shown = member.assets.slice(0, ASSETS_ON_CARD);
  const overflow = member.assets.length - shown.length;

  return (
    <article className="mcard">
      <div className="mcard__head">
        {/* A monogram, not an avatar. Uploads would mean a bucket, a size
            limit and a moderation question for a wall of thirty people. */}
        <span className="monogram" aria-hidden="true">
          {monogram(member.display_name)}
        </span>

        <div className="mcard__id">
          <h3 className="mcard__name">
            <Link href={`/members/${member.slug}${langSuffix(lang)}`}>{member.display_name}</Link>
          </h3>
          {member.headline && <p className="mcard__headline">{member.headline}</p>}
        </div>
      </div>

      {(member.roles.length > 0 || member.sessions.length > 0) && (
        <div className="mcard__meta">
          {member.roles.map((role) => (
            <span className="chip" key={role}>
              {copy.roles[role]}
            </span>
          ))}
          {member.sessions.length > 0 && (
            <span className="chip chip--quiet">
              {copy.attended.replace("{n}", String(member.sessions.length))}
            </span>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <ul className="asset-list">
          {shown.map((asset) => (
            <AssetLine asset={asset} copy={copy} key={`${asset.kind}-${asset.title}`} />
          ))}
          {overflow > 0 && <li className="asset asset--more">+{overflow}</li>}
        </ul>
      )}

      {/* The two lines that make this a matchmaker rather than a directory.
          A card with neither is still a card — plenty of people only listen. */}
      {(member.looking_for || member.can_help) && (
        <dl className="wants">
          {member.looking_for && (
            <div className="wants__row">
              <dt>🔎 {copy.lookingFor}</dt>
              <dd>{member.looking_for}</dd>
            </div>
          )}
          {member.can_help && (
            <div className="wants__row">
              <dt>🤝 {copy.canHelp}</dt>
              <dd>{member.can_help}</dd>
            </div>
          )}
        </dl>
      )}

      {member.tags.length > 0 && (
        <div className="mcard__tags">
          {member.tags.map((tag) => (
            <Link
              className="tag"
              href={`/members?tag=${encodeURIComponent(tag)}${langSuffix(lang, true)}`}
              key={tag}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
