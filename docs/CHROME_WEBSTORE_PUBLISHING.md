# CHROME_WEBSTORE_PUBLISHING.md — Publishing LunchBox to the Chrome Web Store

## 1. Build & package

```bash
npm run build
cd dist && zip -r ../lunchbox-v1.4.0.zip . && cd ..
```

Upload the ZIP (not a .crx). Note: the store assigns its own extension ID
unless you upload the `key`-pinned package — since our manifest contains
`key`, the store item keeps ID `gghekejecnlabppaolhgkgpljilnjbnp`, so the
OAuth redirect URI keeps working. Do not remove `key` before uploading.

## 2. Developer account

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in and pay the **one-time \$5 registration fee**.
3. Verify your email/publisher details.

## 3. Assets to prepare BEFORE submission

| Asset | Requirement |
| --- | --- |
| Icon | 128×128 PNG (already in `dist/icons/icon128.png`) |
| Screenshots | 1–5, 1280×800 or 640×400 PNG/JPG. Capture: dashboard+calendar, log dialog, analytics, manage categories, settings/sync |
| Small promo tile | 440×280 (optional but recommended) |
| Marquee promo | 1400×560 (optional) |
| Description | Short (≤132 chars) + detailed listing text |
| Privacy policy URL | REQUIRED because the extension uses OAuth/user data — host a page stating: data stays in local browser storage; Google account used only for optional Tasks sync; no data sold/shared |

Suggested short description:
> Log daily meals with nutrition, goals, analytics and confetti — optionally synced to Google Tasks.

## 4. Store listing

1. Dashboard → **New item** → upload the ZIP.
2. Fill Store Listing (description, category "Productivity" or "Lifestyle", screenshots, promo images).
3. Privacy tab:
   - Single purpose: personal meal & nutrition logging.
   - Permissions justification:
     - `storage` — save meals/logs/settings locally.
     - `identity` — optional Google sign-in for Tasks sync.
     - host `tasks.googleapis.com` / `www.googleapis.com` / `accounts.google.com` — Google Tasks sync API calls and sign-out revocation.
   - Declare OAuth scopes (tasks, userinfo.email) and link the privacy policy.
4. Distribution: Public, Unlisted (link-only) or Private (your domain). **Unlisted** is ideal for friends & family.

## 5. Review & publishing

- Submit for review. Typical: a few hours to a few days (longer because of
  OAuth scopes; the Tasks scope is sensitive — Google may ask for a demo
  video or verification of the consent screen).
- Consent screen verification (Cloud Console) is a separate process from
  store review; for public release complete both.

## 6. Releasing updates

1. Bump `version` in manifest (+ package.json + APP_VERSION).
2. `npm run build`, zip `dist/`, upload as a new package on the existing item.
3. Submit; users update automatically within hours of approval.
