# PRODUCTION_SETUP.md — Configuring LunchBox for Production

Follow this top-to-bottom; no prior project knowledge required.

## 1. Prerequisites

- Node.js ≥ 18 and npm
- Google account with access to [Google Cloud Console](https://console.cloud.google.com)
- Chrome ≥ 116

## 2. Environment / configuration values

There are NO `.env` files — a Chrome extension ships static files. All
configuration lives in `public/manifest.json`:

| Value | Where | Notes |
| --- | --- | --- |
| `oauth2.client_id` | manifest | Your Web-application OAuth client ID |
| `key` | manifest | Pins the extension ID — NEVER change or remove |
| `version` | manifest + `package.json` + `src/constants` `APP_VERSION` | Keep in sync per release |

The extension ID is derived from `key`: **gghekejecnlabppaolhgkgpljilnjbnp**.
The private half of the key is `keys/extension-key.pem` (required only for
.crx packaging; keep it safe and out of public repos).

## 3. Google Cloud configuration (one-time)

1. Create/select a project.
2. **APIs & Services → Library** → enable **Google Tasks API**.
3. **OAuth consent screen**: External. For private/testing use, add every
   user's Google account under **Test users**. For public use, submit the
   consent screen for verification (scopes: tasks + userinfo.email).
4. **Credentials → Create OAuth client ID** → type **Web application** →
   Authorized redirect URI (exact, trailing slash):
   `https://gghekejecnlabppaolhgkgpljilnjbnp.chromiumapp.org/`
5. Copy the client ID into `public/manifest.json` → `oauth2.client_id`.

Scopes requested by the app (do not add more):
- `https://www.googleapis.com/auth/tasks`
- `https://www.googleapis.com/auth/userinfo.email`

## 4. Build

```bash
npm install
npm run build     # tsc strict + vite -> dist/
```

Build validation checklist:
- `tsc` exits 0 (build fails otherwise).
- `dist/` contains: `index.html`, `background.js`, `manifest.json`,
  `assets/` (main/mui/motion/vendor/xlsx chunks), `icons/`, `data/`.
- `dist/manifest.json` has the real `client_id` and the `key`.

## 5. Release checklist

1. Bump version in `package.json`, `public/manifest.json`, `src/constants/index.ts` (`APP_VERSION`).
2. `npm run build`; smoke-test via Load unpacked (log a meal, open Analytics, connect Google, Sync now).
3. Storage migrations: any new storage shape must have a seeding/migration
   flag (see `STORAGE_KEYS.*Seeded`) — never break existing users' data.
4. Tag/archive the build; for store releases see CHROME_WEBSTORE_PUBLISHING.md.

## 6. Production behavior notes

- `console.debug` diagnostics are compiled out of production builds
  (vite `esbuild.pure`); errors still surface via friendly UI messages.
- OAuth tokens are short-lived (~1 h), persisted in `chrome.storage.local`,
  refreshed silently, and interactively only on user-initiated actions.
- Consent screens left in "Testing" mode expire sessions more aggressively —
  users may need to press "Sync now" occasionally. Verified production
  consent screens don't have this restriction.
