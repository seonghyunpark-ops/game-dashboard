import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCreatorReport, createCreatorLoader } from './murderchat-creators.js';

const sales = (paid = 0, bonus = 0, count = 0) => ({ count, coins: paid + bonus, bonusCoins: bonus, paidCoins: paid });
const est = paid => ({ shareCoins: Math.floor(paid * 0.8), grossKrw: paid * 100, shareKrw: Math.floor(paid * 80), overMinimum: paid * 80 >= 10000 });
const sample = {
  generatedAt: '2026-11-23T03:00:00Z', thisMonth: '2026-11', lastMonth: '2026-10', settlement: { sharePercent: 80, minimumKrw: 10000, coinKrwReference: 100 },
  summary: { creators: 2, adminAccounts: 1, works: { draft: 0, pending: 1, approved: 1, rejected: 1, live: 1 }, openReports: 1, thisMonth: sales(15, 5, 1) },
  creators: [
    { account: 'ab12cd34', label: 'wr***@example.com', provider: 'Google', admin: false, profileName: '<b>안개</b>', agreedAt: '2026-11-20T00:00:00Z', policyVersion: '2026-11-23', names: ['<b>안개</b>'],
      works: { total: 2, draft: 0, pending: 1, approved: 1, rejected: 0, live: 1 }, sales: sales(35, 5, 2), thisMonth: sales(15, 5, 1), lastMonth: sales(200, 0, 10),
      settlement: { thisMonth: est(15), lastMonth: est(200), total: est(235) }, months: [{ month: '2026-11', ...sales(15, 5, 1), ...est(15) }], openReports: 1 },
    { account: 'ff00ee11', label: 'se***@theant.kr', provider: 'Google', admin: true, profileName: '운영필명', names: ['운영필명', '두번째필명'], works: { total: 1, draft: 0, pending: 0, approved: 0, rejected: 1, live: 0 },
      sales: sales(), thisMonth: sales(), lastMonth: sales(), settlement: { thisMonth: est(0), lastMonth: est(0), total: est(0) }, months: [], openReports: 0 },
  ],
  works: [{ id: 'u-a', title: '안개 저택', genre: '추리', players: 4, priceCoins: 20, creatorName: '안개', owner: { account: 'ab12cd34', label: 'wr***@example.com' }, status: 'approved', live: true,
    review: { decision: 'approve', at: '2026-11-21T00:00:00Z' }, sales: { ...sales(35, 5, 2), thisMonth: sales(15, 5, 1) }, openReports: 1, updatedAt: '2026-11-22T00:00:00Z' }],
  official: [{ name: '운영필명', stories: [{ id: 'o1', title: '운영 작품' }], sales: sales(30, 0, 1), thisMonth: sales(30, 0, 1) }],
  reports: [{ id: 'r1', storyTitle: '안개 저택', reason: 'spoiler', text: '결말 노출', at: '2026-11-22T02:00:00Z', status: 'open' }],
};

test('서버 배포 전에는 안내만 보여 준다', () => {
  assert.match(renderCreatorReport({ rows: [] }), /아직 MURDERCHAT 서버에 배포되지 않았습니다/);
  assert.match(renderCreatorReport(null), /배포되지 않았습니다/);
});

test('크리에이터·작품·필명·신고 표와 정산 어림값을 그린다', () => {
  const html = renderCreatorReport(sample);
  assert.ok(!html.includes('<b>안개</b>'), '이름은 이스케이프한다');
  assert.match(html, /&lt;b&gt;안개&lt;\/b&gt;/);
  assert.match(html, /16,000원/);            // 지난달 200코인 × 80원
  assert.match(html, /1,200원 <small class="muted">만 원 미만/); // 이번 달 15코인
  assert.match(html, /작품에 쓴 이름: 두번째필명/);
  assert.match(html, /관리자/);
  assert.match(html, /심사 대기 작품/);
  assert.match(html, /스포일러/);
  assert.match(html, /data-open-dialog="mc-creator-0"/);
});

test('로더는 view=creators로 부르고 403을 안내한다', async () => {
  const user = { getIdToken: async () => 'tok' }; const seen = []; const out = [];
  const loader = createCreatorLoader({ owner: () => user, endpoint: 'https://example.test/dash', publish: v => out.push(v),
    fetcher: async (url, init) => { seen.push([url, init.headers.Authorization]); return { ok: false, status: 403 }; } });
  await loader.load();
  assert.deepEqual(seen, [['https://example.test/dash?view=creators', 'Bearer tok']]);
  assert.equal(out.at(-1).error, '관리 계정만 조회할 수 있습니다.');
});

test('로그아웃하면 늦게 온 응답을 버린다', async () => {
  let user = { getIdToken: async () => 'tok' }; const out = [];
  const loader = createCreatorLoader({ owner: () => user, endpoint: 'https://example.test/dash', publish: v => out.push(v),
    fetcher: async () => { user = null; return { ok: true, status: 200, json: async () => sample }; } });
  await loader.load();
  assert.ok(!out.some(v => v.data));
});
