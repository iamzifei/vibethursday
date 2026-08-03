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
| `DATABASE_SSL` | no | Set to `require` only if the database stops being reachable over the private network |

## Local development

```bash
pnpm install
echo 'DATABASE_URL=postgresql://...' > .env.local
echo 'ADMIN_TOKEN=anything-long' >> .env.local
pnpm dev
```

The `signups` table is created on the first write, so there is no migration
step. See `ensureSchema` in `src/lib/db.ts`.

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
