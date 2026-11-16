# WebDesignAcademy — kontext pro Claude

## Základní info

- **URL prefix**: `/wda`
- **Lokální port**: `9097`
- **Registry**: `dexter.fit.vutbr.cz/webdesignacademy/`
- **Adresář na serveru**: `/home/lazy_lemour/jirka/webdesignacademy/`

## Stack

- **Backend**: Node.js/Express (port 3000), SQLite (`better-sqlite3`)
- **Frontend**: Vite/React (TypeScript), monorepo s workspace balíčky
- **Package manager**: `pnpm` s workspace

## Monorepo struktura

```
apps/
  backend/    — Express server (name: @wda/backend)
  frontend/   — Vite/React app (name: @wda/frontend)
packages/
  visual-preview/          — @wda/css-analysis (workspace:*)
  visual-editor/           — @wda/visual-editor (workspace:*)
  ui-styles/               — @wda/ui-styles shared tokens and primitives
```

Frontend závisí na `@wda/css-analysis` a `@wda/visual-editor` — ty se buildí před samotným frontendem.

## Deploy soubory

| Soubor                     | Popis                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| `docker-compose.prod.yml`  | Produkce — image z registry                                           |
| `docker-compose.build.yml` | Build a push image                                                    |
| `docker-compose.local.yml` | Lokální test (port 9097)                                              |
| `nginx.conf`               | Projekt proxy — `/wda/api/` → backend, zbytek → frontend |
| `apps/frontend/nginx.conf` | Nginx uvnitř frontend image                                           |
| `apps/backend/Dockerfile`  | Produkční backend image                                               |
| `apps/frontend/Dockerfile` | Produkční frontend image (build context = monorepo root)              |

## Důležité detaily

- **Všechny Dockerfile** buildí z root kontextu (`.`) a používají workspace lockfile
- **Backend** kompiluje nativní `better-sqlite3` — Dockerfile používá multi-stage s `python3 make g++`
- **Storage**: dev používá volume `backend_storage:/app/storage`, produkce bind mount `./storage:/app/storage`; `sync-data` je prázdný
- **Lessons** jsou runtime data v samostatném repozitáři, načítaná backendem; formát a pracovní postup jsou v README v sekci `Work with lessons`
- **CORS_ORIGINS** — v `.env` nastavit produkční doménu
- **VITE_BASE_URL** — nastavuje se jako ARG při buildu frontendu, výchozí `/wda`
