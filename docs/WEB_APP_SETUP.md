# WEB_APP_SETUP.md — Supabase, local development and Vercel

The web app (PWA), named **Tracker**, lives in `web/` and shares `src/` (models) with
the Chrome extension. The extension build (`npm run build`) is unchanged.

**Node 20 or newer is required** for the web build. The service-worker
generator (workbox) fails on Node 19 with
`tracingChannel is not a function`. Vercel uses Node 20+ (pinned through
`engines` in package.json and `.nvmrc`).

## 1. Create the Supabase project (one time)

1. Sign in at https://supabase.com and create a project on the free tier.
   Pick a region near you (for example Mumbai, `ap-south-1`).
2. Open **SQL Editor**, paste `supabase/migrations/0001_app_settings.sql`,
   and run it.
3. Open **Authentication → URL Configuration**:
   - **Site URL:** your Vercel production URL (after step 3 below).
   - **Redirect URLs:** add `http://localhost:5174/**`, your production URL
     followed by `/**`, and `https://*-<your-vercel-team>.vercel.app/**`
     for preview deployments.
4. Skip the email template. Supabase locks template editing until custom
   SMTP is configured, and the default email's link is enough. Request the
   link on the device you want to sign in on, and open it there. On Android,
   a link opened in Chrome also signs in the installed app, because they
   share storage. The built-in email sender allows only a few emails per
   hour, so request links sparingly. (Optional later: set up custom SMTP,
   for example Gmail with an app password, then add
   `Your code: {{ .Token }}` to the Magic Link template to enable the
   6-digit code box.)
5. After your first successful sign-in, turn off **Authentication →
   Providers → Email → Allow new users to sign up**. The app is single-user;
   Row Level Security already limits every row to its owner.
6. **Project Settings → API:** copy the Project URL and the `anon` public key.

Note: free projects pause after about a week with no activity. Restore
them from the dashboard. No data is lost.

## 2. Local development

```bash
cp .env.example .env.local   # then paste the URL and anon key
npm run dev:web              # http://localhost:5174
```

`npm test` runs every unit test (extension and web).

## 3. Vercel

1. Vercel → **Add New → Project** → import `Phushyamithra/Lunch-box`.
   The repo is private, so allow Vercel's GitHub app to access it.
2. Settings come from `vercel.json`: build `npm run build:web`, output
   `dist-web`. Leave the framework preset as **Other**.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings →
   Environment Variables**, for both Production and Preview.
4. Under **Settings → Git**, set the production branch to `main`. Pushes to
   `dev` then get preview URLs and never touch production.

## 4. Checking cross-device sync

1. Sign in on the laptop and on the phone with the same email.
2. Change the theme on one device. Reload the other: it should follow.
3. Turn on airplane mode on one device and change the theme. The header
   shows the offline icon. Reconnect, and the change syncs.

## Data boundaries

| Data | Where |
| --- | --- |
| UI settings | Supabase `app_settings`, RLS-scoped to your user |
| Food, fitness (later phases) | Supabase, RLS-scoped |
| Finance (phase 4) | IndexedDB on the device; synced only as client-side-encrypted ciphertext |
| Extension data | `chrome.storage.local`, untouched until the phase 2 import |
