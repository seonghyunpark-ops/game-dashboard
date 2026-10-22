// Only copy explicitly selected identity fields; never copy private profile payloads.
export function mergeIdentity(row, identity = {}) {
  const out = { ...row };
  for (const [key, value] of Object.entries(identity)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

export function identityUid(row) {
  return row.firebaseUid || row.authUid || row.uid || row._id;
}

export function joinIdentities(rows, profiles = [], auth) {
  const merged = rows.map(row => profiles.reduce((out, profile) =>
    mergeIdentity(out, profile?.get(identityUid(row)) || profile?.get(row._id)), { ...row }));
  if (!auth) return merged;
  const seen = new Set();
  const result = merged.map(row => {
    const uid = identityUid(row);
    seen.add(uid);
    const info = auth.get(uid);
    return { ...mergeIdentity(row, info), email: row.email || info?.authEmail || '', name: row.name || info?.authDisplayName || '', hasSave: true };
  });
  for (const [uid, info] of auth) if (!seen.has(uid)) result.push({ _id: uid, ...info, email: info.authEmail || '', name: info.authDisplayName || '', hasSave: false });
  return result;
}
