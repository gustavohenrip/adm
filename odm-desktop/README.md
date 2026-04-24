# ODM Desktop Shell

Desktop shell for the ODM — Open Downloader Manager. Wraps the Angular frontend and spawns the Spring Boot backend as a child process.

## Development

In three terminals:

```sh
# 1. Backend
cd backend && ./gradlew bootRun

# 2. Frontend dev server
cd frontend && npm install && npm start

# 3. Electron (expects Angular at http://localhost:4200)
cd electron && npm install && npm run dev
```

Pass the backend port/token to Electron via env vars when running in dev:

```sh
ADM_BACKEND_PORT=12345 ADM_BACKEND_TOKEN=... npm run dev
```

## Production

`npm run dist` bundles the app with the prebuilt backend jar and minimal JRE (built via jlink from the parent project).
