import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const VERSION = window.__APP_VERSION__ || "dev";
const { SOURCES } = await import(`./config.js?v=${encodeURIComponent(VERSION)}`);

const $ = (id) => document.getElementById(id);
const PAGE = 100;
const state = { src: load("src") || "seongsu", rows: {}, filters: {}, sort: null, unsub: null, stopSnap: null, shown: PAGE };
const apps = {};

function load(k) { try { return localStorage.getItem(k); } catch { return null; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch {} }

function appFor(key) {
  if (!apps[key]) {
    const app = initializeApp(SOURCES[key].firebase, key);
    apps[key] = { auth: getAuth(app), db: getFirestore(app) };
  }
  return apps[key];
}

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
  if (col.type === "number") return Number(v).toLocaleString("ko-KR");
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
  $("tabs").innerHTML = "";
  for (const [key, s] of Object.entries(SOURCES)) {
    const b = document.createElement("button");
    b.className = key === state.src ? "on" : "";
    b.textContent = s.label;
    b.onclick = () => switchSource(key);
    $("tabs").append(b);
  }
}

function switchSource(key) {
  state.src = key;
  save("src", key);
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
  $("note").innerHTML = note.length ? `<div class="note">${note.join("<br>")}</div>` : "";
}

function renderAuthBtn(user) {
  const b = $("authBtn");
  if (user) {
    b.className = "avatar";
    b.title = `${user.email} · 눌러서 로그아웃`;
    b.innerHTML = user.photoURL ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : esc((user.email || "?")[0].toUpperCase());
  } else {
    b.className = "btn primary";
    b.title = "";
    b.textContent = "로그인";
  }
}

function connect() {
  state.unsub?.();
  state.unsub = null;
  const key = state.src;
  const s = src();
  render();
  if (!s.firebase.apiKey) { setStatus("설정 필요", "err"); $("authBtn").hidden = true; return; }
  $("authBtn").hidden = false;
  const { auth, db } = appFor(key);
  const stopAuth = onAuthStateChanged(auth, (user) => {
    if (key !== state.src) return;
    renderAuthBtn(user);
    state.stopSnap?.();
    state.stopSnap = null;
    if (!user) { setStatus("로그인 필요"); render(); return; }
    setStatus("연결 중…");
    state.stopSnap = onSnapshot(collection(db, s.collection), (snap) => {
      state.rows[key] = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      if (!s.columns && state.rows[key].length) { inferColumns(s, state.rows[key]); setupControls(); }
      setStatus(`실시간 · ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`, "live");
      render();
    }, (err) => setStatus(err.code === "permission-denied" ? "권한 없음" : err.message, "err"));
  });
  state.unsub = () => { stopAuth(); state.stopSnap?.(); state.stopSnap = null; };
}

$("authBtn").onclick = async () => {
  const { auth } = appFor(state.src);
  if (auth.currentUser) { if (confirm(`${auth.currentUser.email} 로그아웃할까요?`)) await signOut(auth); }
  else await signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => setStatus(e.message, "err"));
};

function filtered() {
  const s = src();
  const rows = state.rows[state.src] || [];
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
    cards.push([sum.toLocaleString("ko-KR"), `${c.label} 합계 · 평균 ${vals.length ? (sum / vals.length).toFixed(1) : 0}`]);
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
  const all = state.rows[state.src] || [];
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

if (!SOURCES[state.src]) state.src = Object.keys(SOURCES)[0];
$("filters").hidden = load("filtersOpen") !== "1";
renderTabs();
setupControls();
connect();
