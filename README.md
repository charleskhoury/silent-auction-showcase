# Silent Auction

A small, self-contained **silent auction** web app for a fundraising gala.
Guests bid from their phones at the table; the current high bid updates live.
Winners settle in person with the organising committee — **there is no payment
processing** (no cards, no Stripe, no PCI scope).

> **This is a sanitised public copy of a private production project.** All real
> names, domains, email addresses, credentials, keys and images have been
> replaced with obvious placeholders (`example.org`, `admin@example.org`,
> `CHANGE_ME`, a neutral gradient background, a fictional "Riverside Community
> Gala"). It is published as a portfolio sample; it is not the live service and
> ships with no real data or secrets.

---

## What it does

- **Guests** register once with *name + mobile + 4-digit PIN* (not Google). An
  HMAC-signed, httpOnly cookie keeps them signed in on that device; the PIN
  reclaims the same identity on another device (mobile is unique).
- **Bidding** is validated server-side: a bid must meet the *minimum next bid*
  (starting price, or current high + increment), you can't raise against
  yourself, and each item can be Open / Closed by an admin. An optional soft
  deadline with **anti-snipe** extends the close time when a bid lands in the
  final window.
- **Live view**: the public board polls `/api/items` every 3 seconds (chosen
  over SSE/WebSocket so it is bulletproof behind a CDN/proxy — no held
  connections).
- **Admins** (committee) sign in with **Google OAuth** restricted to an email
  allowlist. They create/edit items, upload photos, open/close bidding, view
  every bid with the bidder's real name + mobile, declare/clear winners, export
  a CSV, and read an audit log.
- **Privacy**: the public leaderboard masks surnames (`Alex T.`) or shows
  `Anonymous` if the bidder opted out. Admins always see full details.

## Architecture

| Layer      | Choice                                                            |
|------------|-------------------------------------------------------------------|
| Framework  | Next.js 15 (App Router, standalone output, server components)     |
| Language   | TypeScript (strict)                                               |
| Data       | PostgreSQL 16 via Prisma ORM                                      |
| Admin auth | Auth.js (NextAuth v5) — Google provider, email allowlist          |
| Guest auth | Custom HMAC-signed httpOnly cookie (`src/lib/bidderSession.ts`)    |
| Styling    | Tailwind CSS v4                                                   |
| Logging    | pino (redacts email / mobile / PIN)                               |
| Runtime    | Docker Compose (`app` + `postgres`)                              |

Notable implementation details:

- **Bids are placed in a row-locked transaction** (`SELECT … FOR UPDATE` on the
  item in `src/lib/auction.ts`), so two simultaneous bids are serialised and
  can't tie.
- **Item photos are stored as bytes in the database** (`Item.imageData`, served
  via `/api/items/:id/image`), not on a volume, so a container rebuild never
  loses them. Fine for a handful of items; revisit for large catalogues.
- **Money is integer cents** end to end (`src/lib/money.ts`) to avoid
  floating-point rounding.
- **Strict CSP with a per-request nonce** is set in `src/middleware.ts` (a
  static strict CSP would block Next.js's inline hydration scripts).
- **Defense in depth**: `/admin` and `/api/admin/*` are gated in middleware
  *and* re-checked in every handler.

```
src/
  app/            # routes: public page, /admin, /api/*
  components/     # public board + admin UI + shared UI primitives
  lib/            # auction rules, money, validation, auth, sessions, db
  middleware.ts   # admin gate + per-request CSP nonce
prisma/           # schema + migrations
docker/           # Dockerfile + entrypoint (runs prisma migrate deploy)
```

## Setup (local development)

Requirements: Node.js ≥ 20 and a PostgreSQL database.

```bash
npm ci
cp .env.example .env          # then fill in the values (see below)
npx prisma generate
npx prisma migrate deploy     # or `npm run prisma:migrate` for dev migrations
npm run dev                   # http://localhost:3000
```

### Environment variables

Copy `.env.example` to `.env` and set each value. **Never commit `.env`** — it
is gitignored.

| Variable                 | Purpose                                                        |
|--------------------------|----------------------------------------------------------------|
| `DATABASE_URL`           | Postgres connection string                                     |
| `POSTGRES_USER/PASSWORD/DB` | Used by Compose to initialise the DB container              |
| `GOOGLE_CLIENT_ID/SECRET`| Google OAuth client for admin sign-in                          |
| `AUTH_SECRET`            | Auth.js signing secret — `openssl rand -base64 32`             |
| `AUTH_URL`               | Exact public origin, e.g. `https://auction.example.org`        |
| `ALLOWED_ADMIN_EMAILS`   | Comma-separated admin emails allowed into `/admin`             |
| `ALLOWED_GOOGLE_DOMAIN`  | *(optional)* allow any account on this Workspace domain        |
| `BIDDER_SESSION_SECRET`  | HMAC secret for the guest cookie — `openssl rand -base64 32`   |
| `NODE_ENV` / `LOG_LEVEL` | `production` / pino level                                      |

For admin login to work you must also add the callback URL
`https://<your-host>/api/auth/callback/google` to the OAuth client's authorised
redirect URIs in Google Cloud Console.

## Docker Compose

The stack is an app container plus a Postgres container. The app's entrypoint
runs `prisma migrate deploy` on start, so the schema is applied automatically.

```bash
cp .env.example .env          # fill in real values first
docker compose up -d --build
docker compose logs -f auction
```

> The committed `docker-compose.yml` attaches to an external network named
> `cosmos` (the production host convention). For a standalone run, remove the
> `networks:` blocks (or create the network with
> `docker network create cosmos`).

Health check: `GET /api/health` returns `{"status":"ok"}` when the DB is
reachable.

## Deployment

1. Provision a host with Docker and a reverse proxy that terminates TLS
   (production uses Caddy; any proxy works). The app listens on `:3000` and
   expects TLS to be terminated in front of it.
2. Create `.env` with production values (fresh `AUTH_SECRET` and
   `BIDDER_SESSION_SECRET`, a strong DB password, the OAuth client, and the
   committee email allowlist).
3. Point a DNS record at the host and proxy the chosen hostname to the app
   container's port 3000.
4. Add the production callback URL to the Google OAuth client.
5. `docker compose up -d --build`. Migrations apply on container start; the
   singleton settings row self-seeds on first request.

## Testing

Unit tests (Vitest) cover the money helpers, the Zod validation schemas, and
the auction/bid rules (including a mocked-transaction test of `placeBid`).

```bash
npm test          # run once
npm run test:watch
```

## Continuous integration

- **`.github/workflows/ci.yml`** — on every pull request and push to `main`:
  `npm ci` → `prisma generate` → lint → typecheck → test → Docker build.
- **`.github/workflows/security.yml`** — gitleaks secret scan, Trivy image
  vulnerability scan, and CodeQL (JS/TS) analysis, on PR/push and weekly.
- **`.github/dependabot.yml`** — weekly dependency updates for npm, Docker and
  GitHub Actions.

> The gitleaks action runs without a licence key on public repositories; for a
> private org repo, set a `GITLEAKS_LICENSE` secret.

## Security notes

- **No secrets in the repo.** `.env` is gitignored; `.env.example` contains only
  placeholders. A gitleaks scan runs in CI and over full history.
- **No payment data** is ever collected or stored — settlement is in person, so
  the app holds no card/PCI data.
- **Admin access** is OAuth + an explicit email allowlist, enforced in
  middleware and again in every admin handler (defense in depth).
- **Guest sessions** use an HMAC-signed, httpOnly, `secure`, `SameSite=Lax`
  cookie; PINs are stored only as bcrypt hashes.
- **Input validation** is centralised with Zod (`src/lib/validation.ts`); money
  is handled as integer cents to avoid rounding bugs.
- **Hardening headers**: strict per-request-nonce CSP, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, a restrictive `Permissions-Policy`, HSTS in
  production, and `noindex` (the site is not meant to be crawled).
- **Logs are redacted** (pino strips email, mobile, PIN, cookies).

### Sanitisation note

This public copy was produced by copying the private source into a fresh
repository (no original Git history), removing `.env`, build output, uploaded
images and dependencies, and replacing every real identifier — domains, emails,
Google client IDs, organisation/member names, credentials and the background
image — with placeholders. Do not treat any value here as a real credential.
