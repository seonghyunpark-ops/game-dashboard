// MURDERCHAT 「크리에이터」 탭: 크리에이터 계정·이름, 작품 심사 상태, 판매와 정산 어림값, 신고.
// 관리자 전용 `chatmurderUsageDashboard?view=creators` 응답(서버 creator-report.mjs)을 그린다. 읽기 전용이다.
// 탭을 처음 열 때 한 번 불러오고, 「새로고침」으로 다시 부른다. 계정은 서버가 가린 이메일·8글자 표시값으로만 온다.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v ?? 0).toLocaleString('ko-KR');
const when = v => { const d = new Date(v); return v && Number.isFinite(d.getTime()) ? d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' }) : '—'; };
const won = v => num(v) + '원';
const STATUS = { draft: '작성 중', pending: '심사 대기', approved: '승인', rejected: '반려' };
const REASON = { sexual: '선정성', violence: '폭력', hate: '혐오', copyright: '저작권', spoiler: '스포일러', other: '기타' };
const kpi = (value, label) => `<div class="kpi"><b>${esc(value)}</b><small>${esc(label)}</small></div>`;
const table = (title, headers, rows, note = '', extra = '') => `<section class="card cutline-section"${extra}><div class="card-h"><h2>${title}</h2></div>${note ? `<div class="note cutline-notice">${note}</div>` : ''}<div class="tablewrap"><table><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;
const who = p => p ? `${esc(p.label)} <small class="muted">${esc(p.account ?? '')}</small>` : '계정 기록 없음';
const adminBadge = admin => admin ? ' <small class="badge">관리자</small>' : '';
const sale = s => `${num(s?.count)}건 · 유료 ${num(s?.paidCoins)}코인${s?.bonusCoins ? ` <small class="muted">(보너스 ${num(s.bonusCoins)})</small>` : ''}`;
const share = e => e ? `${won(e.shareKrw)}${e.overMinimum ? '' : ' <small class="muted">만 원 미만</small>'}` : '—';
/** 정산일: 그달 수입은 다음 달 10일에 정산한다(환불 기간 최대 7일). 'YYYY-MM' → 'YYYY-MM-10'. */
export const payDay = month => { const [y, m] = String(month ?? '').split('-').map(Number); if (!y || !m) return '—'; const d = new Date(Date.UTC(y, m, 10)); return d.toISOString().slice(0, 10); };
const searchText = parts => esc(parts.filter(Boolean).join(' ').toLowerCase());

export function renderCreatorReport(data) {
  if (!data || !Array.isArray(data.creators)) return '<div class="note cutline-notice">크리에이터 조회가 아직 MURDERCHAT 서버에 배포되지 않았습니다. 작품 만들기 기능과 함께 배포된 뒤에 표시됩니다.</div>';
  const s = data.summary ?? {}, w = s.works ?? {}, rule = data.settlement ?? { sharePercent: 80, minimumKrw: 10000, coinKrwReference: 100 };
  const top = `<section class="card cutline-section"><div class="card-h"><h2>크리에이터 요약</h2><span class="muted">${esc(when(data.generatedAt))} 기준 · 이번 달 ${esc(data.thisMonth ?? '')}</span></div><div class="kpis">${kpi(num(s.creators), `크리에이터 계정 (관리자 ${num(s.adminAccounts)})`)}${kpi(num(w.pending), '심사 대기 작품')}${kpi(num(w.live), '게재 중 작품')}${kpi(num(w.rejected), '반려 작품')}${kpi(num(w.draft), '작성 중 작품')}${kpi(num(s.openReports), '처리 안 된 신고')}${kpi(num(s.thisMonth?.paidCoins), '이번 달 유료 코인 판매')}</div>
    <div class="note cutline-notice">정산 어림값 = 유료 코인(보너스 코인 제외) × ${esc(rule.sharePercent)}% × 1코인 ${esc(num(rule.coinKrwReference))}원(정가 기준). 스토어 수수료와 코인 묶음 할인을 빼기 전 값이라 실제 지급액보다 큽니다. 정산은 전달 수입을 기준으로 매달 10일에 합니다(환불이 최대 7일이라서). 순매출의 ${esc(rule.sharePercent)}%가 ${esc(won(rule.minimumKrw))}을 넘을 때 지급합니다. 지난달분(${esc(data.lastMonth ?? "")})은 ${esc(payDay(data.lastMonth))}, 이번 달분(${esc(data.thisMonth ?? "")})은 ${esc(payDay(data.thisMonth))}에 정산합니다. 판매는 결제 장부의 작품 구매 기록에서 읽습니다${data.truncated ? ` (장부 ${esc(num(data.ledgerLimit))}줄을 넘어 오래된 판매는 빠져 있습니다)` : ''}.</div>
    <div style="padding:12px"><label>크리에이터·작품 검색 <input type="search" data-creator-query placeholder="크리에이터 이름 · 계정 · 작품 제목 · 상태" style="width:min(520px,100%);padding:8px"></label></div></section>`;

  const monthDialog = (c, i) => `<dialog class="mc-dialog" id="mc-creator-${i}" aria-labelledby="mc-creator-title-${i}"><div class="card-h"><h2 id="mc-creator-title-${i}">${esc(c.profileName || c.names?.[0] || '이름 없음')} <small class="muted">${esc(c.label)} · ${esc(c.account)}</small></h2><form method="dialog"><button class="btn">닫기</button></form></div>
    <p class="note cutline-notice">쓰는 크리에이터 이름: ${(c.names ?? []).map(esc).join(', ') || '없음'} · 정책 동의 ${esc(c.policyVersion ?? '안 함')}${c.agreedAt ? ` (${esc(when(c.agreedAt))})` : ''}${c.renamedAt ? ` · 이름 바꾼 때 ${esc(when(c.renamedAt))}` : ''}</p>
    <div class="tablewrap"><table><thead><tr>${['월', '판매', '유료 코인', '보너스 코인', `정산 어림(${rule.sharePercent}%)`, '정산일'].map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${(c.months ?? []).length ? c.months.map(m => `<tr><td>${esc(m.month)}</td><td>${num(m.count)}건</td><td>${num(m.paidCoins)}</td><td>${num(m.bonusCoins)}</td><td>${share(m)}</td><td>${esc(payDay(m.month))}</td></tr>`).join('') : '<tr><td colspan="6">판매 기록이 없습니다.</td></tr>'}</tbody></table></div></dialog>`;
  const creatorRows = data.creators.map((c, i) => `<tr data-search="${searchText([c.profileName, ...(c.names ?? []), c.label, c.account, c.provider, c.admin && '관리자'])}"><td>${esc(c.profileName || '프로필 없음')}${adminBadge(c.admin)}${(c.names ?? []).filter(n => n !== c.profileName).length ? `<br><small class="muted">작품에 쓴 이름: ${c.names.filter(n => n !== c.profileName).map(esc).join(', ')}</small>` : ''}</td><td>${who(c)}<br><small class="muted">${esc(c.provider ?? '')}</small></td><td>${c.agreedAt ? esc(when(c.agreedAt)) : '동의 안 함'}</td><td>${num(c.works?.total)}편<br><small class="muted">대기 ${num(c.works?.pending)} · 게재 ${num(c.works?.live)} · 반려 ${num(c.works?.rejected)} · 작성 ${num(c.works?.draft)}</small></td><td>${sale(c.sales)}</td><td>${sale(c.thisMonth)}<br>${share(c.settlement?.thisMonth)}</td><td>${sale(c.lastMonth)}<br>${share(c.settlement?.lastMonth)}</td><td>${num(c.openReports)}</td><td><button type="button" class="btn" data-open-dialog="mc-creator-${i}">월별 보기</button>${monthDialog(c, i)}</td></tr>`);
  const creatorsPart = table('크리에이터별 현황', ['크리에이터 이름', '계정', '정책 동의', '작품', '누적 판매', `이번 달분 · ${esc(payDay(data.thisMonth))} 정산 예정`, `지난달분 · ${esc(payDay(data.lastMonth))} 정산`, '열린 신고', '월별'],
    creatorRows.length ? creatorRows : ['<tr><td colspan="9">아직 크리에이터로 등록한 계정이 없습니다.</td></tr>'],
    '계정은 가운데를 가린 이메일과 8글자 표시값입니다. 관리자 계정은 작품마다 다른 크리에이터 이름을 쓸 수 있어, 같은 계정의 이름을 한 줄에 모아 보여 줍니다.', ' data-creator-table');

  const workRows = (data.works ?? []).map(x => `<tr data-search="${searchText([x.title, x.creatorName, x.owner?.label, x.owner?.account, STATUS[x.status], x.live && '게재 중', x.admin && '관리자', x.genre])}"><td>${esc(x.title)}<br><small class="muted">${esc(x.id)}${x.genre ? ' · ' + esc(x.genre) : ''}</small></td><td>${esc(x.creatorName || '—')}${x.official ? ' <small class="badge">운영 표시</small>' : ''}</td><td>${who(x.owner)}${adminBadge(x.admin)}</td><td>${esc(STATUS[x.status] ?? x.status)}${x.live ? '<br><small class="badge">게재 중</small>' : ''}</td><td>${x.priceCoins ? num(x.priceCoins) + '코인' : '무료'}</td><td>${x.players == null ? '—' : num(x.players) + '명'}</td><td>${x.submittedAt ? '요청 ' + esc(when(x.submittedAt)) : '—'}${x.review ? `<br>${x.review.decision === 'approve' ? '승인' : '반려'} ${esc(when(x.review.at))}${x.review.reason ? `<br><small class="muted">${esc(x.review.reason)}</small>` : ''}` : ''}</td><td>${sale(x.sales)}</td><td>${sale(x.sales?.thisMonth)}</td><td>${num(x.openReports)}</td><td>${esc(when(x.updatedAt))}</td></tr>`);
  const worksPart = table('작품별 심사·판매', ['작품', '크리에이터 이름', '계정', '상태', '가격', '인원', '심사', '누적 판매', '이번 달', '신고', '마지막 수정'],
    workRows.length ? workRows : ['<tr><td colspan="11">아직 만들어진 작품이 없습니다.</td></tr>'],
    '심사 승인·반려는 MURDERCHAT 편집기의 작품 만들기 화면에서 합니다. 「게재 중」은 지금 이용자에게 보이는 작품입니다.', ' data-creator-table');

  const officialRows = (data.official ?? []).map(o => `<tr data-search="${searchText([o.name, ...o.stories.map(st => st.title)])}"><td>${esc(o.name)}</td><td>${num(o.stories.length)}편<br><small class="muted">${o.stories.map(st => esc(st.title)).join(', ')}</small></td><td>${sale(o.sales)}</td><td>${sale(o.thisMonth)}</td></tr>`);
  const officialPart = table('운영 작품 필명별 판매', ['필명', '작품', '누적 판매', '이번 달'], officialRows.length ? officialRows : ['<tr><td colspan="4">운영 작품이 없습니다.</td></tr>'],
    '관리자가 편집기에서 바로 게시한 운영 작품입니다. 정산 대상이 아니며 참고용으로 보여 줍니다.', ' data-creator-table');

  const reportRows = (data.reports ?? []).map(r => `<tr data-search="${searchText([r.storyTitle, REASON[r.reason], r.text, r.status === 'open' ? '처리 전' : '처리함'])}"><td>${esc(when(r.at))}</td><td>${esc(r.storyTitle ?? '—')}</td><td>${esc(REASON[r.reason] ?? r.reason)}</td><td>${esc(r.text || '—')}</td><td>${r.status === 'open' ? '처리 전' : '처리함'}</td></tr>`);
  const reportPart = table('작품 신고', ['신고한 때', '작품', '사유', '내용', '상태'], reportRows.length ? reportRows : ['<tr><td colspan="5">신고가 없습니다.</td></tr>'], '최근 200건입니다. 신고한 사람은 표시하지 않습니다.', ' data-creator-table');
  return top + creatorsPart + worksPart + officialPart + reportPart;
}

/** 검색어로 표의 줄을 거른다. */
export function filterCreatorRows(root, query) {
  const q = query.trim().toLowerCase();
  for (const row of root.querySelectorAll('[data-creator-table] tbody tr[data-search]')) row.hidden = !!q && !row.dataset.search.includes(q);
}

export function createCreatorLoader({ owner, endpoint, publish, fetcher = fetch }) {
  let generation = 0, controller;
  return {
    cancel() { generation++; controller?.abort(); },
    async load() {
      const ticket = ++generation, user = owner(); controller?.abort(); controller = new AbortController();
      const current = () => ticket === generation && owner() === user;
      if (!user) return;
      publish({ loading: true });
      try {
        const token = await user.getIdToken(); if (!current()) return;
        const url = new URL(endpoint); url.searchParams.set('view', 'creators');
        const response = await fetcher(url.href, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error(response.status === 403 ? '관리 계정만 조회할 수 있습니다.' : `크리에이터 조회 실패 (${response.status})`);
        const data = await response.json(); if (!current()) return;
        publish({ data });
      } catch (e) { if (current() && e.name !== 'AbortError') publish({ error: e.message }); }
    },
  };
}

/** 「크리에이터」 탭 패널. show()는 처음 한 번만 불러온다. */
export function mountCreatorPanel(host, { owner, endpoint, fetcher }) {
  host.innerHTML = '<div class="card-h"><span class="muted" role="status" data-creator-status>탭을 열면 불러옵니다.</span><button type="button" class="btn" data-creator-refresh>크리에이터 새로고침</button></div><div data-creator-body></div>';
  const status = host.querySelector('[data-creator-status]'), body = host.querySelector('[data-creator-body]'), button = host.querySelector('[data-creator-refresh]');
  let loaded = false;
  const loader = createCreatorLoader({ owner, endpoint, fetcher, publish: ({ data, error, loading }) => {
    if (!host.isConnected) return;
    button.disabled = !!loading;
    if (loading) { status.textContent = '크리에이터 정보를 불러오는 중…'; return; }
    if (error) { status.textContent = error; return; }
    body.innerHTML = renderCreatorReport(data);
    status.textContent = Array.isArray(data?.creators) ? `크리에이터 ${num(data.creators.length)}명 · 작품 ${num(data.works?.length)}편` : '서버 배포 전';
    const input = body.querySelector('[data-creator-query]');
    if (input) input.addEventListener('input', () => filterCreatorRows(body, input.value));
  } });
  button.onclick = () => { loaded = true; loader.load(); };
  return { show() { if (!loaded) { loaded = true; loader.load(); } }, dispose() { loader.cancel(); host.replaceChildren(); } };
}
