// Google Analytics(GA4) 읽기 전용 탭 — 앱별 체류시간·유입 경로(blaiva 웹은 탐색 단계까지).
// 관리 계정의 Google OAuth 토큰(analytics.readonly, 메모리 보관)으로 GA Data API를 직접 부른다. 서버·비밀값 없음.
// 이벤트 이름(depth_2 등)은 blaiva 저장소 web/src/traffic-policy.mjs 와 같아야 한다.
export const SCOPE_GA = "https://www.googleapis.com/auth/analytics.readonly";
export const DEPTHS = [2, 3, 5, 10];
const ACTIONS = { play_request: "재생 시작", external_open: "원문으로 이동", favorite_add: "찜" };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// AI 어시스턴트(ChatGPT·Gemini 등) 유입을 뺀 숫자를 따로 보기 위한 채널 이름(GA 기본 채널 그룹).
export const AI_CHANNEL = "AI Assistant";
const NOT_AI = { notExpression: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: AI_CHANNEL } } } };

// excludeAi: 같은 요청에 'AI Assistant 채널 제외' 조건을 붙인다(기존 필터와는 AND).
export function buildRequests(days = 28, { web = true, excludeAi = false } = {}) {
  const requests = baseRequests(days, { web });
  if (!excludeAi) return requests;
  return requests.map((r, i) => ({
    ...r,
    dimensionFilter: r.dimensionFilter ? { andGroup: { expressions: [r.dimensionFilter, NOT_AI] } } : NOT_AI,
    // 화면 표는 상위 10개 밖으로 밀린 화면도 짝을 찾을 수 있게 넉넉히 받는다.
    ...(i === 4 ? { limit: 200 } : {}),
  }));
}

function baseRequests(days, { web }) {
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
  const totals = ["activeUsers", "sessions", "userEngagementDuration", "averageSessionDuration", "screenPageViewsPerSession", "engagementRate"];
  return [
    { dateRanges, metrics: totals.map((name) => ({ name })) },
    { dateRanges, dimensions: [{ name: "date" }], metrics: totals.map((name) => ({ name })), orderBys: [{ dimension: { dimensionName: "date" }, desc: true }] },
    { dateRanges, dimensions: [{ name: "sessionDefaultChannelGroup" }, { name: "sessionSource" }], metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "userEngagementDuration" }, { name: "screenPageViewsPerSession" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 15 },
    // blaiva 웹은 단계(depth_N)·행동 이벤트만, 게임 앱은 이벤트 이름이 제각각이라 많이 일어난 이벤트 순으로 본다.
    web
      ? { dateRanges, dimensions: [{ name: "eventName" }], metrics: [{ name: "totalUsers" }, { name: "eventCount" }],
          dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: ["page_view", ...DEPTHS.map((d) => `depth_${d}`), ...Object.keys(ACTIONS)] } } } }
      : { dateRanges, dimensions: [{ name: "eventName" }], metrics: [{ name: "totalUsers" }, { name: "eventCount" }], orderBys: [{ metric: { metricName: "eventCount" }, desc: true }], limit: 15 },
    { dateRanges, dimensions: [{ name: web ? "pagePath" : "unifiedScreenName" }], metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "userEngagementDuration" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10 },
  ];
}

// GA 응답 표를 {차원명: 값, 지표명: 숫자} 행 목록으로 바꾼다.
export function rowsOf(report) {
  const dims = (report?.dimensionHeaders || []).map((h) => h.name), mets = (report?.metricHeaders || []).map((h) => h.name);
  return (report?.rows || []).map((row) => {
    const out = {};
    dims.forEach((name, i) => { out[name] = row.dimensionValues?.[i]?.value ?? ""; });
    mets.forEach((name, i) => { out[name] = Number(row.metricValues?.[i]?.value || 0); });
    return out;
  });
}

export function summarize(reports, { web = true, noAiReports = null } = {}) {
  const [totalsReport, daily, channels, events, pages] = reports.map(rowsOf);
  const totals = totalsReport[0] || {};
  const users = totals.activeUsers || 0;
  const byEvent = Object.fromEntries(events.map((r) => [r.eventName, r]));
  const base = byEvent.page_view?.totalUsers || users;
  const steps = [{ label: "1단계(첫 화면)", users: base }, ...DEPTHS.map((d) => ({ label: `${d}화면 이상`, users: byEvent[`depth_${d}`]?.totalUsers || 0 }))]
    .map((s) => ({ ...s, rate: base ? s.users / base : 0 }));
  const actions = Object.entries(ACTIONS).map(([name, label]) => ({ label, users: byEvent[name]?.totalUsers || 0, count: byEvent[name]?.eventCount || 0 }));
  const perUser = (r) => (r.activeUsers ? r.userEngagementDuration / r.activeUsers : 0);
  const out = {
    totals: { users, sessions: totals.sessions || 0, engagementPerUser: perUser(totals), sessionDuration: totals.averageSessionDuration || 0, viewsPerSession: totals.screenPageViewsPerSession || 0, engagementRate: totals.engagementRate || 0 },
    daily: daily.map((r) => ({ date: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`, users: r.activeUsers, sessions: r.sessions, engagementPerUser: perUser(r), viewsPerSession: r.screenPageViewsPerSession })),
    channels: channels.map((r) => ({ channel: r.sessionDefaultChannelGroup, source: r.sessionSource, sessions: r.sessions, users: r.activeUsers, engagementPerUser: perUser(r), viewsPerSession: r.screenPageViewsPerSession })),
    web, steps, actions,
    events: events.map((r) => ({ name: r.eventName, users: r.totalUsers, count: r.eventCount })),
    pages: pages.map((r) => ({ path: r.pagePath ?? r.unifiedScreenName, views: r.screenPageViews, users: r.activeUsers, engagementPerUser: perUser(r) })),
  };
  if (noAiReports) addNoAi(out, summarize(noAiReports, { web }));
  return out;
}

// 'AI Assistant 제외' 조회 결과를 같은 항목(날짜·이벤트·화면 등) 옆에 noAi로 붙인다. 짝이 없으면 0명.
function addNoAi(all, noAi) {
  const pick = (list, key) => new Map(list.map((r) => [r[key], r]));
  all.hasNoAi = true;
  all.totals.usersNoAi = noAi.totals.users; all.totals.sessionsNoAi = noAi.totals.sessions;
  all.steps.forEach((s, i) => { s.usersNoAi = noAi.steps[i]?.users || 0; });
  all.actions.forEach((a, i) => { a.usersNoAi = noAi.actions[i]?.users || 0; });
  const ev = pick(noAi.events, "name"), pg = pick(noAi.pages, "path"), dy = pick(noAi.daily, "date");
  all.events.forEach((e) => { e.usersNoAi = ev.get(e.name)?.users || 0; });
  all.pages.forEach((p) => { p.usersNoAi = pg.get(p.path)?.users || 0; });
  all.daily.forEach((d) => { d.usersNoAi = dy.get(d.date)?.users || 0; d.sessionsNoAi = dy.get(d.date)?.sessions || 0; });
}

export const duration = (seconds) => {
  const s = Math.round(seconds || 0);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
};
const num = (n, d = 0) => Number(n || 0).toLocaleString("ko-KR", { maximumFractionDigits: d });
const pct = (n) => `${(Number(n || 0) * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
const table = (head, rows) => `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${head.length}">자료 없음</td></tr>`}</tbody></table></div>`;
const tr = (cells) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;

export function renderReport(data, days = 28) {
  const t = data.totals;
  // AI 제외 칸: 제외 조회가 있을 때만 '방문자' 옆에 붙인다.
  const ai = !!data.hasNoAi, AI_H = "AI 제외";
  const withAi = (head, at) => (ai ? [...head.slice(0, at + 1), AI_H, ...head.slice(at + 1)] : head);
  const val = (cells, at, v) => (ai ? [...cells.slice(0, at + 1), num(v), ...cells.slice(at + 1)] : cells);
  const card = (value, label) => `<div class="kpi"><b>${esc(value)}</b><small>${esc(label)}</small></div>`;
  return `
<div class="kpis">${card(num(t.users), `방문자(최근 ${days}일)`)}${ai ? card(num(t.usersNoAi), "방문자(AI Assistant 유입 제외)") : ""}${card(num(t.sessions), "방문(세션)")}${ai ? card(num(t.sessionsNoAi), "방문(AI Assistant 유입 제외)") : ""}${card(duration(t.engagementPerUser), "1인 평균 체류(참여) 시간")}${card(duration(t.sessionDuration), "방문당 평균 머문 시간")}${card(num(t.viewsPerSession, 1), "방문당 본 화면 수")}${card(pct(t.engagementRate), "참여 방문 비율")}</div>
${data.web === false ? `<h3 class="ga-h">많이 일어난 이벤트</h3>
${table(withAi(["이벤트", "한 사람 수", "횟수"], 1), data.events.map((e) => tr(val([e.name, num(e.users), num(e.count)], 1, e.usersNoAi))))}` : `<h3 class="ga-h">몇 단계까지 들어갔나</h3>
${table(withAi(["단계", "사람 수", "첫 화면 대비"], 1), data.steps.map((s) => tr(val([s.label, num(s.users), pct(s.rate)], 1, s.usersNoAi))))}
${table(withAi(["행동", "한 사람 수", "횟수"], 1), data.actions.map((a) => tr(val([a.label, num(a.users), num(a.count)], 1, a.usersNoAi))))}`}
<h3 class="ga-h">유입 경로</h3>
${table(["채널", "출처", "방문", "방문자", "1인 체류", "방문당 화면"], data.channels.map((c) => tr([c.channel, c.source, num(c.sessions), num(c.users), duration(c.engagementPerUser), num(c.viewsPerSession, 1)])))}
<h3 class="ga-h">많이 본 화면</h3>
${table(withAi([data.web === false ? "화면" : "화면 주소", "조회", "방문자", "1인 체류"], 2), data.pages.map((p) => tr(val([p.path, num(p.views), num(p.users), duration(p.engagementPerUser)], 2, p.usersNoAi))))}
<h3 class="ga-h">날짜별</h3>
${table(withAi(["날짜", "방문자", "방문", "1인 체류", "방문당 화면"], 1), data.daily.map((d) => tr(val([d.date, num(d.users), num(d.sessions), duration(d.engagementPerUser), num(d.viewsPerSession, 1)], 1, d.usersNoAi))))}${ai ? `
<p class="ga-foot">'AI 제외'는 GA 기본 채널 그룹이 '${esc(AI_CHANNEL)}'(ChatGPT·Gemini 등에서 링크로 들어옴)인 방문을 뺀 사람 수입니다. 한 사람이 여러 경로로 들어왔으면 AI 아닌 방문이 있는 한 남습니다.</p>` : ""}`;
}

// batchRunReports는 한 번에 요청 5개까지라 전체·AI 제외를 두 번에 나눠 동시에 부른다.
async function batch(token, propertyId, requests, fetcher) {
  const res = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:batchRunReports`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(res.status === 403 ? "이 Google 계정에 GA 속성 보기 권한이 없거나 Analytics Data API가 꺼져 있어요." : body?.error?.message || `GA 조회 실패 (${res.status})`);
  return body?.reports || [];
}

export async function fetchReport(token, propertyId, days = 28, fetcher = fetch, { web = true } = {}) {
  const [all, noAi] = await Promise.all([
    batch(token, propertyId, buildRequests(days, { web }), fetcher),
    // AI 제외 조회만 실패하면 기존 표는 그대로 보여 준다.
    batch(token, propertyId, buildRequests(days, { web, excludeAi: true }), fetcher).catch(() => null),
  ]);
  return summarize(all, { web, noAiReports: noAi });
}
