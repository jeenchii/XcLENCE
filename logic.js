/* XcLENCE — domain logic: calculations, permissions, approval routing, workflow, checklists.
 * Pure functions over the global DB / ME. No rendering here.
 */
let DB = null;  // whole app state (config, seq, users, initiatives)
let ME = null;  // signed-in user

// ---------- basics ----------------------------------------------------------
const U = id => DB.users.find(u => u.id === id);
const INIT = id => DB.initiatives.find(i => i.id === id);
const num = v => (v === null || v === undefined || v === "" || isNaN(+v)) ? 0 : +v;
const has = v => v !== null && v !== undefined && v !== "";
const pad = n => String(n).padStart(2, "0");
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function nowStamp() { const d = new Date(); return `${todayISO()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function ymAdd(ym, n) { let [y, m] = ym.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; }
function ymRange(a, b) { const out = []; for (let c = a; c <= b; c = ymAdd(c, 1)) out.push(c); return out; }
function daysSince(d) { return d ? Math.max(0, Math.round((new Date(todayISO()) - new Date(d)) / 864e5)) : 0; }
const roleName = r => (XC.ROLES[r] || { name: r }).name;
const trackName = t => XC.TRACKS[t].name;
const cfgList = k => DB.config.lists[k] || [];

// ---------- stages ----------------------------------------------------------
const stagesOf = i => XC.TRACK_STAGES[i.track];
function nextStage(i) { const s = stagesOf(i), k = s.indexOf(i.stage); return k >= 0 && k < s.length - 1 ? s[k + 1] : null; }
function prevStage(i) { const s = stagesOf(i), k = s.indexOf(i.stage); return k > 0 ? s[k - 1] : null; }
const gateRoles = (i, to) => (XC.GATES[i.track] || {})[to] || [];
const isFinal = i => !nextStage(i);
const stageNum = s => XC.STAGE_ORDER.indexOf(s);

// ---------- impact calculations ---------------------------------------------
const isOneTime = l => /^One-time/.test(l.freq);
const isCost = l => /Cost$/.test(l.freq);
// kind: f = forecast, a = actual, e = estimate (actual where entered, else forecast)
function series(l, kind) {
  const f = (l.m && l.m.f) || {}, a = (l.m && l.m.a) || {};
  if (kind === "f") return f;
  if (kind === "a") return a;
  const e = {};
  new Set([...Object.keys(f), ...Object.keys(a)]).forEach(k => { e[k] = has(a[k]) ? +a[k] : num(f[k]); });
  return e;
}
function monthVal(l, kind, ym) { const s = series(l, kind); return has(s[ym]) ? +s[ym] : null; }
// Annualized: Manual = typed value. Auto-fill = one-time: total of all months;
// recurring: best rolling 12-month sum (run-rate at full potential); < 12 months → average × 12.
function annual(l, kind) {
  if (l.mode === "manual") {
    const ann = l.ann || {};
    if (kind === "f") return num(ann.f);
    if (kind === "a") return num(ann.a);
    return has(ann.a) ? num(ann.a) : num(ann.f);
  }
  const s = series(l, kind), keys = Object.keys(s).filter(k => has(s[k])).sort();
  if (!keys.length) return 0;
  const vals = ymRange(keys[0], keys[keys.length - 1]).map(k => num(s[k]));
  const sum = vals.reduce((x, y) => x + y, 0);
  if (isOneTime(l)) return sum;
  if (vals.length < 12) return sum / vals.length * 12;
  let best = -Infinity;
  for (let i = 0; i + 12 <= vals.length; i++) { let w = 0; for (let j = i; j < i + 12; j++) w += vals[j]; best = Math.max(best, w); }
  return best;
}
function hasData(l, kind) {
  if (l.mode === "manual") return num((l.ann || {})[kind]) !== 0;
  return Object.values(series(l, kind)).some(v => num(v) !== 0);
}
// Financial (WAVE to-be): Total = Net recurring + One-time benefit/5 − Implementation (one-time) cost/5
// Emission (GHG):        Total = Net recurring + Net one-time  (rule to confirm with GHG team)
function totals(lines, kind = "e") {
  let rb = 0, rc = 0, ob = 0, oc = 0;
  (lines || []).forEach(l => { const v = annual(l, kind); if (isOneTime(l)) { if (isCost(l)) oc += v; else ob += v; } else { if (isCost(l)) rc += v; else rb += v; } });
  return { rb, rc, ob, oc, netRec: rb - rc, oneTime: ob - oc, fin: rb - rc + ob / 5 - oc / 5, sum: rb - rc + ob - oc };
}
const finTotals = (i, k) => totals(i.impacts, k);
const susTotals = (i, k) => totals(i.sustain, k);
// The one headline number shown in lists/headers.
function headline(i) {
  if (i.track === "S") return { v: susTotals(i).sum, unit: "tCO₂e" };
  const t = finTotals(i).fin;
  if (i.track === "P" && !t) { const h = num(i.time.actual) || num(i.time.plan); if (h) return { v: h, unit: "Hrs" }; }
  return { v: t, unit: "Mn THB" };
}
function classOf(i) {
  const h = headline(i); if (h.unit === "Hrs") return "Sand";
  const band = DB.config.classes[i.track === "S" ? "emission" : "money"] || [];
  const hit = band.find(([, min]) => h.v >= min);
  return hit ? hit[0] : (band.length ? band[band.length - 1][0] : "—");
}

// ---------- dates -----------------------------------------------------------
const moneyStep = i => (i.milestones || []).find(m => m.type === "Money Step" && m.status !== "Cancelled");
// L4 forecast follows the Money Step completion date when one exists (MissionX rule).
function forecastDate(i, s) {
  if (s === "L4") { const ms = moneyStep(i); if (ms && ms.end) return ms.end; }
  return i.tl.f[s] || null;
}
// Keep the stored L4 forecast equal to the Money Step completion date (two-way link; see app.js).
function syncL4(i) {
  const ms = moneyStep(i);
  if (ms && ms.end && i.tl.f.L4 !== ms.end) { i.tl.f.L4 = ms.end; return true; }
  return false;
}
// Month the money starts to flow = Money Step milestone START date (red line on the impact grids).
const msStartYM = i => { const ms = moneyStep(i); return ms && ms.start ? ms.start.slice(0, 7) : null; };
// Impact Year = year of the L4 date (PIC has no L4 → L5 date).
function impactYear(i) {
  const s = i.track === "P" ? "L5" : "L4";
  const d = i.tl.a[s] || forecastDate(i, s);
  return d ? +d.slice(0, 4) : +(i.created || todayISO()).slice(0, 4);
}

// ---------- permissions -----------------------------------------------------
function perms(role, track) {
  const p = (DB.config.perms[role] || {})[track];
  return p ? { vis: p[0], edit: p[1] } : { vis: "none", edit: "none" };
}
const isMine = (u, i) => !!u && (i.owner === u.id || i.backup === u.id || (i.team || []).includes(u.id));
function scopeCovers(scope, u, i) {
  switch (scope) {
    case "whole": return true;
    case "company": return i.company === u.company;
    case "flagship": return !!i.flagship && i.flagship === u.flagship;
    case "vs": return isMine(u, i) || (!!i.dept && i.dept === u.dept) || ((u.authority && u.authority.depts) || []).includes(i.dept);
    case "own": return isMine(u, i);
    default: return false;
  }
}
function canSee(u, i) {
  if (!u) return false;
  if (isMine(u, i) || myPendingRoles(u, i).length) return true;
  return (u.roles || []).some(r => scopeCovers(perms(r, i.track).vis, u, i));
}
// Editor (card owner) edits own cards; Full editor edits any card in their visibility scope.
function canEdit(u, i) {
  if (!u) return false;
  if (i.status === "Cancelled" && !(u.roles || []).includes("SUPER")) return false;
  if (isMine(u, i)) return true;
  return (u.roles || []).some(r => { const p = perms(r, i.track); return p.edit === "full" && scopeCovers(p.vis, u, i); });
}
const isAdmin = u => !!u && (u.roles || []).some(r => XC.ADMIN_ROLES.includes(r));
const isSuper = u => !!u && (u.roles || []).includes("SUPER");

// ---------- approval routing ------------------------------------------------
function coversAuthority(u, i) {
  const a = u.authority; if (!a) return true;
  return (a.depts || []).includes(i.dept) || (!!i.flagship && (a.flagships || []).includes(i.flagship));
}
// AD default: users holding the role whose approval authority covers the initiative.
const adHolders = (role, i) => DB.users.filter(u => (u.roles || []).includes(role) && (!i || coversAuthority(u, i)));
function holders(role, i) {
  const o = (DB.config.routing || {})[role];
  if (o && o.length) return o.map(U).filter(Boolean);
  return adHolders(role, i);
}
const holderNames = (role, i) => holders(role, i).map(u => u.name).join(", ") || "— no holder —";
function canSign(u, role, i) { return !!u && (isSuper(u) || holders(role, i).some(h => h.id === u.id)); }
function myPendingRoles(u, i) {
  const to = i.submittedFor; if (!to || !u) return [];
  const done = (i.approvals || {})[to] || {};
  return gateRoles(i, to).filter(r => !done[r] && canSign(u, r, i));
}

// ---------- required fields & checklists -----------------------------------
const OV_FIELDS = [
  { k: "title", label: "Initiative Name", req: "MSP" },
  { k: "overview", label: "Overview", req: "MSP" },
  { k: "owner", label: "Initiative Owner", req: "MSP" },
  { k: "backup", label: "Initiative Owner (Back-up)", req: "MSP" },
  { k: "team", label: "Working Team", req: "MSP" },
  { k: "company", label: "Company", req: "MSP" },
  { k: "dept", label: "Department", req: "MP" },
  { k: "category", label: "Initiative Category", req: "MP" },
  { k: "interCompany", label: "Inter-Company Impact?", req: "MSP" },
  { k: "source", label: "Source of Loss & Gain", req: "MSP" },
  { k: "qTools", label: "Q Tools", req: "MSP" },
  { k: "esg", label: "E, S or G Initiative?", req: "S" },
  { k: "flagship", label: "Flagship", req: "S" },
  { k: "levers", label: "Levers", req: "S" },
  { k: "initType", label: "Type of Initiative", req: "S" },
];
const fieldReq = (i, k) => { const f = OV_FIELDS.find(x => x.k === k); return !!f && f.req.includes(i.track); };
const isEmpty = v => Array.isArray(v) ? v.length === 0 : !has(v);
const missingFields = i => OV_FIELDS.filter(f => f.req.includes(i.track) && isEmpty(i[f.k])).map(f => f.label);

function qAnswered(i, q) {
  const a = (i.q || {})[q.id];
  if (q.type === "yesno") return has(a);
  return !!a && (((a.c || []).length > 0) || has(a.other) || a.none);
}
const qDone = (i, stage) => XC.QUESTIONNAIRE[stage].filter(q => q.req).every(q => qAnswered(i, q));
function milestonesOK(i) {
  const live = (i.milestones || []).filter(m => m.status !== "Cancelled");
  return live.some(m => m.type === "Implementation") && live.filter(m => m.type === "Money Step").length === 1 && live.every(m => m.start && m.end);
}

// What must be done before submitting for `to`.  Each item: {tab, label, done}
function requirements(i, to) {
  const R = [], add = (tab, label, done) => R.push({ tab, label, done: !!done });
  const t = i.track;
  if (!to) return R;
  if (to === "L2") {
    const miss = missingFields(i);
    add("overview", "Complete the required Overview fields" + (miss.length ? " — missing: " + miss.join(", ") : ""), !miss.length);
    add("questionnaire", "Answer the L1 Questionnaire", qDone(i, "L1"));
  }
  if (to === "L3") {
    if (t === "M") {
      add("impact", "Please fill the plan (annualized and monthly impact)", (i.impacts || []).some(l => hasData(l, "f")));
      add("impact", "Answer “Having CAPEX spend?”", has(i.capex.has));
      add("milestones", "Please add the milestones (implementation and exactly one Money Step, with dates)", milestonesOK(i));
      add("overview", "Set the Key Value Driver in the Initiative Charter", has(i.charter.kvd));
    }
    if (t === "S") add("sustain", "Please fill the sustainability impact plan (annualized and monthly)", (i.sustain || []).some(l => hasData(l, "f")));
    if (t === "P") {
      add("impact", "Fill the money impact or the plan time reduction", (i.impacts || []).some(l => hasData(l, "f")) || num(i.time.plan) > 0);
      const a = i.assumption || {};
      add("overview", "Complete the Assumption Template", a.has === "No" || (a.has === "Yes" && has(a.current) && has(a.solution)));
    }
  }
  if (to === "L4") {
    if (t === "M") add("milestones", "Complete the Money Step milestone", (moneyStep(i) || {}).status === "Completed");
    add("timeline", "Set the L5 forecast date", has(i.tl.f.L5));
  }
  if (to === "L5") {
    const lines = t === "S" ? i.sustain : i.impacts;
    add(t === "S" ? "sustain" : "impact", t === "P" ? "Update actual impact or actual time reduction" : "Update the actual values",
      (lines || []).some(l => hasData(l, "a")) || (t === "P" && num(i.time.actual) > 0));
    add("questionnaire", "Answer the L5 Questionnaire", qDone(i, "L5"));
  }
  return R;
}

// ---------- workflow --------------------------------------------------------
function log(i, kind, action, comment) {
  i.audit.push({ when: nowStamp(), who: ME ? ME.name : "System", kind, action, comment: comment || "" });
}
const ok = msg => ({ ok: true, msg }), fail = msg => ({ ok: false, msg });

function submitGate(i) {
  const to = nextStage(i);
  if (!to) return fail("This initiative is already at its final stage.");
  if (i.submittedFor) return fail(`Already submitted for ${i.submittedFor} approval.`);
  if (i.status === "On hold" || i.status === "Cancelled") return fail(`The initiative is ${i.status}. Re-activate it first.`);
  const pend = requirements(i, to).filter(r => !r.done);
  if (pend.length) return fail("Complete the checklist first: " + pend.map(p => p.label).join("; "));
  i.submittedFor = to; i.approvals[to] = {}; i.returned = false; i.tl.a["sub:" + to] = todayISO();
  log(i, "workflow", `Submitted for ${to} approval`);
  return ok(`Submitted for ${to} approval. Waiting for ${gateRoles(i, to).map(roleName).join(", ")}.`);
}
function approveGate(i, role) {
  const to = i.submittedFor;
  if (!to) return fail("Nothing is waiting for approval.");
  if (!gateRoles(i, to).includes(role)) return fail("That role is not required at this gate.");
  if (!canSign(ME, role, i)) return fail(`You can't sign off as ${roleName(role)} for this initiative.`);
  i.approvals[to][role] = { by: ME.name, at: nowStamp() };
  log(i, "approval", `${roleName(role)} approved ${i.stage} → ${to}`);
  const left = gateRoles(i, to).filter(r => !i.approvals[to][r]);
  if (left.length) return ok(`Approved as ${roleName(role)}. Still waiting for ${left.map(roleName).join(", ")}.`);
  const from = i.stage;
  i.stage = to; i.submittedFor = null; i.tl.a[to] = todayISO();
  if (to === "L4") i.locked = { total: i.track === "S" ? susTotals(i, "f").sum : finTotals(i, "f").fin, at: todayISO() };
  log(i, "workflow", `Advanced ${from} → ${to} (all sign-offs complete)`);
  return ok(`All sign-offs complete — moved to ${to} ${XC.STAGES[to]}.`);
}
function rejectGate(i, comment) {
  if (!i.submittedFor) return fail("Nothing is waiting for approval.");
  if (!has(comment)) return fail("Add a comment that explains what to fix before rejecting.");
  const to = i.submittedFor;
  i.approvals[to] = {}; i.submittedFor = null; i.returned = true;
  log(i, "approval", `Rejected ${i.stage} → ${to}`, comment);
  return ok("Rejected. The owner can update the initiative and resubmit.");
}
function withdrawGate(i) {
  if (!i.submittedFor) return fail("Nothing to withdraw.");
  const to = i.submittedFor; i.approvals[to] = {}; i.submittedFor = null;
  log(i, "workflow", `Withdrew the ${to} submission`);
  return ok("Submission withdrawn.");
}
function returnStage(i, comment) {
  const prev = prevStage(i);
  if (!prev) return fail("Already at the first stage.");
  if (!has(comment)) return fail("Add a comment explaining why the initiative goes back.");
  if (i.submittedFor) { i.approvals[i.submittedFor] = {}; i.submittedFor = null; }
  const from = i.stage; i.stage = prev; i.returned = true;
  log(i, "workflow", `Returned ${from} → ${prev}`, comment);
  return ok(`Returned to ${prev} ${XC.STAGES[prev]}.`);
}
function setStatus(i, status, comment) {
  if ((status === "On hold" || status === "Cancelled") && !has(comment)) return fail("Add a comment explaining the change.");
  const from = i.status; i.status = status;
  if (status === "Cancelled" && i.submittedFor) { i.approvals[i.submittedFor] = {}; i.submittedFor = null; }
  log(i, "workflow", `Status: ${from} → ${status}`, comment);
  return ok(`Status set to ${status}.`);
}

function createInitiative(track, data) {
  const y = new Date().getFullYear();
  DB.seq[track] = DB.seq[track] || {};
  const n = (DB.seq[track][y] || 0) + 1; DB.seq[track][y] = n;
  const i = Object.assign(xcBlank(track), data);
  i.id = `${track}${y}-${String(n).padStart(4, "0")}`;
  i.created = todayISO(); i.tl.a.L1 = todayISO();
  if (!i.owner) i.owner = ME.id;
  if (!i.team.length) i.team = [ME.id];
  i.audit = [{ when: nowStamp(), who: ME.name, kind: "workflow", action: `Created ${trackName(track)} initiative`, comment: "" }];
  DB.initiatives.unshift(i);
  return i;
}

// ---------- to-do -----------------------------------------------------------
function ownerTodo(u) {
  return DB.initiatives.filter(i => isMine(u, i) && i.status !== "Cancelled" && !isFinal(i) && !i.submittedFor).map(i => {
    const to = nextStage(i), pend = requirements(i, to).filter(r => !r.done);
    const reason = i.returned ? "Returned / rejected — update and resubmit"
      : i.status === "On hold" ? "On hold"
      : pend.length ? `${pend.length} checklist item(s) pending for ${to}` : `Ready to submit for ${to}`;
    return { i, reason, ready: !pend.length && i.status !== "On hold" };
  });
}
const signTodo = u => DB.initiatives.filter(i => myPendingRoles(u, i).length);
