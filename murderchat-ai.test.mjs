import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCost, aiByStory, aiByAccount } from './murderchat-ai.js';

test('기간별 예상 비용과 이번 달 예상', () => {
  const rates = new Map([['m', { input: 1, output: 2 }]]);
  const now = Date.parse('2026-11-20T01:00:00Z'); // 한국 시간 11-20
  const rows = [
    { day: '2026-11-20', model: 'm', requests: 1, inputTokens: 1e6, outputTokens: 0 },
    { day: '2026-11-14', model: 'm', requests: 1, inputTokens: 0, outputTokens: 1e6 },
    { day: '2026-11-01', model: 'm', requests: 1, inputTokens: 1e6, outputTokens: 0 },
    { day: '2026-10-01', model: 'm', requests: 1, inputTokens: 1e6, outputTokens: 0 },
    { day: '2026-11-20', model: '?', requests: 3, inputTokens: 5, outputTokens: 5 },
  ];
  const s = summarizeCost(rows, rates, now);
  assert.equal(s.today, 1); assert.equal(s.week, 3); assert.equal(s.month, 4);
  assert.equal(s.requests, 3); assert.equal(s.unpriced, 3);
  assert.equal(s.monthForecast, 3 / 7 * 30);
});

const plays = [
  { storyId: 'a', storyTitle: 'A', host: { account: 'h1', label: 'H1' }, players: [{ account: 'h1', label: 'H1' }, { account: 'p2', label: 'P2' }], ai: { attempts: 4, inputTokens: 10, outputTokens: 2, costUsd: 0.5 } },
  { storyId: 'a', storyTitle: 'A', host: { account: 'h1', label: 'H1' }, players: [{ account: 'h1', label: 'H1' }], ai: { attempts: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 } },
  { storyId: 'b', storyTitle: 'B', host: null, players: null, ai: { attempts: 2, inputTokens: 3, outputTokens: 1, costUsd: 0.1 } },
];

test('작품별 합계', () => {
  const [a, b] = aiByStory(plays);
  assert.deepEqual([a.title, a.rooms, a.aiRooms, a.attempts, a.costUsd], ['A', 2, 1, 4, 0.5]);
  assert.deepEqual([b.title, b.rooms, b.costUsd], ['B', 1, 0.1]);
});

test('계정별 합계는 비용을 방장에게 붙이고 참가 횟수를 따로 센다', () => {
  const rows = aiByAccount(plays);
  const h1 = rows.find(r => r.account === 'h1'), p2 = rows.find(r => r.account === 'p2'), none = rows.find(r => r.account === null);
  assert.deepEqual([h1.rooms, h1.joined, h1.costUsd], [2, 2, 0.5]);
  assert.deepEqual([p2.rooms, p2.joined, p2.costUsd], [0, 1, 0]);
  assert.deepEqual([none.rooms, none.joined, none.costUsd], [1, 1, 0.1]);
});
