/* XcLENCE — configuration, master lists, roles and demo seed.
 * Sources: Workshop mock-up (14 Oct 2026), XcLENCE_Dropdown_Master_Lists.xlsx, and the
 * Role User / Required Tab sheets of XcLENCE_Progress Log (20261014)_v2.xlsx.
 * XC.DEFAULTS is copied into the database on first run; admins edit it from then on.
 */
const XC = {
  KEY: "xclence.v4",
  VERSION: "V1.01",
  TRIGGER_MN: 1, // Mn THB — splits MissionX (>= 1) from PIC (< 1)

  TRACKS: {
    M: { name: "MissionX", unit: "Mn THB", desc: "EBITDA impact of 1 Mn THB or more" },
    S: { name: "GHG", unit: "tCO₂e", desc: "Sustainability-relevant (GHG reduction)" },
    P: { name: "PIC", unit: "Mn THB", desc: "Productivity — money below 1 Mn THB, time and others" },
  },
  STAGE_ORDER: ["L1", "L2", "L3", "L4", "L5"],
  STAGES: { L1: "Idea", L2: "Idea Identified", L3: "Planned", L4: "Executed", L5: "Realized" },
  TRACK_STAGES: {
    M: ["L1", "L2", "L3", "L4", "L5"],
    S: ["L1", "L2", "L3", "L4", "L5"],
    P: ["L1", "L2", "L3", "L5"], // PIC skips L4
  },
  // Roles that must ALL sign off to ENTER each stage (workshop "XcLENCE WorkFlow (New)").
  GATES: {
    M: { L2: ["VSL"], L3: ["VSL", "TOF", "CTO"], L4: ["VSL", "TOF", "CTO"], L5: ["CFO", "CTO"] },
    S: { L2: ["PLCS"], L3: ["PLCS", "ESG"], L4: ["PLCS", "ESG", "GNET"], L5: ["PLCS", "ESG", "GNET"] },
    P: { L2: ["APPR"], L3: ["APPR", "PICADM"], L5: ["APPR", "PICADM"] },
  },
  // Tabs per track: "r" required, "o" optional, absent = hidden ("Required Tab (each project)").
  TABS: {
    M: { overview: "r", timeline: "r", impact: "r", milestones: "r", attachments: "o", questionnaire: "r" },
    S: { overview: "r", timeline: "r", impact: "o", sustain: "r", milestones: "o", attachments: "o", questionnaire: "r" },
    P: { overview: "r", timeline: "r", impact: "r", milestones: "o", attachments: "o", questionnaire: "r" },
  },
  TAB_LABEL: {
    overview: "Overview", timeline: "Timeline & Status", impact: "Impact", sustain: "Sustainability Impact",
    milestones: "Project Milestones", attachments: "Attachments", questionnaire: "Questionnaire Form",
  },

  ROLES: {
    OWNER:  { name: "Initiative Owner", tracks: "MSP" },
    YL:     { name: "Focal Point Leader (YL)", tracks: "M" },
    TOA:    { name: "TO Analyst", tracks: "MP" },
    PLCS:   { name: "PLC Sustainability Team", tracks: "S" },
    ESG:    { name: "ESG Lead (Flagship)", tracks: "S" },
    GNET:   { name: "G-Net Asst. Secretary", tracks: "S" },
    TOL:    { name: "TO Leader", tracks: "M" },
    CTO:    { name: "CTO / TO Leader", tracks: "M" },
    TOF:    { name: "TO Finance", tracks: "MP" },
    APPR:   { name: "Approver (VP / Manager)", tracks: "MP" },
    VSL:    { name: "Value Stream Leader (EVP)", tracks: "M" },
    CFO:    { name: "CFO / CFO designee", tracks: "M" },
    PICADM: { name: "PIC Admin", tracks: "P" },
    GHGADM: { name: "GHG Admin", tracks: "S" },
    MXADM:  { name: "MissionX Admin", tracks: "M" },
    SUPER:  { name: "Super Admin", tracks: "MSP" },
  },
  ADMIN_ROLES: ["SUPER", "MXADM", "GHGADM", "PICADM"],
  VIS: { none: "—", own: "See own card", vs: "Value stream (department)", company: "Full program (company)", flagship: "Full program (flagship)", whole: "Full program (whole)" },
  EDIT: { none: "—", guest: "Guest (read-only)", editor: "Editor (card owner)", full: "Full editor" },
  STATUSES: ["On track", "Needs leadership attention", "On hold", "Cancelled"],

  QUESTIONNAIRE: {
    L1: [
      { id: "q1", type: "multi", req: true, other: true,
        q: "Q1 : ท่านนำองค์ความรู้ภายในองค์กรจากแหล่งใดมาทำ Project (เลือกได้มากกว่า 1 ตัวเลือก)",
        opts: ["KM Portal (ระบบจัดเก็บข้อมูลสารสนเทศของสายงาน/องค์กร) เช่น GBU, OpEx, D-GA, INI ฯลฯ",
               "กิจกรรม Knowledge Sharing Session",
               "ระบบสารสนเทศที่ ปตท. จัดหาให้ เช่น Document Control, PLLI (E-learning, Online Learning, Casual Learning)"],
        none: "ไม่มีการนำข้อมูลจากระบบสารสนเทศหรือแหล่งเรียนรู้อื่น ๆ ภายใน ปตท. มาใช้ในการปรับปรุงงาน" },
      { id: "q1b", type: "multi", req: true, other: true,
        q: "Q1b : ท่านนำองค์ความรู้ภายนอกองค์กรจากแหล่งใดมาทำ Project (เลือกได้มากกว่า 1 ตัวเลือก)",
        opts: ["งานสัมมนา", "กิจกรรม Knowledge Sharing Session",
               "ระบบสารสนเทศที่ ปตท. ส่งค่าสมาชิกให้หน่วยงานภายนอก เช่น IEEE, APQC"],
        none: "ไม่มีการนำข้อมูลจากระบบสารสนเทศหรือแหล่งเรียนรู้อื่น ๆ ภายนอก ปตท. มาใช้ในการปรับปรุงงาน" },
    ],
    L5: [
      { id: "q2", type: "multi", req: false, other: true, detail: true,
        q: "Q2 : Project นี้มีผลลัพธ์ด้านสิ่งแวดล้อม (Environment) ด้านใด (เลือกได้หลายตัวเลือกและไม่บังคับตัวเลือก)",
        opts: ["GHG", "Water withdrawal", "Energy"] },
      { id: "q3", type: "yesno", req: true,
        q: "Q3 : ท่านได้นำแนวคิดหรือองค์ความรู้จาก Project อื่น มาปรับปรุงโครงการของท่านในครั้งนี้หรือไม่" },
    ],
  },

  DEFAULTS: {
    theme: "Net Zero 2050",
    // Dropdown master lists (XcLENCE_Dropdown_Master_Lists.xlsx) — editable in Admin.
    lists: {
      domains: ["PTT", "PTTTANK", "PTTLNG", "GC", "OR", "IRPC", "TOP", "GPSC"],
      companies: ["PTT", "OR", "GC", "IRPC", "PTTTANK", "TOP", "GPSC", "PTTLNG"],
      depts: ["GBU-GSP", "GBU-NGR", "GBU-GSM", "GBU-CMM", "GBU-NGV", "TSO", "TBU-Petroleum", "TBU-Gas", "PTTTANK-A1", "PTTTANK-Operations"],
      categories: ["Benefit", "Cost Reduction", "Time"],
      yesno: ["Yes", "No"],
      sources: ["Strategic Changes", "Internal Problems", "External Forces"],
      qtools: ["Suggestion", "Problem Solving", "Quality Control Circle", "Theme Achievement", "One Department One Project (ODOP)"],
      esg: ["E: Environment", "S: Social", "G: Greenhouse Gas"],
      flagships: ["EP", "GC", "TOP", "IRPC", "GPSC", "Non-Flagship", "PTT"],
      levers: ["CCUS", "Efficiency Improvement", "Clean Energy", "Carbon Credit mgmt.", "Hydrogen & Derivatives", "Portfolio Mgmt.", "Not applicable"],
      initTypes: ["New", "Replacement", "Maintenance"],
      impactFreq: ["Recurring Benefit", "Recurring Cost", "One-time Benefit", "One-time Cost"],
      impactTypes: ["Transportation Expense", "Rental", "Sales"],
      susTypes: ["Carbon Emissions"],
      scopes: ["(S1) Stationary Combustion", "(S1) Mobile Combustion"],
      msTypes: ["Implementation", "Money Step", "N/A"],
      msStatus: ["Not Started", "Started", "Completed", "Cancelled"],
    },
    // Role x track -> [visibility scope, edit tier]  (Role User sheet; editable by Super Admin)
    perms: {
      OWNER:  { M: ["vs", "editor"], S: ["own", "editor"], P: ["vs", "editor"] },
      YL:     { M: ["whole", "full"] },
      TOA:    { M: ["whole", "full"] },
      PLCS:   { S: ["whole", "full"] },
      ESG:    { S: ["whole", "guest"] },
      GNET:   { S: ["whole", "guest"] },
      TOL:    { M: ["whole", "guest"] },
      CTO:    { M: ["whole", "guest"] },
      TOF:    { M: ["whole", "guest"], P: ["whole", "guest"] },
      APPR:   { M: ["vs", "guest"], P: ["vs", "full"] },
      VSL:    { M: ["whole", "guest"] },
      CFO:    { M: ["whole", "guest"] },
      PICADM: { P: ["whole", "full"] },
      GHGADM: { S: ["whole", "full"] },
      MXADM:  { M: ["whole", "full"] },
      SUPER:  { M: ["whole", "full"], S: ["whole", "full"], P: ["whole", "full"] },
    },
    // Big Rock / Rock / Gravel / Sand thresholds (log #9 — amounts to be confirmed).
    classes: {
      money:    [["Big Rock", 100], ["Rock", 10], ["Gravel", 1], ["Sand", 0]],      // Mn THB
      emission: [["Big Rock", 100000], ["Rock", 10000], ["Gravel", 1000], ["Sand", 0]], // tCO2e
    },
    routing: {}, // role -> [userId] manual override of the AD default
  },

  // Demo directory (AD sign-on is skipped in this build). authority = approval scope.
  USERS: [
    { id: "u01", emp: "640101", name: "Apichaya A.", email: "apichaya.a@pttplc.com", company: "PTT", dept: "GBU-NGR", roles: ["OWNER"] },
    { id: "u02", emp: "640102", name: "Somchai T.", email: "somchai.t@pttplc.com", company: "PTT", dept: "TBU-Petroleum", roles: ["OWNER"] },
    { id: "u03", emp: "710201", name: "Nattapong K.", email: "nattapong.k@pttgcgroup.com", company: "GC", dept: "", flagship: "GC", roles: ["OWNER"] },
    { id: "u20", emp: "710202", name: "Ploy C.", email: "ploy.c@pttgcgroup.com", company: "GC", dept: "", flagship: "GC", roles: ["OWNER"] },
    { id: "u04", emp: "520301", name: "Wichai P.", title: "VP", email: "wichai.p@pttplc.com", company: "PTT", dept: "GBU-NGR", roles: ["APPR"],
      authority: { depts: ["GBU-GSP", "GBU-NGR", "GBU-GSM", "GBU-CMM", "GBU-NGV"] } },
    { id: "u05", emp: "520302", name: "Manop T.", title: "VP", email: "manop.t@pttplc.com", company: "PTT", dept: "TBU-Gas", roles: ["APPR"],
      authority: { depts: ["TSO", "TBU-Petroleum", "TBU-Gas", "PTTTANK-A1", "PTTTANK-Operations"] } },
    { id: "u06", emp: "410401", name: "Anong S.", title: "EVP – GBU", email: "anong.s@pttplc.com", company: "PTT", dept: "GBU-GSP", roles: ["VSL"],
      authority: { depts: ["GBU-GSP", "GBU-NGR", "GBU-GSM", "GBU-CMM", "GBU-NGV"] } },
    { id: "u07", emp: "410402", name: "Prasert V.", title: "EVP – TBU", email: "prasert.v@pttplc.com", company: "PTT", dept: "TBU-Petroleum", roles: ["VSL"],
      authority: { depts: ["TSO", "TBU-Petroleum", "TBU-Gas", "PTTTANK-A1", "PTTTANK-Operations"] } },
    { id: "u08", emp: "530501", name: "Tarawan T.", email: "tarawan.t@pttplc.com", company: "PTT", dept: "", roles: ["TOF"] },
    { id: "u09", emp: "530502", name: "Sucheela S.", email: "sucheela.s@pttplc.com", company: "PTT", dept: "", roles: ["CTO", "TOL"] },
    { id: "u10", emp: "400601", name: "Krit W.", email: "krit.w@pttplc.com", company: "PTT", dept: "", roles: ["CFO"] },
    { id: "u11", emp: "600701", name: "Kanya R.", email: "kanya.r@pttplc.com", company: "PTT", dept: "", roles: ["TOA"] },
    { id: "u12", emp: "600702", name: "Pim L.", email: "pim.l@pttplc.com", company: "PTT", dept: "GBU-NGR", roles: ["YL"] },
    { id: "u13", emp: "600801", name: "Darin M.", email: "darin.m@pttplc.com", company: "PTT", dept: "", roles: ["PLCS"] },
    { id: "u14", emp: "710301", name: "Ekkachai B.", email: "ekkachai.b@pttgcgroup.com", company: "GC", dept: "", flagship: "GC", roles: ["ESG"] },
    { id: "u15", emp: "600802", name: "Fah N.", email: "fah.n@pttplc.com", company: "PTT", dept: "", roles: ["GNET"] },
    { id: "u16", emp: "600901", name: "Ratana P.", email: "ratana.p@pttplc.com", company: "PTT", dept: "", roles: ["PICADM"] },
    { id: "u17", emp: "600902", name: "Somsak G.", email: "somsak.g@pttplc.com", company: "PTT", dept: "", roles: ["GHGADM"] },
    { id: "u18", emp: "600903", name: "Thanin J.", email: "thanin.j@pttplc.com", company: "PTT", dept: "", roles: ["MXADM"] },
    { id: "u19", emp: "500001", name: "Albert C.", email: "albert.c@pttplc.com", company: "PTT", dept: "", roles: ["SUPER"] },
  ],
};

// n consecutive months of value v starting at "YYYY-MM"
function xcSer(start, n, v) {
  const o = {}; let [y, m] = start.split("-").map(Number);
  for (let i = 0; i < n; i++) { o[`${y}-${String(m).padStart(2, "0")}`] = v; m++; if (m > 12) { m = 1; y++; } }
  return o;
}

function xcBlank(track) {
  return {
    id: "", track, title: "", overview: "", owner: "", backup: "", team: [], company: "", dept: "",
    category: "", interCompany: "", crossVS: "", source: "", qTools: "",
    esg: "", flagship: "", levers: "", initType: "", innovation: false,
    stage: "L1", status: "On track", rationale: "", submittedFor: null, approvals: {}, returned: false,
    created: "", tl: { a: {}, f: {} },
    charter: { kvd: "", kvdUnit: "", files: [] },
    assumption: { has: "", current: "", goals: "", rootCause: "", solution: "", expected: "" },
    capex: { has: "", amount: null },
    impacts: [], sustain: [], time: { plan: null, actual: null },
    milestones: [], attachments: ["", "", "", "", "", ""], links: "",
    q: {}, locked: null, audit: [],
  };
}

// Build a plausible audit trail from the timeline + sign-offs of a seeded initiative.
function xcAuditFrom(i, users) {
  const nm = id => (users.find(u => u.id === id) || {}).name || "System";
  const ev = [{ when: (i.tl.a.L1 || i.created) + " 09:00", who: nm(i.owner), kind: "workflow", action: "Created initiative" }];
  Object.entries(i.tl.a).forEach(([k, d]) => {
    if (k.startsWith("sub:")) ev.push({ when: d + " 10:00", who: nm(i.owner), kind: "workflow", action: `Submitted for ${k.slice(4)} approval` });
  });
  Object.entries(i.approvals).forEach(([stage, sigs]) => Object.entries(sigs).forEach(([role, s]) =>
    ev.push({ when: s.at, who: s.by, kind: "approval", action: `${XC.ROLES[role].name} approved → ${stage}` })));
  Object.entries(i.tl.a).forEach(([k, d]) => {
    if (!k.startsWith("sub:") && k !== "L1") ev.push({ when: d + " 18:00", who: "System", kind: "workflow", action: `Advanced to ${k} (all sign-offs complete)` });
  });
  return ev.sort((a, b) => a.when.localeCompare(b.when)).map(e => ({ ...e, comment: "" }));
}

function xcSeed() {
  const S = xcSer, users = JSON.parse(JSON.stringify(XC.USERS));
  const mk = (track, o) => Object.assign(xcBlank(track), o);
  const qL1 = { q1: { c: [0, 1], other: "" }, q1b: { c: [1], other: "" } };
  const list = [
    mk("M", {
      id: "M2026-0001", title: "Charter a 5-year Aframax to secure freight capacity",
      overview: "Charter a 5-year Aframax to secure stable freight capacity and reduce reliance on spot rates. Saving = spot TCE minus 5-year TC hire.",
      owner: "u02", backup: "u01", team: ["u02", "u12"], company: "PTT", dept: "TBU-Petroleum", category: "Cost Reduction",
      interCompany: "No", source: "Strategic Changes", qTools: "Problem Solving", stage: "L2", submittedFor: "L3", created: "2026-06-05",
      approvals: { L2: { VSL: { by: "Prasert V.", at: "2026-08-30 10:12" } }, L3: { VSL: { by: "Prasert V.", at: "2026-10-16 22:25" } } },
      tl: { a: { L1: "2026-06-05", "sub:L2": "2026-08-28", L2: "2026-08-30", "sub:L3": "2026-10-15" }, f: { L3: "2026-10-31", L5: "2027-06-30" } },
      charter: { kvd: "Freight cost per tonne", kvdUnit: "USD/t", files: ["Project Charter_M2026-0001 Aframax.pdf"] },
      capex: { has: "No", amount: null },
      impacts: [
        { id: "I01", freq: "Recurring Benefit", type: "Transportation Expense", pl: "TBU-Petroleum", mode: "auto", m: { f: S("2027-01", 24, 2.2), a: {} }, ann: {} },
        { id: "I02", freq: "Recurring Cost", type: "Rental", pl: "TBU-Petroleum", mode: "auto", m: { f: S("2027-01", 24, 0.6), a: {} }, ann: {} },
        { id: "I03", freq: "One-time Cost", type: "Rental", pl: "TBU-Petroleum", mode: "manual", m: { f: {}, a: {} }, ann: { f: 3 } },
      ],
      milestones: [
        { id: "M01", name: "Engage commercial team on TC structure", owner: "u02", type: "Implementation", status: "Completed", start: "2026-06-10", end: "2026-07-15" },
        { id: "M02", name: "Negotiate TC terms with shortlisted owners", owner: "u02", type: "Implementation", status: "Started", start: "2026-08-01", end: "2026-11-30" },
        { id: "M03", name: "Sign 5-year TC contract", owner: "u02", type: "Money Step", status: "Not Started", start: "2026-12-01", end: "2026-12-31" },
      ],
      q: qL1,
    }),
    mk("M", {
      id: "M2026-0002", title: "Crude blend optimization",
      overview: "Optimise the crude blend recipe in the DCS to lift product margin while keeping sulphur within spec.",
      owner: "u01", backup: "u12", team: ["u01"], company: "PTT", dept: "GBU-GSP", category: "Benefit",
      interCompany: "No", source: "Internal Problems", qTools: "Problem Solving", stage: "L4", created: "2026-02-03",
      approvals: {
        L2: { VSL: { by: "Anong S.", at: "2026-02-20 11:02" } },
        L3: { VSL: { by: "Anong S.", at: "2026-03-04 15:40" }, TOF: { by: "Tarawan T.", at: "2026-03-05 09:10" }, CTO: { by: "Sucheela S.", at: "2026-03-05 14:30" } },
        L4: { VSL: { by: "Anong S.", at: "2026-06-01 10:00" }, TOF: { by: "Tarawan T.", at: "2026-06-02 08:45" }, CTO: { by: "Sucheela S.", at: "2026-06-02 16:20" } },
      },
      tl: { a: { L1: "2026-02-03", "sub:L2": "2026-02-18", L2: "2026-02-20", "sub:L3": "2026-03-01", L3: "2026-03-05", "sub:L4": "2026-05-28", L4: "2026-06-02" }, f: { L5: "2026-12-31" } },
      charter: { kvd: "Margin per barrel", kvdUnit: "USD/bbl", files: [] },
      capex: { has: "Yes", amount: 12 },
      impacts: [
        { id: "I01", freq: "Recurring Benefit", type: "Sales", pl: "GBU-GSP", mode: "auto", m: { f: S("2026-04", 33, 0.35), a: S("2026-04", 6, 0.33) }, ann: {} },
        { id: "I02", freq: "Recurring Cost", type: "Rental", pl: "GBU-GSP", mode: "auto", m: { f: S("2026-04", 33, 0.025), a: S("2026-04", 6, 0.022) }, ann: {} },
        { id: "I03", freq: "One-time Cost", type: "Rental", pl: "GBU-GSP", mode: "manual", m: { f: {}, a: {} }, ann: { f: 0.5, a: 0.5 } },
      ],
      milestones: [
        { id: "M01", name: "Blend model built and validated", owner: "u01", type: "Implementation", status: "Completed", start: "2026-02-10", end: "2026-02-28" },
        { id: "M02", name: "New blend recipe live in DCS", owner: "u01", type: "Money Step", status: "Completed", start: "2026-03-01", end: "2026-05-25" },
      ],
      locked: { total: 3.8, at: "2026-06-02" },
      q: qL1,
    }),
    mk("M", {
      id: "M2026-0003", title: "Cloud-smart approach — DC sunset (phase 1)",
      overview: "Shut down the on-premise data centre and move workloads to cloud.",
      owner: "u02", team: [], company: "PTTTANK", dept: "PTTTANK-Operations", category: "Cost Reduction",
      stage: "L1", created: "2026-10-10", tl: { a: { L1: "2026-10-10" }, f: {} },
    }),
    mk("S", {
      id: "S2026-0001", title: "Flare gas recovery unit",
      overview: "Recover flare gas to fuel gas header, reducing combustion emissions at the cracker.",
      owner: "u03", backup: "u20", team: ["u03", "u20"], company: "GC", flagship: "GC", esg: "G: Greenhouse Gas",
      levers: "Efficiency Improvement", initType: "New", interCompany: "No", source: "Internal Problems", qTools: "Theme Achievement",
      stage: "L3", created: "2026-04-10",
      approvals: { L2: { PLCS: { by: "Darin M.", at: "2026-04-28 14:05" } }, L3: { PLCS: { by: "Darin M.", at: "2026-07-18 10:00" }, ESG: { by: "Ekkachai B.", at: "2026-07-20 13:30" } } },
      tl: { a: { L1: "2026-04-10", "sub:L2": "2026-04-25", L2: "2026-04-28", "sub:L3": "2026-07-15", L3: "2026-07-20" }, f: { L4: "2027-03-31", L5: "2027-09-30" } },
      sustain: [
        { id: "S01", freq: "Recurring Benefit", type: "Carbon Emissions", flagship: "GC", scope: "(S1) Stationary Combustion", mode: "auto", m: { f: S("2027-04", 24, 1000), a: {} }, ann: {} },
        { id: "S02", freq: "Recurring Cost", type: "Carbon Emissions", flagship: "GC", scope: "(S1) Mobile Combustion", mode: "auto", m: { f: S("2027-04", 24, 150), a: {} }, ann: {} },
      ],
      impacts: [{ id: "I01", freq: "Recurring Benefit", type: "Sales", pl: "", mode: "auto", m: { f: S("2027-04", 24, 0.8), a: {} }, ann: {} }],
      q: qL1,
    }),
    mk("S", {
      id: "S2026-0002", title: "Solar rooftop phase 1",
      overview: "Install 8 MWp rooftop solar across PTT office and depot sites.",
      owner: "u20", team: ["u20"], backup: "u03", company: "PTT", flagship: "PTT", esg: "E: Environment", levers: "Clean Energy",
      initType: "New", interCompany: "Yes", source: "Strategic Changes", qTools: "Suggestion", stage: "L2", submittedFor: "L3", created: "2026-07-01",
      approvals: { L2: { PLCS: { by: "Darin M.", at: "2026-08-10 09:30" } }, L3: { PLCS: { by: "Darin M.", at: "2026-10-14 15:12" } } },
      tl: { a: { L1: "2026-07-01", "sub:L2": "2026-08-05", L2: "2026-08-10", "sub:L3": "2026-10-12" }, f: { L3: "2026-10-31", L4: "2027-06-30", L5: "2027-12-31" } },
      sustain: [{ id: "S01", freq: "Recurring Benefit", type: "Carbon Emissions", flagship: "PTT", scope: "(S1) Stationary Combustion", mode: "auto", m: { f: S("2027-07", 24, 420), a: {} }, ann: {} }],
      q: qL1,
    }),
    mk("P", {
      id: "P2026-0001", title: "Control-room 5S",
      overview: "Apply 5S and visual management in the NGR control room.",
      owner: "u01", backup: "u12", team: ["u01", "u12"], company: "PTT", dept: "GBU-NGR", category: "Time", interCompany: "No",
      source: "Internal Problems", qTools: "One Department One Project (ODOP)", stage: "L3", created: "2026-05-02",
      approvals: { L2: { APPR: { by: "Wichai P.", at: "2026-05-15 16:30" } }, L3: { APPR: { by: "Wichai P.", at: "2026-06-19 11:00" }, PICADM: { by: "Ratana P.", at: "2026-06-20 09:20" } } },
      tl: { a: { L1: "2026-05-02", "sub:L2": "2026-05-12", L2: "2026-05-15", "sub:L3": "2026-06-15", L3: "2026-06-20" }, f: { L5: "2026-12-15" } },
      impacts: [{ id: "I01", freq: "One-time Benefit", type: "Sales", pl: "GBU-NGR", mode: "manual", m: { f: {}, a: {} }, ann: { f: 0.35 } }],
      time: { plan: 1200, actual: null },
      assumption: { has: "Yes", current: "Operators lose ~40 min per shift searching for tools and log sheets.", goals: "Cut search time by 75% (Time)",
        rootCause: "No standard locations; shared shelves", solution: "5S with shadow boards and visual labels", expected: "About 1,200 man-hours a year saved" },
      q: qL1,
    }),
    mk("P", {
      id: "P2026-0002", title: "Lab report automation",
      overview: "Automate daily gas-quality lab reports from LIMS into a template.",
      owner: "u02", backup: "u01", team: ["u02"], company: "PTT", dept: "TBU-Gas", category: "Time", interCompany: "No",
      source: "Internal Problems", qTools: "Suggestion", stage: "L2", submittedFor: "L3", created: "2026-07-20",
      approvals: { L2: { APPR: { by: "Manop T.", at: "2026-08-02 10:40" } }, L3: {} },
      tl: { a: { L1: "2026-07-20", "sub:L2": "2026-07-30", L2: "2026-08-02", "sub:L3": "2026-10-13" }, f: { L3: "2026-10-31", L5: "2027-03-31" } },
      time: { plan: 3500, actual: null },
      assumption: { has: "Yes", current: "Reports are retyped by hand every day (2 hrs).", goals: "Zero manual retyping",
        rootCause: "No LIMS export", solution: "Scheduled export + template macro", expected: "3,500 hrs a year saved" },
      q: qL1,
    }),
    mk("P", {
      id: "P2026-0003", title: "Preventive maintenance kaizen",
      overview: "Re-sequence PM routes at the terminal to cut contractor overtime.",
      owner: "u02", backup: "u01", team: ["u02"], company: "PTT", dept: "TSO", category: "Cost Reduction", interCompany: "No",
      source: "Internal Problems", qTools: "Quality Control Circle", stage: "L5", created: "2026-03-01",
      approvals: {
        L2: { APPR: { by: "Manop T.", at: "2026-03-10 09:00" } },
        L3: { APPR: { by: "Manop T.", at: "2026-04-01 09:00" }, PICADM: { by: "Ratana P.", at: "2026-04-02 10:00" } },
        L5: { APPR: { by: "Manop T.", at: "2026-09-29 15:00" }, PICADM: { by: "Ratana P.", at: "2026-09-30 11:00" } },
      },
      tl: { a: { L1: "2026-03-01", "sub:L2": "2026-03-08", L2: "2026-03-10", "sub:L3": "2026-03-28", L3: "2026-04-02", "sub:L5": "2026-09-25", L5: "2026-09-30" }, f: { L5: "2026-09-30" } },
      impacts: [{ id: "I01", freq: "Recurring Benefit", type: "Rental", pl: "TSO", mode: "manual", m: { f: {}, a: {} }, ann: { f: 0.5, a: 0.5 } }],
      time: { plan: 400, actual: 420 },
      assumption: { has: "No" },
      q: { ...qL1, q2: { c: [2], other: "", detail: "Less contractor vehicle mileage" }, q3: "No" },
    }),
  ];
  list.forEach(i => { i.audit = xcAuditFrom(i, users); });
  return {
    config: JSON.parse(JSON.stringify(XC.DEFAULTS)),
    seq: { M: { 2026: 3 }, S: { 2026: 2 }, P: { 2026: 3 } },
    users, initiatives: list,
  };
}

// Reuse the same constants + seed on the Node server (single source of truth).
if (typeof module !== "undefined" && module.exports) { module.exports = { XC, xcSeed, xcBlank }; }
