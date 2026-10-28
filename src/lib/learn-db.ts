// Relative imports only: scripts and tests load this through Node's type stripper.
import { ensureSchema, getPool } from "./db.ts";
import { EMAIL_CODE_MAX_ATTEMPTS, EMAIL_CODE_RESEND_MS, EMAIL_CODE_TTL_MS, emailCodeMatches, type LearnerStatus } from "./learn.ts";

/**
 * Postgres access for recorded lessons (/learn, 2026-10-28).
 *
 * Its own file rather than more of db.ts, which is already several thousand
 * lines. Its own schema step too: `ensureLearnSchema` runs after the main
 * `ensureSchema`, once per process, and every statement in it is idempotent.
 */

const cache = globalThis as unknown as { __vibeThursdayLearnSchema?: Promise<void> };

export function ensureLearnSchema(): Promise<void> {
  cache.__vibeThursdayLearnSchema ??= (async () => {
    await ensureSchema();
    const pool = getPool();

    // Anyone who has signed in to /learn. `status` is the whole of access
    // control: only `approved` may watch (learn.ts, canAccessLessons).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS learners (
        id           bigserial PRIMARY KEY,
        openid       text UNIQUE,
        email        text UNIQUE,
        name         text,
        note         text,
        status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
        created_at   timestamptz NOT NULL DEFAULT now(),
        approved_at  timestamptz,
        last_seen_at timestamptz
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id          bigserial PRIMARY KEY,
        slug        text NOT NULL UNIQUE,
        title       text NOT NULL,
        summary     text,
        position    integer NOT NULL DEFAULT 0,
        video_id    text,
        duration_s  integer,
        published   boolean NOT NULL DEFAULT false,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Invite links (2026-10-28): one URL to share in a group chat. Whoever
    // opens it signs in as themselves and is let in without waiting, and is
    // tagged with the invite so a leaked link's joiners can be found again.
    // The token is kept as is so the organiser can copy the link again later.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS learn_invites (
        id          bigserial PRIMARY KEY,
        token       text NOT NULL UNIQUE,
        label       text NOT NULL,
        max_uses    integer,
        uses        integer NOT NULL DEFAULT 0,
        expires_at  timestamptz,
        revoked_at  timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`ALTER TABLE learners ADD COLUMN IF NOT EXISTS invite_id bigint REFERENCES learn_invites(id) ON DELETE SET NULL`);

    // Chapters (2026-10-28): the organiser's "time title" lines, kept as typed
    // and parsed on the way out (parseChapters), so a typo never blocks a save.
    await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS chapters text`);

    // Handouts live in object storage; this is only where to find them.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lesson_files (
        id          bigserial PRIMARY KEY,
        lesson_id   bigint NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        title       text NOT NULL,
        object_key  text NOT NULL,
        ext         text NOT NULL,
        bytes       bigint NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS lesson_files_lesson_idx ON lesson_files (lesson_id)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lesson_comments (
        id          bigserial PRIMARY KEY,
        lesson_id   bigint NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        learner_id  bigint REFERENCES learners(id) ON DELETE SET NULL,
        parent_id   bigint REFERENCES lesson_comments(id) ON DELETE CASCADE,
        by_admin    boolean NOT NULL DEFAULT false,
        body        text NOT NULL,
        hidden      boolean NOT NULL DEFAULT false,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS lesson_comments_lesson_idx ON lesson_comments (lesson_id, created_at)`);

    // One live code per address. Only a keyed hash of the code is kept.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS learn_email_codes (
        email       text PRIMARY KEY,
        code_hash   text NOT NULL,
        sent_at     timestamptz NOT NULL DEFAULT now(),
        expires_at  timestamptz NOT NULL,
        attempts    integer NOT NULL DEFAULT 0
      )
    `);
  })().catch((error) => {
    cache.__vibeThursdayLearnSchema = undefined;
    throw error;
  });
  return cache.__vibeThursdayLearnSchema;
}

async function q<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureLearnSchema();
  const { rows } = await getPool().query(sql, params);
  return rows as T[];
}

/* ── Learners ────────────────────────────────────────────────────────── */

export type Learner = {
  id: string;
  openid: string | null;
  email: string | null;
  name: string | null;
  note: string | null;
  status: LearnerStatus;
  createdAt: string;
  lastSeenAt: string | null;
  /** The invite link they joined through, if any. */
  inviteId: string | null;
};

const LEARNER_COLUMNS = `id::text, openid, email, name, note, status, created_at AS "createdAt", last_seen_at AS "lastSeenAt", invite_id::text AS "inviteId"`;

export async function findLearner(id: string): Promise<Learner | null> {
  return (await q<Learner>(`SELECT ${LEARNER_COLUMNS} FROM learners WHERE id = $1`, [id]))[0] ?? null;
}

export async function findLearnerByOpenid(openid: string): Promise<Learner | null> {
  return (await q<Learner>(`SELECT ${LEARNER_COLUMNS} FROM learners WHERE openid = $1`, [openid]))[0] ?? null;
}

/**
 * The learner for this WeChat, created as `pending` the first time. Concurrent
 * first visits land on the same row through the unique index.
 */
export async function learnerForOpenid(openid: string): Promise<Learner> {
  const rows = await q<Learner>(
    `INSERT INTO learners (openid) VALUES ($1)
     ON CONFLICT (openid) DO UPDATE SET last_seen_at = now()
     RETURNING ${LEARNER_COLUMNS}`,
    [openid],
  );
  return rows[0];
}

/**
 * The learner for this email, created as `pending` the first time. An address
 * the organiser added in advance is already `approved`, which is how people
 * are let in before they ever visit.
 */
export async function learnerForEmail(email: string): Promise<Learner> {
  const rows = await q<Learner>(
    `INSERT INTO learners (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET last_seen_at = now()
     RETURNING ${LEARNER_COLUMNS}`,
    [email],
  );
  return rows[0];
}

export async function touchLearner(id: string): Promise<void> {
  await q(`UPDATE learners SET last_seen_at = now() WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '10 minutes')`, [id]);
}

/** The name and note someone gives when asking to be let in. */
export async function setLearnerIntro(id: string, name: string, note: string | null): Promise<void> {
  await q(`UPDATE learners SET name = $2, note = $3 WHERE id = $1`, [id, name, note]);
}

export async function setLearnerStatus(id: string, status: LearnerStatus): Promise<void> {
  await q(
    `UPDATE learners SET status = $2, approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END WHERE id = $1`,
    [id, status],
  );
}

export async function setLearnerName(id: string, name: string | null): Promise<void> {
  await q(`UPDATE learners SET name = $2 WHERE id = $1`, [id, name]);
}

/** Let an address in before its owner has visited. Approves it if it already exists. */
export async function preapproveEmail(email: string, name: string | null): Promise<void> {
  await q(
    `INSERT INTO learners (email, name, status, approved_at) VALUES ($1, $2, 'approved', now())
     ON CONFLICT (email) DO UPDATE SET status = 'approved', approved_at = now(), name = COALESCE(learners.name, EXCLUDED.name)`,
    [email, name],
  );
}

/** Pending first (they are waiting on the organiser), then everyone by most recent. */
export async function listLearners(): Promise<Learner[]> {
  return q<Learner>(
    `SELECT ${LEARNER_COLUMNS} FROM learners
     ORDER BY (status = 'pending') DESC, COALESCE(last_seen_at, created_at) DESC
     LIMIT 1000`,
  );
}

/* ── The main site's signups (2026-10-29) ─────────────────────────────── */

/**
 * The signup on the main site with this email, if any. Used after an email
 * code proves the address, so the main site remembers the same person too.
 */
export async function signupIdForEmail(email: string): Promise<string | null> {
  // Signup emails are typed, never checked: if more than one signup claims this
  // address, there is no telling which is the person who proved it, so none.
  const rows = await q<{ id: string }>(`SELECT id::text FROM signups WHERE lower(email) = lower($1) LIMIT 2`, [email]);
  return rows.length === 1 ? rows[0].id : null;
}

/* ── Invite links ────────────────────────────────────────────────────── */

export type Invite = {
  id: string;
  token: string;
  label: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const INVITE_COLUMNS = `id::text, token, label, max_uses AS "maxUses", uses, expires_at AS "expiresAt", revoked_at AS "revokedAt", created_at AS "createdAt"`;

export async function createInvite(token: string, label: string, maxUses: number | null, days: number | null): Promise<string> {
  const rows = await q<{ id: string }>(
    `INSERT INTO learn_invites (token, label, max_uses, expires_at)
     VALUES ($1, $2, $3, CASE WHEN $4::int IS NULL THEN NULL ELSE now() + make_interval(days => $4::int) END)
     RETURNING id::text`,
    [token, label, maxUses, days],
  );
  return rows[0].id;
}

export async function findInvite(token: string): Promise<Invite | null> {
  return (await q<Invite>(`SELECT ${INVITE_COLUMNS} FROM learn_invites WHERE token = $1`, [token]))[0] ?? null;
}

export async function listInvites(): Promise<Invite[]> {
  return q<Invite>(`SELECT ${INVITE_COLUMNS} FROM learn_invites ORDER BY created_at DESC LIMIT 200`);
}

export async function revokeInvite(id: string): Promise<void> {
  await q(`UPDATE learn_invites SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1`, [id]);
}

/** Revokes everyone who is still approved through this invite. Returns how many. */
export async function revokeInviteLearners(id: string): Promise<number> {
  const rows = await q<{ id: string }>(
    `UPDATE learners SET status = 'revoked' WHERE invite_id = $1 AND status = 'approved' RETURNING id::text`,
    [id],
  );
  return rows.length;
}

/**
 * Lets a waiting learner in through an invite, in one statement: the place is
 * taken only if the invite is still good AND the learner is still waiting, so
 * two people racing for the last place cannot both get in, and a revoked
 * learner cannot use a link to undo their revocation. Returns false when
 * nothing changed.
 */
export async function redeemInvite(token: string, learnerId: string, name: string): Promise<boolean> {
  const rows = await q<{ id: string }>(
    // The learner row is locked first (FOR UPDATE): a double submit then waits,
    // re-reads the row as approved, and drops out before it touches the
    // invite. Without the lock both could take a place and only one would be
    // let in, wasting the other.
    `WITH learner AS (
       SELECT id FROM learners WHERE id = $2 AND status = 'pending' FOR UPDATE
     ),
     taken AS (
       UPDATE learn_invites SET uses = uses + 1
       WHERE token = $1
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())
         AND (max_uses IS NULL OR uses < max_uses)
         AND EXISTS (SELECT 1 FROM learner)
       RETURNING id
     )
     UPDATE learners SET status = 'approved', approved_at = now(), name = $3, invite_id = (SELECT id FROM taken)
     WHERE id IN (SELECT id FROM learner) AND EXISTS (SELECT 1 FROM taken)
     RETURNING id::text`,
    [token, learnerId, name],
  );
  return rows.length > 0;
}

/* ── Lessons ─────────────────────────────────────────────────────────── */

export type Lesson = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  /** Raw chapter text, one "time title" per line; read it with parseChapters. */
  chapters: string | null;
  position: number;
  videoId: string | null;
  durationS: number | null;
  published: boolean;
};

const LESSON_COLUMNS = `id::text, slug, title, summary, chapters, position, video_id AS "videoId", duration_s AS "durationS", published`;

export async function listLessons(includeDrafts: boolean): Promise<Lesson[]> {
  return q<Lesson>(
    `SELECT ${LESSON_COLUMNS} FROM lessons ${includeDrafts ? "" : "WHERE published"} ORDER BY position, id`,
  );
}

export async function getLessonBySlug(slug: string): Promise<Lesson | null> {
  return (await q<Lesson>(`SELECT ${LESSON_COLUMNS} FROM lessons WHERE slug = $1`, [slug]))[0] ?? null;
}

export async function getLesson(id: string): Promise<Lesson | null> {
  return (await q<Lesson>(`SELECT ${LESSON_COLUMNS} FROM lessons WHERE id = $1`, [id]))[0] ?? null;
}

export type LessonInput = Omit<Lesson, "id">;

/** Creates a lesson, or updates the one with `id`. Returns its id. */
export async function saveLesson(id: string | null, input: LessonInput): Promise<string> {
  const values = [input.slug, input.title, input.summary, input.position, input.videoId, input.durationS, input.published, input.chapters];
  if (id) {
    await q(
      `UPDATE lessons SET slug = $2, title = $3, summary = $4, position = $5, video_id = $6, duration_s = $7, published = $8, chapters = $9, updated_at = now()
       WHERE id = $1`,
      [id, ...values],
    );
    return id;
  }
  const rows = await q<{ id: string }>(
    `INSERT INTO lessons (slug, title, summary, position, video_id, duration_s, published, chapters)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id::text`,
    values,
  );
  return rows[0].id;
}

export async function deleteLesson(id: string): Promise<void> {
  await q(`DELETE FROM lessons WHERE id = $1`, [id]);
}

/* ── Handouts ────────────────────────────────────────────────────────── */

export type LessonFile = { id: string; lessonId: string; title: string; objectKey: string; ext: string; bytes: number };

const FILE_COLUMNS = `id::text, lesson_id::text AS "lessonId", title, object_key AS "objectKey", ext, bytes::float8 AS bytes`;

export async function listLessonFiles(lessonId: string): Promise<LessonFile[]> {
  return q<LessonFile>(`SELECT ${FILE_COLUMNS} FROM lesson_files WHERE lesson_id = $1 ORDER BY id`, [lessonId]);
}

export async function getLessonFile(id: string): Promise<LessonFile | null> {
  return (await q<LessonFile>(`SELECT ${FILE_COLUMNS} FROM lesson_files WHERE id = $1`, [id]))[0] ?? null;
}

export async function addLessonFile(lessonId: string, title: string, objectKey: string, ext: string, bytes: number): Promise<void> {
  await q(`INSERT INTO lesson_files (lesson_id, title, object_key, ext, bytes) VALUES ($1, $2, $3, $4, $5)`, [
    lessonId,
    title,
    objectKey,
    ext,
    bytes,
  ]);
}

/** Removes the row and returns the object key, so the caller can delete the object too. */
export async function deleteLessonFile(id: string): Promise<string | null> {
  return (await q<{ objectKey: string }>(`DELETE FROM lesson_files WHERE id = $1 RETURNING object_key AS "objectKey"`, [id]))[0]?.objectKey ?? null;
}

/* ── Comments ────────────────────────────────────────────────────────── */

export type LessonComment = {
  id: string;
  parentId: string | null;
  learnerId: string | null;
  name: string | null;
  byAdmin: boolean;
  body: string;
  hidden: boolean;
  createdAt: string;
};

/** Oldest first, so a thread reads top to bottom. Hidden ones only for the organiser. */
export async function listComments(lessonId: string, includeHidden: boolean): Promise<LessonComment[]> {
  return q<LessonComment>(
    `SELECT c.id::text, c.parent_id::text AS "parentId", c.learner_id::text AS "learnerId", l.name,
            c.by_admin AS "byAdmin", c.body, c.hidden, c.created_at AS "createdAt"
     FROM lesson_comments c LEFT JOIN learners l ON l.id = c.learner_id
     WHERE c.lesson_id = $1 ${includeHidden ? "" : "AND NOT c.hidden"}
     ORDER BY c.created_at
     LIMIT 2000`,
    [lessonId],
  );
}

/**
 * A comment, or a reply to one on the same lesson. A `parentId` from another
 * lesson (or a hidden one) is refused rather than trusted from the form.
 */
export async function addComment(input: {
  lessonId: string;
  learnerId: string | null;
  byAdmin: boolean;
  parentId: string | null;
  body: string;
}): Promise<boolean> {
  if (input.parentId) {
    const parent = await q(`SELECT 1 FROM lesson_comments WHERE id = $1 AND lesson_id = $2 AND NOT hidden`, [input.parentId, input.lessonId]);
    if (!parent.length) return false;
  }
  await q(`INSERT INTO lesson_comments (lesson_id, learner_id, by_admin, parent_id, body) VALUES ($1, $2, $3, $4, $5)`, [
    input.lessonId,
    input.learnerId,
    input.byAdmin,
    input.parentId,
    input.body,
  ]);
  return true;
}

export async function setCommentHidden(id: string, hidden: boolean): Promise<void> {
  await q(`UPDATE lesson_comments SET hidden = $2 WHERE id = $1`, [id, hidden]);
}

/** Every comment across lessons, newest first, for the organiser to read and reply to. */
export async function listRecentComments(limit = 100): Promise<(LessonComment & { lessonSlug: string; lessonTitle: string })[]> {
  return q(
    `SELECT c.id::text, c.parent_id::text AS "parentId", c.learner_id::text AS "learnerId", l.name,
            c.by_admin AS "byAdmin", c.body, c.hidden, c.created_at AS "createdAt",
            s.slug AS "lessonSlug", s.title AS "lessonTitle"
     FROM lesson_comments c
     JOIN lessons s ON s.id = c.lesson_id
     LEFT JOIN learners l ON l.id = c.learner_id
     ORDER BY c.created_at DESC LIMIT $1`,
    [limit],
  );
}

/* ── Email codes ─────────────────────────────────────────────────────── */

/**
 * Stores a new code for an address, unless one was sent within the last
 * minute. Returns whether it was stored (and so may be sent).
 */
export async function storeEmailCode(email: string, codeHash: string): Promise<boolean> {
  const rows = await q(
    `INSERT INTO learn_email_codes (email, code_hash, sent_at, expires_at, attempts)
     VALUES ($1, $2, now(), now() + ($3 || ' milliseconds')::interval, 0)
     ON CONFLICT (email) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, sent_at = now(), expires_at = EXCLUDED.expires_at, attempts = 0
       WHERE learn_email_codes.sent_at < now() - ($4 || ' milliseconds')::interval
     RETURNING 1`,
    [email, codeHash, String(EMAIL_CODE_TTL_MS), String(EMAIL_CODE_RESEND_MS)],
  );
  return rows.length > 0;
}

export type CodeCheck = "ok" | "wrong" | "expired" | "locked";

/**
 * Checks a typed code. The attempt is counted before the comparison, in the
 * same statement that reads the row, so parallel guesses cannot each see
 * "attempts = 0". A correct code is deleted: it works once.
 */
export async function checkEmailCode(email: string, code: string): Promise<CodeCheck> {
  const rows = await q<{ codeHash: string; attempts: number; expired: boolean }>(
    `UPDATE learn_email_codes SET attempts = attempts + 1 WHERE email = $1
     RETURNING code_hash AS "codeHash", attempts, expires_at <= now() AS expired`,
    [email],
  );
  const row = rows[0];
  if (!row || row.expired) return "expired";
  if (row.attempts > EMAIL_CODE_MAX_ATTEMPTS) return "locked";
  if (!emailCodeMatches(email, code, row.codeHash)) return "wrong";
  await q(`DELETE FROM learn_email_codes WHERE email = $1`, [email]);
  return "ok";
}
