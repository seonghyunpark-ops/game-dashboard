import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from './session.js';
const admin = { email: 'lee.ike1@gmail.com', emailVerified: true };
function fixture({ person = admin, fail = false, delayed = null } = {}) {
  const calls = { popup: 0, created: [], signed: [], out: [] };
  const sources = { main: { firebase: { projectId: 'main' } }, lumi: { firebase: { projectId: 'lumi' } }, costs: { firebase: { projectId: 'lumi' } }, ai: { firebase: { projectId: 'ai' } } };
  const sdk = {
    create(config, id) { calls.created.push(id); return { auth: { id, currentUser: null, async authStateReady() {} } }; },
    async popup(auth) { calls.popup++; auth.currentUser = person; return { user: person }; },
    credential() { return { token: 'memory-only' }; },
    async signIn(auth) { calls.signed.push(auth.id); if (auth.id === 'ai' && fail) throw Error('provider disabled'); if (auth.id === 'ai' && delayed) await delayed; auth.currentUser = person; return { user: person }; },
    async signOut(auth) { calls.out.push(auth.id); auth.currentUser = null; },
    watch() {},
  };
  return { session: createSession({ sources, sdk, allowedEmails: [admin.email] }), calls };
}
test('one popup signs into every distinct project and shares LumiClass sessions', async () => {
  const { session, calls } = fixture();
  assert.deepEqual(await session.login(), []);
  assert.equal(calls.popup, 1);
  assert.deepEqual(calls.signed.sort(), ['ai', 'lumi']);
  assert.equal(session.client('lumi'), session.client('costs'));
  await session.ensure('ai'); await session.ensure('costs');
  assert.equal(calls.popup, 1);
  assert.equal(calls.signed.length, 2);
});
test('unknown and unverified accounts never get fan-out access', async () => {
  for (const person of [{ ...admin, email: 'other@example.com' }, { ...admin, emailVerified: false }]) {
    const { session, calls } = fixture({ person });
    await assert.rejects(session.login(), /허용되지 않은/);
    assert.equal(session.user(), null);
    assert.deepEqual(calls.signed, []);
    await assert.rejects(session.ensure('ai'), /허용된/);
  }
});
test('old session for another account is replaced and provider failure is isolated', async () => {
  const { session, calls } = fixture({ fail: true });
  session.client('lumi').auth.currentUser = { ...admin, email: 'other@example.com' };
  const failures = await session.login();
  assert.deepEqual(failures.map((f) => f.key), ['ai']);
  assert.equal((await session.ensure('lumi')).auth.currentUser.email, admin.email);
  await session.logout();
  for (const key of ['main', 'lumi', 'ai']) assert.equal(session.client(key).auth.currentUser, null);
  assert.equal(session.user(), null);
});
test('logout during fan-out cannot resurrect a project session', async () => {
  let release; const delayed = new Promise((r) => { release = r; });
  const { session, calls } = fixture({ delayed });
  const login = session.login();
  while (!calls.signed.includes('ai')) await new Promise((r) => setImmediate(r));
  const logout = session.logout(); release();
  await Promise.all([login, logout]);
  assert.equal(session.user(), null);
  assert.equal(session.client('ai').auth.currentUser, null);
});
