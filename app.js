/* XcLENCE — state, persistence (localStorage or REST API), router and event handlers.
 * Load order: data.js → logic.js → views.js → app.js
 */

// ---------- UI state --------------------------------------------------------
let ROUTE = [], CUR = null, ACTIVE_ROLE = null, SIDE = typeof window === "undefined" || window.innerWidth > 900;
let LOGIN = { domain: "PTT", user: "" };
let OVSUB = "info", GRIDEXT = {}, SEL = new Set(), OPEN = null, NEWF = {}, SF = {}, ADV = false;
let ACTF = "all", ADMTAB = "users", RESETASK = false;
let DIRTY = { id: null, items: new Map() };   // field changes waiting for their comment-log entry
let SAVING = false, SAVED_AT = "", SAVE_TIMER = null;  // autosave indicator
let PENDING_LINK = null;    // Money Step ↔ L4 change awaiting confirmation
let SCROLL_TODAY = false;   // scroll impact grids to the present month after the next render
const AUTOSAVE_MS = 1200;
const APP = () => document.getElementById("app");

// ---------- persistence (dual mode) -----------------------------------------
// A backend answering /api/bootstrap → REST API + database (see /server);
// otherwise (opened as a file, static host, shared link) → localStorage.
let API = false;
async function load() {
  try {
    const r = await fetch("/api/bootstrap", { cache: "no-store" });
    if (r.ok) { const d = await r.json(); if (d && d.config) { API = true; return d; } }
  } catch (e) { /* no backend */ }
  API = false;
  try { const raw = localStorage.getItem(XC.KEY); if (raw) { const d = JSON.parse(raw); if (d && d.config && d.users) return d; } } catch (e) {}
  const seed = xcSeed();
  try { localStorage.setItem(XC.KEY, JSON.stringify(seed)); } catch (e) {}
  return seed;
}
function save() {
  if (API) {
    fetch("/api/state", { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json", "X-User": ME ? ME.id : "" }, body: JSON.stringify(DB) })
      .catch(e => toast("Couldn't save to the server: " + e.message, "bad"));
    return;
  }
  try { localStorage.setItem(XC.KEY, JSON.stringify(DB)); } catch (e) { toast("Browser storage is full or blocked — changes are not kept.", "bad"); }
  SAVED_AT = nowStamp().slice(11);
}
async function doReset() {
  if (API) { await fetch("/api/reset", { method: "POST" }); DB = await load(); }
  else { try { localStorage.removeItem(XC.KEY); } catch (e) {} DB = await load(); }
  RESETASK = false; ME = U(ME.id) || DB.users.find(u => u.roles.includes("SUPER"));
  toast("Demo data restored."); render();
}
function saveSession() { try { localStorage.setItem(XC.KEY + ".session", JSON.stringify({ u: ME && ME.id, r: ACTIVE_ROLE })); } catch (e) {} }
function restoreSession() {
  try { const s = JSON.parse(localStorage.getItem(XC.KEY + ".session") || "null"); if (s && s.u && U(s.u)) { ME = U(s.u); ACTIVE_ROLE = ME.roles.includes(s.r) ? s.r : ME.roles[0]; } } catch (e) {}
}

// ---------- path helpers ----------------------------------------------------
function getPath(o, p) { return p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o); }
function setPath(o, p, v) { const ks = p.split("."); let x = o; ks.slice(0, -1).forEach(k => { if (x[k] == null || typeof x[k] !== "object") x[k] = {}; x = x[k]; }); x[ks[ks.length - 1]] = v; }

// ---------- toasts ----------------------------------------------------------
function toast(msg, kind = "ok") {
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box); }
  const t = document.createElement("div"); t.className = "toast " + kind; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), kind === "bad" ? 7000 : 4000);
}
const report = r => { toast(r.msg, r.ok ? "ok" : "bad"); return r.ok; };

// ---------- router ----------------------------------------------------------
// In-memory route (NAV), mirrored to location.hash where the host allows it. Some hosts
// (sandboxed iframes, file snapshots) ignore hash changes, so links never depend on them.
let NAV = "#/home", SKIP_HASH = null;
function parse() { return (NAV || "#/home").replace(/^#\/?/, "").split("/"); }
function go(h) {
  if (h === NAV) { render(); return; }
  NAV = h; onNavigate();
  try { if (location.hash !== h) { SKIP_HASH = h; location.hash = h; } } catch (e) { /* hash not writable here */ }
}
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest('a[href^="#/"]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault(); go(a.getAttribute("href"));
});
function render() {
  ROUTE = parse();
  let r = ROUTE[0] || "home";
  // Render the target directly — don't rely on a hashchange (some hosts/snapshots drop it).
  if (!ME || r === "login") { CUR = null; APP().innerHTML = viewLogin(); return; }
  CUR = r === "init" ? INIT(ROUTE[1]) || null : null;
  if (CUR && !canSee(ME, CUR)) CUR = null;
  let main;
  switch (r) {
    case "home": main = viewHome(); break;
    case "new": main = viewNew(); break;
    case "todo": main = viewTodo(); break;
    case "search": main = viewSearch(); break;
    case "init": main = viewInit(ROUTE[1], ROUTE[2] || "overview"); break;
    case "dash": main = viewDash(XC.TRACKS[ROUTE[1]] ? ROUTE[1] : "M"); break;
    case "data": main = viewData(XC.TRACKS[ROUTE[1]] ? ROUTE[1] : "M"); break;
    case "admin": main = viewAdmin(); break;
    case "manual": main = viewManual(); break;
    case "rulebook": main = viewRulebook(); break;
    case "faq": main = viewFaq(); break;
    default: main = viewHome();
  }
  APP().innerHTML = topbar() + `<div class="layout">${sidebar()}<main class="main" id="main">${main}</main></div>`;
  afterRender();
}
// Bring the present month (and the Money Step start, if earlier) into view on the impact grids,
// just right of the pinned Version / Annualized columns.
function afterRender() {
  if (!SCROLL_TODAY) return;
  SCROLL_TODAY = false;
  document.querySelectorAll(".gridwrap").forEach(gw => {
    const today = gw.querySelector("th.today"), ms = gw.querySelector("th.ms"), pin = gw.querySelectorAll("th.stk1, th.stk2");
    let target = today;
    if (ms && today && ms.offsetLeft < today.offsetLeft) target = ms;
    if (!target) return;
    const pinned = [...pin].reduce((w, th) => w + th.offsetWidth, 0);
    gw.scrollLeft = Math.max(0, target.offsetLeft - pinned - target.offsetWidth);
  });
}
function goToday() { SCROLL_TODAY = true; render(); }
function extendGrid(key, dir) {
  const i = CURI(), k = i.id + key, e = GRIDEXT[k] || { b: 0, a: 0 };
  e[dir]++; GRIDEXT[k] = e;
  const gw = document.querySelector(".gridwrap"), x = gw ? gw.scrollLeft : 0;
  render();
  const g2 = document.querySelector(".gridwrap");
  if (g2) g2.scrollLeft = dir === "b" ? 0 : x;
}
// Re-render but keep keyboard focus on the same control (onchange fires as focus moves on).
function renderKeep() {
  const a = document.activeElement, id = a && a.id, s = a && a.selectionStart, y = window.scrollY;
  const gw = document.querySelector(".gridwrap"), gx = gw ? gw.scrollLeft : 0;
  render();
  window.scrollTo(0, y);
  const g2 = document.querySelector(".gridwrap"); if (g2) g2.scrollLeft = gx;
  if (id) { const e = document.getElementById(id); if (e) { e.focus(); try { if (s != null && e.setSelectionRange) e.setSelectionRange(s, s); } catch (x) {} } }
}
let LAST_PATH = "";
function onNavigate() {
  commitDraft(false);
  PENDING_LINK = null;
  const p = parse(), path = p.slice(0, 2).join("/");
  if (path !== LAST_PATH) { SEL = new Set(); OPEN = null; if (p[0] !== "init" || p[1] !== LAST_PATH.split("/")[1]) OVSUB = "info"; }
  if (p[0] === "init" && (p[2] === "impact" || p[2] === "sustain")) SCROLL_TODAY = true;
  LAST_PATH = path;
  if (window.innerWidth <= 900) SIDE = false; // overlay menu closes after navigating on small screens
  render(); window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => {
  if (SKIP_HASH && location.hash === SKIP_HASH) { SKIP_HASH = null; return; }
  if (location.hash.startsWith("#/") && location.hash !== NAV) { NAV = location.hash; onNavigate(); } // back / forward
});
window.addEventListener("beforeunload", () => commitDraft(false));
function toggleSide() { SIDE = !SIDE; render(); }
function popToggle(el, key) { if (el.open) OPEN = key; else if (OPEN === key) OPEN = null; }

// ---------- autosave + comment log -----------------------------------------
// Every change is persisted immediately; a moment after the user stops editing, the changes
// are written to the comment log as one "Updated …: from → to" entry.
function short(v) { const s = Array.isArray(v) ? v.join(", ") : String(v ?? ""); return s.length > 60 ? s.slice(0, 59) + "…" : s || "∅"; }
const same = (a, b) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
function markDirty(i, label, from, to) {
  if (DIRTY.id && DIRTY.id !== i.id) commitDraft(false);
  const prev = DIRTY.items.get(label);
  if (!prev && typeof to !== "object" && same(from, to)) return; // nothing actually changed
  DIRTY.id = i.id;
  DIRTY.items.set(label, { from: prev ? prev.from : from, to });
  save();
  setSaveState(true);
  clearTimeout(SAVE_TIMER);
  SAVE_TIMER = setTimeout(autoCommit, AUTOSAVE_MS);
}
function commitDraft() {
  clearTimeout(SAVE_TIMER); SAVE_TIMER = null;
  if (!DIRTY.id || !DIRTY.items.size) return null;
  const id = DIRTY.id, i = INIT(id);
  const changed = [...DIRTY.items.entries()].filter(([, v]) => typeof v.to === "object" || v.to === undefined || !same(v.from, v.to));
  if (i && changed.length) {
    const parts = changed.map(([k, v]) => (typeof v.to === "object" || v.to === undefined) ? k : `${k}: ${short(v.from)} → ${short(v.to)}`);
    const shown = parts.length > 8 ? parts.slice(0, 8).concat(`and ${parts.length - 8} more`) : parts;
    log(i, "edit", "Updated " + shown.join("; "));
    save();
  }
  DIRTY = { id: null, items: new Map() };
  return id;
}
// Timer-driven commit: update only the save indicator and the comment-log feed, so a field the
// user is typing in right now is never re-rendered away.
function autoCommit() {
  const id = commitDraft();
  setSaveState(false);
  if (id && CUR && CUR.id === id) {
    const feed = document.querySelector(".activity .feed");
    if (feed) feed.outerHTML = feedHtml(CUR);
  }
}
function setSaveState(saving) {
  SAVING = saving;
  const el = document.getElementById("savestate");
  if (el) { el.innerHTML = saveStateHtml(); el.classList.toggle("busy", saving); }
}
const CURI = () => CUR || INIT(ROUTE[1]);
function editable() { const i = CURI(); if (!i || !canEdit(ME, i)) { toast("You can't edit this initiative.", "bad"); return null; } return i; }

// ---------- field handlers --------------------------------------------------
function onField(el) {
  const i = editable(); if (!i) return;
  const p = el.dataset.f, old = getPath(i, p);
  let v = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset.num) v = el.value === "" ? null : Number(el.value);
  setPath(i, p, v);
  markDirty(i, el.dataset.label || p, old, v);
  renderKeep();
}
function setValue(p, v) {
  const i = editable(); if (!i) return;
  const old = getPath(i, p); setPath(i, p, v);
  markDirty(i, p === "capex.has" ? "Having CAPEX spend" : p === "assumption.has" ? "Having assumption template" : p, old, v);
  renderKeep();
}
function onTeam(uid, on) {
  const i = editable(); if (!i) return;
  const old = [...(i.team || [])];
  i.team = on ? [...new Set([...old, uid])] : old.filter(x => x !== uid);
  markDirty(i, "Working Team", old.map(uname), i.team.map(uname));
  OPEN = "team"; renderKeep();
}
// impact lines ---------------------------------------------------------------
const lineOf = (i, key, id) => (i[key] || []).find(l => l.id === id);
function onLine(el) {
  const i = editable(); if (!i) return;
  const [key, id, k] = el.dataset.line.split("|"), l = lineOf(i, key, id);
  const old = l[k]; l[k] = el.value; markDirty(i, `#${id} ${k}`, old, el.value); renderKeep();
}
function onMode(key, id, mode) {
  const i = editable(); if (!i) return;
  const l = lineOf(i, key, id), old = l.mode; l.mode = mode; l.ann = l.ann || {};
  markDirty(i, `#${id} annualized mode`, old, mode); renderKeep();
}
function onAnn(el) {
  const i = editable(); if (!i) return;
  const [key, id, kind] = el.dataset.ann.split("|"), l = lineOf(i, key, id);
  l.ann = l.ann || {}; const old = l.ann[kind];
  l.ann[kind] = el.value === "" ? null : Number(el.value);
  markDirty(i, `#${id} ${kind === "f" ? "forecast" : "actual"} annualized`, old, l.ann[kind]); renderKeep();
}
function onCell(el) {
  const i = editable(); if (!i) return;
  const [key, id, kind, ym] = el.dataset.cell.split("|"), l = lineOf(i, key, id);
  l.m = l.m || { f: {}, a: {} }; l.m[kind] = l.m[kind] || {};
  const old = l.m[kind][ym];
  if (el.value === "") delete l.m[kind][ym]; else l.m[kind][ym] = Number(el.value);
  markDirty(i, `#${id} ${kind === "f" ? "forecast" : "actual"} ${fmtDate(ym)}`, old ?? "", el.value === "" ? "" : Number(el.value)); renderKeep();
}
function toggleSel(id, on) { if (on) SEL.add(id); else SEL.delete(id); renderKeep(); }
function addLine(key) {
  const i = editable(); if (!i) return;
  i[key] = i[key] || [];
  const pre = key === "sustain" ? "S" : "I", n = i[key].reduce((m, l) => Math.max(m, +l.id.slice(1) || 0), 0) + 1;
  const id = pre + String(n).padStart(2, "0"), L = cfgList;
  const line = key === "sustain"
    ? { id, freq: "Recurring Benefit", type: L("susTypes")[0] || "", flagship: i.flagship || "", scope: L("scopes")[0] || "", mode: "auto", m: { f: {}, a: {} }, ann: {} }
    : { id, freq: "Recurring Benefit", type: L("impactTypes")[0] || "", pl: i.dept || "", mode: "auto", m: { f: {}, a: {} }, ann: {} };
  i[key].push(line); log(i, "edit", `Added ${key === "sustain" ? "sustainability" : "impact"} line #${id}`); save(); render();
}
function deleteLines(key) {
  const i = editable(); if (!i) return;
  const ids = [...SEL].filter(id => lineOf(i, key, id)); if (!ids.length) return;
  i[key] = i[key].filter(l => !ids.includes(l.id)); SEL = new Set();
  log(i, "edit", `Deleted ${key === "sustain" ? "sustainability" : "impact"} line(s) ${ids.map(x => "#" + x).join(", ")}`); save(); render();
}
// milestones -----------------------------------------------------------------
function onMs(el) {
  const i = editable(); if (!i) return;
  const [id, k] = el.dataset.ms.split("|"), m = i.milestones.find(x => x.id === id);
  if (k === "type" && el.value === "Money Step" && i.milestones.some(x => x.id !== id && x.type === "Money Step" && x.status !== "Cancelled")) {
    toast("Only one Money Step milestone is allowed. Change or cancel the existing one first.", "bad"); render(); return;
  }
  // Changing the Money Step completion date moves the L4 forecast date → confirm first (as in WAVE).
  if (k === "end" && m.type === "Money Step" && m.status !== "Cancelled" && el.value && el.value !== m.end) {
    PENDING_LINK = { id: i.id, kind: "ms", msId: id, value: el.value };
    render(); return;
  }
  const old = m[k]; m[k] = el.value;
  markDirty(i, `Milestone #${id} ${k}`, k === "owner" ? uname(old) : old, k === "owner" ? uname(el.value) : el.value);
  const prevL4 = i.tl.f.L4;
  if (moneyStep(i) && syncL4(i)) {
    markDirty(i, "L4 forecast date (from Money Step)", prevL4 || "", i.tl.f.L4);
    toast(`L4 forecast date is now ${fmtDate(i.tl.f.L4)} — linked to Money Step #${moneyStep(i).id}.`);
  }
  renderKeep();
}
// L4 forecast date edited on Timeline & Status → also moves the Money Step completion date.
function onL4(el) {
  const i = editable(); if (!i) return;
  const ms = moneyStep(i);
  if (ms && el.value) { PENDING_LINK = { id: i.id, kind: "l4", msId: ms.id, value: el.value }; render(); return; }
  const old = i.tl.f.L4; i.tl.f.L4 = el.value;
  markDirty(i, "L4 forecast date", old, el.value); renderKeep();
}
function confirmLink() {
  const p = PENDING_LINK, i = p && INIT(p.id); PENDING_LINK = null;
  if (!i || !canEdit(ME, i)) { render(); return; }
  const m = i.milestones.find(x => x.id === p.msId);
  const oldEnd = m ? m.end : "", oldL4 = forecastDate(i, "L4");
  if (m) m.end = p.value;
  i.tl.f.L4 = p.value;
  if (m) markDirty(i, `Money Step #${m.id} completion date`, oldEnd, p.value);
  markDirty(i, "L4 forecast date", oldL4, p.value);
  toast(`Money Step completion and L4 forecast date are now ${fmtDate(p.value)} (Impact Year ${p.value.slice(0, 4)}).`);
  render();
}
function cancelLink() { PENDING_LINK = null; toast("No change — dates kept."); render(); }
function addMilestone() {
  const i = editable(); if (!i) return;
  const n = i.milestones.reduce((x, m) => Math.max(x, +m.id.slice(1) || 0), 0) + 1, id = "M" + String(n).padStart(2, "0");
  i.milestones.push({ id, name: "", owner: i.owner || ME.id, type: "Implementation", status: "Not Started", start: "", end: "" });
  log(i, "edit", `Added milestone #${id}`); save(); render();
  const e = document.getElementById(`ms_${id}_name`); if (e) e.focus();
}
function deleteMilestones() {
  const i = editable(); if (!i) return;
  const ids = [...SEL].filter(id => i.milestones.some(m => m.id === id)); if (!ids.length) return;
  i.milestones = i.milestones.filter(m => !ids.includes(m.id)); SEL = new Set();
  log(i, "edit", `Deleted milestone(s) ${ids.map(x => "#" + x).join(", ")}`); save(); render();
}
// files (names only in this build) -------------------------------------------
function addCharterFiles(el) {
  const i = editable(); if (!i) return;
  const names = [...el.files].map(f => f.name); i.charter.files.push(...names);
  log(i, "edit", "Attached to charter: " + names.join(", ")); save(); render();
}
function removeCharterFile(k) { const i = editable(); if (!i) return; const [f] = i.charter.files.splice(k, 1); log(i, "edit", "Removed charter file " + f); save(); render(); }
function setAttachment(k, el) {
  const i = editable(); if (!i) return;
  const name = el && el.files && el.files[0] ? el.files[0].name : "";
  const old = i.attachments[k]; i.attachments[k] = name;
  log(i, "edit", name ? `Attachment ${k + 1}: ${name}` : `Removed attachment ${k + 1} (${old})`); save(); render();
}
// questionnaire --------------------------------------------------------------
function qRec(i, id) { i.q = i.q || {}; if (!i.q[id] || typeof i.q[id] !== "object") i.q[id] = { c: [], other: "" }; return i.q[id]; }
function onQ(id, k, on) {
  const i = editable(); if (!i) return;
  const a = qRec(i, id); a.c = on ? [...new Set([...(a.c || []), k])].sort() : (a.c || []).filter(x => x !== k);
  if (on) a.none = false;
  markDirty(i, `Questionnaire ${id.toUpperCase()}`, undefined, {}); renderKeep();
}
function onQNone(id, on) {
  const i = editable(); if (!i) return;
  const a = qRec(i, id); a.none = on; if (on) { a.c = []; a.other = ""; }
  markDirty(i, `Questionnaire ${id.toUpperCase()}`, undefined, {}); renderKeep();
}
function onQText(id, field, v) {
  const i = editable(); if (!i) return;
  const a = qRec(i, id); a[field] = v; if (field === "other" && v) a.none = false;
  markDirty(i, `Questionnaire ${id.toUpperCase()}`, undefined, {}); renderKeep();
}
function onQYes(id, v) { const i = editable(); if (!i) return; i.q = i.q || {}; const old = i.q[id]; i.q[id] = v; markDirty(i, `Questionnaire ${id.toUpperCase()}`, old, v); renderKeep(); }

// ---------- workflow actions ------------------------------------------------
function act(fn) { const i = CURI(); if (!i) return; commitDraft(false); const r = fn(i); if (r.ok) save(); report(r); OPEN = null; render(); }
const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
function doSubmit() { if (!editable()) return; act(i => submitGate(i)); }
function doApprove(role) {
  const c = val("gate_c");
  act(i => { const r = approveGate(i, role); if (r.ok && c) i.audit[i.audit.length - (i.submittedFor ? 1 : 2)].comment = c; return r; });
}
function doReject() { const c = val("gate_c"); act(i => rejectGate(i, c)); }
function doWithdraw() { if (!editable()) return; act(i => withdrawGate(i)); }
function doReturn() { if (!editable()) return; const c = val("ret_c"); act(i => returnStage(i, c)); }
function doStatus() { if (!editable()) return; const s = val("hold_s"), c = val("hold_c"); act(i => setStatus(i, s, c)); }
function doComment() {
  const i = CURI(), c = val("cm_t"); if (!i) return;
  if (!c) { toast("Write a comment first.", "bad"); return; }
  log(i, "comment", "Comment", c); save(); render();
}
function doLogin() {
  const u = U(val("lg_user")); if (!u) return;
  ME = u; ACTIVE_ROLE = val("lg_role") || u.roles[0]; saveSession();
  toast(`Signed in as ${u.name} (${roleName(ACTIVE_ROLE)}).`);
  go("#/home");
}
function doCreate(track) {
  const n = NEWF;
  if (!has(n.title) || !has(n.overview)) { toast("Enter the Initiative Name and Overview.", "bad"); return; }
  const data = { title: n.title.trim(), overview: n.overview.trim(), company: n.company || val("nf_co") || ME.company };
  if (track === "S") data.flagship = n.flagship || val("nf_fl"); else data.dept = n.dept || val("nf_dp");
  const i = createInitiative(track, data); save(); NEWF = {};
  toast(`Created ${i.id}. Complete the Overview and L1 Questionnaire, then submit for L2.`);
  go(`#/init/${i.id}/overview`);
}

// ---------- admin actions ---------------------------------------------------
function superOnly() { if (!isSuper(ME)) { toast("Only Super Admin can change this.", "bad"); return false; } return true; }
function toggleRole(uid, role, on) {
  if (!superOnly()) return;
  const u = U(uid); u.roles = on ? [...new Set([...u.roles, role])] : u.roles.filter(r => r !== role);
  save(); toast(`${u.name}: ${on ? "added" : "removed"} ${roleName(role)}.`);
  if (u.id === ME.id && !ME.roles.includes(ACTIVE_ROLE)) ACTIVE_ROLE = ME.roles[0] || "OWNER";
  OPEN = "r" + uid; renderKeep();
}
function addUser() {
  if (!superOnly()) return;
  const name = val("nu_name"), emp = val("nu_emp");
  if (!name || !emp) { toast("Enter the employee number and name.", "bad"); return; }
  const id = "u" + Date.now().toString(36);
  DB.users.push({ id, emp, name, email: val("nu_email"), company: val("nu_co") || "PTT", dept: val("nu_dept"), roles: ["OWNER"] });
  save(); toast(`Added ${name}.`); render();
}
function setPerm(role, track, idx, v) {
  if (!superOnly()) return;
  const p = DB.config.perms; p[role] = p[role] || {}; p[role][track] = p[role][track] || ["none", "none"]; p[role][track][idx] = v;
  save(); toast(`${roleName(role)} · ${trackName(track)} updated.`);
}
function setRouting(role, uid) {
  if (!superOnly()) return;
  DB.config.routing = DB.config.routing || {};
  if (uid) DB.config.routing[role] = [uid]; else delete DB.config.routing[role];
  save(); toast(uid ? `${roleName(role)} now routes to ${uname(uid)}.` : `${roleName(role)} reset to the AD default.`); render();
}
function saveList(k) {
  if (!superOnly()) return;
  DB.config.lists[k] = val("ls_" + k).split("\n").map(s => s.trim()).filter(Boolean);
  save(); toast(`List “${k}” saved (${DB.config.lists[k].length} values).`);
}
function saveSettings() {
  if (!superOnly()) return;
  DB.config.theme = val("st_theme") || DB.config.theme;
  ["money", "emission"].forEach(k => DB.config.classes[k].forEach((c, idx) => { c[1] = Number(val(`cl_${k}_${idx}`)) || 0; }));
  save(); toast("Settings saved."); render();
}

// ---------- downloads -------------------------------------------------------
function downloadFile(name, text, type = "text/plain") {
  const blob = new Blob([text], { type }), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCSV(t) {
  const list = visible().filter(i => i.track === t);
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [DATA_COLS.map(c => q(c[0])).join(","), ...list.map(i => DATA_COLS.map(([, f]) => q(f(i))).join(","))].join("\r\n");
  downloadFile(`XcLENCE_${trackName(t)}_${todayISO()}.csv`, "﻿" + csv, "text/csv");
  toast(`Exported ${list.length} row(s).`);
}
function downloadCharterTemplate() {
  const i = CURI();
  downloadFile(`Charter_Template_${i ? i.id : "XcLENCE"}.md`, [
    `# Project Charter — ${i ? i.id + " " + i.title : ""}`, "", "## Current conditions (problem statement)", "", "## Goals / targets", "",
    "## Root cause analysis", "", "## Proposed solution / method", "", "## Expected result / confirmation", "",
    "## Key value driver and unit", "", "## Money Step (what event means no further action is needed)", ""].join("\n"), "text/markdown");
}

// ---------- boot ------------------------------------------------------------
async function boot() {
  try { DB = await load(); }
  catch (e) { APP().innerHTML = `<div class="card pad err">Couldn't load XcLENCE data: ${esc(e.message)}</div>`; return; }
  DB.initiatives.forEach(syncL4); // stored L4 forecast = Money Step completion date
  restoreSession();
  if (location.hash.startsWith("#/") && location.hash !== "#/login") NAV = location.hash;
  if (/^#\/init\/[^/]+\/(impact|sustain)/.test(NAV)) SCROLL_TODAY = true;
  LAST_PATH = parse().slice(0, 2).join("/");
  render();
}
boot();
