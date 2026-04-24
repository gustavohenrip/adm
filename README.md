<p align="center">
  <img src=".github/assets/banner.png" alt="ODM, Open Downloader Manager" width="820">
</p>

<h1 align="center">ODM</h1>
<p align="center"><i>Open Downloader Manager</i></p>

## What it is

A fast, cross platform download manager. It pulls files over HTTP with dynamic segmentation, speaks BitTorrent through libtorrent, and keeps everything in a single queue. One app, one UI, every protocol you actually use.

## Why you might want it

You want IDM style speed on HTTP and FDM style torrents, without running two programs. You want pause, resume, scheduling, rate limits, proxy and auth, folder auto categorization, a tray icon, and clipboard URL capture. That is the whole pitch.

## Download

Grab the installer for your platform from the [Releases page](https://github.com/gustavohenrip/odm/releases/latest).

- macOS, Apple Silicon, dmg
- Windows x64, nsis installer
- Linux x64, AppImage, deb, rpm

The app updates itself in the background from future GitHub releases.

## Features

- Multi threaded HTTP and HTTPS with dynamic range reallocation
- Full BitTorrent via jlibtorrent, unified queue with HTTP
- Pause, resume, scheduler, per download rate limits
- HTTP auth, proxy support, clipboard URL detection
- Automatic folder categorization for Programs, Compressed, Documents, Music, Video
- Tray icon, auto updater, dark and light themes
- 10 languages including English, Português, Español, Français, Deutsch, Italiano, Русский, 中文, 日本語, العربية

## Stack

- Angular 18 frontend in TypeScript
- Spring Boot 3.3 backend on Java 17, SQLite through JPA
- Electron shell, REST and WebSocket STOMP bound to 127.0.0.1 with a per session token
- BitTorrent through jlibtorrent

## Build from source

```
cd backend && ./gradlew bootRun
cd frontend && npm install && npm start
cd odm-desktop && npm install && npm run dev
```

The backend prints `ODM_READY port=... token=...` on stdout when it is listening. Electron reads that line in production. In dev you can pass `ODM_BACKEND_PORT` and `ODM_BACKEND_TOKEN`.

## Release

Push a `v*.*.*` tag. The workflow builds the installers and attaches them to a new GitHub Release.

## License

MIT
