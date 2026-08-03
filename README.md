# Vibe Thursday

Signup site for a weekly AI builders meetup in Sydney — every Thursday, 3–6pm,
Sydney CBD.

Chinese-first with an English view at `/?lang=en`. Collects an email and,
because most announcements currently go through a WeChat group, an optional
WeChat ID.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| App | Next.js 16, App Router, `output: "standalone"` | Small container on a shared host |
| Database | Postgres, `pg` driver, no ORM | One table; an ORM would be more machinery than schema |
| Styling | Plain CSS custom properties | The design tokens are the design system |
| Hosting | Zeabur, Tencent Singapore server | Closest available region to Sydney with no ICP filing |

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | On Zeabur set it to `${postgresql.POSTGRES_CONNECTION_STRING}` so the password is never copied around |
| `ADMIN_TOKEN` | yes | Long random string. Guards `/admin` and the CSV export; without it those routes stay closed |
| `NEXT_PUBLIC_SITE_URL` | recommended | Absolute site URL, e.g. `https://vibethursday.com`. Without it Open Graph image URLs resolve against localhost |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | recommended | Turnstile site key. Read at **build** time, so changing it needs a redeploy, not a restart |
| `TURNSTILE_SECRET_KEY` | recommended | Turnstile secret. Without it signups still work but nothing is verified; `/admin` says so plainly |
| `FIRST_SESSION_DATE` | no | `YYYY-MM-DD` of the first session that actually runs. Earlier Thursdays are not offered |
| `DATABASE_SSL` | no | Set to `require` only if the database stops being reachable over the private network |

## Local development

```bash
pnpm install
cp .env.example .env.local   # then fill in DATABASE_URL
pnpm dev
```

`.env.example` ships Cloudflare's published Turnstile test pair, which always
passes. Swap the secret to `2x0000000000000000000000000000000AA` to exercise
the rejection path.

The `signups` table is created on the first write, so there is no migration
step. See `ensureSchema` in `src/lib/db.ts`.

## Bot protection

Two layers on the signup form:

1. A honeypot field, hidden from sighted users and skipped by screen readers
   and keyboard tabbing, so only automated submissions fill it. A hit returns
   200 so the bot records success and does not retry with a different shape.
2. Cloudflare Turnstile in managed mode, verified server-side.
3. A fixed-window rate limit of 6 submissions per IP per hour.

**Turnstile is advisory, not mandatory.** A submission carrying no token is
accepted and recorded as `bot_check = skipped`; only a token that is present
*and* invalid gets a 403. The submit button is never disabled by the challenge.

This is deliberate, and it replaced a stricter design that broke a real signup.
The widget does not complete in every browser — WeChat's in-app browser is the
case that hit us, and WeChat is this community's main sharing channel. Blocking
the button on the challenge meant a stuck spinner became an unusable form, and
the request never even reached the server. On a form with no account and no
payment behind it, trading real signups for spam protection is the wrong way
round; spam rows are trivially deletable, lost signups are not.

`/admin` shows how many rows are unverified so the true rate is visible rather
than assumed.

## Viewing signups

`/admin?key=$ADMIN_TOKEN` lists everyone and links to a CSV export. The page is
`noindex` and the key is compared in constant time.

## Regenerating the artwork

Both steps are manual and their output is committed — neither runs during a
build.

```bash
OPENAI_API_KEY=... node scripts/generate-images.mjs   # gpt-image-2 → art/
./scripts/build-og.sh                                 # art/ + real text → public/og.jpg
```

The generated images are deliberately textless. Every character on the site,
including the social card, is drawn as real text so nothing depends on an image
model spelling correctly. `build-og.sh` needs Inter, Geist Mono and a
standalone PingFang SC `.ttf` installed locally.

## Content

All copy lives in `src/lib/content.ts`, both languages side by side. Changing
the wording never means touching a component.
