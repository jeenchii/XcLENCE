/* XcLENCE — reference API + static server (Node built-in http, zero dependencies).
 *
 *   node server/server.js      →  http://localhost:4000
 *
 * Serves the existing front-end (../index.html, app.js, …) AND the JSON API the
 * front-end calls when it's loaded over http:// (see the DUAL MODE note in app.js).
 *
 * To use a real SQLite database instead of the JSON file, change the one require
 * below to "./db.sqlite.js" (after `npm i better-sqlite3`). Same interface.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./db.js");            // ← swap to "./db.sqlite.js" for real SQLite

const ROOT = path.join(__dirname, "..");  // the front-end lives one level up
const PORT = process.env.PORT || 4000;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon" };

const sendJson = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise(r => { let d = ""; req.on("data", c => d += c); req.on("end", () => r(d)); });

/* ---- AUTH SEAM (Active Directory / SSO intentionally skipped for this sample) ----
 * The front-end sends the mock user id in the `X-User` header. In production you would:
 *   1. put Microsoft Entra ID (Azure AD) SSO in front (MSAL on the client),
 *   2. validate the JWT here and read role/department from token claims,
 *   3. authorize each endpoint against those claims.
 * Everything below is written so that swap is localised to this function.        */
function currentUser(req) { return { id: req.headers["x-user"] || "anonymous" }; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // ---------------- API ----------------
  if (p.startsWith("/api/")) {
    try {
      if (p === "/api/bootstrap" && req.method === "GET") return sendJson(res, 200, db.bootstrap());
      if (p === "/api/state" && req.method === "PUT") {
        const doc = JSON.parse((await readBody(req)) || "{}");
        return sendJson(res, 200, db.putState(doc, currentUser(req).id));
      }
      if (p === "/api/reset" && req.method === "POST") { db.reset(); return sendJson(res, 200, { ok: true }); }
      return sendJson(res, 404, { error: "no such endpoint: " + req.method + " " + p });
    } catch (e) { return sendJson(res, 500, { error: String(e) }); }
  }

  // ---------------- static front-end ----------------
  let rel = decodeURIComponent(p === "/" ? "/index.html" : p);
  if (rel.startsWith("/server")) { res.writeHead(404); return res.end("not found"); } // don't serve the backend/store
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`XcLENCE  →  http://localhost:${PORT}`);
  console.log(`  front-end + API served together · storage: ${path.basename(require.resolve("./db.js"))}`);
});
