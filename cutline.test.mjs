import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUsageLoader, renderUsage, formatBytes } from './cutline.js';
import { ADMIN_EMAILS } from './config.js';
import { readdir, readFile } from 'node:fs/promises';

test('UI and every dashboard rule contain exactly the requested five admins', async () => {
  const expected = ['hc.lee@theant.kr','hyunjin.kim@theant.kr','juyi.kim@theant.kr','hyerin.kim@theant.kr','seonghyun.park@theant.kr'].sort();
  assert.deepEqual([...ADMIN_EMAILS].sort(), expected);
  for (const name of await readdir(new URL('./rules/', import.meta.url))) {
    if (!name.endsWith('.rules')) continue;
    const text = await readFile(new URL(`./rules/${name}`, import.meta.url), 'utf8');
    const emails = [...new Set(text.match(/[a-z.0-9]+@[a-z.]+/g) || [])].sort();
    assert.deepEqual(emails, expected, name);
    assert.ok(!text.includes('OWNER_EMAIL'), name);
  }
});

test('missing measurements stay unknown while measured zero is zero', () => {
  assert.equal(formatBytes(null), '미수집');
  assert.equal(formatBytes(0), '0 B');
  const html = renderUsage({ storage: { bytes: 0, objects: 0 }, bandwidth: { observedBytes: null }, cost: {} });
  assert.match(html, /0 B/);
  assert.match(html, /미수집/);
  assert.doesNotMatch(html, /\$0\.00/);
});
test('late response after leaving view cannot publish and sends only bearer header', async () => {
  let resolve, calls = [], published = [];
  const owner = { getIdToken: async () => 'primary-token' };
  const loader = createUsageLoader({ owner: () => owner, fetcher: async (_, options) => { calls.push(options); return new Promise(r => { resolve = r; }); }, publish: x => published.push(x) });
  const request = loader.load();
  await new Promise(r => setImmediate(r));
  loader.cancel(); resolve({ ok: true, json: async () => ({ projectId: 'cutline' }) });
  await request;
  assert.equal(published.length, 0);
  assert.equal(calls[0].headers.Authorization, 'Bearer primary-token');
  assert.equal(calls[0].cache, 'no-store');
});
test('release content is escaped and unsafe links are omitted', () => {
  const html = renderUsage({ releases: { items: [{ title: '<img onerror=alert(1)>', url: 'javascript:alert(1)' }] } });
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href="javascript:'));
});
test('logout while obtaining token prevents request', async () => {
  let finish, user = { getIdToken: () => new Promise(r => { finish = r; }) }, calls = 0;
  const loader = createUsageLoader({ owner: () => user, fetcher: async () => { calls++; }, publish: () => assert.fail('must not publish') });
  const pending = loader.load(); user = null; finish('old-token'); await pending;
  assert.equal(calls, 0);
});
test('forbidden response has actionable error and never exposes response body', async () => {
  let result;
  const loader = createUsageLoader({ owner: () => user, fetcher: async () => ({ ok: false, status: 403 }), publish: value => { result = value; } });
  const user = { getIdToken: async () => 'token' };
  await loader.load(); assert.match(result.error, /권한/);
});
test('diagnostic traffic, full cost exclusions, rounded days and components are visible', () => {
  const html = renderUsage({ period: { elapsedDays: 28.259359467, totalDays:31 }, bandwidth:{ components:[{label:'Cloud Run',bytes:1024,status:'ok'}],coverage:'source coverage' }, cost:{disclaimer:'source disclaimer'} });
  assert.match(html, /28\.3 \/ 31일/);
  assert.doesNotMatch(html, /28\.259/);
  for (const text of ['진단용','내부·중복 트래픽','청구 대역폭이 아닙니다','컴퓨팅','Firestore','작업 요금','세금','Cloud Run','1 KiB','source coverage','source disclaimer']) assert.ok(html.includes(text), text);
});

test('MURDERCHAT 쿠폰 발급·사용 내역을 표로 보여 주고 값은 이스케이프한다', async () => {
  const { renderMurderchatUsage } = await import('./cutline.js');
  const without = renderMurderchatUsage({ rows: [] });
  assert.match(without, /쿠폰 기능을 배포한 뒤에 표시됩니다/);
  const html = renderMurderchatUsage({ rows: [], coupons: {
    limit: 200, totals: { issued: 2, active: 1, redeemed: 3, coinsGiven: 60, passesGiven: 2 },
    coupons: [
      { code: 'OPEN2026', coins: 30, passes: 2, mode: 'each', maxUses: null, used: 2, expiresAt: null, note: '<b>오픈</b>', createdAt: '2026-11-17T00:00:00Z', createdBy: 'admin@example.com', disabled: false },
      { code: 'ONE1', coins: 0, passes: 1, mode: 'single', maxUses: 1, used: 1, expiresAt: null, note: '', createdAt: '2026-11-17T00:00:00Z', createdBy: 'admin@example.com', disabled: false },
    ],
    uses: [{ code: 'OPEN2026', coins: 30, passes: 2, account: '3fa9c1d2', at: '2026-11-17T01:00:00Z' }],
  } });
  assert.match(html, /쿠폰 발급 내역/); assert.match(html, /쿠폰 사용 내역/);
  assert.match(html, /코인 30 \+ AI 이용권 2/); assert.match(html, /2 \/ 제한 없음/);
  assert.match(html, /한 사람만/); assert.match(html, /모두 사용됨/); assert.match(html, /3fa9c1d2/);
  assert.ok(html.includes('&lt;b&gt;오픈&lt;/b&gt;') && !html.includes('<b>오픈</b>'));
  const empty = renderMurderchatUsage({ rows: [], coupons: { limit: 200, totals: {}, coupons: [], uses: [] } });
  assert.match(empty, /아직 발급한 쿠폰이 없습니다/); assert.match(empty, /아직 사용된 쿠폰이 없습니다/);
});

test('MURDERCHAT 방 플레이 기록과 계정별 내역을 표와 팝업으로 보여 준다', async () => {
  const { renderMurderchatUsage } = await import('./cutline.js');
  const without = renderMurderchatUsage({ rows: [] });
  assert.match(without, /방 플레이 기록을 불러오지 못했습니다/); assert.match(without, /계정별 내역을 불러오지 못했습니다/);
  const html = renderMurderchatUsage({ rows: [],
    plays: { limit: 200, rows: [
      { startedAt: '2026-11-17T01:00:00Z', roomCode: 'ABC234', storyTitle: '<i>작품</i>', host: { account: '3fa9c1d2', label: 'ho***@example.com', provider: 'Google' },
        players: [{ name: '하나', account: '3fa9c1d2', label: 'ho***@example.com' }, { name: '<b>둘</b>', account: null, label: '로그인 안 함' }],
        humans: 2, bots: 2, coinsUsed: 14, passesUsed: 1, vouchersUsed: 0, ai: { attempts: 12, inputTokens: 1000, outputTokens: 200, costUsd: 0.0123, costComplete: true } },
      { startedAt: null, roomCode: 'OLD234', storyTitle: '옛 작품', host: null, players: null, humans: null, bots: null, coinsUsed: null, passesUsed: null, vouchersUsed: null, ai: { attempts: 3, inputTokens: 10, outputTokens: 5, costUsd: 0, costComplete: false } },
    ] },
    accounts: { ledgerLimit: 5000, truncated: false, rows: [
      { account: '3fa9c1d2', label: 'ho***@example.com', provider: 'Google', coins: 21, coinsBought: 55, purchases: 1, couponCoins: 10, couponPasses: 2, coinsSpent: 44, coinsOnStories: 12, coinsOnPasses: 25, coinsOnRooms: 7,
        passesBought: 5, passesUsed: 3, passesHeld: 4, vouchersUsed: 1, rooms: 2, lastAt: '2026-11-17T02:00:00Z',
        stories: [{ id: 's', title: '<u>산 작품</u>', priceCoins: 12, purchasedAt: '2026-11-17T00:02:00Z', vouchersLeft: 6 }] },
    ] } });
  assert.match(html, /방 플레이 기록/); assert.match(html, /ABC234/); assert.match(html, /사람 2 · AI 2/); assert.match(html, /코인 14 · 이용권 1 · 참여권 0/);
  assert.match(html, /1,000 \/ 200/); assert.match(html, /\$0\.0123/); assert.match(html, /\$0\.0000 이상/); assert.match(html, /OLD234/);
  assert.ok(html.includes('&lt;i&gt;작품&lt;/i&gt;') && !html.includes('<i>작품</i>') && !html.includes('<b>둘</b>') && !html.includes('<u>산 작품</u>'));
  assert.match(html, /data-open-dialog="mc-account-0"/); assert.match(html, /<dialog class="mc-dialog" id="mc-account-0"/);
  assert.match(html, /1편 보기/); assert.match(html, /12코인/); assert.match(html, /돈으로 산 코인/); assert.match(html, /5 \+ 쿠폰 2/);
  const empty = renderMurderchatUsage({ rows: [], plays: { limit: 200, rows: [] }, accounts: { ledgerLimit: 5000, rows: [] } });
  assert.match(empty, /아직 기록된 방이 없습니다/); assert.match(empty, /아직 코인이나 쿠폰을 쓴 계정이 없습니다/);
});
