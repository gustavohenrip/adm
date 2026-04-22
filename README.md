# Azrael Download Manager (ADM)

A modern, cross-platform download manager combining the strengths of IDM (dynamic HTTP segmentation) and FDM (full BitTorrent support), wrapped in a clean liquid-glass UI.

## Highlights

- Multi-threaded HTTP/HTTPS downloads with dynamic range reallocation (IDM-style).
- Full BitTorrent client via libtorrent (FDM-style), unified with HTTP in a single queue.
- Pause, resume, scheduler, per-download rate limiting, HTTP auth, proxy support.
- IDM-style automatic folder categorization (Programs, Compressed, Documents, Music, Video, General).
- Tray icon, clipboard URL detection, auto-updater.
- Light and dark themes with translucent liquid-glass surfaces.
- 10 languages: English, Português (BR), Español, Français, Deutsch, Italiano, Русский, 中文, 日本語, العربية.

## Stack

- **Frontend**: Angular + TypeScript, packaged in Electron.
- **Backend**: Spring Boot (Java 17+) running as sidecar process.
- **Communication**: REST + WebSocket (STOMP) over `127.0.0.1` with per-session token.
- **Persistence**: SQLite via JPA.
- **Torrent**: jlibtorrent.

## Platforms

- macOS (Intel + Apple Silicon)
- Windows (x86_64)
- Linux (x86_64) — AppImage, deb, rpm

## Status

Early development. See release history for progress.

## License

MIT
