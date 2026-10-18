/* XcLENCE — page rendering (string templates). Every user-supplied string goes through esc(). */

// ---------- helpers ---------------------------------------------------------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LOGO = "logo.webp"; // the build script inlines this as a data URI
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = d => { if (!d) return "—"; const [y, m, dd] = d.split("-"); return dd ? `${+dd} ${MON[+m - 1]} ${y}` : `${MON[+m - 1]} ${y}`; };
function fmtV(v, unit) {
  if (unit === "Mn THB") return (Math.round(num(v) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Math.round(num(v)).toLocaleString("en-US");
}
const fmtCell = (v, unit) => v === null || v === undefined ? "" : unit === "Mn THB" ? (Math.round(v * 1000) / 1000).toString() : Math.round(v).toLocaleString("en-US");
const uname = id => { const u = U(id); return u ? u.name : "—"; };
const dis = ed => ed ? "" : "disabled";
function opts(list, val, blank = "— select —") {
  return (blank !== null ? `<option value="">${blank}</option>` : "") + list.map(o => {
    const v = typeof o === "object" ? o.v : o, l = typeof o === "object" ? o.l : o;
    return `<option value="${esc(v)}" ${String(v) === String(val ?? "") ? "selected" : ""}>${esc(l)}</option>`;
  }).join("");
}
const userList = () => DB.users.map(u => ({ v: u.id, l: `${u.emp} : ${u.name}` }));
const visible = () => DB.initiatives.filter(i => canSee(ME, i));
const orgLabel = i => i.track === "S" ? [i.company, i.flagship].filter(Boolean).join(" · ") : [i.company, i.dept].filter(Boolean).join(" – ");

const ICO = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  chart: '<path d="M5 20V10M10 20V4M15 20v-8M20 20v-5"/>',
  leaf: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7"/>',
  flag: '<path d="M6 21V4h11l-2 4 2 4H6"/>',
  clip: '<path d="M16 7l-7 7a2 2 0 003 3l7-7a4 4 0 00-6-6l-7 7a6 6 0 008 8l6-6"/>',
  form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  plus: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
  book: '<path d="M4 5a2 2 0 012-2h5v17H6a2 2 0 00-2 2zM20 5a2 2 0 00-2-2h-5v17h5a2 2 0 012 2z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  dash: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="4"/><rect x="13" y="10" width="7" height="10"/><rect x="4" y="13" width="7" height="7"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3 3 7 3s7-1.3 7-3"/>',
  bell: '<path d="M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>',
  info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/>',
};
const ico = (n, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
const TAB_ICON = { overview: "home", timeline: "clock", impact: "chart", sustain: "leaf", milestones: "flag", attachments: "clip", questionnaire: "form" };

function statusPill(i) {
  const cls = { "On track": "g", "Needs leadership attention": "a", "On hold": "n", "Cancelled": "r" }[i.status] || "n";
  return `<span class="pill ${cls}"><i></i>${esc(i.status)}</span>${i.submittedFor ? ` <span class="pill b">Pending ${i.submittedFor} approval</span>` : ""}`;
}
const stageChip = i => `<span class="stg s${i.stage}">${i.stage}</span>`;
const crumb = parts => `<div class="crumb">${parts.map(esc).join(" &gt; ")}</div>`;
function pagehead(parts, title, extra = "") { return `<div class="pagehead">${crumb(parts)}<h1>${esc(title)}${extra}</h1></div>`; }
const kpi = (label, value, sub = "", cls = "") => `<div class="kpi ${cls}"><label>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</label><b>${value}</b></div>`;

// ---------- form controls bound to the open initiative ----------------------
const fid = p => "f_" + p.replace(/[^\w]/g, "_");
function inp(i, path, ed, o = {}) {
  const v = getPath(i, path);
  return `<input id="${fid(path)}" type="${o.type || "text"}" value="${esc(v ?? "")}" data-f="${path}" data-label="${esc(o.label || path)}" ${o.num ? 'data-num="1" step="any"' : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} onchange="onField(this)" ${dis(ed)}>`;
}
function txt(i, path, ed, o = {}) {
  return `<textarea id="${fid(path)}" data-f="${path}" data-label="${esc(o.label || path)}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} onchange="onField(this)" ${dis(ed)}>${esc(getPath(i, path) ?? "")}</textarea>`;
}
function sel(i, path, list, ed, o = {}) {
  return `<select id="${fid(path)}" data-f="${path}" data-label="${esc(o.label || path)}" onchange="onField(this)" ${dis(ed)}>${opts(list, getPath(i, path))}</select>`;
}
function fld(i, k, label, ctl, cls = "") {
  const req = fieldReq(i, k), miss = req && isEmpty(i[k]);
  return `<div class="fld ${cls} ${miss ? "miss" : ""}"><label for="${fid(k)}">${esc(label)}${req ? '<i class="req" title="Required">*</i>' : ""}</label>${ctl}</div>`;
}
const roF = (label, v, cls = "") => `<div class="fld ${cls}"><label>${esc(label)}</label><div class="rofield">${v}</div></div>`;
function yn(i, path, ed) {
  const v = getPath(i, path);
  return `<span class="yn"><button type="button" class="ynb y ${v === "Yes" ? "on" : ""}" onclick="setValue('${path}','Yes')" ${dis(ed)}>Yes</button><button type="button" class="ynb n ${v === "No" ? "on" : ""}" onclick="setValue('${path}','No')" ${dis(ed)}>No</button></span>`;
}

// ---------- chrome ----------------------------------------------------------
function topbar() {
  const n = signTodo(ME).length + ownerTodo(ME).filter(o => o.i.returned || o.ready).length;
  const ini = ME.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return `<header class="topbar">
    <button class="iconbtn" onclick="toggleSide()" aria-label="Toggle menu">${ico("menu")}</button>
    <a href="#/home" class="brand"><img src="${LOGO}" alt="XcLENCE — Excellence"></a>
    <div class="tb-right">
      <div class="userchip"><div><b>${esc(ME.emp)} | ${esc(ME.name.toUpperCase())}</b><small>${esc(roleName(ACTIVE_ROLE))} · ${esc(ME.company)}</small></div><span class="avatar">${esc(ini)}</span></div>
      <a class="iconbtn bell" href="#/todo" title="To-do list (${n})">${ico("bell")}${n ? `<span class="badge">${n}</span>` : ""}</a>
      <a class="btn ghost sm" href="#/login">Sign out</a>
    </div></header>`;
}
function sidebar() {
  const h = NAV;
  const it = (href, label, icon) => `<a href="#${href}" class="${h === "#" + href ? "on" : ""}">${icon ? ico(icon) : ""}<span>${esc(label)}</span></a>`;
  let html = `<nav class="side ${SIDE ? "" : "collapsed"}" aria-label="Main">`;
  if (CUR) {
    const tabs = XC.TABS[CUR.track];
    html += `<div class="sgroup"><div class="sg-h">Initiative <small>${esc(CUR.id)}</small></div>${Object.keys(tabs).map(t =>
      `<a href="#/init/${CUR.id}/${t}" class="tab ${ROUTE[2] === t ? "on" : ""}">${ico(TAB_ICON[t])}<span>${XC.TAB_LABEL[t]}</span>${tabs[t] === "r" ? '<i class="rdot" title="Required tab"></i>' : ""}</a>`).join("")}</div>`;
  }
  html += `<div class="sgroup"><div class="sg-h">System</div>
    <details ${!CUR ? "open" : ""}><summary>${ico("plus")}Initiative</summary>${it("/new", "New Initiative")}${it("/todo", "To do List")}${it("/search", "Search Initiative")}</details>
    <details><summary>${ico("book")}Manual &amp; Rule Book</summary>${it("/manual", "Manual")}${it("/rulebook", "Rulebook")}${it("/faq", "FAQ")}</details>
    ${isAdmin(ME) ? `<details><summary>${ico("gear")}Admin</summary>${it("/admin", "User Management")}</details>` : ""}
    <details><summary>${ico("dash")}Dashboard</summary>${it("/dash/M", "MissionX Dashboard")}${it("/dash/S", "GHG Dashboard")}${it("/dash/P", "PIC Dashboard")}</details>
    <details><summary>${ico("db")}Master Data</summary>${it("/data/M", "MissionX Data")}${it("/data/S", "GHG Data")}${it("/data/P", "PIC Data")}</details>
  </div></nav>`;
  return html;
}

// ---------- login -----------------------------------------------------------
function viewLogin() {
  const dom = LOGIN.domain || "PTT";
  const users = DB.users.filter(u => u.company === dom);
  const sel1 = users.find(u => u.id === LOGIN.user) || users[0];
  return `<div class="loginbg"><form class="logincard" onsubmit="event.preventDefault();doLogin()">
    <div class="lc-top">PTT Group</div>
    <img src="${LOGO}" alt="XcLENCE — Excellence" class="lc-logo">
    <label class="lc-l">Domain<select onchange="LOGIN.domain=this.value;LOGIN.user='';render()">${opts(cfgList("domains"), dom, null)}</select></label>
    <label class="lc-l">Account <small>demo — Active Directory sign-on is skipped in this build</small>
      <select onchange="LOGIN.user=this.value;render()">${users.map(u => `<option value="${u.id}" ${sel1 && u.id === sel1.id ? "selected" : ""}>${esc(u.name)} — ${esc(u.roles.map(roleName).join(", "))}</option>`).join("")}</select></label>
    ${sel1 ? `<input readonly value="${esc(sel1.email)}" aria-label="Email"><input readonly value="${esc(sel1.name)}" aria-label="Name">
      <select id="lg_role" aria-label="Role">${opts(sel1.roles.map(r => ({ v: r, l: roleName(r) })), sel1.roles[0], null)}</select>
      <input type="hidden" id="lg_user" value="${sel1.id}">` : `<p class="muted">No demo account for this domain.</p>`}
    <button class="btn navy wide" ${sel1 ? "" : "disabled"}>LOG ON</button>
    <div class="lc-foot"><span>XcLENCE Program by PTT</span><span>${XC.VERSION}</span></div>
  </form></div>`;
}

// ---------- home / to-do / search -------------------------------------------
function initTable(list, empty = "No initiatives match.") {
  return `<div class="tablewrap"><table class="grid"><thead><tr><th>Initiative No.</th><th>Project</th><th>Initiative Name</th><th>Flagship / Department</th><th class="r">Total Impact</th><th>Impact Unit</th><th>Impact Year</th><th>Group</th><th>Stage</th><th>Status</th></tr></thead><tbody>
    ${list.map(i => { const h = headline(i); return `<tr><td><a class="idlink" href="#/init/${i.id}/overview">${i.id}</a></td><td>${trackName(i.track)}</td><td>${esc(i.title || "(untitled)")}</td><td>${esc(orgLabel(i) || "—")}</td><td class="r num">${fmtV(h.v, h.unit)}</td><td>${h.unit}</td><td>${impactYear(i)}</td><td>${classOf(i)}</td><td>${stageChip(i)}</td><td>${statusPill(i)}</td></tr>`; }).join("")
      || `<tr><td colspan="10" class="empty">${empty}</td></tr>`}
  </tbody></table></div>`;
}
function viewHome() {
  const vis = visible(), sign = signTodo(ME), own = ownerTodo(ME), mine = vis.filter(i => isMine(ME, i));
  const last = i => (i.audit[i.audit.length - 1] || {}).when || "";
  const recent = [...vis].sort((a, b) => last(b).localeCompare(last(a))).slice(0, 6);
  return pagehead(["Home"], `Welcome, ${ME.name}`) + `
    <div class="kpis">
      <a class="kpi link" href="#/todo"><label>Awaiting my sign-off</label><b>${sign.length}</b></a>
      <a class="kpi link" href="#/todo"><label>My initiatives — action needed</label><b>${own.length}</b></a>
      <div class="kpi"><label>My initiatives</label><b>${mine.length}</b></div>
      <div class="kpi"><label>Initiatives I can see</label><b>${vis.length}</b></div>
    </div>
    <div class="card pad"><div class="row between"><h2>Recently updated</h2><a class="btn blue sm" href="#/new">${ico("plus")} New Initiative</a></div>${initTable(recent, "Nothing to show yet.")}</div>`;
}
function viewTodo() {
  const sign = signTodo(ME), own = ownerTodo(ME);
  return pagehead(["Home", "Initiative", "To do List"], "To do List") + `
    <div class="card pad"><h2>For approvers <small>filtered by your approval authority</small></h2>
    <div class="tablewrap"><table class="grid"><thead><tr><th>Initiative No.</th><th>Project</th><th>Initiative Name</th><th>Flagship / Department</th><th>Gate</th><th>Sign as</th><th>Signed</th><th class="r">Days pending</th></tr></thead><tbody>
      ${sign.map(i => { const to = i.submittedFor, sig = i.approvals[to] || {}, roles = gateRoles(i, to);
        return `<tr><td><a class="idlink" href="#/init/${i.id}/overview">${i.id}</a></td><td>${trackName(i.track)}</td><td>${esc(i.title)}</td><td>${esc(orgLabel(i))}</td><td>${i.stage} → ${to}</td><td>${myPendingRoles(ME, i).map(roleName).join(", ")}</td><td>${roles.filter(r => sig[r]).length} / ${roles.length}</td><td class="r num">${daysSince(i.tl.a["sub:" + to])}</td></tr>`; }).join("")
        || `<tr><td colspan="8" class="empty">Nothing is waiting for your sign-off.</td></tr>`}
    </tbody></table></div></div>
    <div class="card pad"><h2>For initiative owners &amp; leaders <small>your cards that need an action</small></h2>
    <div class="tablewrap"><table class="grid"><thead><tr><th>Initiative No.</th><th>Project</th><th>Initiative Name</th><th>Stage</th><th>Status</th><th>What to do</th></tr></thead><tbody>
      ${own.map(o => `<tr><td><a class="idlink" href="#/init/${o.i.id}/${o.ready ? "overview" : "timeline"}">${o.i.id}</a></td><td>${trackName(o.i.track)}</td><td>${esc(o.i.title || "(untitled)")}</td><td>${stageChip(o.i)}</td><td>${statusPill(o.i)}</td><td class="${o.i.returned ? "warnt" : o.ready ? "okt" : ""}">${esc(o.reason)}</td></tr>`).join("")
        || `<tr><td colspan="6" class="empty">Nothing needs your action.</td></tr>`}
    </tbody></table></div></div>`;
}
function viewSearch() {
  const vis = visible(), f = SF;
  const years = [...new Set(vis.map(impactYear))].sort();
  const s = (k, label, list) => `<label class="sf"><span>${label}</span><select onchange="SF.${k}=this.value;render()">${opts(list, f[k], "All")}</select></label>`;
  const list = vis.filter(i => (!f.type || i.track === f.type)
    && (!f.no || (i.id + " " + i.title).toLowerCase().includes(f.no.toLowerCase()))
    && (!f.year || impactYear(i) === +f.year) && (!f.flagship || i.flagship === f.flagship) && (!f.dept || i.dept === f.dept)
    && (!f.group || classOf(i) === f.group) && (!f.category || i.category === f.category)
    && (!f.time || (f.time === "Yes") === !!(num(i.time.plan) || num(i.time.actual)))
    && (!f.levers || i.levers === f.levers) && (!f.source || i.source === f.source));
  return pagehead(["Home", "Initiative", "Search Initiative"], "Search Initiative") + `
    <div class="card pad">
      <div class="row between"><span class="muted small">Showing initiatives your role can see (${vis.length}).</span>
        <label class="switch"><input type="checkbox" ${ADV ? "checked" : ""} onchange="ADV=this.checked;render()"> Advance Search</label></div>
      <div class="sfgrid">
        ${s("type", "Select Project Type", Object.keys(XC.TRACKS).map(t => ({ v: t, l: `${t} : ${trackName(t)}` })))}
        <label class="sf"><span>Initiative No. / Name</span><input id="sf_no" value="${esc(f.no || "")}" oninput="SF.no=this.value;renderKeep()" placeholder="e.g. M2026-0001"></label>
        ${s("year", "Impact Year", years)}${s("flagship", "Flagship", cfgList("flagships"))}${s("dept", "Department", cfgList("depts"))}
        ${ADV ? s("group", "Project Classified Group", DB.config.classes.money.map(c => c[0])) + s("category", "Initiative Category", cfgList("categories"))
          + s("time", "Time Reduction", [{ v: "Yes", l: "Has time reduction" }, { v: "No", l: "No time reduction" }]) + s("levers", "Levers", cfgList("levers"))
          + s("source", "Source of Loss Gain (PIC)", cfgList("sources")) : ""}
      </div>
      <div class="row center"><button class="btn ghost" onclick="SF={};render()">CLEAR</button><button class="btn blue" onclick="render()">SEARCH</button></div>
      ${initTable(list)}
    </div>`;
}

// ---------- new initiative (decision tree) ----------------------------------
function viewNew() {
  const n = NEWF, track = n.sus === "Yes" ? "S" : n.sus === "No" && n.big ? (n.big === "Yes" ? "M" : "P") : null;
  const q = (key, label, help) => `<div class="dq"><div><b>${label}</b><small>${help}</small></div><span class="yn">
    <button type="button" class="ynb y ${n[key] === "Yes" ? "on" : ""}" onclick="NEWF.${key}='Yes';${key === "sus" ? "NEWF.big=null;" : ""}render()">Yes</button>
    <button type="button" class="ynb n ${n[key] === "No" ? "on" : ""}" onclick="NEWF.${key}='No';render()">No</button></span></div>`;
  let result = "";
  if (track) {
    const st = XC.TRACK_STAGES[track];
    result = `<div class="trackres t${track}"><div class="tr-h"><span class="tbadge t${track}">${track}</span><div><b>${trackName(track)}</b><small>${XC.TRACKS[track].desc}</small></div></div>
      <div class="tr-path">${st.map(s => `<span class="stg s${s}">${s}</span>`).join('<i>→</i>')}</div>
      <ul class="tr-gates">${st.slice(1).map(s => `<li><b>→ ${s}</b> ${XC.GATES[track][s].map(roleName).join(" + ")}</li>`).join("")}</ul>
      <div class="tr-tabs">Required tabs: ${Object.entries(XC.TABS[track]).filter(([, v]) => v === "r").map(([k]) => XC.TAB_LABEL[k]).join(" · ")}</div></div>
      <div class="card pad"><h2>Basic information</h2><div class="fgrid">
        <div class="fld span2"><label for="nf_title">Initiative Name<i class="req">*</i></label><input id="nf_title" value="${esc(n.title || "")}" oninput="NEWF.title=this.value"></div>
        <div class="fld span2"><label for="nf_ov">Overview<i class="req">*</i></label><textarea id="nf_ov" oninput="NEWF.overview=this.value">${esc(n.overview || "")}</textarea></div>
        <div class="fld"><label for="nf_co">Select Company<i class="req">*</i></label><select id="nf_co" onchange="NEWF.company=this.value">${opts(cfgList("companies"), n.company || ME.company)}</select></div>
        ${track === "S"
          ? `<div class="fld"><label for="nf_fl">Flagship<i class="req">*</i></label><select id="nf_fl" onchange="NEWF.flagship=this.value">${opts(cfgList("flagships"), n.flagship || ME.flagship)}</select></div>`
          : `<div class="fld"><label for="nf_dp">Department<i class="req">*</i></label><select id="nf_dp" onchange="NEWF.dept=this.value">${opts(cfgList("depts"), n.dept || ME.dept)}</select></div>`}
      </div>
      <p class="muted small">You become the Initiative Owner. The number is assigned on create (${track}${new Date().getFullYear()}-NNNN). Everything else can be completed on the initiative page before you submit for L2.</p>
      <div class="row"><button class="btn blue" onclick="doCreate('${track}')">Create initiative</button><a class="btn ghost" href="#/home">Cancel</a></div></div>`;
  }
  return pagehead(["Home", "Initiative", "New Initiative"], "New Initiative") + `
    <div class="card pad"><h2>Loss &amp; Gain Identification</h2><p class="muted small">Two questions decide which process (track) the initiative follows.</p>
      ${q("sus", "1. Is it sustainability-relevant (GHG reduction)?", "Yes → GHG track (S), whatever the money impact")}
      ${n.sus === "No" ? q("big", "2. Is the expected money impact 1 Mn THB or more?", "Yes → MissionX (M) · No → PIC (P): money below 1 Mn THB, time and others") : ""}
    </div>${result}`;
}

// ---------- initiative page -------------------------------------------------
function route(i) {
  const st = stagesOf(i);
  return `<ol class="route">${XC.STAGE_ORDER.map(s => {
    const inT = st.includes(s), idx = stageNum(s), cur = stageNum(i.stage);
    let cls = !inT ? "skip" : idx <= cur ? "done" : s === i.submittedFor ? "pend" : "todo";
    if (s === i.stage) cls += " cur";
    return `<li class="rt ${cls}" ${inT ? 'tabindex="0"' : ""}><span class="bub">${s}</span><small>${inT ? XC.STAGES[s] : "n/a"}</small>${inT ? `<div class="tip" role="tooltip">${routeTip(i, s)}</div>` : ""}</li>`;
  }).join("")}</ol>`;
}
function routeTip(i, s) {
  if (s === "L1") return `<div class="tip-h">L1 Idea</div><div class="tip-r"><span>Created by ${esc(uname(i.owner))}</span><span class="st ok">${fmtDate(i.tl.a.L1 || i.created)}</span></div>`;
  const roles = gateRoles(i, s), sig = (i.approvals || {})[s] || {}, reached = stageNum(i.stage) >= stageNum(s);
  const head = reached ? `Approved into ${s}` : i.submittedFor === s ? `Waiting for sign-off → ${s}` : `Sign-off needed → ${s}`;
  return `<div class="tip-h">${head}</div>` + roles.map(r => {
    const a = sig[r];
    return `<div class="tip-r"><span><b>${esc(a ? a.by : holderNames(r, i))}</b> <em>(${esc(roleName(r))})</em></span>${a ? `<span class="st ok">Approved ${esc(a.at)}</span>` : i.submittedFor === s ? '<span class="st bad">Pending</span>' : '<span class="st muted">Not started</span>'}</div>`;
  }).join("");
}
function sumbar(i) {
  const h = headline(i);
  return `<section class="sumbar card">
    <div class="sb"><label>Initiative No.</label><div class="initno">${i.id}</div><div>${statusPill(i)}</div></div>
    <div class="sb"><label>Stage</label><div class="big">${i.stage}</div><small>${XC.STAGES[i.stage]}</small></div>
    <div class="sb wide"><label>Workflow Route <small>hover a stage to see sign-offs</small></label>${route(i)}</div>
    <div class="sb"><label>${i.track === "S" ? "Flagship" : "Org. or Dept."}</label><div class="mid">${esc((i.track === "S" ? i.flagship : i.dept) || i.company || "—")}</div></div>
    <div class="sb"><label>Total Impact <small>latest est., annualized</small></label><div class="mid">${fmtV(h.v, h.unit)} <small>${h.unit}</small></div></div>
    <div class="sb"><label>Impact Year</label><div class="mid">${impactYear(i)}</div></div>
  </section>`;
}
function gateBox(i) {
  if (!i.submittedFor) return i.returned ? `<div class="notice warn">${ico("info")}<span>This initiative was returned or rejected. Read the comment log, update it and resubmit.</span></div>` : "";
  const to = i.submittedFor, roles = gateRoles(i, to), sig = i.approvals[to] || {}, mine = myPendingRoles(ME, i);
  const rows = roles.map(r => sig[r]
    ? `<li class="ok"><span class="mark">✓</span><b>${esc(roleName(r))}</b> — ${esc(sig[r].by)} <span class="muted">${esc(sig[r].at)}</span></li>`
    : `<li><span class="mark">○</span><b>${esc(roleName(r))}</b> — <span class="muted">waiting for ${esc(holderNames(r, i))}</span></li>`).join("");
  return `<div class="gatebox card ${mine.length ? "mine" : ""}">
    <div class="gb-h"><b>Submitted for ${to} approval</b><span>${roles.filter(r => sig[r]).length} of ${roles.length} sign-offs · ${daysSince(i.tl.a["sub:" + to])} day(s) pending</span></div>
    <ul class="siglist">${rows}</ul>
    ${mine.length ? `<p class="gb-hint">${ico("info")} Your sign-off is requested — add a comment and use <b>Approve</b> or <b>Reject</b> at the bottom of the page.</p>` : ""}
  </div>`;
}
// Bottom bar: the approver's row (comment + Approve / Reject) and the owner's row (Cancel / Return / Submit).
function actionBar(i) {
  const mine = myPendingRoles(ME, i), ed = canEdit(ME, i);
  let rows = "";
  if (mine.length) {
    rows += `<div class="ab-row ab-sign">
      <div class="ab-label"><b>Your sign-off · ${i.stage} → ${i.submittedFor}</b><small>as ${esc(mine.map(roleName).join(", "))}</small></div>
      <textarea id="gate_c" rows="2" aria-label="Approval comment" placeholder="Comment — required to reject, optional to approve"></textarea>
      <div class="ab-btns">${mine.map(r => `<button class="btn green" onclick="doApprove('${r}')">✓ Approve${mine.length > 1 ? " as " + esc(roleName(r)) : ""}</button>`).join("")}
        <button class="btn red" onclick="doReject()">✕ Reject</button></div></div>`;
  }
  if (ed) {
    const to = nextStage(i), prev = prevStage(i), pend = to ? requirements(i, to).filter(r => !r.done) : [];
    const active = i.status !== "On hold" && i.status !== "Cancelled";
    const why = !active ? `Initiative is ${i.status}` : pend.length ? "Complete the checklist on Timeline & Status first" : "";
    rows += `<div class="ab-row ab-own">
      <details class="pop" ${OPEN === "hold" ? "open" : ""} ontoggle="popToggle(this,'hold')"><summary class="btn red">${active ? "Cancel / On hold" : "Re-activate"}</summary>
        <div class="popbody">${active ? `<label>New status<select id="hold_s"><option>On hold</option><option>Cancelled</option></select></label>` : `<input type="hidden" id="hold_s" value="On track">`}
          <textarea id="hold_c" placeholder="Comment${active ? " (required)" : ""}"></textarea><button class="btn navy sm" onclick="doStatus()">${active ? "Apply" : "Re-activate"}</button></div></details>
      ${prev ? `<details class="pop" ${OPEN === "ret" ? "open" : ""} ontoggle="popToggle(this,'ret')"><summary class="btn yellow">Return to ${prev}</summary>
        <div class="popbody"><textarea id="ret_c" placeholder="Why does it go back? (required)"></textarea><button class="btn navy sm" onclick="doReturn()">Return to ${prev}</button></div></details>` : ""}
      ${i.submittedFor ? `<button class="btn ghost" onclick="doWithdraw()">Withdraw ${i.submittedFor} submission</button>`
        : to ? `<button class="btn blue" onclick="doSubmit()" ${why ? `disabled title="${esc(why)}"` : ""}>Submit to ${to}</button>` : '<span class="done-tag">✓ Final stage reached</span>'}
      ${pend.length && !i.submittedFor && to ? `<a class="pendlink" href="#/init/${i.id}/timeline">${pend.length} checklist item(s) pending</a>` : ""}
    </div>`;
  }
  if (!rows) return `<div class="actionbar ro">${ico("info")}<span>Read-only — your role can view this initiative but not edit it.</span></div>`;
  return `<div class="actionbar">${rows}</div>`;
}
// Confirmation when the Money Step completion date and the L4 forecast date change (they move together).
function linkBanner(i) {
  const p = PENDING_LINK;
  if (!p || p.id !== i.id) return "";
  const ms = moneyStep(i);
  const msg = p.kind === "ms"
    ? `This will update the L4 forecast date of this initiative to <b>${fmtDate(p.value)}</b> (Impact Year ${p.value.slice(0, 4)}).`
    : `This will also change the completion date of Money Step milestone <b>#${esc(ms ? ms.id : "")}</b> to <b>${fmtDate(p.value)}</b>.`;
  return `<div class="confirmbar" role="alertdialog" aria-live="assertive">${ico("info")}<span>${msg} To proceed with the update, click Confirm.</span>
    <button class="btn blue sm" onclick="confirmLink()">Confirm</button><button class="btn ghost sm" onclick="cancelLink()">Cancel</button></div>`;
}
const feedHtml = i => {
  const f = ACTF;
  const items = [...i.audit].reverse().filter(e => f === "all" || (f === "comment" ? (e.kind === "comment" || !!e.comment) : f === "approval" ? (e.kind === "approval" || e.kind === "workflow") : e.kind === "edit"));
  return `<ol class="feed">${items.map(e => `<li class="k-${e.kind}"><span class="dot"></span><div><div class="fh"><b>${esc(e.who)}</b><span class="muted">${esc(e.when)}</span></div><div>${esc(e.action)}</div>${e.comment ? `<div class="cm">“${esc(e.comment)}”</div>` : ""}</div></li>`).join("") || '<li class="empty">No activity.</li>'}</ol>`;
};
function activity(i) {
  return `<aside class="activity card" aria-label="Activity and comment log">
    <div class="act-h"><b>Comment log</b><select onchange="ACTF=this.value;render()" aria-label="Filter activity">${opts([{ v: "all", l: "Show Everything" }, { v: "comment", l: "Comments" }, { v: "approval", l: "Approvals & workflow" }, { v: "edit", l: "Edits" }], ACTF, null)}</select></div>
    <div class="cbox"><textarea id="cm_t" placeholder="Add a comment for the team…"></textarea><button class="btn navy sm" onclick="doComment()">Post comment</button></div>
    ${feedHtml(i)}
  </aside>`;
}
const saveStateHtml = () => SAVING ? '<span class="dotpulse"></span>Saving…' : `✓ All changes saved${SAVED_AT ? " · " + SAVED_AT : ""}`;
function viewInit(id, tab) {
  const i = INIT(id);
  if (!i) return pagehead(["Home", "Initiative"], "Not found") + `<div class="card pad">Initiative ${esc(id)} doesn't exist. <a href="#/search">Search initiatives</a></div>`;
  if (!canSee(ME, i)) return pagehead(["Home", "Initiative"], "No access") + `<div class="card pad">Your role can't see ${esc(id)}. Ask the initiative owner or an admin for access.</div>`;
  const tabs = XC.TABS[i.track];
  if (!tabs[tab]) tab = "overview";
  const ed = canEdit(ME, i);
  const body = { overview: tabOverview, timeline: tabTimeline, impact: tabImpact, sustain: tabSustain, milestones: tabMilestones, attachments: tabAttachments, questionnaire: tabQuestionnaire }[tab](i, ed);
  return `<div class="initgrid"><div class="initmain">
    ${pagehead(["Home", "Initiative", XC.TAB_LABEL[tab]], XC.TAB_LABEL[tab], ` <span class="namepill">${esc(i.title || "(untitled)")}</span>${ed ? `<span class="savestate" id="savestate" role="status" title="Autosave — every edit is saved and written to the comment log">${saveStateHtml()}</span>` : ""}`)}
    ${sumbar(i)}${linkBanner(i)}${gateBox(i)}
    ${tabs[tab] === "o" ? `<div class="notice">${ico("info")}<span>Optional tab for ${trackName(i.track)} initiatives${tab === "impact" && i.track === "S" ? " — financial impact is not required" : ""}.</span></div>` : ""}
    ${body}
    ${actionBar(i)}
  </div>${activity(i)}</div>`;
}

// ---------- tab: overview ---------------------------------------------------
function kpiStripPlan(i) {
  if (i.track === "S") { const t = susTotals(i, "f"); return `<div class="kpis sm">${kpi("Total Emission Impact", fmtV(t.sum, "t"), "forecast, annualized · tCO₂e")}${kpi("Net Recurring Emission", fmtV(t.netRec, "t"), "forecast · tCO₂e")}${kpi("One-time Emission", fmtV(t.oneTime, "t"), "forecast · tCO₂e")}</div>`; }
  const t = finTotals(i, "f");
  return `<div class="kpis sm">${kpi("Total Impact", fmtV(t.fin, "Mn THB"), "forecast, annualized · Mn THB")}${kpi("Net Recurring", fmtV(t.netRec, "Mn THB"), "forecast, annualized")}${kpi("One-time benefit", fmtV(t.ob, "Mn THB"), "forecast, annualized")}${kpi("One-time Cost", fmtV(t.oc, "Mn THB"), "planned, annualized")}</div>`;
}
function tabOverview(i, ed) {
  const subs = [["info", "Initiative Info."], ["charter", "Initiative Charter"], ["assumption", "Assumption Template"]];
  const body = OVSUB === "charter" ? ovCharter(i, ed) : OVSUB === "assumption" ? ovAssumption(i, ed) : ovInfo(i, ed);
  return `<div class="subtabs" role="tablist">${subs.map(([k, l]) => `<button role="tab" aria-selected="${OVSUB === k}" class="${OVSUB === k ? "on" : ""}" onclick="OVSUB='${k}';render()">${l}</button>`).join("")}</div><div class="card pad">${body}</div>`;
}
function teamPicker(i, ed) {
  const names = (i.team || []).map(uname).join(", ") || "— select —";
  return `<details class="multi" ${OPEN === "team" ? "open" : ""} ontoggle="popToggle(this,'team')"><summary>${esc(names)}</summary><div class="multilist">
    ${DB.users.map(u => `<label><input type="checkbox" id="team_${u.id}" ${(i.team || []).includes(u.id) ? "checked" : ""} onchange="onTeam('${u.id}',this.checked)" ${dis(ed)}> ${esc(u.name)} <small>${esc(u.company)}${u.dept ? " · " + esc(u.dept) : ""}</small></label>`).join("")}</div></details>`;
}
function ovInfo(i, ed) {
  const L = cfgList;
  return `<h3 class="sec">Initiative Information</h3>
    ${fld(i, "title", "Initiative Name", inp(i, "title", ed, { label: "Initiative Name" }), "full")}
    ${fld(i, "overview", "Overview", txt(i, "overview", ed, { label: "Overview", ph: "Be specific — what are we actually changing that creates value?" }), "full")}
    <div class="fgrid">
      ${fld(i, "owner", "Initiative Owner", sel(i, "owner", userList(), ed, { label: "Initiative Owner" }))}
      ${fld(i, "backup", "Initiative Owner (Back-up)", sel(i, "backup", userList(), ed, { label: "Initiative Owner (Back-up)" }))}
      ${fld(i, "company", "Select Company", sel(i, "company", L("companies"), ed, { label: "Company" }))}
      ${fld(i, "dept", "Department", sel(i, "dept", L("depts"), ed, { label: "Department" }))}
      ${roF("Impact Year (L4 Date)", `<b>${impactYear(i)}</b> · ${fmtDate(i.tl.a[i.track === "P" ? "L5" : "L4"] || forecastDate(i, i.track === "P" ? "L5" : "L4"))}`)}
      ${roF("Select Program", `${i.track} : ${esc(trackName(i.track))}`)}
      ${i.track !== "S" ? fld(i, "category", "Initiative Category", sel(i, "category", L("categories"), ed, { label: "Initiative Category" })) : ""}
      ${fld(i, "interCompany", "Inter-Company Impact?", sel(i, "interCompany", L("yesno"), ed, { label: "Inter-Company Impact" }))}
      ${fld(i, "crossVS", "Cross Sub-Value Stream", sel(i, "crossVS", L("depts"), ed, { label: "Cross Sub-Value Stream" }))}
    </div>
    ${kpiStripPlan(i)}
    <div class="fgrid">
      ${fld(i, "source", "Source of Loss & Gain", sel(i, "source", L("sources"), ed, { label: "Source of Loss & Gain" }))}
      ${fld(i, "qTools", "Q Tools", sel(i, "qTools", L("qtools"), ed, { label: "Q Tools" }))}
      ${fld(i, "team", "Working Team", teamPicker(i, ed), "span2")}
    </div>
    ${i.track === "S" ? `<h3 class="sec">GHG classification</h3><div class="fgrid">
      ${fld(i, "esg", "E, S or G Initiative?", sel(i, "esg", L("esg"), ed, { label: "E, S or G" }))}
      ${fld(i, "flagship", "Flagship", sel(i, "flagship", L("flagships"), ed, { label: "Flagship" }))}
      ${fld(i, "levers", "Levers", sel(i, "levers", L("levers"), ed, { label: "Levers" }))}
      ${fld(i, "initType", "Type of Initiative", sel(i, "initType", L("initTypes"), ed, { label: "Type of Initiative" }))}</div>` : ""}
    <label class="check"><input type="checkbox" id="f_innovation" data-f="innovation" data-label="Innovation" onchange="onField(this)" ${i.innovation ? "checked" : ""} ${dis(ed)}> Innovation initiative <span class="muted">(shared with InI for the innovation award)</span></label>`;
}
function fileList(i, key, ed) {
  const files = key === "charter" ? i.charter.files : [];
  return `<div class="files">${files.map((f, k) => `<div class="file"><span class="ftype">${esc((f.split(".").pop() || "").toUpperCase().slice(0, 4))}</span><span>${esc(f)}</span>${ed ? `<button class="x" onclick="removeCharterFile(${k})" aria-label="Remove ${esc(f)}">✕</button>` : ""}</div>`).join("") || '<span class="muted small">No file attached.</span>'}
    ${ed ? `<label class="btn navy sm browse">Browse<input type="file" multiple onchange="addCharterFiles(this)" hidden></label>` : ""}</div>`;
}
function ovCharter(i, ed) {
  return `<h3 class="sec">Project Charter Information</h3>
    ${roF("Initiative Name", esc(i.title || "—"), "full")}
    ${roF("Overview", esc(i.overview || "—"), "full tall")}
    ${kpiStripPlan(i)}
    <div class="fgrid">
      <div class="fld ${i.track === "M" && !has(i.charter.kvd) ? "miss" : ""}"><label for="f_charter_kvd">Key Value Driver${i.track === "M" ? '<i class="req">*</i>' : ""}</label>${inp(i, "charter.kvd", ed, { label: "Key Value Driver", ph: "e.g. Freight cost per tonne" })}</div>
      <div class="fld"><label for="f_charter_kvdUnit">Key Value Driver Unit</label>${inp(i, "charter.kvdUnit", ed, { label: "Key Value Driver Unit", ph: "e.g. USD/t" })}</div>
      <div class="fld span2"><label>Project Charter Attachment</label>${fileList(i, "charter", ed)}</div>
    </div>
    <p class="muted small">The charter is a live version — editable at every stage. Files: this build keeps file names only; the production build stores files.</p>`;
}
function ovAssumption(i, ed) {
  const a = i.assumption || {};
  const box = (k, label, help, ph) => `<div class="fld"><label for="${fid("assumption." + k)}">${label}${help ? ` <small>${help}</small>` : ""}</label>${txt(i, "assumption." + k, ed, { label, ph })}</div>`;
  return `<h3 class="sec">Project Charter Assumption</h3>
    ${roF("Initiative Name", esc(i.title || "—"), "full")}
    <div class="row between wrap">
      <div class="fld inline ${i.track === "P" && !has(a.has) ? "miss" : ""}"><label>Having Assumption Template?${i.track === "P" ? '<i class="req">*</i>' : ""}</label>${yn(i, "assumption.has", ed)}</div>
      <div class="row"><span class="muted small">Download Charter Template</span><button class="btn navy sm" onclick="downloadCharterTemplate()">Download</button></div>
    </div>
    ${a.has === "Yes" ? `<div class="fgrid two">
      ${box("current", "Current Conditions :", "Problem statement / break down the problem", "Numbers, text or both")}
      ${box("goals", "Set goals/targets :", "Objectives for improvement", "Numbers and a unit from the Loss & Gain analysis (time / money / others)")}
      ${box("rootCause", "Root Cause Analysis :", "", "Numbers, text or both")}
      ${box("solution", "Proposed solution/method :", "", "Numbers, text or both")}
      ${box("expected", "Expected Result/Result/Confirmation :", "", "Numbers, text or both")}</div>` : a.has === "No" ? '<p class="muted">No assumption template for this initiative.</p>' : ""}`;
}

// ---------- tab: timeline & status ------------------------------------------
function tabTimeline(i, ed) {
  const to = nextStage(i), req = requirements(i, to), st = stagesOf(i), cur = stageNum(i.stage);
  const rows = [];
  st.forEach((s, k) => {
    if (k > 0) rows.push({ label: `Submitted for ${s} approval`, a: i.tl.a["sub:" + s], state: stageNum(s) <= cur ? "Completed" : i.submittedFor === s ? "Current" : "Not Started" });
    rows.push({ label: `${s} (${XC.STAGES[s]})`, a: i.tl.a[s], s, state: stageNum(s) < cur ? "Completed" : s === i.stage ? (k === st.length - 1 ? "Completed" : "Current") : "Not Started" });
  });
  const fc = r => {
    if (!r.s || r.s === "L1") return "";
    const ms = moneyStep(i);
    if (r.s === "L4") {
      const f4 = forecastDate(i, "L4");
      const note = ms ? `<small class="linknote">↔ Money Step #${esc(ms.id)} completion date · sets the Impact Year</small>` : `<small class="linknote muted">No Money Step yet — add one on Project Milestones to link it</small>`;
      if (stageNum("L4") <= cur) return `<span class="linked">${fmtDate(f4)}</span>${note}`;
      return `<input type="date" id="f_tl_f_L4" value="${esc(f4 || "")}" onchange="onL4(this)" aria-label="L4 forecast date" ${dis(ed)}>${note}`;
    }
    if (stageNum(r.s) <= cur) return i.tl.f[r.s] ? `<span class="muted">${fmtDate(i.tl.f[r.s])}</span>` : "";
    return `<input type="date" id="${fid("tl.f." + r.s)}" value="${esc(i.tl.f[r.s] || "")}" data-f="tl.f.${r.s}" data-label="${r.s} forecast date" onchange="onField(this)" ${dis(ed)}>${r.s === "L5" && i.track === "P" ? '<small class="linknote muted">sets the Impact Year</small>' : ""}`;
  };
  const active = i.status !== "On hold" && i.status !== "Cancelled";
  return `<div class="card pad"><h2>A. Checklist Status ${to ? `<small>before submitting for ${to}</small>` : ""}</h2>
      ${to ? `<div class="tablewrap"><table class="list"><thead><tr><th>Tab</th><th>Requirement</th><th>Status</th></tr></thead><tbody>
        ${req.map(r => `<tr><td><a href="#/init/${i.id}/${r.tab}">${ico(TAB_ICON[r.tab])} ${XC.TAB_LABEL[r.tab]}</a></td><td>${esc(r.label)}</td><td>${r.done ? '<span class="st ok">● Completed</span>' : '<span class="st bad">● Pending</span>'}</td></tr>`).join("")}
      </tbody></table></div>` : '<p class="okt">Final stage reached — no further gate.</p>'}</div>
    <div class="card pad"><h2>B. Timeline</h2><div class="tablewrap"><table class="list tl"><thead><tr><th>State</th><th>Stage</th><th>Actual</th><th>Forecast</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.state === "Current" ? "curr" : ""}"><td><span class="tls ${r.state.replace(" ", "")}">${r.state === "Completed" ? "◉" : r.state === "Current" ? "◎" : "○"} ${r.state}</span></td><td>${esc(r.label)}</td><td>${fmtDate(r.a)}</td><td>${fc(r)}</td></tr>`).join("")}
    </tbody></table></div></div>
    <div class="card pad"><h2>C. Progress status</h2><div class="fgrid">
      <div class="fld"><label for="f_status">Weekly status</label>${active ? `<select id="f_status" data-f="status" data-label="Weekly status" onchange="onField(this)" ${dis(ed)}>${opts(["On track", "Needs leadership attention"], i.status, null)}</select>` : `<div class="rofield">${esc(i.status)} — use Re-activate below</div>`}</div>
      <div class="fld span3"><label for="f_rationale">Status rationale <small>required if not on track</small></label>${txt(i, "rationale", ed, { label: "Status rationale" })}</div>
    </div></div>`;
}

// ---------- tabs: impact & sustainability -----------------------------------
// Continuous month timeline (like WAVE): spans the data, the present month and the Money Step
// start, at least 12 months ahead of today; extendable 12 months either way.
function monthRange(i, key) {
  const present = todayISO().slice(0, 7), ms = msStartYM(i);
  const keys = (i[key] || []).flatMap(l => [...Object.keys((l.m || {}).f || {}), ...Object.keys((l.m || {}).a || {})]).sort();
  const pts = [present, ...(keys.length ? [keys[0], keys[keys.length - 1]] : []), ...(ms ? [ms] : [])].sort();
  let start = pts[0], end = pts[pts.length - 1];
  const minEnd = ymAdd(present, 11); if (end < minEnd) end = minEnd;
  const ext = GRIDEXT[i.id + key] || { b: 0, a: 0 };
  return ymRange(ymAdd(start, -12 * ext.b), ymAdd(end, 12 * ext.a));
}
function impactGrid(i, key, ed) {
  const S = key === "sustain", unit = S ? "tCO₂e" : "Mn THB", lines = i[key] || [];
  const months = monthRange(i, key), todayYM = todayISO().slice(0, 7), msYM = msStartYM(i), ms = moneyStep(i);
  const L = cfgList, kinds = [["f", "Forecast"], ["a", "Actual"], ["e", "Estimate"]];
  const moCls = m => `${m === todayYM ? "today" : ""} ${m === msYM ? "ms" : ""} ${m.endsWith("-01") ? "ys" : ""}`;
  const lsel = (l, k, list) => `<select id="ln_${key}_${l.id}_${k}" data-line="${key}|${l.id}|${k}" onchange="onLine(this)" aria-label="${k} of ${l.id}" ${dis(ed)}>${opts(list, l[k])}</select>`;
  const body = lines.map(l => kinds.map(([kind, kl], r) => {
    const first = r === 0 ? `<td rowspan="3" class="chk"><input type="checkbox" ${SEL.has(l.id) ? "checked" : ""} onchange="toggleSel('${l.id}',this.checked)" aria-label="Select ${l.id}" ${dis(ed)}></td>
      <td rowspan="3" class="lid">#${l.id}</td>
      <td rowspan="3" class="lfreq">${lsel(l, "freq", L("impactFreq"))}<span class="mtag ${l.mode === "manual" ? "man" : ""}">${l.mode === "manual" ? "Manual" : "Auto-fill"}</span>
        <div class="mode"><label><input type="radio" name="md_${key}_${l.id}" ${l.mode !== "manual" ? "checked" : ""} onchange="onMode('${key}','${l.id}','auto')" ${dis(ed)}> Auto-fill</label><label><input type="radio" name="md_${key}_${l.id}" ${l.mode === "manual" ? "checked" : ""} onchange="onMode('${key}','${l.id}','manual')" ${dis(ed)}> Manual</label></div></td>
      <td rowspan="3">${lsel(l, "type", L(S ? "susTypes" : "impactTypes"))}</td>
      ${S ? `<td rowspan="3">${lsel(l, "flagship", L("flagships"))}</td><td rowspan="3">${lsel(l, "scope", L("scopes"))}</td>` : `<td rowspan="3">${lsel(l, "pl", L("depts"))}</td>`}` : "";
    const ann = l.mode === "manual" && kind !== "e"
      ? `<input type="number" step="any" class="cell ann" id="an_${key}_${l.id}_${kind}" value="${esc((l.ann || {})[kind] ?? "")}" data-ann="${key}|${l.id}|${kind}" onchange="onAnn(this)" aria-label="${kl} annualized ${l.id}" ${dis(ed)}>`
      : `<b>${fmtCell(annual(l, kind), unit)}</b>`;
    const cells = months.map(m => {
      if (kind === "e") { const v = monthVal(l, "e", m); return `<td class="mo est ${moCls(m)}">${v === null ? "" : fmtCell(v, unit)}</td>`; }
      const v = ((l.m || {})[kind] || {})[m];
      return `<td class="mo ${moCls(m)}"><input type="number" step="any" class="cell" id="c_${key}_${l.id}_${kind}_${m}" value="${esc(v ?? "")}" data-cell="${key}|${l.id}|${kind}|${m}" onchange="onCell(this)" aria-label="${kl} ${m} ${l.id}" ${dis(ed) || (l.mode === "manual" ? "disabled" : "")}></td>`;
    }).join("");
    return `<tr class="v-${kind} ${r === 2 ? "lastrow" : ""}">${first}<td class="ver stk1">${r === 0 ? `<span class="vid">#${l.id}</span>` : ""}${kl}</td><td class="annc stk2">${ann}</td>${cells}</tr>`;
  }).join("")).join("");
  const thMonth = m => `<th class="mo ${moCls(m)}">${m === msYM ? '<span class="mk ms">Money Step</span>' : ""}${m === todayYM ? '<span class="mk today">Today</span>' : ""}${MON[+m.slice(5) - 1]}-${m.slice(0, 4)}</th>`;
  return `<div class="card pad">
    <div class="row between wrap"><div class="row wrap"><h2>${S ? "Sustainability Impact" : "Impact"}</h2><span class="chip">Grouped by Month</span>
      <span class="legend"><i class="lg today"></i>Present month (${fmtDate(todayYM)})
        <i class="lg ms"></i>${ms && msYM ? `Money Step start (${fmtDate(msYM)}) — money flows from here` : "Money Step start — not set (Project Milestones)"}</span></div>
      ${ed ? `<div class="row">${SEL.size ? `<button class="btn red-o sm" onclick="deleteLines('${key}')">Delete selected (${SEL.size})</button>` : ""}<button class="btn blue sm" onclick="addLine('${key}')">+ Add New Impact</button></div>` : ""}</div>
    <div class="gridtools"><button class="btn ghost sm" onclick="extendGrid('${key}','b')">◂ 12 months earlier</button>
      <button class="btn ghost sm" onclick="goToday()">Go to present month</button>
      <button class="btn ghost sm" onclick="extendGrid('${key}','a')">12 months later ▸</button>
      <span class="muted small">${fmtDate(months[0])} – ${fmtDate(months[months.length - 1])} · scroll sideways; Version and Annualized stay pinned</span></div>
    <div class="tablewrap gridwrap"><table class="igrid"><thead><tr><th></th><th>#</th><th>Frequency &amp; Direction</th><th>Type of impact</th>${S ? "<th>Flagship</th><th>Scope Impacted</th>" : "<th>P&amp;L Impact</th>"}<th class="stk1">Version</th><th class="stk2">Annualized<br><small>${unit}</small></th>
      ${months.map(thMonth).join("")}</tr></thead>
      <tbody>${body || `<tr><td colspan="${(S ? 8 : 7) + months.length}" class="empty">No impact lines yet${ed ? " — use “+ Add New Impact”" : ""}.</td></tr>`}</tbody></table></div>
    <p class="muted small">Enter monthly values as positive numbers in ${unit}; the line type decides whether it adds or subtracts. Auto-fill computes the annualized value from the months (see Rulebook); Manual lets you type it. Estimate = Actual where entered, otherwise Forecast.</p>
  </div>`;
}
function tabImpact(i, ed) {
  const e = finTotals(i, "e"), f = finTotals(i, "f"), P = i.track === "P";
  return `<div class="kpis">
      ${kpi("Total Impact", fmtV(e.fin, "Mn THB"), "latest est., annualized · Mn THB")}
      ${kpi("Forecast Impact", fmtV(f.fin, "Mn THB"), "latest est., annualized", P ? "dim" : "")}
      ${kpi("Net Recurring Impact", fmtV(e.netRec, "Mn THB"), "latest est., annualized")}
      ${kpi("One-time Impact", fmtV(e.oneTime, "Mn THB"), "latest est., annualized")}
      ${kpi("CAPEX Spend", i.capex.has === "Yes" ? fmtV(i.capex.amount, "Mn THB") : "—", "Mn THB · not in total")}
      ${kpi("Impact Year", impactYear(i))}
      ${i.locked ? kpi("Locked at L4", fmtV(i.locked.total, "Mn THB"), "forecast on " + fmtDate(i.locked.at)) : ""}
    </div>
    <div class="card pad row wrap"><div class="fld inline ${i.track === "M" && !has(i.capex.has) ? "miss" : ""}"><label>Having CAPEX Spend?${i.track === "M" ? '<i class="req">*</i>' : ""}</label>${yn(i, "capex.has", ed)}</div>
      <div class="fld inline"><label for="f_capex_amount">CAPEX Spend</label>${inp(i, "capex.amount", ed && i.capex.has === "Yes", { num: 1, type: "number", label: "CAPEX Spend" })} <span class="muted">M THB</span></div>
      <span class="muted small">Investment only — recorded for monitoring, not included in Total Impact.</span></div>
    ${impactGrid(i, "impacts", ed)}
    ${P ? `<div class="card pad"><h2>Time Reduction</h2><div class="fgrid">
      <div class="fld"><label for="f_time_plan">Plan Time Reduction <small>hours / year</small></label>${inp(i, "time.plan", ed, { num: 1, type: "number", label: "Plan time reduction" })}</div>
      <div class="fld"><label for="f_time_actual">Actual Time Reduction <small>hours / year</small></label>${inp(i, "time.actual", ed, { num: 1, type: "number", label: "Actual time reduction" })}</div></div>
      <p class="muted small">PIC records time saved alongside money; below 1 Mn THB the headline shows hours when there's no money impact.</p></div>` : ""}`;
}
function tabSustain(i, ed) {
  const e = susTotals(i, "e");
  return `<div class="kpis">
      ${kpi("Total Emission Impact", fmtV(e.sum, "t"), "latest est., annualized · tCO₂e")}
      ${kpi("Net Recurring Emission Impact", fmtV(e.netRec, "t"), "latest est., annualized")}
      ${kpi("One-time Impact", fmtV(e.oneTime, "t"), "latest est. · tCO₂e")}
      ${kpi("Impact Year", impactYear(i))}
      ${i.locked ? kpi("Locked at L4", fmtV(i.locked.total, "t"), "forecast on " + fmtDate(i.locked.at)) : ""}
    </div>${impactGrid(i, "sustain", ed)}`;
}

// ---------- tab: project milestones -----------------------------------------
function msCheck(i, m) {
  const l4 = forecastDate(i, "L4");
  if (m.status === "Cancelled") return ["Milestone cancelled", "muted"];
  if (!m.start || !m.end) return ["Dates missing", "bad"];
  if (m.type !== "Money Step" && l4 && m.end > l4) return ["End date is after L4 date", "bad"];
  if (m.status !== "Completed" && m.end < todayISO()) return ["Late", "bad"];
  return ["OK", "ok"];
}
function tabMilestones(i, ed) {
  const ms = i.milestones || [], live = ms.filter(m => m.status !== "Cancelled");
  const starts = live.map(m => m.start).filter(Boolean).sort(), ends = live.map(m => m.end).filter(Boolean).sort();
  const late = live.filter(m => m.status !== "Completed" && m.end && m.end < todayISO()).length;
  const pct = live.length ? Math.round(live.filter(m => m.status === "Completed").length / live.length * 100) : 0;
  const h = headline(i), L = cfgList;
  const msel = (m, k, list) => `<select id="ms_${m.id}_${k}" data-ms="${m.id}|${k}" onchange="onMs(this)" aria-label="${k} ${m.id}" ${dis(ed)}>${opts(list, m[k])}</select>`;
  const mdate = (m, k) => `<input type="date" id="ms_${m.id}_${k}" value="${esc(m[k] || "")}" data-ms="${m.id}|${k}" onchange="onMs(this)" aria-label="${k} ${m.id}" ${dis(ed)}>`;
  return `<div class="kpis">
      ${kpi("Total Impact", `${fmtV(h.v, h.unit)} <small>${h.unit}</small>`, "latest est., annualized")}
      ${kpi("L4 Estimated Date", fmtDate(forecastDate(i, "L4")), "= Money Step completion date")}
      ${kpi("Earliest Milestone Start", fmtDate(starts[0]))}${kpi("Latest Milestone End", fmtDate(ends[ends.length - 1]))}
      ${kpi("No. of Late Milestones", late, "", late ? "warn" : "")}${kpi("% Completed Milestones", pct + "%", "excl. cancelled")}
    </div>
    <div class="card pad"><div class="row between"><h2>Milestones</h2>${ed ? `<div class="row">${SEL.size ? `<button class="btn red-o sm" onclick="deleteMilestones()">Delete selected (${SEL.size})</button>` : ""}<button class="btn blue sm" onclick="addMilestone()">+ Add Milestone</button></div>` : ""}</div>
    <div class="tablewrap"><table class="grid ms"><thead><tr><th></th><th>#</th><th>Name</th><th>Milestone Owner</th><th>Type</th><th>Status</th><th>Starting Date</th><th>Completion Date</th><th>Planning Check</th></tr></thead><tbody>
      ${ms.map(m => { const [c, cc] = msCheck(i, m); return `<tr><td class="chk"><input type="checkbox" ${SEL.has(m.id) ? "checked" : ""} onchange="toggleSel('${m.id}',this.checked)" aria-label="Select ${m.id}" ${dis(ed)}></td><td class="lid">#${m.id}</td>
        <td><input id="ms_${m.id}_name" value="${esc(m.name)}" data-ms="${m.id}|name" onchange="onMs(this)" aria-label="Name ${m.id}" ${dis(ed)}></td>
        <td>${msel(m, "owner", userList())}</td><td>${msel(m, "type", L("msTypes"))}</td><td>${msel(m, "status", L("msStatus"))}</td>
        <td>${mdate(m, "start")}${m.type === "Money Step" && m.status !== "Cancelled" ? '<small class="linknote ms">red line on Impact tabs</small>' : ""}</td><td>${mdate(m, "end")}${m.type === "Money Step" && m.status !== "Cancelled" ? '<small class="linknote">↔ = L4 Forecast Date</small>' : ""}</td><td class="st ${cc}">${c}</td></tr>`; }).join("")
        || `<tr><td colspan="9" class="empty">No milestones yet.</td></tr>`}
    </tbody></table></div>
    <p class="muted small">One person holds primary responsibility per milestone. Every initiative needs exactly one Money Step — the milestone after which no further action beyond BAU is needed for the benefit. Prefix sub-parts with [A] / [B] so a part can be split into its own initiative later.</p></div>`;
}

// ---------- tab: attachments ------------------------------------------------
function tabAttachments(i, ed) {
  return `<div class="card pad"><div class="attgrid">${i.attachments.map((f, k) => `<div class="fld"><label>Attachment ${k + 1}</label><div class="att"><span class="rofield">${esc(f || "—")}</span>
      ${ed ? `<label class="btn navy sm browse">Browse<input type="file" onchange="setAttachment(${k},this)" hidden></label>${f ? `<button class="x" onclick="setAttachment(${k},null)" aria-label="Remove attachment ${k + 1}">✕</button>` : ""}` : ""}</div></div>`).join("")}</div>
    <div class="fld full"><label for="f_links">Other Attachment Links</label>${txt(i, "links", ed, { label: "Other attachment links", ph: "One link per line (SharePoint, Teams, etc.)" })}</div>
    <p class="muted small">This build keeps file names only; the production build uploads the files to storage.</p></div>`;
}

// ---------- tab: questionnaire ----------------------------------------------
function qBlock(i, q, ed) {
  const a = (i.q || {})[q.id] || (q.type === "yesno" ? "" : {});
  let ctl;
  if (q.type === "yesno") {
    ctl = ["Yes", "No"].map(v => `<label class="qopt in"><input type="radio" name="q_${q.id}" ${a === v ? "checked" : ""} onchange="onQYes('${q.id}','${v}')" ${dis(ed)}> ${v === "Yes" ? "ใช่" : "ไม่ใช่"}</label>`).join("");
  } else {
    const c = a.c || [];
    ctl = q.opts.map((o, k) => `<label class="qopt"><input type="checkbox" id="q_${q.id}_${k}" ${c.includes(k) ? "checked" : ""} onchange="onQ('${q.id}',${k},this.checked)" ${dis(ed)}> ${esc(o)}</label>`).join("")
      + (q.other ? `<div class="qopt other"><span>อื่น ๆ</span><input id="q_${q.id}_other" value="${esc(a.other || "")}" onchange="onQText('${q.id}','other',this.value)" placeholder="ระบุ…" aria-label="Other" ${dis(ed)}></div>` : "")
      + (q.none ? `<label class="qopt"><input type="checkbox" id="q_${q.id}_none" ${a.none ? "checked" : ""} onchange="onQNone('${q.id}',this.checked)" ${dis(ed)}> ${esc(q.none)}</label>` : "")
      + (q.detail ? `<textarea id="q_${q.id}_detail" onchange="onQText('${q.id}','detail',this.value)" placeholder="รายละเอียด (Detail)" aria-label="Detail" ${dis(ed)}>${esc(a.detail || "")}</textarea>` : "");
  }
  return `<div class="qrow ${q.req && !qAnswered(i, q) ? "miss" : ""}"><div class="qq">${esc(q.q)}${q.req ? '<i class="req">*</i>' : ' <small class="muted">(optional)</small>'}</div><div class="qa">${ctl}</div></div>`;
}
function tabQuestionnaire(i, ed) {
  const h = headline(i);
  return `<div class="kpis">${kpi("Total Impact", `${fmtV(h.v, h.unit)} <small>${h.unit}</small>`, "latest est., annualized")}${kpi("L4 Estimated Date", fmtDate(forecastDate(i, i.track === "P" ? "L5" : "L4")))}</div>
    <div class="card pad"><h2>L1 Questionnaire Form <small>required before submitting for L2 · ${qDone(i, "L1") ? '<span class="okt">complete</span>' : '<span class="warnt">incomplete</span>'}</small></h2>${XC.QUESTIONNAIRE.L1.map(q => qBlock(i, q, ed)).join("")}</div>
    <div class="card pad"><h2>L5 Questionnaire Form <small>required before submitting for L5 · ${qDone(i, "L5") ? '<span class="okt">complete</span>' : '<span class="warnt">incomplete</span>'}</small></h2>${XC.QUESTIONNAIRE.L5.map(q => qBlock(i, q, ed)).join("")}</div>`;
}

// ---------- dashboards & master data ----------------------------------------
function bars(rows, unit) {
  const max = Math.max(1e-9, ...rows.map(r => Math.abs(r.v)));
  return `<div class="bars">${rows.map(r => `<div class="bar-r"><span class="bl">${esc(r.l)}</span><span class="bt"><i style="width:${Math.max(2, Math.abs(r.v) / max * 100)}%"></i></span><span class="bv">${fmtV(r.v, unit)}${r.n !== undefined ? ` <small>(${r.n})</small>` : ""}</span></div>`).join("") || '<p class="muted">No data.</p>'}</div>`;
}
function viewDash(t) {
  const list = visible().filter(i => i.track === t && i.status !== "Cancelled");
  const unit = t === "S" ? "tCO₂e" : "Mn THB", val = i => t === "S" ? susTotals(i).sum : finTotals(i).fin;
  const sum = l => l.reduce((x, i) => x + val(i), 0);
  const conf = list.filter(i => stageNum(i.stage) >= 3), pipe = list.filter(i => stageNum(i.stage) < 3);
  const byStage = XC.TRACK_STAGES[t].map(s => { const l = list.filter(i => i.stage === s); return { l: `${s} ${XC.STAGES[s]}`, v: sum(l), n: l.length }; });
  const gk = t === "S" ? "flagship" : "dept", groups = {};
  list.forEach(i => { const g = i[gk] || i.company || "—"; groups[g] = groups[g] || []; groups[g].push(i); });
  const byGroup = Object.entries(groups).map(([g, l]) => ({ l: g, v: sum(l), n: l.length })).sort((a, b) => b.v - a.v);
  const cls = (DB.config.classes[t === "S" ? "emission" : "money"] || []).map(([c]) => ({ l: c, v: list.filter(i => classOf(i) === c).length }));
  const pend = list.filter(i => i.submittedFor);
  return pagehead(["Home", "Dashboard"], `${trackName(t)} Dashboard`) + `
    <div class="kpis">
      ${kpi("Initiatives", list.length, "visible to you, excl. cancelled")}
      ${kpi("Total Impact", fmtV(sum(list), unit), unit + " · latest est., annualized")}
      ${kpi("Confirmed (L4–L5)", fmtV(sum(conf), unit), conf.length + " initiative(s)")}
      ${kpi("In pipeline (L1–L3)", fmtV(sum(pipe), unit), pipe.length + " initiative(s)")}
      ${t === "P" ? kpi("Time saved", fmtV(list.reduce((x, i) => x + num(i.time.actual), 0), "h") + " h", "actual · plan " + fmtV(list.reduce((x, i) => x + num(i.time.plan), 0), "h") + " h") : ""}
    </div>
    <div class="dgrid">
      <div class="card pad"><h2>Impact by stage <small>${unit}</small></h2>${bars(byStage, unit)}</div>
      <div class="card pad"><h2>By ${t === "S" ? "flagship" : "department"} <small>${unit}</small></h2>${bars(byGroup, unit)}</div>
      <div class="card pad"><h2>Classified group <small>number of initiatives</small></h2>${bars(cls, "n")}</div>
      <div class="card pad"><h2>Approval status <small>who still has to sign</small></h2><div class="tablewrap"><table class="list"><thead><tr><th>Initiative</th><th>Gate</th><th>Signed</th><th>Waiting for</th><th class="r">Days</th></tr></thead><tbody>
        ${pend.map(i => { const to = i.submittedFor, sig = i.approvals[to] || {}, rl = gateRoles(i, to); return `<tr><td><a class="idlink" href="#/init/${i.id}/overview">${i.id}</a></td><td>→ ${to}</td><td>${rl.filter(r => sig[r]).length}/${rl.length}</td><td>${rl.filter(r => !sig[r]).map(r => `${esc(roleName(r))}: ${esc(holderNames(r, i))}`).join("<br>")}</td><td class="r num">${daysSince(i.tl.a["sub:" + to])}</td></tr>`; }).join("") || '<tr><td colspan="5" class="empty">Nothing pending.</td></tr>'}
      </tbody></table></div></div>
    </div>
    <p class="muted small">Basic built-in view. Detailed reporting is built in Power BI on the exported data (Master Data).</p>`;
}
const DATA_COLS = [
  ["Initiative No.", i => i.id], ["Project", i => trackName(i.track)], ["Initiative Name", i => i.title], ["Company", i => i.company],
  ["Department", i => i.dept], ["Flagship", i => i.flagship], ["Initiative Owner", i => uname(i.owner)], ["Stage", i => i.stage],
  ["Status", i => i.status], ["Impact Year", i => impactYear(i)], ["Total Impact", i => Math.round(headline(i).v * 1000) / 1000],
  ["Impact Unit", i => headline(i).unit], ["Group", i => classOf(i)], ["Category", i => i.category], ["Source of Loss & Gain", i => i.source],
  ["Q Tools", i => i.qTools], ["Levers", i => i.levers], ["Innovation", i => i.innovation ? "Yes" : "No"], ["Created", i => i.created],
];
function viewData(t) {
  const list = visible().filter(i => i.track === t);
  return pagehead(["Home", "Master Data"], `${trackName(t)} Data`) + `<div class="card pad"><div class="row between"><span class="muted small">${list.length} initiative(s) visible to you.</span><button class="btn blue sm" onclick="exportCSV('${t}')">Export CSV</button></div>
    <div class="tablewrap"><table class="grid dense"><thead><tr>${DATA_COLS.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>
    ${list.map(i => `<tr>${DATA_COLS.map(([n, f]) => `<td>${n === "Initiative No." ? `<a class="idlink" href="#/init/${i.id}/overview">${i.id}</a>` : esc(f(i) ?? "")}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${DATA_COLS.length}" class="empty">No data.</td></tr>`}
    </tbody></table></div></div>`;
}

// ---------- admin -----------------------------------------------------------
function viewAdmin() {
  if (!isAdmin(ME)) return pagehead(["Home", "Admin"], "User Management") + `<div class="card pad">Admin roles only.</div>`;
  const su = isSuper(ME), tabs = [["users", "Users & roles"], ["perms", "Visibility & editing"], ["routing", "Approval routing"], ["lists", "Dropdown lists"], ["settings", "Settings"]];
  let body = "";
  if (ADMTAB === "users") {
    body = `<div class="tablewrap"><table class="grid dense"><thead><tr><th>Emp.</th><th>Name</th><th>Email</th><th>Company</th><th>Department / Flagship</th><th>Roles</th><th>Approval authority</th></tr></thead><tbody>
      ${DB.users.map(u => `<tr><td>${esc(u.emp)}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.company)}</td><td>${esc(u.dept || u.flagship || "—")}</td>
        <td>${su ? `<details class="multi sm" ${OPEN === "r" + u.id ? "open" : ""} ontoggle="popToggle(this,'r${u.id}')"><summary>${esc(u.roles.map(roleName).join(", ") || "— none —")}</summary><div class="multilist">
          ${Object.keys(XC.ROLES).map(r => `<label><input type="checkbox" ${u.roles.includes(r) ? "checked" : ""} onchange="toggleRole('${u.id}','${r}',this.checked)"> ${esc(roleName(r))} <small>${XC.ROLES[r].tracks}</small></label>`).join("")}</div></details>` : esc(u.roles.map(roleName).join(", "))}</td>
        <td class="small">${u.authority ? esc((u.authority.depts || []).concat(u.authority.flagships || []).join(", ")) : '<span class="muted">all</span>'}</td></tr>`).join("")}
    </tbody></table></div>
    ${su ? `<h3 class="sec">Add user</h3><div class="fgrid">
      <div class="fld"><label for="nu_emp">Employee no.</label><input id="nu_emp"></div><div class="fld"><label for="nu_name">Name</label><input id="nu_name"></div>
      <div class="fld"><label for="nu_email">Email</label><input id="nu_email"></div><div class="fld"><label for="nu_co">Company</label><select id="nu_co">${opts(cfgList("companies"), "PTT", null)}</select></div>
      <div class="fld"><label for="nu_dept">Department</label><select id="nu_dept">${opts(cfgList("depts"), "")}</select></div><div class="fld"><label>&nbsp;</label><button class="btn blue" onclick="addUser()">Add user (Initiative Owner)</button></div></div>` : ""}
    <p class="muted small">Viewers / submitters come from Active Directory in production; sign-off and admin roles are assigned here.</p>`;
  } else if (ADMTAB === "perms") {
    body = `<div class="tablewrap"><table class="grid dense"><thead><tr><th>Role</th>${["M", "S", "P"].map(t => `<th>${trackName(t)} — visibility</th><th>${trackName(t)} — editing</th>`).join("")}</tr></thead><tbody>
      ${Object.keys(XC.ROLES).map(r => `<tr><td><b>${esc(roleName(r))}</b></td>${["M", "S", "P"].map(t => { const p = perms(r, t), on = XC.ROLES[r].tracks.includes(t);
        if (!on) return '<td class="muted">—</td><td class="muted">—</td>';
        return su ? `<td><select onchange="setPerm('${r}','${t}',0,this.value)">${opts(Object.entries(XC.VIS).map(([v, l]) => ({ v, l })), p.vis, null)}</select></td><td><select onchange="setPerm('${r}','${t}',1,this.value)">${opts(Object.entries(XC.EDIT).map(([v, l]) => ({ v, l })), p.edit, null)}</select></td>`
          : `<td>${XC.VIS[p.vis]}</td><td>${XC.EDIT[p.edit]}</td>`; }).join("")}</tr>`).join("")}
    </tbody></table></div>
    <p class="muted small">Defaults come from the Role User sheet (Data Visibility / Data Editability). Owners, back-ups and working-team members always see and edit their own cards; approvers always see what waits for their sign-off. ${su ? "" : "Only Super Admin can change this."}</p>`;
  } else if (ADMTAB === "routing") {
    const gateRolesAll = [...new Set(Object.values(XC.GATES).flatMap(g => Object.values(g).flat()))];
    body = `<div class="tablewrap"><table class="grid dense"><thead><tr><th>Sign-off role</th><th>AD default holders (approval authority)</th><th>Manual override</th><th></th></tr></thead><tbody>
      ${gateRolesAll.map(r => { const ov = (DB.config.routing || {})[r];
        return `<tr><td><b>${esc(roleName(r))}</b></td><td class="small">${adHolders(r).map(u => `${esc(u.name)}${u.authority ? ` <span class="muted">(${esc((u.authority.depts || []).join(", "))})</span>` : ""}`).join("<br>") || '<span class="bad">no holder</span>'}</td>
        <td>${su ? `<select onchange="setRouting('${r}',this.value)">${opts(DB.users.map(u => ({ v: u.id, l: `${u.name} (${u.roles.map(roleName).join(", ")})` })), ov ? ov[0] : "", "— AD default —")}</select>` : ov ? esc(ov.map(uname).join(", ")) : "AD default"}</td>
        <td>${ov ? '<span class="chip warn">overridden</span>' : ""} ${ov && su ? `<button class="btn ghost sm" onclick="setRouting('${r}','')">Reset to AD</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div><p class="muted small">An override applies to every initiative for that role (e.g. delegate down to a division head). “Reset to AD” goes back to the org-chart default.</p>`;
  } else if (ADMTAB === "lists") {
    body = `<div class="listgrid">${Object.keys(DB.config.lists).map(k => `<div class="fld"><label for="ls_${k}">${esc(k)}</label><textarea id="ls_${k}" rows="6" ${su ? "" : "disabled"}>${esc(DB.config.lists[k].join("\n"))}</textarea>${su ? `<button class="btn navy sm" onclick="saveList('${k}')">Save</button>` : ""}</div>`).join("")}</div>
      <p class="muted small">One value per line. These feed every dropdown (from XcLENCE_Dropdown_Master_Lists.xlsx).</p>`;
  } else {
    body = `<div class="fgrid">
      <div class="fld"><label for="st_theme">PIC yearly theme</label><input id="st_theme" value="${esc(DB.config.theme)}" ${su ? "" : "disabled"}></div>
      ${["money", "emission"].map(k => `<div class="fld span2"><label>Classified group thresholds — ${k === "money" ? "Mn THB" : "tCO₂e"} (minimum)</label><div class="row">${DB.config.classes[k].map(([n, v], idx) => `<span class="thr">${esc(n)} ≥ <input type="number" id="cl_${k}_${idx}" value="${v}" ${su ? "" : "disabled"}></span>`).join("")}</div></div>`).join("")}
    </div>${su ? `<button class="btn blue" onclick="saveSettings()">Save settings</button>` : ""}
    <h3 class="sec">Demo data</h3>${RESETASK ? `<p class="warnt">This replaces all initiatives, users and settings with the demo seed.</p><div class="row"><button class="btn red" onclick="doReset()">Confirm reset</button><button class="btn ghost" onclick="RESETASK=false;render()">Keep my data</button></div>` : `<button class="btn red-o" onclick="RESETASK=true;render()">Reset demo data…</button>`}`;
  }
  return pagehead(["Home", "Admin", "User Management"], "User Management") + `<div class="subtabs">${tabs.map(([k, l]) => `<button class="${ADMTAB === k ? "on" : ""}" onclick="ADMTAB='${k}';render()">${l}</button>`).join("")}</div><div class="card pad">${body}</div>`;
}

// ---------- manual / rulebook / FAQ -----------------------------------------
function viewManual() {
  return pagehead(["Home", "Manual & Rule Book", "Manual"], "Manual") + `<div class="card pad prose">
    <h2>For initiative owners</h2><ol>
      <li><b>New Initiative</b> — answer the two Loss &amp; Gain questions. Sustainability-relevant → GHG (S). Otherwise ≥ 1 Mn THB → MissionX (M), below → PIC (P).</li>
      <li>Complete the <b>Overview</b> (required fields are marked <i class="req">*</i>) and the <b>L1 Questionnaire</b>, then <b>Submit to L2</b>.</li>
      <li>Before L3: fill the plan on <b>Impact</b> / <b>Sustainability Impact</b> (annualized and monthly), add <b>Project Milestones</b> with one Money Step (MissionX), and the Charter / Assumption Template.</li>
      <li><b>Timeline &amp; Status</b> lists exactly what is still pending for the next gate. The Submit button unlocks when it's complete.</li>
      <li>Hover the <b>Workflow Route</b> to see who has approved and who is still pending.</li>
      <li>Update actuals monthly after L4; answer the <b>L5 Questionnaire</b> before submitting for L5.</li></ol>
    <h2>For approvers</h2><ol>
      <li>The bell and <b>To do List</b> show what waits for your sign-off, filtered by your approval authority.</li>
      <li>Open the initiative, review it, then <b>Approve as …</b> or <b>Reject</b> with a comment. A gate moves forward only when every required role has signed, in any order.</li></ol>
    <h2>Autosave &amp; comment log</h2><p>There is no Save button. Every change is saved as you make it — the indicator next to the page title shows <b>Saving…</b> then <b>All changes saved</b>. A moment after you stop editing, one entry is written to the comment log listing what changed (from → to), so the team can see every edit.</p>
    <h2>Money Step ↔ L4</h2><p>The Money Step milestone's completion date <i>is</i> the L4 forecast date. Change either one (Project Milestones or Timeline &amp; Status) and, after you confirm, the other follows — and so does the Impact Year. The Money Step <b>start</b> date is shown as the red line on the Impact tabs; the yellow line is the present month.</p></div>`;
}
function viewRulebook() {
  const gates = Object.keys(XC.GATES).map(t => `<tr><td><b>${t}</b> ${trackName(t)}</td>${XC.STAGE_ORDER.slice(1).map(s => `<td>${XC.GATES[t][s] ? XC.GATES[t][s].map(roleName).join("<br>") : '<span class="muted">skipped</span>'}</td>`).join("")}</tr>`).join("");
  const tabs = Object.keys(XC.TAB_LABEL).map(k => `<tr><td>${XC.TAB_LABEL[k]}</td>${["M", "S", "P"].map(t => `<td>${XC.TABS[t][k] === "r" ? "Required" : XC.TABS[t][k] === "o" ? '<span class="muted">Optional</span>' : "—"}</td>`).join("")}</tr>`).join("");
  return pagehead(["Home", "Manual & Rule Book", "Rulebook"], "Rulebook") + `<div class="card pad prose">
    <h2>1. Which track?</h2><p>Loss &amp; Gain identification → <b>Sustainability relevant?</b> Yes → <b>S (GHG)</b>. No → <b>money impact ≥ ${XC.TRIGGER_MN} Mn THB?</b> Yes → <b>M (MissionX)</b>, No → <b>P (PIC)</b> — money below 1 Mn THB, time and others.</p>
    <h2>2. Stage gauge</h2><p>L1 Idea → L2 Idea Identified → L3 Planned (old L2 + L3 merged) → L4 Executed → L5 Realized. PIC skips L4.</p>
    <h2>3. Sign-offs (all listed roles must approve; any order)</h2><div class="tablewrap"><table class="list"><thead><tr><th>Track</th><th>→ L2</th><th>→ L3</th><th>→ L4</th><th>→ L5</th></tr></thead><tbody>${gates}</tbody></table></div>
    <h2>4. Required tabs</h2><div class="tablewrap"><table class="list"><thead><tr><th>Tab</th><th>MissionX</th><th>GHG</th><th>PIC</th></tr></thead><tbody>${tabs}</tbody></table></div>
    <h2>5. Impact calculation</h2><ul>
      <li>All values are entered as positive numbers; the line type (Recurring / One-time, Benefit / Cost) decides the sign. Money in Mn THB, emissions in tCO₂e.</li>
      <li><b>Estimate</b> = Actual where entered, otherwise Forecast (Plan and Forecast are merged).</li>
      <li><b>Auto-fill annualized</b>: one-time lines = total of all months; recurring lines = the best rolling 12-month sum (run-rate at full potential), or average × 12 when there are fewer than 12 months. <b>Manual</b> = typed value.</li>
      <li><b>Total Impact (money)</b> = Net recurring + One-time benefit ÷ 5 − One-time (implementation) cost ÷ 5. CAPEX Spend is recorded separately and not included.</li>
      <li><b>Total Emission Impact</b> = Net recurring + net one-time emissions <span class="warnt">(rule to confirm with the GHG team)</span>.</li>
      <li>The forecast total is <b>locked at L4</b> for comparison against later estimates.</li>
      <li><b>Impact Year</b> = year of the L4 date (PIC: L5). For MissionX the L4 date follows the Money Step completion date.</li></ul>
    <h2>6. Classified group</h2><p>${DB.config.classes.money.map(([n, v]) => `${n} ≥ ${v} Mn THB`).join(" · ")}. GHG: ${DB.config.classes.emission.map(([n, v]) => `${n} ≥ ${v.toLocaleString()} tCO₂e`).join(" · ")}. <span class="muted">Thresholds to be confirmed (log #9).</span></p>
    <h2>7. Numbering</h2><p>Track letter + year + running number per track and year, e.g. <b>M2026-0001</b>, <b>S2026-0001</b>, <b>P2026-0015</b>.</p></div>`;
}
function viewFaq() {
  const qa = [
    ["My initiative is below 1 Mn THB but reduces GHG — which track?", "GHG (S). The sustainability question is asked first and overrides the money threshold."],
    ["Why is Submit disabled?", "Open Timeline & Status — section A lists every pending item for the next gate."],
    ["Who approves my initiative?", "Hover the Workflow Route on the initiative header. Approvers are resolved from your department / flagship; an admin can override."],
    ["Can I edit the charter after L3?", "Yes. The Initiative Charter is a live version, editable at every stage."],
    ["Do I have to fill monthly values?", "For the L3 plan, yes (MissionX and GHG). Annualized values are computed from the months, or switch the line to Manual."],
    ["Is the Impact tab required for GHG?", "No — financial impact is optional for GHG; the Sustainability Impact tab is required."],
  ];
  return pagehead(["Home", "Manual & Rule Book", "FAQ"], "FAQ") + `<div class="card pad prose">${qa.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;
}
