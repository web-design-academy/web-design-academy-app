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
- Docker mounts `${LESSONS_HOST_PATH:-./lessons}` read-only at `/app/lessons`
  in the backend. Set `LESSONS_HOST_PATH` in the root `.env` or shell to keep
  the repository elsewhere, for example
  `LESSONS_HOST_PATH=/srv/wda-lessons`.
- Clone the repository at the selected host path before `docker compose up`;
  Compose fails if it is missing.
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

## License & Branding

The source code in this repository is licensed under the [MIT License](LICENSE).

**Brand Protection:** The "Web Design Academy" name, logo, and associated domain names (e.g., webdesignacademy.org) are the exclusive intellectual property of Dmitrii Ivanushkin and are **not** covered by the MIT License. They may not be used for commercial purposes, in derivative works, or in standalone deployments without explicit written permission. In the event of a change in repository ownership or maintainership, the transfer of domain names and branding assets is not automatic and will require a separate, explicit agreement with Dmitrii Ivanushkin.

## Academic Citation

If you use this software for your research, academic projects, or build upon it for your thesis, please cite our work. A `CITATION.cff` file is included in this repository.
