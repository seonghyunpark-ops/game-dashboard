// Google 계정 OAuth(읽기 전용) — AdMob 보고서, Firebase Authentication 사용자 목록.
// 토큰은 메모리에만 두고 1시간 뒤 만료되면 다시 받는다.
let gisLoaded;
const tokens = {};

function loadGis() {
  gisLoaded ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Google 로그인 스크립트를 불러오지 못했어요"));
    document.head.append(s);
  });
  return gisLoaded;
}

export async function getToken(clientId, scope, { prompt = "" } = {}) {
  const t = tokens[scope];
  if (t && t.exp > Date.now() + 60_000) return t.value;
  if (!clientId) throw new Error("config.js 의 GOOGLE.clientId 가 비어 있어요");
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      prompt,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        tokens[scope] = { value: r.access_token, exp: Date.now() + r.expires_in * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.message || e.type)),
    });
    client.requestAccessToken();
  });
}

export function forgetToken(scope) { delete tokens[scope]; }

async function api(url, token, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message || body?.[0]?.error?.message || `HTTP ${res.status}`);
  return body;
}

export const SCOPE_ADMOB = "https://www.googleapis.com/auth/admob.readonly";
export const SCOPE_AUTH = "https://www.googleapis.com/auth/identitytoolkit";

const ymd = (d) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });

// 일자 × 앱 × 광고 형식 별 수익·노출·클릭·요청.
export async function admobReport(token, publisherId, from, to, currency) {
  let pub = publisherId;
  if (!pub) {
    const { account } = await api("https://admob.googleapis.com/v1/accounts", token);
    if (!account?.length) throw new Error("이 Google 계정에 AdMob 계정이 없어요");
    pub = account[0].publisherId;
  }
  const spec = {
    reportSpec: {
      dateRange: { startDate: ymd(from), endDate: ymd(to) },
      dimensions: ["DATE", "APP", "FORMAT"],
      metrics: ["ESTIMATED_EARNINGS", "IMPRESSIONS", "CLICKS", "AD_REQUESTS", "MATCHED_REQUESTS"],
      localizationSettings: { currencyCode: currency, languageCode: "ko-KR" },
    },
  };
  const out = await api(`https://admob.googleapis.com/v1/accounts/${pub}/networkReport:generate`, token, { method: "POST", body: JSON.stringify(spec) });
  return (out || []).filter((x) => x.row).map(({ row }) => {
    const d = row.dimensionValues, m = row.metricValues;
    const ds = d.DATE.value;
    return {
      date: `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`,
      app: d.APP?.displayLabel || d.APP?.value || "",
      format: d.FORMAT?.value || "",
      earnings: Number(m.ESTIMATED_EARNINGS?.microsValue || 0) / 1e6,
      impressions: Number(m.IMPRESSIONS?.integerValue || 0),
      clicks: Number(m.CLICKS?.integerValue || 0),
      requests: Number(m.AD_REQUESTS?.integerValue || 0),
      matched: Number(m.MATCHED_REQUESTS?.integerValue || 0),
    };
  });
}

// Firebase Authentication 전체 사용자(프로젝트 소유자 권한 필요).
export async function authUsers(token, projectId) {
  const users = [];
  let page = "";
  do {
    const q = new URLSearchParams({ maxResults: "1000", ...(page && { nextPageToken: page }) });
    const r = await api(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet?${q}`, token, { headers: { "x-goog-user-project": projectId } });
    users.push(...(r.users || []));
    page = r.nextPageToken || "";
  } while (page);
  return users;
}
