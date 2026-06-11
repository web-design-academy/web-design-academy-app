# Web Design Academy

## Environment

- Node.js `22.x`
- npm `10+`
- Docker Engine/Desktop with Docker Compose

## Required env files

Create env files from examples:

```sh
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Minimal variables:

- `frontend/.env`: `VITE_APP_MODE` (`offline` or `online`), `VITE_GOOGLE_CLIENT_ID`
- `backend/.env`: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAIL`, `CORS_ORIGINS`

> In `online` mode, both frontend and backend Google client IDs must be configured.

## Local development

Run in two terminals:

```sh
cd backend
npm install
npm run start
```

```sh
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:3000`, frontend on `http://localhost:5173`.

## Docker (dev)

```sh
docker compose up --build
```

This starts:

- backend: `http://localhost:3000`
- frontend: `http://localhost:5173`
