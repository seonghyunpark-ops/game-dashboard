import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SOURCES } from "./config.js";

const $ = (id) => document.getElementById(id);
const state = { src: localStorage.getItem("src") || "seongsu", rows: {}, filters: {}, sort: null, unsub: null, user: null };
const apps = {};

function appFor(key) {
  if (!apps[key]) {
    const app = initializeApp(SOURCES[key].firebase, key);
    apps[key] = { auth: getAuth(app), db: getFirestore(app) };
  }
  return apps[key];
}

function toDate(v) {
  if (v == null || v === "") return null;
  if (typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function fmt(v, col) {
  if (v == null || v === "") return "";
  if (col.type === "date") { const d = toDate(v); return d ? d.toLocaleString("ko-KR", { hour12: false }) : String(v); }
  if (col.type === "bool") return v === true || v === "1" || v === 1 ? "예" : "아니오";
  if (col.type === "number") return Number(v).toLocaleString("ko-KR");
  return String(v);
}

function catValue(row, col) {
  const v = row[col.key];
  if (col.type === "bool") return fmt(v ?? false, col);
  return v == null || v === "" ? "(없음)" : String(v);
}

function setStatus(text, cls) {
  $("statusText").textContent = text;
  $("dot").className = "dot" + (cls ? " " + cls : "");
}

function renderTabs() {
  $("tabs").innerHTML = "";
  for (const [key, s] of Object.entries(SOURCES)) {
    const b = document.createElement("button");
    b.className = "tab" + (key === state.src ? " on" : "");
    b.textContent = s.label;
    b.onclick = () => switchSource(key);
    $("tabs").append(b);
  }
}

function switchSource(key) {
  state.src = key;
  try { localStorage.setItem("src", key); } catch {}
  state.filters = {};
  state.sort = null;
  $("q").value = $("from").value = $("to").value = "";
  renderTabs();
  setupControls();
  connect();
}

function setupControls() {
  const s = SOURCES[state.src];
  const cats = s.columns.filter((c) => c.category);
  $("groupBy").innerHTML = cats.map((c) => `<option value="${c.key}">${c.label}</option>`).join("");
  $("thead").innerHTML = "<tr>" + s.columns.map((c) => `<th data-k="${c.key}">${c.label}</th>`).join("") + "</tr>";
  $("thead").querySelectorAll("th").forEach((th) => th.onclick = () => {
    const k = th.dataset.k;
    state.sort = state.sort?.key === k ? { key: k, dir: -state.sort.dir } : { key: k, dir: -1 };
    render();
  });
  const note = [];
  if (!s.firebase.apiKey) note.push(`<b>${s.label}</b>: config.js 에 웹 앱 apiKey·appId 가 비어 있습니다. Firebase 콘솔에서 웹 앱을 등록한 뒤 채워 주세요.`);
  if (s.analyticsUrl) note.push(`Analytics 이벤트(ss_cold_start 등)는 GA4에 저장돼 여기서 읽을 수 없습니다. <a href="${s.analyticsUrl}" target="_blank" rel="noopener">Firebase Analytics 콘솔 열기</a>`);
  $("note").innerHTML = note.length ? `<div class="note">${note.join("<br>")}</div>` : "";
}

function connect() {
  state.unsub?.();
  state.unsub = null;
  const key = state.src;
  const s = SOURCES[key];
  render();
  if (!s.firebase.apiKey) { setStatus("설정 필요", "err"); $("authBtn").hidden = true; return; }
  $("authBtn").hidden = false;
  const { auth, db } = appFor(key);
  const stopAuth = onAuthStateChanged(auth, (user) => {
    if (key !== state.src) return;
    state.user = user;
    $("authBtn").textContent = user ? `로그아웃 (${user.email})` : "Google 로그인";
    state.stopSnap?.();
    state.stopSnap = null;
    if (!user) { setStatus("로그인 필요"); return; }
    setStatus("연결 중…");
    state.stopSnap = onSnapshot(collection(db, s.collection), (snap) => {
      state.rows[key] = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      setStatus(`실시간 · ${new Date().toLocaleTimeString("ko-KR", { hour12: false })} 갱신`, "live");
      render();
    }, (err) => setStatus(err.code === "permission-denied" ? "권한 없음: 보안 규칙에 소유자 읽기를 추가하세요" : err.message, "err"));
  });
  state.unsub = () => { stopAuth(); state.stopSnap?.(); state.stopSnap = null; };
}

$("authBtn").onclick = async () => {
  const { auth } = appFor(state.src);
  if (auth.currentUser) await signOut(auth);
  else await signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => setStatus(e.message, "err"));
};

function filtered() {
  const s = SOURCES[state.src];
  const rows = state.rows[state.src] || [];
  const q = $("q").value.trim().toLowerCase();
  const from = $("from").value ? new Date($("from").value + "T00:00:00") : null;
  const to = $("to").value ? new Date($("to").value + "T23:59:59") : null;
  let out = rows.filter((r) => {
    if (q && !s.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) return false;
    if (from || to) {
      const d = toDate(r[s.dateField]);
      if (!d || (from && d < from) || (to && d > to)) return false;
    }
    for (const [k, v] of Object.entries(state.filters)) {
      const col = s.columns.find((c) => c.key === k);
      if (v !== "" && catValue(r, col) !== v) return false;
    }
    return true;
  });
  if (state.sort) {
    const col = s.columns.find((c) => c.key === state.sort.key);
    const val = (r) => col.type === "date" ? (toDate(r[col.key])?.getTime() ?? -Infinity) : col.type === "number" ? Number(r[col.key] ?? -Infinity) : String(r[col.key] ?? "");
    out = [...out].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * state.sort.dir);
  }
  return out;
}

function render() {
  const s = SOURCES[state.src];
  const all = state.rows[state.src] || [];
  const rows = filtered();

  $("catFilters").innerHTML = "";
  for (const col of s.columns.filter((c) => c.category)) {
    const counts = new Map();
    all.forEach((r) => counts.set(catValue(r, col), (counts.get(catValue(r, col)) || 0) + 1));
    const label = document.createElement("label");
    label.textContent = col.label;
    const sel = document.createElement("select");
    sel.innerHTML = `<option value="">전체</option>` + [...counts].sort((a, b) => b[1] - a[1]).map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${n})</option>`).join("");
    sel.value = state.filters[col.key] ?? "";
    sel.onchange = () => { state.filters[col.key] = sel.value; render(); };
    label.append(sel);
    $("catFilters").append(label);
  }

  $("chips").innerHTML = Object.entries(state.filters).filter(([, v]) => v !== "").map(([k, v]) =>
    `<span class="chip" data-k="${k}">${s.columns.find((c) => c.key === k).label}: ${esc(v)} ✕</span>`).join("");
  $("chips").querySelectorAll(".chip").forEach((c) => c.onclick = () => { delete state.filters[c.dataset.k]; render(); });

  const nums = s.columns.filter((c) => c.type === "number");
  const cards = [[`${rows.length.toLocaleString("ko-KR")}`, `표시 / 전체 ${all.length.toLocaleString("ko-KR")}`]];
  for (const c of nums) {
    const vals = rows.map((r) => Number(r[c.key])).filter((n) => !isNaN(n));
    const sum = vals.reduce((a, b) => a + b, 0);
    cards.push([sum.toLocaleString("ko-KR"), `${c.label} 합계 · 평균 ${vals.length ? (sum / vals.length).toFixed(1) : 0}`]);
  }
  $("cards").innerHTML = cards.map(([b, t]) => `<div class="card"><b>${b}</b><span>${t}</span></div>`).join("");

  const gcol = s.columns.find((c) => c.key === $("groupBy").value) || s.columns.find((c) => c.category);
  const groups = new Map();
  rows.forEach((r) => groups.set(catValue(r, gcol), (groups.get(catValue(r, gcol)) || 0) + 1));
  const max = Math.max(1, ...groups.values());
  $("groupTitle").textContent = `${gcol.label}별 분류 (클릭하면 필터)`;
  $("groups").innerHTML = [...groups].sort((a, b) => b[1] - a[1]).map(([v, n]) =>
    `<div class="group-row" data-v="${esc(v)}"><span class="fill" style="width:${(n / max) * 100}%"></span><span>${esc(v)}</span><span>${n}</span></div>`).join("") || `<div class="muted">데이터 없음</div>`;
  $("groups").querySelectorAll(".group-row").forEach((g) => g.onclick = () => { state.filters[gcol.key] = g.dataset.v; render(); });

  $("tbody").innerHTML = rows.slice(0, 2000).map((r) => "<tr>" + s.columns.map((c) =>
    `<td class="${c.type === "number" ? "num" : ""}">${esc(fmt(r[c.key], c))}</td>`).join("") + "</tr>").join("");
}

function esc(v) {
  return String(v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

$("csv").onclick = () => {
  const s = SOURCES[state.src];
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [s.columns.map((c) => cell(c.label)).join(",")].concat(filtered().map((r) => s.columns.map((c) => cell(fmt(r[c.key], c))).join(",")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }));
  a.download = `${state.src}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

["q", "from", "to", "groupBy"].forEach((id) => $(id).addEventListener("input", render));
$("reset").onclick = () => { state.filters = {}; $("q").value = $("from").value = $("to").value = ""; render(); };

if (!SOURCES[state.src]) state.src = Object.keys(SOURCES)[0];
renderTabs();
setupControls();
connect();
