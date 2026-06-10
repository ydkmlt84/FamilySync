# FamilySync

FamilySync is a standalone self-hosted companion application for Maintainerr. It lets Plex users voluntarily link their account so FamilySync can collect each user's Plex `userRating`, aggregate those ratings, and optionally tag protected movies in Radarr or protected series in Sonarr. It uses SQLite through `better-sqlite3`.

## Project structure

```text
app/
  server/
    src/
  ui/
    src/
      components/
```

The NestJS API lives in `app/server/src`. The React application lives in
`app/ui/src`, with reusable UI sections under `app/ui/src/components`.

## Proof Confirmed

The initial POC confirmed the required Plex behavior:

- A generic non-admin Plex account token returned `401` against the local PMS metadata endpoint.
- The server-specific `accessToken` returned by `https://plex.tv/api/resources` succeeded.
- The same Plex movie `ratingKey` returned different `userRating` values for different users.

FamilySync therefore stores the server-specific Plex resource token in `LinkedUser.plexToken` for PMS metadata calls. The generic Plex account token is also stored as `plexAccountToken` so server resources can be rediscovered later.

## Configuration

The only required setting is the database encryption key. Copy `.env.example`
to `.env` and set:

```powershell
APP_ENCRYPTION_KEY=a-random-secret-with-at-least-32-characters
```

Generate one on Windows or Linux with Docker:

```powershell
docker run --rm node:24-alpine node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the printed value into `APP_ENCRYPTION_KEY`. Everything else — the Plex
server connection, libraries, Radarr/Sonarr, and rating thresholds — is
configured in the first-run setup wizard and the in-app admin settings.

`APP_ENCRYPTION_KEY` encrypts Plex tokens and Radarr/Sonarr settings in SQLite
using AES-256-GCM. Existing plaintext values are migrated automatically at
startup. Back up this key separately: losing or changing it makes stored
secrets unrecoverable.

For HTTPS deployments, set `PUBLIC_URL` to the externally visible HTTPS URL.
FamilySync then marks its session cookie `Secure`. When TLS terminates at a
reverse proxy, `COOKIE_SECURE=true` can explicitly enforce this behavior and
`TRUST_PROXY=true` trusts the first proxy's forwarded headers.

To rotate the key, set the new value as `APP_ENCRYPTION_KEY` and temporarily
set the old value as `APP_ENCRYPTION_KEY_PREVIOUS`. Start FamilySync once to
re-encrypt stored secrets, then remove `APP_ENCRYPTION_KEY_PREVIOUS`. Back up
the database before rotating.

### First-run setup wizard

On first launch FamilySync shows a setup wizard:

1. **Link Plex** — sign in with the Plex account that _owns_ the server you want
   FamilySync to manage. The first owner to link becomes the administrator; a
   non-owner cannot claim the instance. (There is no setup token — the
   Plex-ownership check is the gate.)
2. **Choose server connection** — FamilySync auto-discovers the server's Plex
   connection URLs. Pick one (or enter a URL manually), test it, and save. That
   URL is stored in the database and used for all Plex Media Server calls.

The selected server identifier is persisted, so every future linked user must
have access to that same server. If the owner account owns more than one Plex
server, choosing among them is not yet supported.

Admin access is based on the linked Plex account. The Plex server admin account can manage linked users, choose Plex movie and TV libraries, configure Radarr/Sonarr connections, and force sync; non-admin linked users can view cached rated media.

TV support includes Plex shows, seasons, and episodes from selected TV libraries. Radarr tags movies by TMDB ID. Sonarr tags series by TVDB ID when a protected show, season, or episode can be matched back to a Sonarr series.

FamilySync stores local development data under `data` by default:

```text
data/
  familysync.sqlite
  logs/
    familysync.log
```

Set `CONFIG_DIR` to move both defaults in non-Docker installations. The Docker
image uses `/config` automatically. Logs are written to both stdout and
rotating files. Five 5 MB rotated files are retained.

Plex metadata refresh is enabled weekly by default at 4:00 AM Sunday. It
refreshes cached titles, posters, season/episode indexes, and external IDs
without changing rating values or their freshness timestamps. Administrators
can change the schedule or run it immediately from the Jobs page.

## Development

```powershell
yarn install
yarn dev
```

Internal development API: `http://localhost:3000/api`

Web UI: `http://localhost:6614`

Or run the development servers in separate terminals:

```powershell
yarn dev:server
```

```powershell
yarn dev:web
```

### Reset The Setup Wizard

To test first-run setup again, stop the development server and run:

```powershell
yarn dev:reset
```

Type `reset` when prompted. The command moves the current SQLite database and
any WAL sidecars into `data/backups` with a timestamp, then the setup wizard
runs when FamilySync starts again. For automated local testing:

```powershell
yarn dev:reset --yes
```

The command refuses `NODE_ENV=production` and database paths outside the
workspace by default.

### Quality Checks

Run the complete validation pipeline after changes:

```powershell
yarn check
```

This checks formatting, lint rules, TypeScript, coverage thresholds,
unit/component tests, and both production builds. Coverage must remain at or
above 30% for statements, functions, and lines, with at least 15% branch
coverage. Individual commands are also available:

```powershell
yarn test
yarn test:watch
yarn test:coverage
yarn lint
yarn format
yarn format:check
yarn typecheck
yarn build
```

## Brand Assets

Drop image files into `public` using these paths:

- `public/assets/logo.png` - header logo shown in the app.
- `public/favicon/favicon.ico` - browser favicon fallback.
- `public/favicon/favicon.svg` - SVG browser favicon.
- `public/favicon/apple-touch-icon.png` - Apple touch icon.

The logo falls back to the default FamilySync icon if `logo.png` is missing.

## REST API

```http
GET /api/media/carousel
GET /api/media/carousel/:ratingKey/poster
GET /api/media/:ratingKey (authenticated)
GET /api/users
DELETE /api/users/:id
POST /api/sync
POST /api/sync/metadata
```

## Docker

```powershell
Copy-Item .env.example .env
# set APP_ENCRYPTION_KEY in .env, then:
docker compose up -d
```

`docker-compose.yml` pulls the published image
(`ghcr.io/ydkmlt84/familysync:main`); to build locally instead, comment out
`image:` and uncomment `build: .`. FamilySync listens on port `6614`. The
Docker image stores runtime data in `/config` automatically, and SQLite plus
rotating logs are persisted in the mounted volume:

```text
/config/familysync.sqlite
/config/logs/familysync.log
```
