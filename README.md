# Web Design Academy

## Environment

- Node.js `22.x`
- pnpm `9+` (or `10+`)
- Docker Engine/Desktop with Docker Compose

## Required env files

Create env files from examples:

```sh
cp apps/frontend/.env.example apps/frontend/.env
cp apps/backend/.env.example apps/backend/.env
```

Minimal variables:

- `apps/frontend/.env`: `VITE_APP_MODE` (`offline` or `online`), `VITE_GOOGLE_CLIENT_ID`
- `apps/backend/.env`: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `CORS_ORIGINS`

> In `online` mode, both frontend and backend Google client IDs must be configured.
> Set `ADMIN_EMAILS` to a comma-separated list, for example `one@example.com,two@example.com`.

## Local development

Run pnpm install from the root:

```sh
pnpm install
```

Run in separate terminals (or with your preferred runner):

```sh
# Start backend
pnpm start:backend
```

```sh
# Start frontend
pnpm dev:frontend
```

Backend runs on `http://localhost:3000`, frontend on `http://localhost:5173`.

## Docker (dev)

```sh
docker compose up --build
```

This starts:

- backend: `http://localhost:3000`
- frontend: `http://localhost:5173`
