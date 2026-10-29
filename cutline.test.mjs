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
