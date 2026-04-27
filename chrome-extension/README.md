# ODM Integration (Chrome / Edge / Brave / Chromium / Firefox)

Captures downloads from the browser and routes them to the local ODM
desktop app, the same way IDM Integration Module does. Works for direct
links and for downloads triggered through a click or redirect.

## How it works

1. The ODM desktop app installs a Chrome Native Messaging host for the
   fixed extension ID `fnmhbcgfgoaghnknfdeehccahpepkngm`.
2. The browser extension captures direct download clicks before navigation,
   watches download response headers through `webRequest`, and keeps
   `chrome.downloads.onCreated` only as a fallback.
3. The extension forwards URL, filename, size, referer, cookies and
   user-agent through the native bridge so ODM can make the first real
   download request itself.
4. ODM creates the download with the rate limiter and download settings
   configured in the desktop app.

## Install

### 1. Run ODM desktop at least once

Open ODM once before installing or reloading the extension. This installs
the native bridge Chrome needs.

### 2. Load the extension unpacked

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and pick this `chrome-extension/` folder.
4. Confirm Chrome shows extension ID `fnmhbcgfgoaghnknfdeehccahpepkngm`.

### 3. Verify the bridge

Click the extension toolbar icon. The popup should show **Connected**
along with the local backend URL. If it says **ODM not running**, start
the desktop app and reload the extension.

## Usage

- Direct download clicks are stopped before Chrome spends the URL, then
  sent to ODM with the same cookies, referer and user-agent.
- Downloads detected only after Chrome creates a download item still use
  the fallback path and are cancelled as quickly as Chrome allows.
- Right-click a link or a page → **Send link to ODM** / **Send page URL
  to ODM** to enqueue manually.
- Use the popup toggle to disable interception temporarily.
- Open **Settings** to tune the minimum size, the allowed extension
  list, excluded hosts and excluded MIME types.

## Filters (defaults)

- Minimum size: **0 KB**
- Always intercept: archives (zip/rar/7z/...), iso/dmg/pkg, exe/msi/deb/rpm,
  video/audio, pdf and epub.
- Skipped hosts: `mail.google.com`, `docs.google.com`, `drive.google.com`.
- Skipped MIME: `text/html`, `application/xhtml+xml`.

Edit any of these in the options page.

## Troubleshooting

- **Popup says “Bridge unreachable”** — open ODM once, then reload the
  extension. ODM installs the native host used by Chrome.
- **Popup says “ODM not running”** — open the ODM desktop app.
- **Downloads still happen in Chrome** — open the extension popup and
  confirm the toggle is on. Files smaller than the minimum size and not
  on the allow list stay in Chrome.
- **Some redirect-only downloads still touch Chrome first** — normal
  Chrome Manifest V3 does not allow consumer extensions to block every
  response-level request. Direct clicks are intercepted before Chrome
  spends the URL; the download API path remains a fallback.

## Pack for the Web Store later

`chrome-extension/` is laid out so you can zip it directly:

```
cd chrome-extension && zip -r ../odm-integration.zip . -x "*.DS_Store"
```

Submit the zip to the Chrome Web Store dashboard. Replace `icon.png`
with proper 16/32/48/128 PNGs before publishing.
