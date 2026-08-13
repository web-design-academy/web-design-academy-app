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

## Work with lessons

- Lessons live in a separate Git repository cloned to `./lessons`:

  ```sh
  git clone <LESSONS_REPOSITORY_URL> lessons
  ```

- Local pnpm development reads `./lessons` directly.
- Docker mounts host `./lessons` read-only at `/app/lessons` in the backend.
- Clone the repository before `docker compose up`; Compose fails if it is
  missing.
- Each task may contain `index.html`, `styles.css`, and `script.js`, plus
  optional `solution.html`, `solution.css`, `solution.js`, and
  `evaluation.json`.
- Lesson frontmatter uses `visualEditor` and `visualPreview` booleans to make
  those optional features available; users still enable them with lesson
  switches.
- `evaluation.json` is edited by admins in Monaco and is applied only while
  Visual preview is enabled. Evaluate checks the current code; Submit only
  saves it to the backend.
- Readonly blocks use `<!-- readonly:start -->` / `<!-- readonly:end -->` in
  HTML and `/* readonly:start */` / `/* readonly:end */` in CSS/JS, with an
  empty line on each side.
- **Download drafts** creates `lessons.zip`. Extract its contents into
  `./lessons`, preserving `./lessons/.git`.
- To include lesson deletions and commit the downloaded archive:

  ```sh
  git -C lessons rm -r -- .
  unzip -o /path/to/lessons.zip -d lessons
  git -C lessons add -A
  git -C lessons commit -m "Update lessons"
  git -C lessons push
  ```

- Host changes are available immediately; containers do not need rebuilding or
  restarting.
