import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, initializeAuth, inMemoryPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const VERSION = window.__APP_VERSION__ || "dev";
const { SOURCES, GOOGLE, ADMOB, ADMIN_EMAILS } = await import(`./config.js?v=${encodeURIComponent(VERSION)}`);
const G = await import(`./google.js?v=${encodeURIComponent(VERSION)}`);
const { createSession } = await import(`./session.js?v=${encodeURIComponent(VERSION)}`);
const REVENUE = "revenue";
const FINANCE = ['finance', REVENUE, 'finance_bunny', 'finance_firebase'];
const financeLabels = { finance: '총합', revenue: '광고 수익', finance_bunny: 'Bunny 지출', finance_firebase: 'Firebase 지출' };
const { summarizeFinance } = await import(`./finance-core.js?v=${encodeURIComponent(VERSION)}`);
let financeReports = {}, financeStop, financeGeneration = 0, financeError = '';

const $ = (id) => document.getElementById(id);
const PAGE = 100;
const state = { src: load("src") || "seongsu", rows: {}, profiles: {}, auth: {}, filters: {}, sort: null, unsub: null, shown: PAGE, rev: { rows: null, pick: null } };
let connection = 0;
let adToken = null, adEpoch = 0;
const session = createSession({
  sources: SOURCES,
  allowedEmails: ADMIN_EMAILS,
  sdk: {
    create(config, id) { const app = initializeApp(config, id); return { auth: getAuth(app), db: getFirestore(app) }; },
    popup: (auth) => signInWithPopup(auth, new GoogleAuthProvider()),
    credential: (result) => GoogleAuthProvider.credential(null, GoogleAuthProvider.credentialFromResult(result)?.accessToken),
    signIn: signInWithCredential,
    signOut,
    watch: onAuthStateChanged,
  },
  onChange() {
    adToken = null; adEpoch++;
    state.rows = {}; state.profiles = {}; state.auth = {}; state.rev.rows = null; state.rev.finance = null;
    G.forgetToken(G.SCOPE_AUTH); G.forgetToken(G.SCOPE_ADMOB);
    renderAuthBtn(session.user());
    financeStop?.(); financeStop = null; financeReports = {}; financeGeneration++;
    if (!FINANCE.includes(state.src)) connect(); else if (state.src === REVENUE) renderRevenue(); else connectFinance();
  },
});
// 광고 계정 선택이 대시보드의 관리 계정이나 다른 앱 세션을 바꾸지 않게 분리합니다.
const adAuth = initializeAuth(initializeApp(SOURCES.seongsu.firebase, 'admob-authorization'), { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
async function getAdToken() {
  const owner = session.user(), epoch = adEpoch;
  if (!owner) throw Error('관리 계정으로 먼저 로그인해 주세요.');
  if (adToken?.owner === owner.uid && adToken.exp > Date.now()) return adToken.value;
  const provider = new GoogleAuthProvider();
  provider.addScope(G.SCOPE_ADMOB);
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(adAuth, provider);
    if (epoch !== adEpoch || session.user()?.uid !== owner.uid) throw Error('관리 계정이 변경되었습니다. 다시 연결해 주세요.');
    if (!result.user.emailVerified || !ADMIN_EMAILS.includes(result.user.email?.toLowerCase())) throw Error('지정된 관리 계정의 AdMob 계정으로 연결해 주세요.');
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw Error('광고 수익 조회 권한을 받지 못했습니다.');
    adToken = { value: token, owner: owner.uid, exp: Date.now() + 30 * 60_000 };
    return token;
  } finally { await signOut(adAuth); }
}

function load(k) { try { return localStorage.getItem(k); } catch { return null; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch {} }

const src = () => SOURCES[state.src];
const cols = () => src().columns || [];
const colOf = (k) => cols().find((c) => c.key === k);

// config 에 columns 가 없으면 실제 문서를 보고 컬럼·타입·분류 여부를 추정한다.
function inferColumns(s, rows) {
  const sample = rows.slice(0, 300);
  const keys = [...new Set(sample.flatMap((r) => Object.keys(r)))].filter((k) => k !== "_id");
  const isDateStr = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v);
  const columns = [{ key: "_id", label: "ID" }];
  for (const key of keys) {
    const vals = sample.map((r) => r[key]).filter((v) => v != null && v !== "");
    let type;
    if (vals.length && vals.every((v) => typeof v === "boolean")) type = "bool";
    else if (vals.length && vals.every((v) => typeof v === "number")) type = "number";
    else if (vals.length && vals.every((v) => typeof v?.toDate === "function" || isDateStr(v))) type = "date";
    else if (vals.some((v) => typeof v === "object")) continue;
    const distinct = new Set(vals.map(String)).size;
    const category = type === "bool" || (!type && distinct > 0 && distinct <= 30 && distinct < Math.max(2, sample.length / 2));
    columns.push({ key, label: key, ...(type && { type }), ...(category && { category: true }) });
  }
  s.columns = columns;
  s.dateField ??= columns.find((c) => c.type === "date")?.key;
  s.stats ??= columns.filter((c) => c.type === "number").slice(0, 4).map((c) => c.key);
}

const AUTH_COLUMNS = [
  { key: "authProvider", label: "로그인 방식", category: true },
  { key: "authEmail", label: "로그인 이메일" },
  { key: "authPlayGamesId", label: "Play 게임즈 ID" },
  { key: "authCreatedAt", label: "계정 생성", type: "date" },
  { key: "authLastLoginAt", label: "최근 로그인", type: "date" },
  { key: "hasSave", label: "세이브 있음", type: "bool", category: true },
];
const PROVIDER_LABEL = { "playgames.google.com": "Play 게임즈", "google.com": "Google", password: "이메일", "apple.com": "Apple" };

function authInfo(u) {
  const ps = u.providerUserInfo || [];
  const pg = ps.find((p) => p.providerId === "playgames.google.com");
  return {
    authProvider: ps.length ? ps.map((p) => PROVIDER_LABEL[p.providerId] || p.providerId).join("+") : u.customAuth ? "맞춤 인증" : "로그인 방식 미확인",
    authEmail: u.email || ps.find((p) => p.email)?.email || "",
    authPlayGamesId: pg?.rawId || "",
    authCreatedAt: u.createdAt ? new Date(Number(u.createdAt)) : null,
    authLastLoginAt: u.lastLoginAt ? new Date(Number(u.lastLoginAt)) : null,
    authDisabled: !!u.disabled,
  };
}

// 문서 ID(=UID) 기준으로 Authentication 정보를 붙이고, 세이브 문서가 없는 로그인 계정도 행으로 넣는다.
function rowsOf(key) {
  const rows = (state.rows[key] || []).map(r => ({ ...r, ...(state.profiles[key]?.get(r._id) || {}) }));
  const auth = state.auth[key];
  if (!auth) return rows;
  const seen = new Set();
  const merged = rows.map((r) => { seen.add(r._id); return { ...r, ...(auth.get(r._id) || {}), hasSave: true }; });
  for (const [uid, a] of auth) if (!seen.has(uid)) merged.push({ _id: uid, ...a, hasSave: false });
  return merged;
}

async function joinAuth() {
  const s = src();
  const key = state.src;
  try {
    const owner = session.user();
    if (!owner) throw new Error("관리 계정으로 먼저 로그인해 주세요.");
    setStatus("로그인 정보 불러오는 중…");
    const token = await G.getToken(GOOGLE.clientId, G.SCOPE_AUTH);
    const users = await G.authUsers(token, s.firebase.projectId);
    if (session.user()?.uid !== owner.uid) return;
    state.auth[key] = new Map(users.map((u) => [u.localId, authInfo(u)]));
    s.columns = [...cols().filter((c) => !AUTH_COLUMNS.some((a) => a.key === c.key)), ...AUTH_COLUMNS];
    setupControls();
    setStatus(`로그인 계정 ${users.length.toLocaleString("ko-KR")}명 합침`, "live");
    render();
  } catch (e) {
    setStatus(e.message, "err");
  }
}

function toDate(v) {
  if (v == null || v === "") return null;
  if (typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function isTrue(v) { return v === true || v === "1" || v === 1 || v === "true"; }

function fmt(v, col) {
  if (col.type === "bool") return isTrue(v) ? "예" : "아니오";
  if (v == null || v === "") return "";
  if (col.type === "date") { const d = toDate(v); return d ? d.toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : String(v); }
  if (col.type === "number") return (Number(v) / (col.divisor || 1)).toLocaleString("ko-KR", { maximumFractionDigits: col.decimals ?? 3 });
  return String(v);
}

function ago(v) {
  const d = toDate(v);
  if (!d) return "";
  const s = (Date.now() - d) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}일 전`;
  return d.toLocaleDateString("ko-KR");
}

function catValue(row, col) {
  if (col.type === "bool") return fmt(row[col.key], col);
  const v = row[col.key];
  return v == null || v === "" ? "(없음)" : String(v);
}

function esc(v) {
  return String(v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function setStatus(text, cls) {
  $("statusText").textContent = text;
  $("dot").className = "dot" + (cls ? " " + cls : "");
  $("dot").title = text;
}

function renderTabs() {
  const groups = new Map();
  for (const [key, source] of Object.entries(SOURCES)) {
    const group = source.group || source.label;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(key);
  }
  groups.set("재무 총합", FINANCE);
  const selected = FINANCE.includes(state.src) ? "재무 총합" : src().group || src().label;
  $("tabs").replaceChildren(); $("subtabs").replaceChildren();
  for (const [group, keys] of groups) {
    const b = document.createElement("button");
    b.className = group === selected ? "on" : "";
    b.setAttribute("aria-pressed", String(group === selected));
    b.textContent = group;
    b.onclick = () => { const previous = load(`group.${group}`); switchSource(keys.includes(previous) ? previous : keys[0]); };
    $("tabs").append(b);
  }
  const children = groups.get(selected) || [];
  $("subtabs").hidden = children.length < 2;
  for (const key of children) {
    const b = document.createElement("button");
    b.textContent = financeLabels[key] || SOURCES[key]?.tabLabel || SOURCES[key]?.label;
    b.className = key === state.src ? "on" : "";
    b.setAttribute("aria-pressed", String(key === state.src));
    b.onclick = () => switchSource(key);
    $("subtabs").append(b);
  }
}

function switchSource(key) {
  state.src = key;
  save("src", key);
  if (!FINANCE.includes(key)) save(`group.${src().group || src().label}`, key);
  else save('group.재무 총합', key);
  const rev = key === REVENUE;
  const finance = FINANCE.includes(key) && !rev;
  $("revenueView").hidden = !rev;
  $("financeView").hidden = !finance;
  $("dataView").hidden = rev || finance;
  financeStop?.(); financeStop = null; financeGeneration++;
  if (finance) { connection++; state.unsub?.(); state.unsub = null; renderTabs(); connectFinance(); return; }
  if (rev) {
    connection++;
    state.unsub?.();
    state.unsub = null;
    renderTabs();
    $("authBtn").hidden = false;
    renderAuthBtn(session.user());
    setStatus(state.rev.rows ? "AdMob 불러옴" : "AdMob 연결 전", state.rev.rows ? "live" : "");
    renderRevenue();
    return;
  }
  state.filters = {};
  state.sort = null;
  state.shown = PAGE;
  $("q").value = $("from").value = $("to").value = "";
  renderTabs();
  setupControls();
  connect();
}

function setupControls() {
  const s = src();
  const cats = cols().filter((c) => c.category);
  $("groupBy").innerHTML = cats.map((c) => `<option value="${c.key}">${c.label}별</option>`).join("");
  if (cats.length) $("groupBy").value = (cats.find((c) => !c.type) || cats[0]).key;
  const sortable = cols().filter((c) => c.type === "number" || c.type === "date");
  $("sortSel").innerHTML = `<option value="">기본 순서</option>` + sortable.map((c) => `<option value="${c.key}">${c.label} 높은순</option>`).join("");
  $("thead").innerHTML = "<tr>" + cols().map((c) => `<th data-k="${c.key}">${c.label}</th>`).join("") + "</tr>";
  $("thead").querySelectorAll("th").forEach((th) => th.onclick = () => {
    const k = th.dataset.k;
    state.sort = state.sort?.key === k ? { key: k, dir: -state.sort.dir } : { key: k, dir: -1 };
    render();
  });
  const note = [];
  if (!s.firebase.apiKey) note.push(`<b>${s.label}</b>: config.js 에 웹 앱 apiKey·appId 가 비어 있습니다.`);
  if (s.analyticsUrl) note.push(`플레이·클리어·광고 이벤트는 Google Analytics 에만 있어요. <a href="${s.analyticsUrl}" target="_blank" rel="noopener">Analytics 열기 →</a>`);
  if (s.authJoin) note.push(state.auth[state.src]
    ? `로그인 계정 ${state.auth[state.src].size.toLocaleString("ko-KR")}명의 이메일·로그인 방식·최근 로그인을 UID 기준으로 합쳐 보는 중이에요.`
    : `UID에 맞는 로그인 이메일·방식·최근 로그인을 추가로 보려면 해당 Firebase 프로젝트에 조회 권한이 있는 Google 계정으로 연결하세요.<br><button class="btn" id="joinAuthBtn">로그인 정보 합치기</button>`);
  $("note").innerHTML = note.length ? `<div class="note">${note.join("<br>")}</div>` : "";
  $("joinAuthBtn")?.addEventListener("click", joinAuth);
}

// ── 광고 수익(AdMob) ─────────────────────────────────────
function revRange() {
  const v = $("revRange").value;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (v === "month") return [new Date(today.getFullYear(), today.getMonth(), 1), today];
  if (v === "lastmonth") return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)];
  const from = new Date(today);
  from.setDate(from.getDate() - Number(v) + 1);
  return [from, today];
}

async function loadRevenue() {
  try {
    const owner = session.user();
    if (!owner) throw new Error("관리 계정으로 먼저 로그인해 주세요.");
    setStatus("AdMob 불러오는 중…");
    const token = await getAdToken();
    const [from, to] = revRange();
    const rows = await G.admobReport(token, ADMOB.publisherId, from, to, ADMOB.currency);
    if (session.user()?.uid !== owner.uid) return;
    state.rev.rows = rows;
    setStatus(`AdMob · ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`, "live");
    $("revNote").hidden = true;
  } catch (e) {
    setStatus(e.message, "err");
    $("revNote").hidden = false;
    $("revNote").textContent = `불러오지 못했어요: ${e.message}`;
  }
  renderRevenue();
  renderFinance();
}

const money = (n) => n.toLocaleString("ko-KR", { style: "currency", currency: ADMOB.currency, maximumFractionDigits: ADMOB.currency === "KRW" ? 0 : 2 });
const int = (n) => n.toLocaleString("ko-KR");

function sumRev(rows) {
  const t = { earnings: 0, impressions: 0, clicks: 0, requests: 0, matched: 0 };
  for (const r of rows) for (const k in t) t[k] += r[k];
  return t;
}

function renderRevenue() {
  const all = state.rev.rows || [];
  const pick = state.rev.pick;
  const rows = pick ? all.filter((r) => r[pick.key] === pick.value) : all;
  const t = sumRev(rows);
  $("revConnect").textContent = state.rev.rows ? "새로고침" : "AdMob 불러오기";
  $("revChips").innerHTML = pick ? `<button class="chip" id="revClear">${pick.key === "app" ? "앱" : "형식"}: ${esc(pick.value)} ✕</button>` : "";
  $("revClear")?.addEventListener("click", () => { state.rev.pick = null; renderRevenue(); });
  $("revKpis").innerHTML = [
    [money(t.earnings), "예상 수익"],
    [int(t.impressions), "광고 노출(시청) 수"],
    [int(t.clicks), `클릭 · CTR ${t.impressions ? ((t.clicks / t.impressions) * 100).toFixed(2) : 0}%`],
    [money(t.impressions ? (t.earnings / t.impressions) * 1000 : 0), "eCPM(1천 회당)"],
    [`${t.requests ? ((t.matched / t.requests) * 100).toFixed(1) : 0}%`, `매칭률 · 요청 ${int(t.requests)}`],
  ].map(([b, s]) => `<div class="kpi"><b>${b}</b><small>${s}</small></div>`).join("");

  const gk = $("revGroup").value;
  const groups = new Map();
  for (const r of all) { const g = groups.get(r[gk]) || []; g.push(r); groups.set(r[gk], g); }
  const gs = [...groups].map(([v, rs]) => [v, sumRev(rs)]).sort((a, b) => b[1].earnings - a[1].earnings);
  const gmax = Math.max(1e-9, ...gs.map(([, s]) => s.earnings));
  $("revGroups").innerHTML = gs.map(([v, s]) =>
    `<div class="g${pick?.key === gk && pick.value === v ? " on" : ""}" data-v="${esc(v)}"><span class="lbl">${esc(v || "(없음)")}</span><span class="n">${money(s.earnings)}</span><div class="track"><div class="fill" style="width:${(s.earnings / gmax) * 100}%"></div></div><small class="muted">노출 ${int(s.impressions)}</small></div>`).join("")
    || `<div class="empty">${state.rev.rows ? "기간 내 데이터 없음" : "AdMob 을 불러오면 표시돼요"}</div>`;
  $("revGroups").querySelectorAll(".g").forEach((el) => el.onclick = () => {
    const v = el.dataset.v;
    state.rev.pick = pick?.key === gk && pick.value === v ? null : { key: gk, value: v };
    renderRevenue();
  });

  const days = new Map();
  for (const r of rows) { const d = days.get(r.date) || []; d.push(r); days.set(r.date, d); }
  const ds = [...days].map(([d, rs]) => [d, sumRev(rs)]).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const dmax = Math.max(1e-9, ...ds.map(([, s]) => s.earnings));
  $("revSum").textContent = ds.length ? `${ds.length}일` : "";
  $("revDaily").innerHTML = ds.map(([d, s]) =>
    `<div class="day"><span class="d">${d.slice(5).replace("-", ".")} ${"일월화수목금토"[new Date(d).getDay()]}</span><span class="bar"><i style="width:${(s.earnings / dmax) * 100}%"></i></span><span class="v">${money(s.earnings)}<small>노출 ${int(s.impressions)}</small></span></div>`).join("")
    || `<div class="empty">—</div>`;
}

$("revConnect").onclick = loadRevenue;
$("revRange").onchange = () => { if (state.rev.rows) loadRevenue(); };
$("revGroup").onchange = () => { state.rev.pick = null; renderRevenue(); };
$("revCsv").onclick = () => {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["날짜", "앱", "광고 형식", `예상 수익(${ADMOB.currency})`, "노출", "클릭", "요청", "매칭 요청"];
  const lines = [head.map(q).join(",")].concat((state.rev.rows || []).map((r) => [r.date, r.app, r.format, r.earnings, r.impressions, r.clicks, r.requests, r.matched].map(q).join(",")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }));
  a.download = `admob_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

function renderAuthBtn(user) {
  const b = $("authBtn");
  if (user) {
    // 클릭 전에 준비해 브라우저가 인증 팝업을 사용자 동작으로 인식하게 합니다.
    void G.prepareGoogle().catch(() => {});
    b.className = "avatar";
    b.title = `${user.email} · 눌러서 로그아웃`;
    b.innerHTML = user.photoURL ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : esc((user.email || "?")[0].toUpperCase());
  } else {
    b.className = "btn primary";
    b.title = "";
    b.textContent = "로그인";
  }
}

async function connect() {
  const ticket = ++connection;
  state.unsub?.();
  state.unsub = null;
  const key = state.src;
  const s = src();
  render();
  if (!s.firebase.apiKey) { setStatus("설정 필요", "err"); $("authBtn").hidden = true; return; }
  $("authBtn").hidden = false;
  renderAuthBtn(session.user());
  if (!session.user()) { setStatus("관리 계정 로그인 필요"); render(); return; }
  try {
    const { db } = await session.ensure(key);
    if (ticket !== connection || key !== state.src) return;
    setStatus("연결 중…");
    const stops = [];
    state.unsub = () => stops.forEach(stop => stop());
    stops.push(onSnapshot(collection(db, s.collection), (snap) => {
      if (ticket !== connection || !session.user()) return;
      state.rows[key] = snap.docs.map((d) => ({ _id: d.id, ...d.data() })).filter(row => !s.rowFilter || Object.entries(s.rowFilter).every(([k, v]) => (row[k] ?? (k === 'app' && row._id.startsWith('bunny-20') ? 'blaiva' : undefined)) === v));
      if (!s.columns && state.rows[key].length) { inferColumns(s, state.rows[key]); setupControls(); }
      setStatus(`실시간 · ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`, "live");
      render();
    }, (err) => { if (ticket === connection) setStatus(err.code === "permission-denied" ? "이 앱의 읽기 권한이 없습니다" : err.message, "err"); }));
    if (s.profileJoin) stops.push(onSnapshot(collection(db, s.profileJoin.collection), snap => {
      if (ticket !== connection || !session.user()) return;
      state.profiles[key] = new Map(snap.docs.map(doc => [doc.id, Object.fromEntries(s.profileJoin.fields.filter(field => doc.data()[field] !== undefined).map(field => [field, doc.data()[field]]))]));
      render();
    }, err => { if (ticket === connection) setStatus(`프로필 조회 실패: ${err.code}`, "err"); }));
  } catch (e) { if (ticket === connection) setStatus(e.message, "err"); }
}

$("authBtn").onclick = async () => {
  try {
    if (session.user()) {
      if (confirm(`${session.user().email} · 전체 앱에서 로그아웃할까요?`)) await session.logout();
    } else {
      const failures = await session.login();
      if (failures.length) setStatus(`일부 앱 연결 실패: ${failures.map((f) => `${SOURCES[f.key].label} (${f.message})`).join(" · ")}`, "err");
    }
  } catch (e) { setStatus(e.message, "err"); }
};

function filtered() {
  const s = src();
  const rows = rowsOf(state.src);
  const q = $("q").value.trim().toLowerCase();
  const from = $("from").value ? new Date($("from").value + "T00:00:00") : null;
  const to = $("to").value ? new Date($("to").value + "T23:59:59") : null;
  let out = rows.filter((r) => {
    if (q && !cols().some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) return false;
    if (from || to) {
      const d = toDate(r[s.dateField]);
      if (!d || (from && d < from) || (to && d > to)) return false;
    }
    for (const [k, v] of Object.entries(state.filters)) if (v !== "" && catValue(r, colOf(k)) !== v) return false;
    return true;
  });
  if (state.sort) {
    const col = colOf(state.sort.key);
    const val = (r) => col.type === "date" ? (toDate(r[col.key])?.getTime() ?? -Infinity) : col.type === "number" ? Number(r[col.key] ?? -Infinity) : String(r[col.key] ?? "");
    out = [...out].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * state.sort.dir);
  }
  return out;
}

function renderFilters(all) {
  const s = src();
  $("catFilters").innerHTML = "";
  for (const col of cols().filter((c) => c.category)) {
    const counts = new Map();
    all.forEach((r) => { const v = catValue(r, col); counts.set(v, (counts.get(v) || 0) + 1); });
    const label = document.createElement("label");
    label.textContent = col.label;
    const sel = document.createElement("select");
    sel.innerHTML = `<option value="">전체</option>` + [...counts].sort((a, b) => b[1] - a[1]).map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${n})</option>`).join("");
    sel.value = state.filters[col.key] ?? "";
    sel.onchange = () => { state.filters[col.key] = sel.value; state.shown = PAGE; render(); };
    label.append(sel);
    $("catFilters").append(label);
  }
  const active = Object.values(state.filters).filter((v) => v !== "").length + ($("from").value ? 1 : 0) + ($("to").value ? 1 : 0);
  $("filterCount").hidden = !active;
  $("filterCount").textContent = active;
  $("chips").innerHTML = Object.entries(state.filters).filter(([, v]) => v !== "").map(([k, v]) =>
    `<button class="chip" data-k="${k}">${colOf(k).label}: ${esc(v)} ✕</button>`).join("");
  $("chips").querySelectorAll(".chip").forEach((c) => c.onclick = () => { delete state.filters[c.dataset.k]; render(); });
}

function renderKpis(rows, all) {
  const cards = [[rows.length.toLocaleString("ko-KR"), rows.length === all.length ? "전체" : `필터 결과 · 전체 ${all.length.toLocaleString("ko-KR")}`]];
  for (const c of cols().filter((c) => c.type === "number")) {
    const vals = rows.map((r) => Number(r[c.key])).filter((n) => !isNaN(n));
    const sum = vals.reduce((a, b) => a + b, 0);
    cards.push([fmt(sum,c), `${c.label} 합계 · 평균 ${vals.length ? (sum / vals.length / (c.divisor || 1)).toFixed(c.decimals ?? 1) : 0}`]);
  }
  $("cards").innerHTML = cards.map(([b, t]) => `<div class="kpi"><b>${b}</b><small>${t}</small></div>`).join("");
}

function renderGroups(rows) {
  const gcol = colOf($("groupBy").value) || cols().find((c) => c.category);
  if (!gcol) { $("groups").innerHTML = `<div class="empty">데이터 없음</div>`; $("gmore").hidden = true; return; }
  const groups = new Map();
  rows.forEach((r) => { const v = catValue(r, gcol); groups.set(v, (groups.get(v) || 0) + 1); });
  const max = Math.max(1, ...groups.values());
  const cur = state.filters[gcol.key];
  $("groups").innerHTML = [...groups].sort((a, b) => b[1] - a[1]).map(([v, n]) =>
    `<div class="g${cur === v ? " on" : ""}" data-v="${esc(v)}"><span class="lbl">${esc(v)}</span><span class="n">${n.toLocaleString("ko-KR")}</span><div class="track"><div class="fill" style="width:${(n / max) * 100}%"></div></div></div>`).join("")
    || `<div class="empty">데이터 없음</div>`;
  $("gmore").hidden = groups.size <= 6;
  $("gmore").textContent = $("groups").classList.contains("open") ? "접기" : `전체 보기 (${groups.size})`;
  $("groups").querySelectorAll(".g").forEach((g) => g.onclick = () => {
    state.filters[gcol.key] = state.filters[gcol.key] === g.dataset.v ? "" : g.dataset.v;
    state.shown = PAGE;
    render();
  });
}

function cell(r, c) {
  const v = fmt(r[c.key], c);
  if (c.type === "bool") return `<span class="pill${isTrue(r[c.key]) ? " yes" : ""}">${v}</span>`;
  return esc(v);
}

function renderTable(rows) {
  const s = src();
  $("thead").querySelectorAll("th").forEach((th) => th.className = state.sort?.key === th.dataset.k ? "sorted" : "");
  $("tbody").innerHTML = rows.slice(0, state.shown).map((r) => "<tr>" + cols().map((c) =>
    `<td class="${c.type === "number" ? "num" : ""}">${cell(r, c)}</td>`).join("") + "</tr>").join("");
}

function renderList(rows) {
  const s = src();
  const stats = (s.stats || []).map(colOf);
  const tags = cols().filter((c) => c.category && !(s.stats || []).includes(c.key));
  const html = rows.slice(0, state.shown).map((r) => {
    const title = r[s.titleKey] || r._id;
    const sub = title !== r._id ? `<div class="item-id">${esc(r._id)}</div>` : "";
    const st = stats.map((c) => `<div class="stat"><b>${esc(fmt(r[c.key], c) || "0")}</b><small>${c.label}</small></div>`).join("");
    const tg = tags.map((c) => { const v = catValue(r, c); return v === "(없음)" ? "" : `<span class="pill${c.type === "bool" && isTrue(r[c.key]) ? " yes" : ""}">${c.type === "bool" ? c.label + " " : ""}${esc(v)}</span>`; }).join("");
    return `<div class="item"><div class="item-h"><div class="item-t">${esc(title)}</div><div class="item-d">${ago(r[s.dateField])}</div></div>${sub}${st ? `<div class="item-stats" style="grid-template-columns:repeat(${stats.length},1fr)">${st}</div>` : ""}<div class="item-tags">${tg}</div></div>`;
  }).join("");
  $("list").innerHTML = html || `<div class="empty">${state.rows[state.src] ? "조건에 맞는 항목이 없어요" : "로그인하면 데이터가 표시돼요"}</div>`;
}

function render() {
  const all = rowsOf(state.src);
  const rows = filtered();
  renderFilters(all);
  renderKpis(rows, all);
  renderGroups(rows);
  renderTable(rows);
  renderList(rows);
  $("listTitle").textContent = `목록 ${rows.length.toLocaleString("ko-KR")}`;
  $("sortSel").value = state.sort && state.sort.dir === -1 ? state.sort.key : "";
  const more = document.querySelector(".more");
  more?.remove();
  if (rows.length > state.shown) {
    const b = document.createElement("button");
    b.className = "btn more";
    b.textContent = `더 보기 (${(rows.length - state.shown).toLocaleString("ko-KR")}개 남음)`;
    b.onclick = () => { state.shown += PAGE; render(); };
    $("list").parentElement.append(b);
  }
}

$("csv").onclick = () => {
  const s = src();
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [cols().map((c) => q(c.label)).join(",")].concat(filtered().map((r) => cols().map((c) => q(fmt(r[c.key], c))).join(",")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }));
  a.download = `${state.src}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

$("filterToggle").onclick = () => { $("filters").hidden = !$("filters").hidden; save("filtersOpen", $("filters").hidden ? "0" : "1"); };
$("sortSel").onchange = () => { state.sort = $("sortSel").value ? { key: $("sortSel").value, dir: -1 } : null; render(); };
["q", "from", "to"].forEach((id) => $(id).addEventListener("input", () => { state.shown = PAGE; render(); }));
$("groupBy").addEventListener("change", render);
$("gmore").onclick = () => { $("groups").classList.toggle("open"); render(); };
$("reset").onclick = () => { state.filters = {}; $("q").value = $("from").value = $("to").value = ""; render(); };

async function checkUpdate() {
  if (VERSION === "dev") return;
  try {
    const { version } = await (await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" })).json();
    if (version && version !== VERSION) $("updateToast").hidden = false;
  } catch {}
}
$("updateBtn").onclick = () => location.reload();
$("foot").textContent = `버전 ${VERSION}`;
setInterval(checkUpdate, 5 * 60 * 1000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkUpdate(); });

async function connectFinance() {
  renderFinance();
  if (!session.user()) { setStatus('관리 계정 로그인 필요'); return; }
  const ticket = ++financeGeneration;
  try {
    const { db } = await session.ensure('blaiva_costs');
    if (ticket !== financeGeneration) return;
    financeStop = onSnapshot(collection(db, 'financeReports'), snap => {
      if (ticket !== financeGeneration || !session.user()) return;
      financeReports = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); financeError = '';
      setStatus('재무 데이터 연결됨', 'live'); renderFinance();
    }, e => { financeError = `재무 조회 실패: ${e.code}`; renderFinance(); });
  } catch(e) { financeError = e.message; renderFinance(); }
}
function financeData() {
  const month = $('financeMonth').value;
  return summarizeFinance(financeReports[month], state.rev.finance?.month === month ? state.rev.finance.rows : null, month, ADMOB.currency);
}
function renderFinance() {
  if (!$('financeMonth').value) return;
  const month = $('financeMonth').value, report = financeReports[month], result = financeData();
  const show = state.src === 'finance_bunny' ? 'Bunny' : state.src === 'finance_firebase' ? 'Firebase / GCP' : null;
  const rows = result.rows.filter(r => !show || r.category === show);
  const fm = (v, currency) => Number(v).toLocaleString('ko-KR', { style: 'currency', currency, maximumFractionDigits: currency === 'KRW' ? 2 : 6 });
  $('financeTitle').textContent = financeLabels[state.src] || '재무 총합';
  $('financeNote').textContent = financeError || (!session.user() ? '관리 계정 로그인 후 표시됩니다.' : `${month} · ${result.missing.length ? '집계 대기: ' + result.missing.join(' · ') : '세 항목 연결됨'}. 서로 다른 통화는 합산하지 않습니다. 손익은 조회된 항목만의 추정치이며 최종 청구·정산과 다를 수 있습니다.`);
  $('financeKpis').innerHTML = Object.entries(result.totals).flatMap(([currency,t]) => [[fm(t.income,currency), `${currency} 수입`], [fm(t.expense,currency), `${currency} 지출`], [fm(t.net,currency), `${currency} 수입−지출 · ${result.missing.length ? '일부 집계' : '사용 기준'}`]]).map(([v,l]) => `<div class="kpi"><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('') || '<div class="kpi"><b>집계 대기</b><small>조회되지 않은 비용은 0원이 아닙니다</small></div>';
  $('financeHead').innerHTML = '<tr><th>항목</th><th>대상</th><th>수입</th><th>지출</th><th>기준</th></tr>';
  $('financeBody').innerHTML = rows.map(r => `<tr><td>${esc(r.category)}</td><td>${esc(r.app)}</td><td>${esc(fm(r.income,r.currency))}</td><td>${esc(fm(r.expense,r.currency))}</td><td>${esc(r.basis)}</td></tr>`).join('') || '<tr><td colspan="5">아직 집계된 항목이 없습니다.</td></tr>';
  const checked = report?.checkedAt?.toDate?.();
  $('financeChecked').textContent = checked ? '갱신 ' + checked.toLocaleString('ko-KR') : '';
  const b = report?.bunny;
  const details = b ? [`Bunny 계정 청구 집계만 총합에 반영합니다. 아래는 체험·크레딧을 적용하지 않은 앱별 사용 원가 추정이며 중복 합산하지 않습니다.`, ...b.apps.map(a => `${a.app}: 저장 ${(a.storageBytes/1e9).toFixed(3)} GB · 전송 ${(a.bandwidthBytes/1e9).toFixed(3)} GB · 저장 ${fm(a.storageUsd,'USD')} + 전송 ${fm(a.deliveryUsd,'USD')} = ${fm(a.estimatedUsd,'USD')} 추정 (${a.regions}개 지역, $${a.storageUsdPerGbMonth}/GB·월)`), `Bunny 잔액: ${b.balance == null ? '미확인' : fm(b.balance,'USD')} · 체험 잔액: ${b.trialBalance == null ? '미확인' : fm(b.trialBalance,'USD')} · 체험 종료: ${b.trialUntil || '미확인'}. 잔액·충전액·크레딧을 사용료에 더하지 않습니다.`] : [];
  details.push(report?.firebase?.note || 'Firebase / Google Cloud: 결제 내보내기 첫 데이터 수신 대기. 함수·Firestore·Hosting 등 프로젝트별 GCP 서비스 비용과 크레딧을 함께 집계합니다.');
  $('financeDetails').innerHTML = details.map(t => `<p>${esc(t)}</p>`).join('');
}
$('financeMonth').value = new Date().toISOString().slice(0,7);
$('financeMonth').onchange = renderFinance;
$('financeAd').onclick = async () => {
  const owner = session.user(), month = $('financeMonth').value;
  if (!owner) { financeError = '관리 계정으로 먼저 로그인해 주세요.'; renderFinance(); return; }
  $('financeAd').disabled = true;
  try {
    const token = await getAdToken();
    const [y,m] = month.split('-').map(Number), from = new Date(y,m-1,1), to = new Date(Math.min(Date.now(),new Date(y,m,0).getTime()));
    if (from > to) throw Error('미래 월은 조회할 수 없습니다.');
    const rows = await G.admobReport(token, ADMOB.publisherId, from, to, ADMOB.currency);
    if (session.user()?.uid !== owner.uid) return;
    state.rev.finance = { month, rows }; financeError = '';
  } catch(e) { financeError = `광고 수익 조회 실패: ${e.message}`; }
  finally { $('financeAd').disabled = false; renderFinance(); }
};
$('financeCsv').onclick = () => {
  const q = v => `"${String(v).replace(/"/g,'""')}"`;
  const data = [['월','항목','대상','통화','수입','지출','기준'], ...financeData().rows.map(r => [$('financeMonth').value,r.category,r.app,r.currency,r.income,r.expense,r.basis])];
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob(['\uFEFF' + data.map(r=>r.map(q).join(',')).join('\n')], {type:'text/csv'})); a.href=url; a.download=`finance_${$('financeMonth').value}.csv`; a.click(); URL.revokeObjectURL(url);
};
if (!FINANCE.includes(state.src) && !SOURCES[state.src]) state.src = Object.keys(SOURCES)[0];
$("filters").hidden = load("filtersOpen") !== "1";
switchSource(state.src);
