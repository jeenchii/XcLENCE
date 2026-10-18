# XcLENCE — "real build" reference server

A small, runnable sample of how the localStorage prototype becomes a **real app**: one
front-end, now backed by a **server + database** and a REST API. Authentication (Active
Directory / SSO) is **intentionally stubbed** here so the sample stays runnable — the exact
place to add Microsoft Entra ID is marked in the code.

## Run it

Requires **Node.js** (any recent version for the default JSON store).

```bash
cd xclence-site
node server/server.js
# → open http://localhost:4000
```

That's it — the server serves the front-end **and** the API together, so there's no CORS
setup and no second process.

- Open **http://localhost:4000** → runs against the **server + database**.
- Open **index.html as a file** → still runs the old **localStorage** prototype, unchanged.

The front-end picks the mode automatically (`const API = location.protocol.startsWith("http")`
in `app.js`). That one line — plus `load()`/`save()`/`resetDB()` — is the *entire* client-side
difference, because all state access was already funnelled through those three functions.

## Single-file build (share / static hosting)

```bash
powershell -ExecutionPolicy Bypass -File build-bundle.ps1
```

Writes `dist/XcLENCE.html` — CSS, JS and logo inlined, pure ASCII (works on any host,
whatever charset it declares). It runs in localStorage mode. Re-run after every code change.

## What's here

| File | Role |
|---|---|
| `server.js` | Node built-in HTTP server: serves the front-end + the JSON API. Zero dependencies. |
| `db.js` | **Default** data repository — a JSON file store (`store.json`). Zero dependencies, runs anywhere. |
| `db.sqlite.js` | **Production-shaped** drop-in — real SQLite with proper tables + an append-only `audit` table. |
| `../data.js` | Shared constants **and** the seed — `require()`d by the server so there's one source of truth. |

## Architecture (and how to grow it)

```
Browser (app.js)  ──fetch──▶  server.js  ──▶  db.js  ─▶  store.json     ← you are here (pilot)
                                          └─▶  db.sqlite.js ─▶ xclence.db  ← flip one require()
```

**1. Swap the storage engine — one line.** In `server.js` change
`require("./db.js")` → `require("./db.sqlite.js")`, then `npm i better-sqlite3`.
Same interface (`bootstrap` / `putState` / `reset`). For production on PTT's stack, keep the
SQL shape in `db.sqlite.js` and point it at **Azure SQL** via the `mssql` driver.

**2. Reporting.** Power BI connects **directly to the SQL database** (`initiatives`, `audit`) —
no dashboard is rebuilt in the app, exactly as the requirements ask.

**3. Auth — where AD goes (skipped in this sample).** `server.js → currentUser()` currently
trusts an `X-User` header (the mock login). In production:
put **Entra ID (Azure AD) SSO** in front (MSAL.js on the client), **validate the JWT** in
`currentUser()`, and read role/department from token claims. External PTT-group users →
**Azure AD B2C**. Only that one function changes.

**4. From "state sync" to server-enforced rules.** This sample uses optimistic whole-state
sync (`PUT /api/state`) to stay tiny. The production step is to move the mutations to
**granular, server-authoritative endpoints** so the server (not the browser) owns the rules:

| Today (sample) | Production target |
|---|---|
| `PUT /api/state` (whole doc) | `POST /api/initiatives` — server generates `YY-NNNN` / `IM·SS###` in a DB **transaction** (no ID collisions) |
| client advances stages | `POST /api/initiatives/:id/submit`, `/approve` `{role}`, `/reject` — server checks the role matrix + writes audit |
| client edits fields | `PUT /api/initiatives/:id` — validated server-side, business-case/plan locking enforced |

The append-only `audit` table in `db.sqlite.js` already shows the pattern: the server only
ever **inserts** history, never lets the client shorten or rewrite it.

## API (current sample)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/bootstrap` | Whole app state (config + initiatives, each with its audit). |
| PUT | `/api/state` | Optimistic sync of the whole state; audit is append-only + server-stamped. |
| POST | `/api/reset` | Reseed the demo data. |
