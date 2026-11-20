// MURDERCHAT AI 사용량 합계: 예상 비용 요약, 작품별, 계정별.
// 서버 응답(chatmurderUsageDashboard)의 rows(일·모델별)와 plays.rows(방별, AI 사용량 포함)만으로 계산한다. 읽기 전용.
export const USD_KRW = 1400; // 원화 어림값에 쓰는 환율(1달러당 원). 정확한 청구액이 아니다.

const kstDay = (now, back = 0) => new Date(now + 9 * 3600000 - back * 86400000).toISOString().slice(0, 10);
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** 일별 모델 사용량(rows)에 단가(rates: 모델 → {input, output}, 100만 토큰당 USD)를 곱해 기간별 비용을 낸다. */
export function summarizeCost(rows = [], rates = new Map(), now = Date.now()) {
  const today = kstDay(now), week = kstDay(now, 6), month = kstDay(now, 29);
  const sum = { today: 0, week: 0, month: 0, requests: 0, unpriced: 0 };
  for (const row of rows) {
    const rate = rates.get(row.model);
    if (!rate) { sum.unpriced += finite(row.requests); continue; }
    const cost = (finite(row.inputTokens) * rate.input + finite(row.outputTokens) * rate.output) / 1e6;
    const day = String(row.day ?? '');
    if (day >= month) { sum.month += cost; sum.requests += finite(row.requests); }
    if (day >= week) sum.week += cost;
    if (day === today) sum.today += cost;
  }
  // 이번 달 예상: 최근 7일 하루 평균 × 30일.
  return { ...sum, dailyAverage: sum.week / 7, monthForecast: sum.week / 7 * 30 };
}

const blank = () => ({ rooms: 0, aiRooms: 0, attempts: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
function add(target, ai) {
  target.rooms += 1;
  if (!ai) return;
  if (ai.attempts > 0) target.aiRooms += 1;
  target.attempts += finite(ai.attempts);
  target.inputTokens += finite(ai.inputTokens);
  target.outputTokens += finite(ai.outputTokens);
  target.costUsd += finite(ai.costUsd);
}
const byCost = (a, b) => b.costUsd - a.costUsd || b.attempts - a.attempts || b.rooms - a.rooms;

/** 방 기록을 작품별로 더한다. */
export function aiByStory(plays = []) {
  const map = new Map();
  for (const play of plays) {
    const key = play.storyId ?? play.storyTitle ?? '';
    if (!map.has(key)) map.set(key, { title: play.storyTitle || play.storyId || '작품 기록 없음', ...blank() });
    add(map.get(key), play.ai);
  }
  return [...map.values()].sort(byCost);
}

/**
 * 방 기록을 계정별로 더한다. AI 비용은 방을 연 계정(방장, 이용권을 낸 사람)에 붙인다.
 * 참가한 방 수는 방장이든 참가자든 그 방에 있었던 횟수다.
 */
export function aiByAccount(plays = []) {
  const map = new Map();
  const entry = person => {
    const key = person?.account || '';
    if (!map.has(key)) map.set(key, { label: key ? person.label : '계정 기록 없음', account: key || null, provider: person?.provider ?? null, joined: 0, ...blank() });
    return map.get(key);
  };
  for (const play of plays) {
    add(entry(play.host), play.ai);
    const seen = new Set();
    for (const person of play.players ?? []) {
      if (!person?.account || seen.has(person.account)) continue;
      seen.add(person.account);
      entry(person).joined += 1;
    }
    if (!play.host) entry(null).joined += 1;
  }
  return [...map.values()].sort(byCost);
}
