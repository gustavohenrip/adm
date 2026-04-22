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

- **Frontend**: Angular 18 + TypeScript, shipped inside Electron.
- **Backend**: Spring Boot 3.3 (Java 17+) running as a sidecar process.
- **Communication**: REST + WebSocket (STOMP) bound to `127.0.0.1` with a per-session token.
- **Persistence**: SQLite via JPA/Hibernate.
- **Torrent**: jlibtorrent.

## Platforms

- macOS (Intel + Apple Silicon)
- Windows (x86_64)
- Linux (x86_64) — AppImage, deb, rpm

## Development

```
# backend
cd backend && ./gradlew bootRun

# frontend
cd frontend && npm install && npm start

# electron shell (points to http://localhost:4200)
cd electron && npm install && npm run dev
```

The backend prints an `ADM_READY port=... token=...` line on stdout once listening. Electron parses that line in production; in dev you can pass the port and token through `ADM_BACKEND_PORT` and `ADM_BACKEND_TOKEN`.

## Release

Push a `v*.*.*` tag to trigger the release workflow that builds `.dmg`, `.exe`, `.AppImage`, `.deb`, and `.rpm` installers and attaches them to a GitHub Release.

## License

MIT
