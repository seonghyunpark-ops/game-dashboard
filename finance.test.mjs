import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFinance } from './finance-core.js';
test('계정 Bunny 금액만 합산하고 앱별 추정·잔액은 중복 합산하지 않는다', () => {
  const result = summarizeFinance({ bunny: { amount: 1, balance: 20, apps: [{ estimatedUsd: 3 }] }, firebase: { status: 'ready', rows: [{ project: 'a', currency: 'USD', cost: 2, credits: -1, net: 1 }] } }, [{ date: '2026-10-01', earnings: 5 }, { date: '2026-09-30', earnings: 90 }], '2026-10', 'KRW');
  assert.deepEqual(result.totals.USD, { income: 0, expense: 2, net: -2 });
  assert.equal(result.totals.KRW.income, 5);
  assert.deepEqual(result.missing, []);
});
test('미연결과 실제 0을 구분한다', () => {
  assert.equal(summarizeFinance(null, null, '2026-10', 'KRW').missing.length, 3);
  assert.equal(summarizeFinance({ bunny: { amount: 0 }, firebase: { status: 'ready', rows: [] } }, [], '2026-10', 'KRW').missing.length, 0);
});
