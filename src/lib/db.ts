import { Pool } from "pg";
import { fallbackSlug, type AssetKind, type Platform, type ProductStage, type ProfileInput, type Role } from "@/lib/members";

/**
 * Postgres access.
 *
 * The pool is cached on globalThis because Next.js re-evaluates modules on every
 * hot reload in development — without the cache each reload would open a fresh
 * pool and the database would run out of connections within a few minutes.
 */

type PoolCache = {
  pool: Pool | undefined;
  schemaReady: Promise<void> | undefined;
};

const cache = globalThis as unknown as { __vibeThursdayDb?: PoolCache };

cache.__vibeThursdayDb ??= { pool: undefined, schemaReady: undefined };

export function getPool(): Pool {
  const store = cache.__vibeThursdayDb!;

  if (!store.pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }

    store.pool = new Pool({
      connectionString,
      // The app and the database sit in the same Zeabur project and talk over
      // the private internal network, so TLS is off by default. Setting
      // DATABASE_SSL=require turns on TLS *with* certificate verification —
      // there is deliberately no option here that skips verification.
      ssl: process.env.DATABASE_SSL === "require" ? true : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return store.pool;
}

/**
 * Creates the signups table if it does not exist.
 *
 * Running migrations from the app rather than a separate step keeps deployment
 * to a single command, which matters because this project has no CI. The work
 * is done at most once per process — the in-flight promise is cached, so
 * concurrent first requests all wait on the same statement rather than racing.
 */
export function ensureSchema(): Promise<void> {
  const store = cache.__vibeThursdayDb!;

  store.schemaReady ??= (async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS signups (
        id            bigserial PRIMARY KEY,
        name          text NOT NULL,
        email         text NOT NULL,
        wechat        text,
        building      text,
        demo_intent   text,
        first_session date,
        source        text,
        lang          text,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Added after launch. IF NOT EXISTS keeps this safe to run against the
    // table created by the original schema above.
    await pool.query(`ALTER TABLE signups ADD COLUMN IF NOT EXISTS bot_check text`);

    // Email stopped being mandatory once the Chinese form started asking for a
    // WeChat ID instead — most of that audience does not check email.
    await pool.query(`ALTER TABLE signups ALTER COLUMN email DROP NOT NULL`);

    // Case-insensitive uniqueness: signing up twice with "Me@x.com" and
    // "me@x.com" is one person changing their mind, not two attendees.
    // Postgres allows unlimited NULLs in a unique index, so rows with no email
    // are simply not constrained by this one.
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS signups_email_lower_idx
      ON signups (lower(email))
    `);

    // The same guarantee for people who only left a WeChat ID.
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS signups_wechat_lower_idx
      ON signups (lower(wechat))
    `);

    // What they would like to talk about this week. Separate from `building`:
    // that is a standing description of their work, this changes week to week.
    await pool.query(`ALTER TABLE signups ADD COLUMN IF NOT EXISTS topic text`);

    // Every session this person has signed up for, not just the latest.
    // `first_session` alone was overwritten on each re-signup, so a regular
    // who came back for week two silently vanished from week one's count and
    // the historical headcount kept shrinking.
    await pool.query(`ALTER TABLE signups ADD COLUMN IF NOT EXISTS sessions date[] NOT NULL DEFAULT '{}'`);

    // Backfill rows created before the column existed.
    await pool.query(`
      UPDATE signups
         SET sessions = ARRAY[first_session]
       WHERE sessions = '{}' AND first_session IS NOT NULL
    `);

    // Which other times this person could make. Asked of everyone, not just
    // the people who cannot do Thursdays: whether a second session is worth
    // running depends on total demand, and a Thursday regular who would also
    // come on a Saturday is part of that number.
    await pool.query(`ALTER TABLE signups ADD COLUMN IF NOT EXISTS availability text[] NOT NULL DEFAULT '{}'`);

    // ── Member wall ──────────────────────────────────────────────────
    // One row per person who claimed their card. `signup_id` is the only way
    // in, which is what keeps the wall to people who actually turned up: there
    // is no open registration anywhere on this site.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id            bigserial PRIMARY KEY,
        signup_id     bigint NOT NULL UNIQUE REFERENCES signups(id) ON DELETE CASCADE,
        slug          text NOT NULL UNIQUE,
        display_name  text NOT NULL,
        headline      text,
        bio           text,
        roles         text[] NOT NULL DEFAULT '{}',
        looking_for   text,
        can_help      text,
        tags          text[] NOT NULL DEFAULT '{}',
        -- Two states, not three. A "members only" tier would mean the wall
        -- itself needs a login, and the wall is also the recruitment page.
        hidden        boolean NOT NULL DEFAULT false,
        -- NULL while the card is a draft prefilled from the signup. The wall
        -- only ever shows rows where this is set.
        published_at  timestamptz,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Zero or more per member. A card with no assets is a complete card — that
    // is the whole point, it is what someone who only comes to listen has.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_assets (
        id          bigserial PRIMARY KEY,
        member_id   bigint NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        kind        text NOT NULL,
        title       text NOT NULL,
        tagline     text,
        url         text,
        -- Products only: idea / local / beta / live / revenue. Deliberately a
        -- label rather than a gate, so "runs on my laptop" is a state a card
        -- can be in rather than a reason it cannot exist.
        stage       text,
        -- Media and profile links only: xhs / wechat / x / linkedin / …
        platform    text,
        sort_order  int NOT NULL DEFAULT 0,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS member_assets_member_idx
      ON member_assets (member_id, sort_order)
    `);

    // Avatars live in the row rather than in object storage. At this size —
    // tens of members, capped at roughly 60 KB each after the browser resizes
    // them — a bucket would be a second system to configure, secure and pay for
    // in exchange for nothing. Postgres moves values this large out of line
    // automatically, and no list query ever selects the bytes.
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar bytea`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_mime text`);
    // Bumped on every upload so the URL changes and caches do not serve the
    // previous face for a month.
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_version int NOT NULL DEFAULT 0`);
  })().catch((error) => {
    // Clear the cache so a transient failure (database still booting) is
    // retried on the next request instead of being remembered forever.
    store.schemaReady = undefined;
    throw error;
  });

  return store.schemaReady;
}

export type SignupInput = {
  name: string;
  email: string | null;
  wechat: string | null;
  building: string | null;
  demoIntent: string | null;
  topic: string | null;
  firstSession: string | null;
  source: string | null;
  /** Other times this person could make. Whitelisted by the route. */
  availability: string[];
  lang: string;
  /** Turnstile verdict for this submission: verified / skipped / unavailable. */
  botCheck: string;
};

/**
 * Inserts a signup, or updates the existing row when we already know this
 * person. Re-submitting is treated as "I changed my details", never an error —
 * an error here would just make someone think they failed to sign up.
 *
 * Identity is "email or WeChat ID, whichever we have": the Chinese form asks
 * for a WeChat ID and the English one for an email, and either may be the only
 * thing present.
 *
 * This is a lookup followed by an update rather than an upsert, because
 * Postgres cannot express "conflict on whichever of these two columns is
 * non-null". The previous version picked the ON CONFLICT target from the
 * *submission* — and got it wrong whenever the submission carried an email the
 * stored row did not have. The insert then fell through to the WeChat unique
 * index and raised 23505, which surfaced as a 500 and lost the signup. That is
 * the exact path of "signed up for week one with only a WeChat ID, came back
 * for week two and filled the optional email in this time", and it failed
 * permanently: every retry took the same branch.
 */
export async function saveSignup(input: SignupInput): Promise<string> {
  await ensureSchema();

  const pool = getPool();

  // Two rows can match when the same person once signed up through each form
  // and left a different identifier each time. LIMIT 2 is enough to notice.
  const existing = await pool.query<{ id: string; email: string | null; wechat: string | null }>(
    `SELECT id::text AS id, email, wechat
       FROM signups
      WHERE ($1::text IS NOT NULL AND lower(email) = lower($1))
         OR ($2::text IS NOT NULL AND lower(wechat) = lower($2))
      ORDER BY id
      LIMIT 2`,
    [input.email, input.wechat],
  );

  const target = existing.rows[0];

  if (!target) {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO signups (name, email, wechat, building, demo_intent, first_session, source, lang, bot_check, topic, availability, sessions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               CASE WHEN $6::date IS NULL THEN '{}'::date[] ELSE ARRAY[$6::date] END)
       RETURNING id::text AS id`,
      [
        input.name,
        input.email,
        input.wechat,
        input.building,
        input.demoIntent,
        input.firstSession,
        input.source,
        input.lang,
        input.botCheck,
        input.topic,
        input.availability,
      ],
    );

    return inserted.rows[0].id;
  }

  /**
   * True when some *other* matched row already holds this identifier.
   *
   * Writing it onto the target row would violate that column's unique index,
   * which is the failure this function exists to avoid. Skipping the write
   * leaves the two rows as they were — a duplicate that predates this
   * submission — but records the signup instead of throwing it away.
   */
  const takenByAnother = (value: string | null, column: "email" | "wechat") =>
    value !== null &&
    existing.rows.some(
      (row) => row.id !== target.id && row[column]?.toLowerCase() === value.toLowerCase(),
    );

  await pool.query(
    `UPDATE signups SET
       name          = $2,
       email         = COALESCE($3, email),
       wechat        = COALESCE($4, wechat),
       building      = COALESCE($5, building),
       demo_intent   = $6,
       -- COALESCE, so submitting the compact returning-visitor form without
       -- retyping anything does not wipe what they wrote last time.
       topic         = COALESCE($11, topic),
       first_session = $7,
       -- Union, not replace: signing up for week three must not erase weeks one
       -- and two. DISTINCT keeps a re-submission for the same week idempotent.
       sessions      = ARRAY(
                         SELECT DISTINCT unnest(
                           sessions || CASE WHEN $7::date IS NULL THEN '{}'::date[] ELSE ARRAY[$7::date] END
                         )
                         ORDER BY 1
                       ),
       source        = COALESCE($8, source),
       -- Replace rather than union: unlike sessions, this is a current
       -- preference and someone whose Saturdays stopped working must be able
       -- to say so. An empty submission leaves it alone, so the compact
       -- returning-visitor form does not silently wipe an earlier answer.
       availability  = CASE WHEN cardinality($12::text[]) = 0
                            THEN availability ELSE $12::text[] END,
       lang          = $9,
       bot_check     = $10,
       updated_at    = now()
     WHERE id = $1`,
    [
      target.id,
      input.name,
      takenByAnother(input.email, "email") ? null : input.email,
      takenByAnother(input.wechat, "wechat") ? null : input.wechat,
      input.building,
      input.demoIntent,
      input.firstSession,
      input.source,
      input.lang,
      input.botCheck,
      input.topic,
      input.availability,
    ],
  );

  return target.id;
}

/**
 * Puts a signup's card on the wall, for someone who ticked the box asking for
 * exactly that.
 *
 * This exists because claiming was a two-gate funnel — find your card at
 * /claim, then publish it in the editor — and on 2026-08-13 only 14 of 56
 * signups had made it through both. The wall is what lets people work out who
 * is worth talking to *before* they arrive, so a wall holding a quarter of the
 * room only does a quarter of its job.
 *
 * Consent is the reason this is a checkbox and not automatic. `building` is
 * the field people want published, and the form never said whether it was
 * public — publishing it on everyone's behalf would turn something written for
 * the organiser into something written for the internet. Email and WeChat ID
 * are never copied here; the form promises those stay private.
 *
 * Three things it deliberately does not do on an existing card:
 *
 *   - It does not overwrite `display_name` / `bio` / `looking_for`. Someone who
 *     edited their card has said more about themselves than the signup form
 *     ever asked, and a later signup must not undo that.
 *   - It does not clear `hidden`. Taking your card down is an explicit act; a
 *     tickbox on a different form is not consent to reverse it.
 *   - It does not unpublish when the box is left unticked. The box means "put
 *     me up", not "here is my current wall setting" — the card's owner controls
 *     that from /me.
 */
export async function publishCardForSignup(signupId: string): Promise<void> {
  await ensureSchema();

  await getPool().query(
    `INSERT INTO members (signup_id, slug, display_name, bio, looking_for, published_at)
     SELECT g.id, $2, g.name, g.building, g.topic, now()
       FROM signups g
      WHERE g.id = $1
     ON CONFLICT (signup_id) DO UPDATE
        SET published_at = COALESCE(members.published_at, now()),
            updated_at   = now()`,
    [signupId, fallbackSlug(signupId)],
  );
}

export type SignupRow = {
  id: string;
  name: string;
  email: string | null;
  wechat: string | null;
  building: string | null;
  demo_intent: string | null;
  first_session: string | null;
  source: string | null;
  lang: string | null;
  bot_check: string | null;
  /** What they said they would like to talk about this week. */
  topic: string | null;
  /** Every session this person has signed up for, oldest first. */
  sessions: string[];
  /** Other times they said they could make. Empty when they did not answer. */
  availability: string[];
  created_at: string;
};

export async function listSignups(): Promise<SignupRow[]> {
  await ensureSchema();

  const result = await getPool().query<SignupRow>(
    `SELECT id, name, email, wechat, building, demo_intent, topic,
            -- Formatted in SQL like first_session is. Returned raw, the driver
            -- hands back Date objects, which stringify to "Thu Aug 13 2026 …"
            -- in the CSV export.
            COALESCE(
              (SELECT array_agg(to_char(s, 'YYYY-MM-DD') ORDER BY s)
                 FROM unnest(sessions) AS s),
              '{}'
            ) AS sessions,
            to_char(first_session, 'YYYY-MM-DD') AS first_session,
            availability, source, lang, bot_check,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     FROM signups
     ORDER BY created_at DESC`,
  );

  return result.rows;
}

/* =============================================================================
   Member wall
============================================================================= */

export type MemberAsset = {
  kind: AssetKind;
  title: string;
  tagline: string | null;
  url: string | null;
  stage: ProductStage | null;
  platform: Platform | null;
};

export type Member = {
  id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  roles: Role[];
  looking_for: string | null;
  can_help: string | null;
  tags: string[];
  hidden: boolean;
  published: boolean;
  /** Every session this person signed up for, oldest first. */
  sessions: string[];
  /**
   * What they said they wanted to talk about when they last signed up.
   *
   * Read live from `signups` rather than copied onto the card, so it changes
   * by itself every week without anyone editing anything. Null once they stop
   * filling it in, which is most weeks for most people.
   */
  topic: string | null;
  /** Whether there is a photo at all. Separate from the version on purpose. */
  has_avatar: boolean;
  /** Cache-busting suffix only. It keeps climbing when a photo is removed, so
   *  it can never be used to answer "is there one". */
  avatar_version: number;
  assets: MemberAsset[];
};

/** Column list shared by every member read, so the shapes cannot drift apart. */
const MEMBER_COLUMNS = `
  m.id::text            AS id,
  m.slug,
  m.display_name,
  m.headline,
  m.bio,
  m.roles,
  m.looking_for,
  m.can_help,
  m.tags,
  m.hidden,
  (m.published_at IS NOT NULL) AS published,
  g.topic,
  (m.avatar IS NOT NULL) AS has_avatar,
  m.avatar_version,
  COALESCE(
    (SELECT array_agg(to_char(s, 'YYYY-MM-DD') ORDER BY s) FROM unnest(g.sessions) AS s),
    '{}'
  ) AS sessions
`;

type MemberBase = Omit<Member, "assets">;

/**
 * Attaches assets to already-loaded members.
 *
 * One extra query for the whole page rather than one per member. Written this
 * way instead of a json_agg join because the aggregate turns every scalar
 * column into something the driver hands back differently, and this codebase
 * reads raw rows.
 */
async function withAssets(members: MemberBase[]): Promise<Member[]> {
  if (members.length === 0) return [];

  const result = await getPool().query<MemberAsset & { member_id: string }>(
    `SELECT member_id::text AS member_id, kind, title, tagline, url, stage, platform
       FROM member_assets
      WHERE member_id = ANY($1::bigint[])
      ORDER BY member_id, sort_order, id`,
    [members.map((member) => member.id)],
  );

  const byMember = new Map<string, MemberAsset[]>();

  for (const { member_id, ...asset } of result.rows) {
    const list = byMember.get(member_id);
    if (list) list.push(asset);
    else byMember.set(member_id, [asset]);
  }

  return members.map((member) => ({ ...member, assets: byMember.get(member.id) ?? [] }));
}

/**
 * Everyone whose card is live, most recently seen first.
 *
 * Sorted by last session rather than by any kind of score. This wall answers
 * "who is around" for a weekly meetup; ranking it by votes would quietly turn
 * it into a popularity contest, which is not what it is for.
 */
export async function listWallMembers(): Promise<Member[]> {
  await ensureSchema();

  const result = await getPool().query<MemberBase>(
    `SELECT ${MEMBER_COLUMNS}
       FROM members m
       JOIN signups g ON g.id = m.signup_id
      WHERE m.published_at IS NOT NULL AND NOT m.hidden
      ORDER BY (SELECT max(s) FROM unnest(g.sessions) AS s) DESC NULLS LAST,
               m.updated_at DESC`,
  );

  return withAssets(result.rows);
}

/** One live card, for its own page. Drafts and hidden cards 404. */
export async function getMemberBySlug(slug: string): Promise<Member | null> {
  await ensureSchema();

  const result = await getPool().query<MemberBase>(
    `SELECT ${MEMBER_COLUMNS}
       FROM members m
       JOIN signups g ON g.id = m.signup_id
      WHERE m.slug = $1 AND m.published_at IS NOT NULL AND NOT m.hidden`,
    [slug],
  );

  return (await withAssets(result.rows))[0] ?? null;
}

/** The signed-in member's own card, draft or not. */
export async function getMemberById(id: string): Promise<Member | null> {
  await ensureSchema();

  const result = await getPool().query<MemberBase>(
    `SELECT ${MEMBER_COLUMNS}
       FROM members m
       JOIN signups g ON g.id = m.signup_id
      WHERE m.id = $1`,
    [id],
  );

  return (await withAssets(result.rows))[0] ?? null;
}

/**
 * Finds the signup behind a claim attempt, and creates the draft card.
 *
 * The match is name plus one contact method, both case-insensitive. This is a
 * soft check on purpose: there is no email sender in this project, so a
 * one-time link would mean standing up mail infrastructure first, and the
 * worst case here is that someone who already knows both your name and your
 * WeChat ID edits a page you were going to publish anyway. The organiser can
 * fix that from /admin.
 *
 * The draft is prefilled from what the person already wrote when they signed
 * up, which is the whole cold-start strategy: editing two sentences is a very
 * different ask from writing a profile from scratch.
 */
export async function claimMember(name: string, contact: string): Promise<string | null> {
  await ensureSchema();

  const pool = getPool();

  const found = await pool.query<{ id: string; name: string; building: string | null; topic: string | null }>(
    `SELECT id::text AS id, name, building, topic
       FROM signups
      WHERE lower(name) = lower($1)
        AND (lower(email) = lower($2) OR lower(wechat) = lower($2))
      LIMIT 1`,
    [name, contact],
  );

  const signup = found.rows[0];
  if (!signup) return null;

  // Slug defaults off the signup id because it is already unique and known
  // before the insert. Members pick a real handle in the editor.
  const result = await pool.query<{ id: string }>(
    `INSERT INTO members (signup_id, slug, display_name, bio, looking_for)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (signup_id) DO UPDATE SET updated_at = now()
     RETURNING id::text AS id`,
    [signup.id, fallbackSlug(signup.id), signup.name, signup.building, signup.topic],
  );

  return result.rows[0].id;
}

/**
 * Tags already in use on live cards, most used first.
 *
 * Feeds the editor's suggestions. Suggesting only what other people have
 * actually published is what makes tags converge into something worth
 * filtering by — a free-text field with no prompt produces thirty spellings of
 * the same idea and a filter nobody can use.
 */
export async function listPublishedTags(limit = 24): Promise<string[]> {
  await ensureSchema();

  const result = await getPool().query<{ tag: string }>(
    `SELECT t AS tag
       FROM members m, unnest(m.tags) AS t
      WHERE m.published_at IS NOT NULL AND NOT m.hidden
      GROUP BY t
      ORDER BY count(*) DESC, t
      LIMIT $1`,
    [limit * 2],
  );

  // Case-insensitive dedupe after the fact: "AI Agent" and "ai agent" are one
  // tag, and the more popular spelling arrives first so it wins.
  const seen = new Set<string>();
  const out: string[] = [];

  for (const { tag } of result.rows) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * The stored avatar bytes, for the route that serves them.
 *
 * Gated the same way the card is. Without this, a hidden or still-draft card
 * leaked its owner's photo to anyone counting upwards through /api/avatar/1,
 * /2, /3 — the ids are sequential and the route needs no credential. `viewerId`
 * is the signed-in member, who must always be able to see their own picture in
 * the editor before they publish.
 */
export async function getMemberAvatar(
  id: string,
  viewerId: string | null,
): Promise<{ bytes: Buffer; mime: string } | null> {
  await ensureSchema();

  const result = await getPool().query<{
    avatar: Buffer | null;
    avatar_mime: string | null;
    visible: boolean;
  }>(
    `SELECT avatar, avatar_mime,
            (published_at IS NOT NULL AND NOT hidden) AS visible
       FROM members
      WHERE id = $1`,
    [id],
  );

  const row = result.rows[0];
  if (!row?.avatar) return null;
  if (!row.visible && viewerId !== id) return null;

  return { bytes: row.avatar, mime: row.avatar_mime ?? "image/jpeg" };
}

export async function saveMemberAvatar(id: string, bytes: Buffer, mime: string): Promise<number> {
  await ensureSchema();

  const result = await getPool().query<{ avatar_version: number }>(
    `UPDATE members
        SET avatar = $2, avatar_mime = $3, avatar_version = avatar_version + 1, updated_at = now()
      WHERE id = $1
      RETURNING avatar_version`,
    [id, bytes, mime],
  );

  return result.rows[0]?.avatar_version ?? 0;
}

/** Back to the monogram. The version still moves, so caches let go of the old one. */
export async function clearMemberAvatar(id: string): Promise<void> {
  await ensureSchema();

  await getPool().query(
    `UPDATE members
        SET avatar = NULL, avatar_mime = NULL, avatar_version = avatar_version + 1, updated_at = now()
      WHERE id = $1`,
    [id],
  );
}

/** Every card, published or not, for the organiser's moderation table. */
export type AdminMember = {
  id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  published: boolean;
  hidden: boolean;
  updated_at: string;
};

export async function listAllMembers(): Promise<AdminMember[]> {
  await ensureSchema();

  const result = await getPool().query<AdminMember>(
    `SELECT id::text AS id, slug, display_name, headline,
            (published_at IS NOT NULL) AS published, hidden,
            to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
       FROM members
      ORDER BY updated_at DESC`,
  );

  return result.rows;
}

/**
 * Takes a card off the wall, or puts it back.
 *
 * The claim check is deliberately soft, so there had to be a way to undo
 * someone else's edit that did not involve opening a psql session. Hiding
 * rather than deleting: the row is still the member's, and the organiser
 * reversing a decision should not cost them their card.
 */
export async function setMemberHidden(id: string, hidden: boolean): Promise<void> {
  await ensureSchema();

  await getPool().query(
    `UPDATE members SET hidden = $2, updated_at = now() WHERE id = $1`,
    [id, hidden],
  );
}

/** Raised when the handle someone typed is already taken. */
export class SlugTakenError extends Error {}

/**
 * Writes a card and replaces its assets.
 *
 * Assets are deleted and re-inserted rather than diffed: the editor submits the
 * whole list, there are at most eight of them, and a diff would need stable ids
 * round-tripped through the client for no benefit.
 */
export async function saveMember(id: string, profile: ProfileInput): Promise<void> {
  await ensureSchema();

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    try {
      await client.query(
        `UPDATE members SET
           slug         = $2,
           display_name = $3,
           headline     = $4,
           bio          = $5,
           roles        = $6,
           looking_for  = $7,
           can_help     = $8,
           tags         = $9,
           hidden       = $10,
           -- Publishing is one-way from the editor's point of view: taking a
           -- card down is what the hidden flag is for. Keeping the original
           -- timestamp means "member since" stays true after every later edit.
           published_at = CASE WHEN $11 THEN COALESCE(published_at, now()) ELSE published_at END,
           updated_at   = now()
         WHERE id = $1`,
        [
          id,
          profile.slug,
          profile.displayName,
          profile.headline,
          profile.bio,
          profile.roles,
          profile.lookingFor,
          profile.canHelp,
          profile.tags,
          profile.hidden,
          profile.publish,
        ],
      );
    } catch (error) {
      // 23505 is unique_violation, and `slug` is the only unique column this
      // statement touches.
      if ((error as { code?: string }).code === "23505") throw new SlugTakenError();
      throw error;
    }

    await client.query(`DELETE FROM member_assets WHERE member_id = $1`, [id]);

    for (const [index, asset] of profile.assets.entries()) {
      await client.query(
        `INSERT INTO member_assets (member_id, kind, title, tagline, url, stage, platform, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, asset.kind, asset.title, asset.tagline, asset.url, asset.stage, asset.platform, index],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
