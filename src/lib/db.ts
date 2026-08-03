import { Pool } from "pg";

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
  firstSession: string | null;
  source: string | null;
  lang: string;
  /** Turnstile verdict for this submission: verified / skipped / unavailable. */
  botCheck: string;
};

/**
 * Inserts a signup, or updates the existing row when we already know this
 * person. Re-submitting is treated as "I changed my details", never an error —
 * an error here would just make someone think they failed to sign up.
 *
 * Which column identifies them depends on what they gave us: the Chinese form
 * asks for a WeChat ID and the English one for an email, and either may be the
 * only thing present. Postgres cannot express "conflict on whichever of these
 * two is non-null" in one statement, so the conflict target is chosen here.
 */
export async function saveSignup(input: SignupInput): Promise<void> {
  await ensureSchema();

  const conflictColumn = input.email ? "lower(email)" : "lower(wechat)";

  await getPool().query(
    `
    INSERT INTO signups (name, email, wechat, building, demo_intent, first_session, source, lang, bot_check)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (${conflictColumn}) DO UPDATE SET
      name          = EXCLUDED.name,
      email         = COALESCE(EXCLUDED.email, signups.email),
      wechat        = COALESCE(EXCLUDED.wechat, signups.wechat),
      building      = COALESCE(EXCLUDED.building, signups.building),
      demo_intent   = EXCLUDED.demo_intent,
      first_session = EXCLUDED.first_session,
      source        = COALESCE(EXCLUDED.source, signups.source),
      lang          = EXCLUDED.lang,
      bot_check     = EXCLUDED.bot_check,
      updated_at    = now()
    `,
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
    ],
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
  created_at: string;
};

export async function listSignups(): Promise<SignupRow[]> {
  await ensureSchema();

  const result = await getPool().query<SignupRow>(
    `SELECT id, name, email, wechat, building, demo_intent,
            to_char(first_session, 'YYYY-MM-DD') AS first_session,
            source, lang, bot_check,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     FROM signups
     ORDER BY created_at DESC`,
  );

  return result.rows;
}
