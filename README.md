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
| Database | Postgres, `pg` driver, no ORM | Three tables; an ORM would be more machinery than schema |
| Styling | Plain CSS custom properties | The design tokens are the design system |
| Hosting | Zeabur, Tencent Singapore server | Closest available region to Sydney with no ICP filing |

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | On Zeabur set it to `${postgresql.POSTGRES_CONNECTION_STRING}` so the password is never copied around |
| `ADMIN_TOKEN` | yes | Long random string. Guards `/admin` and the CSV export; without it those routes stay closed. Also signs member cookies unless `MEMBER_SECRET` is set |
| `MEMBER_SECRET` | no | Separate signing key for member sign-in cookies. Falls back to `ADMIN_TOKEN`. Changing it signs everyone out |
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

## The member wall

`/members` is the community's own page: everyone who has come, and what they are
working on. It exists because all of this used to be posted into a WeChat group
and become unfindable within days.

**The subject of a card is a person, not a product.** A member has zero or more
*assets* hanging off them — a product, a business, a media account, a community,
a profile link — and a card with none of them is a complete card. That is the
whole design: if only people with shipped products could appear, most of the
room would never fill one in, and an empty wall is worse than no wall.

For the same reason a product carries a **stage** (idea / runs locally / beta /
live / making money) rather than a requirement to be online. "Runs on my laptop"
is a legitimate thing to show at a builders' meetup — arguably a better
conversation than "shipped", because it means the person is stuck on something
someone at the table may have already solved.

Two fields do most of the work: **looking for** and **can help with**. Without
them the wall is a directory; with them it is how people get matched. They are
also the free experiment that decides whether a paid Q&A feature is ever worth
building — see `docs/design/2026-08-09-member-wall-and-paid-qa.md`.

### Claiming

There is no registration anywhere on this site. A card can only be reached
through an existing signup:

1. `/claim` takes the name and the email **or** WeChat ID used when signing up.
2. On a match the draft card is created, **prefilled from what that person
   already wrote** in the signup form (`building` → bio, `topic` → looking for).
3. A signed cookie (six months) is set and `/me` becomes editable.
4. Nothing appears on the wall until they publish.

The match is a soft check on purpose. This project has no mail sender, so a
one-time link would mean standing up mail infrastructure first, and the worst
case is that someone who already knows both your name and your WeChat ID edits
a page you were about to publish anyway — recoverable from `/admin`. The claim
endpoint shares the signup form's rate limiter so it cannot be used to
enumerate who has signed up.

Sorting on the wall is by **most recent session**, never by votes. This answers
"who is around this Thursday", which is what a weekly meetup needs; ranking it
would quietly turn it into a popularity contest.

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
