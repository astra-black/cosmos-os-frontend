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

## Routes and status

The sidebar links to `/dashboard`; `/` is the public landing route and redirects
authenticated users to the dashboard. All routes below are registered in
`src/App.tsx` and have an implemented frontend screen. Screens that load agency
data require the middleware to be running and may show an empty state when the
corresponding API has no records.

| Route | Status |
| --- | --- |
| `/` | Public landing page / authenticated redirect |
| `/login`, `/invite/:token`, `/join/:token` | Authentication and invitations |
| `/dashboard` | Agency dashboard |
| `/events`, `/events/:eventId` | Events and event operations |
| `/activity` | Activity feed |
| `/crm`, `/clients`, `/contacts`, `/campaigns` | CRM screens |
| `/projects`, `/projects/:projectId`, `/tasks`, `/milestones`, `/assets`, `/approvals`, `/vendors`, `/portfolio`, `/finance`, `/billing` | Delivery and finance screens |
| `/cues`, `/crew`, `/incidents`, `/analytics` | Live operations screens |
| `/teams`, `/monitoring`, `/settings`, `/ai` | System and assistant screens |
| `/portal`, `/portal/login` | Client portal |

## Routing and module loading

The frontend uses React Router with a `BrowserRouter`. Route components are
statically imported through `src/pages/index.ts` and `src/App.tsx`; there is no
runtime `import()` or route-level lazy loading. Vite therefore bundles the
active route modules as part of the normal application build rather than
fetching route chunks on navigation.

## App structure

Production UI lives under `src/` (pages, layout shell, ops boards, CRM, AI, etc.).
