# Cosmos OS Frontend

Agency operations UI for **Cosmos Core** middleware. Vite + React + shadcn (Base UI) shell mapped to events, projects, portfolio, assets, cues, crew, incidents, analytics, and monitoring.

## Quick start

```bash
# From cosmos-os-frontend
cp .env.example .env   # if needed
npm install
npm run dev            # http://localhost:5173
```

Run the middleware in a second terminal:

```bash
# From cosmos-core-middleware
cp .env.example .env   # set Airtable + COSMOS_API_KEYS
npm install
npm run dev            # http://localhost:3000
```

Default login (middleware seed admin):

- Email: `admin@cosmos.com`
- Password: `admin123`

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Middleware origin (default `http://localhost:3000`). Leave empty to use the Vite proxy. |
| `VITE_COSMOS_API_KEY` | Sent as `x-cosmos-api-key` for assets/portfolio routes. Must match `COSMOS_API_KEYS` on the server. |

Vite also proxies `/api` and `/health` to `localhost:3000` (see `vite.config.ts`).

## Auth model

1. `POST /api/v1/auth/login` → JWT stored in `localStorage`
2. Agency routes send `Authorization: Bearer <token>`
3. Assets/portfolio also send `x-cosmos-api-key` when `VITE_COSMOS_API_KEY` is set

## Screens

| Route | Status |
| --- | --- |
| `/login` | Live auth |
| `/` | Dashboard — events, projects, incident/analytics for featured event |
| `/events` | Event list |
| `/events/:eventId` | Event detail — cues, crew, incidents, health |
| `/projects` | Projects list (backend may still stub empty) |
| `/assets` | Assets list (JWT + API key) |
| `/monitoring` | Health + monitoring stats |
| other nav items | Domain placeholders with endpoint hints |

## App structure

Production UI lives under `src/` (pages, layout shell, ops boards, CRM, AI, etc.).
