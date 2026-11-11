// Google Analytics(GA4) 읽기 전용 탭 — 앱별 체류시간·유입 경로(blaiva 웹은 탐색 단계까지).
// 관리 계정의 Google OAuth 토큰(analytics.readonly, 메모리 보관)으로 GA Data API를 직접 부른다. 서버·비밀값 없음.
// 이벤트 이름(depth_2 등)은 blaiva 저장소 web/src/traffic-policy.mjs 와 같아야 한다.
export const SCOPE_GA = "https://www.googleapis.com/auth/analytics.readonly";
export const DEPTHS = [2, 3, 5, 10];
const ACTIONS = { play_request: "재생 시작", external_open: "원문으로 이동", favorite_add: "찜" };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function buildRequests(days = 28, { web = true } = {}) {
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

export function summarize(reports, { web = true } = {}) {
  const [totalsReport, daily, channels, events, pages] = reports.map(rowsOf);
  const totals = totalsReport[0] || {};
  const users = totals.activeUsers || 0;
  const byEvent = Object.fromEntries(events.map((r) => [r.eventName, r]));
  const base = byEvent.page_view?.totalUsers || users;
  const steps = [{ label: "1단계(첫 화면)", users: base }, ...DEPTHS.map((d) => ({ label: `${d}화면 이상`, users: byEvent[`depth_${d}`]?.totalUsers || 0 }))]
    .map((s) => ({ ...s, rate: base ? s.users / base : 0 }));
  const actions = Object.entries(ACTIONS).map(([name, label]) => ({ label, users: byEvent[name]?.totalUsers || 0, count: byEvent[name]?.eventCount || 0 }));
  const perUser = (r) => (r.activeUsers ? r.userEngagementDuration / r.activeUsers : 0);
  return {
    totals: { users, sessions: totals.sessions || 0, engagementPerUser: perUser(totals), sessionDuration: totals.averageSessionDuration || 0, viewsPerSession: totals.screenPageViewsPerSession || 0, engagementRate: totals.engagementRate || 0 },
    daily: daily.map((r) => ({ date: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`, users: r.activeUsers, sessions: r.sessions, engagementPerUser: perUser(r), viewsPerSession: r.screenPageViewsPerSession })),
    channels: channels.map((r) => ({ channel: r.sessionDefaultChannelGroup, source: r.sessionSource, sessions: r.sessions, users: r.activeUsers, engagementPerUser: perUser(r), viewsPerSession: r.screenPageViewsPerSession })),
    web, steps, actions,
    events: events.map((r) => ({ name: r.eventName, users: r.totalUsers, count: r.eventCount })),
    pages: pages.map((r) => ({ path: r.pagePath ?? r.unifiedScreenName, views: r.screenPageViews, users: r.activeUsers, engagementPerUser: perUser(r) })),
  };
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
  const card = (value, label) => `<div class="kpi"><b>${esc(value)}</b><small>${esc(label)}</small></div>`;
  return `
<div class="kpis">${card(num(t.users), `방문자(최근 ${days}일)`)}${card(num(t.sessions), "방문(세션)")}${card(duration(t.engagementPerUser), "1인 평균 체류(참여) 시간")}${card(duration(t.sessionDuration), "방문당 평균 머문 시간")}${card(num(t.viewsPerSession, 1), "방문당 본 화면 수")}${card(pct(t.engagementRate), "참여 방문 비율")}</div>
${data.web === false ? `<h3 class="ga-h">많이 일어난 이벤트</h3>
${table(["이벤트", "한 사람 수", "횟수"], data.events.map((e) => tr([e.name, num(e.users), num(e.count)])))}` : `<h3 class="ga-h">몇 단계까지 들어갔나</h3>
${table(["단계", "사람 수", "첫 화면 대비"], data.steps.map((s) => tr([s.label, num(s.users), pct(s.rate)])))}
${table(["행동", "한 사람 수", "횟수"], data.actions.map((a) => tr([a.label, num(a.users), num(a.count)])))}`}
<h3 class="ga-h">유입 경로</h3>
${table(["채널", "출처", "방문", "방문자", "1인 체류", "방문당 화면"], data.channels.map((c) => tr([c.channel, c.source, num(c.sessions), num(c.users), duration(c.engagementPerUser), num(c.viewsPerSession, 1)])))}
<h3 class="ga-h">많이 본 화면</h3>
${table([data.web === false ? "화면" : "화면 주소", "조회", "방문자", "1인 체류"], data.pages.map((p) => tr([p.path, num(p.views), num(p.users), duration(p.engagementPerUser)])))}
<h3 class="ga-h">날짜별</h3>
${table(["날짜", "방문자", "방문", "1인 체류", "방문당 화면"], data.daily.map((d) => tr([d.date, num(d.users), num(d.sessions), duration(d.engagementPerUser), num(d.viewsPerSession, 1)])))}`;
}

export async function fetchReport(token, propertyId, days = 28, fetcher = fetch, { web = true } = {}) {
  const res = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:batchRunReports`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests: buildRequests(days, { web }) }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(res.status === 403 ? "이 Google 계정에 GA 속성 보기 권한이 없거나 Analytics Data API가 꺼져 있어요." : body?.error?.message || `GA 조회 실패 (${res.status})`);
  return summarize(body?.reports || [], { web });
}
