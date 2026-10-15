// Google credentials stay in memory. Each Firebase project keeps its own SDK session.
export function createSession({ sources, allowedEmails, sdk, onChange = () => {} }) {
  const clients = new Map();
  const pending = new Map();
  let credential = null;
  let generation = 0;
  let changing = false;
  const allowed = (user) => !!user?.emailVerified && allowedEmails.includes(user.email?.toLowerCase());
  function client(key) {
    const source = sources[key];
    const id = source.firebase.projectId;
    if (!clients.has(id)) clients.set(id, sdk.create(source.firebase, id));
    return clients.get(id);
  }
  const primary = client(Object.keys(sources)[0]);
  const user = () => allowed(primary.auth.currentUser) ? primary.auth.currentUser : null;
  async function logout() {
    generation++;
    credential = null;
    changing = true;
    // Finish in-flight sign-ins before clearing every project, including failed sessions.
    await Promise.allSettled([...pending.values()]);
    const results = await Promise.allSettled([...clients.values()].map((c) => sdk.signOut(c.auth)));
    changing = false;
    onChange(null);
    if (results.some((r) => r.status === 'rejected')) throw new Error('일부 세션 로그아웃에 실패했습니다. 다시 시도해 주세요.');
  }
  async function ensure(key) {
    const c = client(key);
    await c.auth.authStateReady();
    const owner = user();
    if (!owner || changing) throw new Error('허용된 관리 계정으로 로그인해 주세요.');
    if (allowed(c.auth.currentUser) && c.auth.currentUser.email.toLowerCase() === owner.email.toLowerCase()) return c;
    if (!credential) throw new Error('전체 앱 연결을 갱신하려면 상단에서 다시 로그인해 주세요.');
    const id = sources[key].firebase.projectId;
    if (!pending.has(id)) {
      const epoch = generation;
      const task = (async () => {
        const result = await sdk.signIn(c.auth, credential);
        if (epoch !== generation || !allowed(result.user) || result.user.email.toLowerCase() !== owner.email.toLowerCase()) {
          await sdk.signOut(c.auth);
          throw new Error('로그인 계정이 변경되었습니다. 다시 로그인해 주세요.');
        }
        return c;
      })();
      pending.set(id, task);
      task.finally(() => { if (pending.get(id) === task) pending.delete(id); }).catch(() => {});
    }
    return pending.get(id);
  }
  async function login() {
    changing = true;
    let result;
    try {
      result = await sdk.popup(primary.auth);
      if (!allowed(result.user)) {
        await logout();
        throw new Error('허용되지 않은 계정입니다. 지정된 관리 계정으로 로그인해 주세요.');
      }
      credential = sdk.credential(result);
      generation++;
      changing = false;
      const keys = [...new Map(Object.keys(sources).map((k) => [sources[k].firebase.projectId, k])).values()];
      const results = await Promise.allSettled(keys.map(ensure));
      onChange(user());
      return keys.flatMap((key, i) => results[i].status === 'rejected' ? [{ key, message: results[i].reason.message }] : []);
    } finally { changing = false; }
  }
  sdk.watch(primary.auth, () => { if (!changing) onChange(user()); });
  return { client, user, login, logout, ensure, allowed };
}
