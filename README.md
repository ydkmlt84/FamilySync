# FamilySync

FamilySync is a standalone self-hosted companion application for Maintainerr. It lets Plex users voluntarily link their account so FamilySync can collect each user's Plex `userRating`, aggregate those ratings, and optionally tag protected movies in Radarr or protected series in Sonarr. It uses SQLite through `better-sqlite3`.

## Proof Confirmed

The initial POC confirmed the required Plex behavior:

- A generic non-admin Plex account token returned `401` against the local PMS metadata endpoint.
- The server-specific `accessToken` returned by `https://plex.tv/api/resources` succeeded.
- The same Plex movie `ratingKey` returned different `userRating` values for different users.

FamilySync therefore stores the server-specific Plex resource token in `LinkedUser.plexToken` for PMS metadata calls. The generic Plex account token is also stored as `plexAccountToken` so server resources can be rediscovered later.

## Configuration

Copy `.env.example` to `.env` and set at least:

```powershell
PLEX_BASE_URL=https://your-plex-direct-url:32400
PUBLIC_URL=http://localhost:5174
SETUP_TOKEN=a-random-secret-with-at-least-32-characters
APP_ENCRYPTION_KEY=a-separate-random-secret-with-at-least-32-characters
```

`SETUP_TOKEN` protects a fresh instance from being claimed by an unauthorized
Plex server owner. Enter it in the initial setup field before linking the first
administrator. FamilySync permanently disables setup-token use after the
instance is initialized. Existing installations with an administrator are
recognized automatically. As an alternative, preconfigure the trusted account
with `PLEX_ADMIN_USER_ID`.

`APP_ENCRYPTION_KEY` encrypts Plex tokens and Radarr/Sonarr settings in SQLite
using AES-256-GCM. Existing plaintext values are migrated automatically at
startup. Back up this key separately: losing or changing it makes stored
secrets unrecoverable. Generate independent setup and encryption secrets; do
not reuse the same value.

To rotate the key, set the new value as `APP_ENCRYPTION_KEY` and temporarily
set the old value as `APP_ENCRYPTION_KEY_PREVIOUS`. Start FamilySync once to
re-encrypt stored secrets, then remove `APP_ENCRYPTION_KEY_PREVIOUS`. Back up
the database before rotating.

Server selection:

- Preferred: set `PLEX_SERVER_IDENTIFIER` to the Plex server `clientIdentifier`.
- Or: link the Plex server admin account first. FamilySync will persist that admin-owned server identifier and require all future linked users to have access to that same server.

If an admin account owns multiple Plex servers and `PLEX_SERVER_IDENTIFIER` is not set, linking fails until the target server is configured.

Admin access is based on the linked Plex account. The Plex server admin account can manage linked users, choose Plex movie and TV libraries, configure Radarr/Sonarr connections, and force sync; non-admin linked users can view cached rated media.

TV support includes Plex shows, seasons, and episodes from selected TV libraries. Radarr tags movies by TMDB ID. Sonarr tags series by TVDB ID when a protected show, season, or episode can be matched back to a Sonarr series.

FamilySync stores local development data under `data` by default:

```text
data/
  familysync.sqlite
  logs/
    familysync.log
```

Set `CONFIG_DIR` to move both defaults, or override `DATABASE_PATH` and
`LOG_PATH` individually. Logs are written to both stdout and rotating files.
Five 5 MB rotated files are retained.

Plex metadata refresh is enabled weekly by default at 4:00 AM Sunday. It
refreshes cached titles, posters, season/episode indexes, and external IDs
without changing rating values or their freshness timestamps. Administrators
can change the schedule or run it immediately from the Jobs page.

## Development

```powershell
yarn install
yarn dev
```

API: `http://localhost:3000/api`

Web UI: `http://localhost:5174`

Or run the development servers in separate terminals:

```powershell
yarn dev:server
```

```powershell
yarn dev:web
```

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
docker compose up --build
```

The container sets `CONFIG_DIR=/config`. SQLite and rotating logs are persisted
in the `familysync-config` volume:

```text
/config/familysync.sqlite
/config/logs/familysync.log
```
