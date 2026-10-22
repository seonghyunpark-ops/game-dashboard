import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinIdentities } from './identity.js';
import { SOURCES } from './config.js';

test('blaiva joins public nickname and registration identity without blank values hiding data', () => {
  const rows = [{ _id: 'u1', visitCount: 4, nickname: 'saved' }];
  const result = joinIdentities(rows, [
    new Map([['u1', { nickname: 'creator' }]]),
    new Map([['u1', { email: 'member@example.test', name: 'Member', nickname: '' }]]),
  ]);
  assert.deepEqual(result[0], { _id: 'u1', visitCount: 4, nickname: 'creator', email: 'member@example.test', name: 'Member' });
  assert.equal(rows[0].nickname, 'saved');
});

test('campusmaru joins explicit Firebase UID and avoids duplicate auth-only rows', () => {
  const result = joinIdentities([{ _id: 'report-1', firebaseUid: 'auth-1', name: 'Saved' }], [], new Map([
    ['auth-1', { authEmail: 'one@example.test', authDisplayName: 'Google Name' }],
    ['auth-2', { authEmail: 'two@example.test' }],
  ]));
  assert.equal(result.length, 2);
  assert.equal(result[0].email, 'one@example.test');
  assert.equal(result[0].name, 'Saved');
  assert.equal(result[1].email, 'two@example.test');
  assert.equal(result[1].hasSave, false);
});

test('logout or absent joins leaves no identity from a previous session', () => {
  assert.deepEqual(joinIdentities([{ _id: 'u1' }]), [{ _id: 'u1' }]);
});

test('member screens expose identities and enable Authentication lookup', () => {
  for (const key of ['blaiva', 'blaiva_members', 'lumiclass']) {
    assert.equal(SOURCES[key].authJoin, true);
    assert.ok(SOURCES[key].columns.some(c => c.key === 'email'));
    assert.ok(SOURCES[key].identityFields.includes('email'));
  }
  assert.ok(SOURCES.blaiva.profileJoins.some(join => join.collection === 'memberProfiles'));
});
