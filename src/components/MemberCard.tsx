import Link from "next/link";
import type { Member, MemberAsset } from "@/lib/db";
import { LANG_PARAM, type Copy, type Lang } from "@/lib/content";
import { formatSession } from "@/lib/sessions";
import { topicSession } from "@/lib/wharf";
import { Avatar } from "@/components/Avatar";

type MembersCopy = Copy["members"];

/** English is a query param, so every internal link has to carry it along. */
export function langSuffix(lang: Lang, hasQuery = false): string {
  const param = LANG_PARAM[lang];
  if (!param) return "";
  return `${hasQuery ? "&" : "?"}lang=${param}`;
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

      {asset.url ? (
        <a
          className="asset__title asset__title--link"
          href={asset.url}
          target="_blank"
          // noopener stops the opened page reaching back through window.opener;
          // nofollow keeps the wall from being worth spamming for backlinks.
          rel="noopener noreferrer nofollow"
        >
          {asset.title}
          <span aria-hidden="true"> ↗</span>
        </a>
      ) : (
        <span className="asset__title">{asset.title}</span>
      )}

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
  /** ISO date of the next session, so "this week" can only mean this week. */
  upcoming: string;
};

/**
 * The topic line to show on a card, and which session it was written for.
 *
 * Two things have to be true and neither was true to begin with:
 *
 * - The label has to match the date. A topic written three weeks ago and never
 *   touched again was being labelled 本周.
 * - Claiming a card copies the signup's topic into `looking_for`, so for anyone
 *   who has not edited since, the same sentence appeared twice under two
 *   different headings.
 *
 * The first was originally fixed by hiding the topic unless the person was
 * signed up for the coming Thursday — which is correct about the label and
 * wrong about everything else. Between a session ending and the next week's
 * sign-ups opening, that gate hid **every** topic on the site: 35 of them in
 * the database and none rendered anywhere. So the gate is now on the label,
 * not on the line. `session` is null when they have never picked a Thursday,
 * which is its own true thing to say about someone.
 */
export function cardTopic(
  member: Member,
): { topic: string; session: string | null } | null {
  if (!member.topic) return null;

  const same = member.looking_for?.trim().toLowerCase() === member.topic.trim().toLowerCase();
  if (same) return null;

  return { topic: member.topic, session: topicSession(member.sessions) };
}

/** 本周想聊 / 8月27日（周四）想聊 / 想聊 — whichever the date makes true. */
export function topicLabel(
  session: string | null,
  upcoming: string,
  lang: Lang,
  copy: Pick<MembersCopy, "thisWeekTopic" | "topicOn" | "topicUndated">,
): string {
  if (session === null) return copy.topicUndated;
  if (session >= upcoming) return copy.thisWeekTopic;
  return copy.topicOn.replace("{date}", formatSession(session, lang));
}

/**
 * How much of a card the wall shows before deferring to the member's own page.
 *
 * These caps exist for the grid, not for brevity: every row is the same height,
 * so one person with eight assets and six tags would otherwise set that height
 * for the whole wall.
 */
const ASSETS_ON_CARD = 3;
const TAGS_ON_CARD = 4;

export function MemberCard({ member, copy, lang, upcoming }: Props) {
  const topic = cardTopic(member);
  const shown = member.assets.slice(0, ASSETS_ON_CARD);
  const overflow = member.assets.length - shown.length;

  const shownTags = member.tags.slice(0, TAGS_ON_CARD);
  const tagOverflow = member.tags.length - shownTags.length;

  return (
    <article className="mcard">
      <div className="mcard__head">
        <Avatar
          id={member.id}
          name={member.display_name}
          hasAvatar={member.has_avatar}
          version={member.avatar_version}
          size="sm"
        />

        <div className="mcard__id">
          <h3 className="mcard__name">
            {/* Stretched link: the ::after on this anchor covers the whole card,
                so anywhere on the card opens the member's page. Everything else
                that is interactive — asset links, tags — is lifted above it in
                CSS, which keeps them clickable without nesting anchors. */}
            <Link className="mcard__link" href={`/members/${member.slug}${langSuffix(lang)}`}>
              {member.display_name}
            </Link>
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
          A card with neither is still a card — plenty of people only listen.
          The week's topic joins them when there is one: it comes straight from
          the latest signup, so it is the only part of a card that stays current
          without its owner touching it. */}
      {(topic || member.looking_for || member.can_help) && (
        <dl className="wants">
          {topic && (
            <div className="wants__row">
              <dt>📌 {topicLabel(topic.session, upcoming, lang, copy)}</dt>
              <dd>{topic.topic}</dd>
            </div>
          )}
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

      {shownTags.length > 0 && (
        <div className="mcard__tags">
          {shownTags.map((tag) => (
            <Link
              className="tag"
              href={`/members?tag=${encodeURIComponent(tag)}${langSuffix(lang, true)}`}
              key={tag}
            >
              #{tag}
            </Link>
          ))}
          {tagOverflow > 0 && <span className="tag">+{tagOverflow}</span>}
        </div>
      )}
    </article>
  );
}
