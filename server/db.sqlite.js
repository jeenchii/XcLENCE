/* XcLENCE — data repository, REAL SQLite variant (production-shaped).
 *
 * Drop-in replacement for ./db.js — identical bootstrap()/putState()/reset() interface.
 * Use it:   npm i better-sqlite3   then in server.js change the require to "./db.sqlite.js".
 * For Azure SQL keep this shape and swap the driver for `mssql` (standard SQL below).
 *
 * The AUDIT table is append-only (INSERT only, never UPDATE/DELETE).
 */
const path = require("path");
const Database = require("better-sqlite3");
const { xcSeed } = require("../data.js");

const db = new Database(path.join(__dirname, "xclence.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT);          -- config, seq, users
  CREATE TABLE IF NOT EXISTS initiatives (
    id TEXT PRIMARY KEY,          -- M2026-0001 / S2026-0001 / P2026-0001
    track TEXT, title TEXT, company TEXT, dept TEXT, flagship TEXT,
    stage TEXT, status TEXT, submitted_for TEXT,
    data TEXT,                    -- JSON: impacts, sustain, milestones, charter, approvals, timeline…
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, initiative_id TEXT,
    who TEXT, kind TEXT, action TEXT, comment TEXT, at TEXT, srv_at TEXT
  );
`);
const nowIso = () => new Date().toISOString().replace("T", " ").slice(0, 16);
const stSet = db.prepare("INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
const insInit = db.prepare(`INSERT INTO initiatives (id,track,title,company,dept,flagship,stage,status,submitted_for,data,updated_at)
  VALUES (@id,@track,@title,@company,@dept,@flagship,@stage,@status,@submitted_for,@data,@updated_at)
  ON CONFLICT(id) DO UPDATE SET track=excluded.track,title=excluded.title,company=excluded.company,dept=excluded.dept,
   flagship=excluded.flagship,stage=excluded.stage,status=excluded.status,submitted_for=excluded.submitted_for,data=excluded.data,updated_at=excluded.updated_at`);
const auditCount = db.prepare("SELECT COUNT(*) n FROM audit WHERE initiative_id=?");
const insAudit = db.prepare("INSERT INTO audit(initiative_id,who,kind,action,comment,at,srv_at) VALUES(?,?,?,?,?,?,?)");

function upsertInitiative(i) {
  const { audit = [], ...rest } = i;
  insInit.run({ id: i.id, track: i.track, title: i.title, company: i.company, dept: i.dept, flagship: i.flagship,
    stage: i.stage, status: i.status, submitted_for: i.submittedFor, data: JSON.stringify(rest), updated_at: nowIso() });
  audit.slice(auditCount.get(i.id).n).forEach(a => insAudit.run(i.id, a.who, a.kind, a.action, a.comment || "", a.when || "", nowIso()));
}
function writeState(doc) {
  const { initiatives = [], ...state } = doc;
  Object.entries(state).forEach(([k, v]) => stSet.run(k, JSON.stringify(v)));
  return initiatives;
}
function reset() {
  db.transaction(() => {
    db.exec("DELETE FROM initiatives; DELETE FROM audit; DELETE FROM state;");
    writeState(xcSeed()).forEach(upsertInitiative);
  })();
}
function ensureSeeded() { if (!db.prepare("SELECT 1 FROM state WHERE key='config'").get()) reset(); }

function bootstrap() {
  ensureSeeded();
  const state = Object.fromEntries(db.prepare("SELECT key,value FROM state").all().map(r => [r.key, JSON.parse(r.value)]));
  const aud = db.prepare("SELECT * FROM audit WHERE initiative_id=? ORDER BY id");
  const initiatives = db.prepare("SELECT data FROM initiatives ORDER BY id").all().map(r => {
    const i = JSON.parse(r.data);
    i.audit = aud.all(i.id).map(a => ({ when: a.at, who: a.who, kind: a.kind, action: a.action, comment: a.comment, _srvAt: a.srv_at }));
    return i;
  });
  return { ...state, initiatives };
}
function putState(doc /*, whoId */) {
  ensureSeeded();
  db.transaction(() => {
    const list = writeState(doc), keep = new Set(list.map(i => i.id));
    list.forEach(upsertInitiative);
    db.prepare("SELECT id FROM initiatives").all().forEach(r => { if (!keep.has(r.id)) db.prepare("DELETE FROM initiatives WHERE id=?").run(r.id); });
  })();
  return { ok: true };
}

module.exports = { bootstrap, putState, reset };
