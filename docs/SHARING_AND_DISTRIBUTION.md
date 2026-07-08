# SHARING_AND_DISTRIBUTION.md — Ways to Share LunchBox

## Option 1 — Load unpacked (developers)

Send the `dist/` folder. Recipient: `chrome://extensions` → Developer mode →
Load unpacked → select folder.

- ✅ Instant, free, full functionality (extension ID is pinned, so OAuth works)
- ❌ "Developer mode" banner; removed if they clean dev extensions; folder must stay on disk

## Option 2 — ZIP package (friends, manual install)

```bash
cd dist && zip -r ../lunchbox.zip .
```
Recipient unzips to a permanent folder, then follows Option 1 steps.

- ✅ Easy to email/share; identical behavior to Option 1
- ❌ Same developer-mode caveats; no auto-updates — you re-send ZIPs

Friend setup note: for Google Tasks sync, each friend's Google account must
be added under **Test users** in your Cloud Console consent screen (up to
100), or the consent screen must be verified for production.

## Option 3 — CRX package

Pack via `chrome://extensions` → "Pack extension" (uses `keys/extension-key.pem`).

- ✅ Single signed file
- ❌ Chrome BLOCKS crx installs outside the Web Store on Windows/macOS
  (only enterprise policy or Linux dev installs work). Practically obsolete —
  not recommended.

## Option 4 — Chrome Web Store (recommended)

See CHROME_WEBSTORE_PUBLISHING.md. Use **Unlisted** visibility for a private
circle: anyone with the link installs normally, gets auto-updates, no
developer mode.

- ✅ Auto-updates, no warnings, one link, trusted install flow
- ❌ $5 one-time fee, review delays, privacy policy required

## Comparison

| | Unpacked | ZIP | CRX | Web Store |
| --- | --- | --- | --- | --- |
| Ease for non-devs | ✖ | ◐ | ✖ | ✔ |
| Auto-updates | ✖ | ✖ | ✖ | ✔ |
| No dev-mode warning | ✖ | ✖ | ✖ | ✔ |
| Cost | free | free | free | $5 once |
| OAuth sync works | ✔ | ✔ | ✔ | ✔ (same pinned ID) |
