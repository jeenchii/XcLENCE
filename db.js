/* XcLENCE — data repository (default: JSON file store, zero dependencies).
 *
 * The seam server.js talks to: bootstrap(), putState(), reset(). Swap the storage
 * engine without touching server.js — a real-SQLite drop-in lives in ./db.sqlite.js.
 *
 * Store shape (append-only audit kept apart from initiative data):
 *   { state:       { config, seq, users },                 ← everything except initiatives
 *     initiatives: { <id>: <initiative without audit> },
 *     audit:       { <id>: [ {when, who, kind, action, comment, _srvAt} ] } }
 */
const fs = require("fs");
const path = require("path");
const { xcSeed } = require("../data.js"); // single source of truth for the seed

const STORE = path.join(__dirname, "store.json");
const nowIso = () => new Date().toISOString().replace("T", " ").slice(0, 16);

function readStore() { try { return JSON.parse(fs.readFileSync(STORE, "utf8")); } catch (e) { return null; } }
function writeStore(s) { fs.writeFileSync(STORE, JSON.stringify(s, null, 2)); }

function split(doc) {
  const { initiatives = [], ...state } = doc;
  return { state, initiatives };
}
function reset() {
  const { state, initiatives } = split(xcSeed());
  const s = { state, initiatives: {}, audit: {} };
  initiatives.forEach(i => {
    const { audit = [], ...rest } = i;
    s.initiatives[i.id] = rest;
    s.audit[i.id] = audit.map(a => ({ ...a, _srvAt: nowIso() }));
  });
  writeStore(s);
  return s;
}
function ensureSeeded() { const s = readStore(); return s && s.state && s.state.config ? s : reset(); }

// GET /api/bootstrap → the whole app state, initiatives with their audit reattached.
function bootstrap() {
  const s = ensureSeeded();
  const initiatives = Object.values(s.initiatives).map(i => ({ ...i, audit: s.audit[i.id] || [] }));
  return { ...s.state, initiatives };
}

// PUT /api/state → optimistic whole-state sync from the client.
// State + initiatives are replaced; the AUDIT log is APPEND-ONLY and server-stamped —
// the server never lets a client shorten or rewrite history.
function putState(doc, whoId) {
  const s = ensureSeeded(), { state, initiatives } = split(doc);
  s.state = state;
  const next = {};
  initiatives.forEach(i => {
    const { audit = [], ...rest } = i;
    next[i.id] = rest;
    const have = s.audit[i.id] || [];
    if (audit.length > have.length) s.audit[i.id] = have.concat(audit.slice(have.length).map(a => ({ ...a, _srvAt: nowIso(), _by: whoId || a.who })));
    else if (!s.audit[i.id]) s.audit[i.id] = audit.slice();
  });
  s.initiatives = next; // reflects deletes; audit of removed items is retained
  writeStore(s);
  return { ok: true, initiatives: Object.keys(next).length };
}

module.exports = { bootstrap, putState, reset };
