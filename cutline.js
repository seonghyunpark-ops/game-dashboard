import {renderMurderchatTabs} from './murderchat-tabs.js';
export const CUTLINE_ENDPOINT = 'https://asia-northeast3-cutline-antstudio.cloudfunctions.net/cutlineUsageDashboard';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function formatBytes(value) {
  if (!known(value)) return '미수집';
  const index = value ? Math.min(4, Math.floor(Math.log(value) / Math.log(1024))) : 0;
  return `${(value / 1024 ** index).toLocaleString('ko-KR', { maximumFractionDigits: 3 })} ${['B','KiB','MiB','GiB','TiB'][index]}`;
}
const money = value => known(value) ? value.toLocaleString('ko-KR', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }) : '미수집';
const date = value => value && !isNaN(new Date(value)) ? new Date(value).toLocaleString('ko-KR') : '미확인';
const link = (url, title) => {
  try { const parsed = new URL(url); if (parsed.protocol === 'https:') return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`; } catch {}
  return esc(title);
};
export function createUsageLoader({ owner, fetcher = fetch, publish, endpoint = CUTLINE_ENDPOINT, label = 'Cutline' }) {
  let generation = 0, controller;
  return {
    cancel() { generation++; controller?.abort(); },
    async load() {
      const ticket = ++generation, user = owner();
      controller?.abort(); controller = new AbortController();
      const current = () => ticket === generation && owner() === user;
      if (!user) return;
      try {
        const token = await user.getIdToken();
        if (!current()) return;
        const response = await fetcher(endpoint, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error(response.status === 403 ? `${label} 읽기 권한이 없습니다.` : response.status === 401 ? '로그인 세션을 갱신해 주세요.' : `${label} 조회 실패 (${response.status})`);
        const data = await response.json();
        if (current()) publish({ data });
      } catch (error) { if (current() && error.name !== 'AbortError') publish({ error: error.message }); }
    },
  };
}
export const MURDERCHAT_ENDPOINT = 'https://asia-northeast3-gamecontry-play.cloudfunctions.net/chatmurderUsageDashboard';

const murderchatRates = new Map([
  ['gpt-6-luna', { input: 0.10, output: 0.50, url: 'https://developers.openai.com/api/docs/models/gpt-6-luna' }],
  ['gemini-3.1-flash-lite', { input: 0.25, output: 1.50, url: 'https://ai.google.dev/gemini-api/docs/pricing/#gemini-3.1-flash-lite' }],
  ['claude-haiku-5-5', { input: 0.10, output: 0.50, url: 'https://platform.claude.com/docs/en/models/haiku-5-5/overview' }],
]);

export function renderMurderchatUsage({ rows = [], coupons = null, plays = null, accounts = null } = {}) {
  const names = { openai: 'OpenAI', gemini: 'Gemini', claude: 'Claude' };
  const fields = ['requests', 'successes', 'failures', 'inputTokens', 'outputTokens'];
  const counts = row => fields.map(key => `<td>${Number(row[key] ?? 0).toLocaleString('ko-KR')}</td>`).join('');
  const totals = Object.entries(names).map(([provider, name]) => {
    const matching = rows.filter(row => row.provider === provider);
    const total = Object.fromEntries(fields.map(key => [key, matching.reduce((sum, row) => sum + (row[key] ?? 0), 0)]));
    return `<tr><td>${name}</td>${counts(total)}</tr>`;
  });
  const details = rows.map(row => {
    const rate = murderchatRates.get(row.model);
    const estimate = rate && (row.inputTokens * rate.input + row.outputTokens * rate.output) / 1e6;
    return `<tr><td>${esc(row.day)}</td><td>${esc(names[row.provider] ?? row.provider)}</td><td>${esc(row.model)}</td>${counts(row)}<td>${known(estimate) ? '$' + estimate.toFixed(6) : '미산정'}</td></tr>`;
  });
  const prices = Array.from(murderchatRates, ([model, rate]) =>
    `<tr><td>${link(rate.url, model)}</td><td>$${rate.input.toFixed(2)}</td><td>$${rate.output.toFixed(2)}</td></tr>`);
  const usageHeaders = ['요청', '성공', '실패', '입력 토큰', '출력 토큰'];
  const table = (title, headers, body, note = '') => `<section class="card cutline-section"><div class="card-h"><h2>${title}</h2></div>${note ? `<div class="note cutline-notice">${note}</div>` : ''}<div class="tablewrap"><table><thead><tr>${headers.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${body.join('')}</tbody></table></div></section>`;
  // 쿠폰 발급·사용 내역. 서버가 아직 쿠폰 내역을 보내지 않으면(이전 버전) 안내만 보여 준다.
  const num = value => Number(value ?? 0).toLocaleString('ko-KR');
  const gives = item => [item.coins ? `코인 ${num(item.coins)}` : '', item.passes ? `AI CHAT 토큰 ${num(item.passes)}` : ''].filter(Boolean).join(' + ') || '—';
  const couponState = coupon => coupon.disabled ? '중지됨' : coupon.expiresAt && Date.now() >= Date.parse(coupon.expiresAt) ? '기간 만료' : coupon.maxUses != null && coupon.used >= coupon.maxUses ? '모두 사용됨' : '사용 가능';
  const when = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone:'Asia/Seoul' }) : '—'; };
  const kpi = (value, label) => `<div class="kpi"><b>${esc(num(value))}</b><small>${esc(label)}</small></div>`;
  const t = coupons?.totals || {};
  const couponPart = !coupons
    ? table('쿠폰 발급·사용 내역', ['안내'], ['<tr><td>쿠폰 내역을 불러오지 못했습니다. MURDERCHAT 서버가 쿠폰 기능을 배포한 뒤에 표시됩니다.</td></tr>'])
    : `<section class="card cutline-section"><div class="card-h"><h2>쿠폰 요약</h2><span class="muted">최근 ${esc(num(coupons.limit))}건 기준</span></div><div class="kpis">${kpi(t.issued, '발급한 쿠폰')}${kpi(t.active, '지금 쓸 수 있는 쿠폰')}${kpi(t.redeemed, '사용된 횟수')}${kpi(t.coinsGiven, '나간 코인')}${kpi(t.passesGiven, '나간 AI CHAT 토큰')}</div></section>`
      + table('쿠폰 발급 내역', ['코드', '주는 것', '방식', '사용 / 수량', '상태', '기한', '메모', '만든 때', '만든 사람'],
        (coupons.coupons || []).length ? coupons.coupons.map(c => `<tr><td>${esc(c.code)}</td><td>${esc(gives(c))}</td><td>${c.mode === 'single' ? '한 사람만' : '계정마다 1회'}</td><td>${esc(num(c.used))} / ${c.maxUses == null ? '제한 없음' : esc(num(c.maxUses))}</td><td>${couponState(c)}</td><td>${c.expiresAt ? esc(when(c.expiresAt)) : '없음'}</td><td>${esc(c.note || '—')}</td><td>${esc(when(c.createdAt))}</td><td>${esc(c.createdBy || '—')}</td></tr>`) : ['<tr><td colspan="9">아직 발급한 쿠폰이 없습니다.</td></tr>'],
        '쿠폰은 MURDERCHAT 편집기의 「쿠폰」 버튼에서 발급합니다. 이 화면은 읽기 전용입니다.')
      + table('쿠폰 사용 내역', ['사용한 때', '코드', '받은 것', '계정 표시값'],
        (coupons.uses || []).length ? coupons.uses.map(u => `<tr><td>${esc(when(u.at))}</td><td>${esc(u.code)}</td><td>${esc(gives(u))}</td><td>${esc(u.account)}</td></tr>`) : ['<tr><td colspan="4">아직 사용된 쿠폰이 없습니다.</td></tr>'],
        '계정 표시값은 계정 식별값을 알아볼 수 없게 바꾼 앞 8글자입니다. 같은 계정은 같은 값으로 보입니다.');
  // 방 플레이 기록: 어떤 계정이 어떤 방에서 어떤 작품을 했고 AI(API)를 얼마나 썼는지.
  const usd = value => known(value) ? '$' + value.toFixed(4) : '미산정';
  const who = person => person ? `${esc(person.label)} <small class="muted">${esc(person.account ?? '')}</small>` : '기록 없음';
  const orDash = value => value == null ? '—' : esc(num(value));
  const playRows = (plays?.rows || []).map(p => `<tr><td>${p.startedAt ? esc(when(p.startedAt)) : '기록 없음'}</td><td>${esc(p.roomCode || '—')}</td><td>${esc(p.storyTitle || '—')}</td><td>${who(p.host)}</td><td>${p.players ? p.players.map(m => `${esc(m.name)} (${esc(m.label)})`).join('<br>') : '기록 없음'}</td><td>${p.humans == null ? '—' : `사람 ${esc(num(p.humans))} · AI ${esc(num(p.bots))}`}</td><td>${p.coinsUsed == null ? '—' : `코인 ${esc(num(p.coinsUsed))} · AI CHAT 토큰 ${esc(num(p.passesUsed))} · 참여권 ${esc(num(p.vouchersUsed))}`}</td><td>${p.ai ? esc(num(p.ai.attempts)) : '0'}</td><td>${p.ai ? `${esc(num(p.ai.inputTokens))} / ${esc(num(p.ai.outputTokens))}` : '0 / 0'}</td><td>${p.ai ? usd(p.ai.costUsd) + (p.ai.costComplete ? '' : ' 이상') : '$0.0000'}</td></tr>`);
  const playPart = !plays
    ? table('방 플레이 기록', ['안내'], ['<tr><td>방 플레이 기록을 불러오지 못했습니다. MURDERCHAT 서버가 이 기능을 배포한 뒤에 표시됩니다.</td></tr>'])
    : table('방 플레이 기록', ['시작한 때', '방 코드', '작품', '방장 계정', '참가자', '자리', '시작할 때 쓴 것', 'AI 요청', '입력 / 출력 토큰', 'AI 비용'],
      playRows.length ? playRows : ['<tr><td colspan="10">아직 기록된 방이 없습니다.</td></tr>'],
      `최근 ${esc(num(plays.limit))}개 방입니다. 계정은 가운데를 가린 이메일과 8글자 표시값으로 보입니다. 이 기능을 배포하기 전에 한 방은 계정 기록이 없어 AI 사용량만 나옵니다. AI 비용은 기록된 토큰으로 계산한 추정값이며, "이상"은 단가를 모르는 요청이 섞여 있다는 뜻입니다.`);
  // 계정별 내역: 코인 구매, 소장 작품(팝업), AI CHAT 토큰 구매와 사용.
  const storyDialog = (a, i) => `<dialog class="mc-dialog" id="mc-account-${i}" aria-labelledby="mc-account-title-${i}"><div class="card-h"><h2 id="mc-account-title-${i}">${esc(a.label)} <small class="muted">${esc(a.account)}</small></h2><form method="dialog"><button class="btn">닫기</button></form></div>
    <div class="kpis">${kpi(a.coins, '일반 코인')}${kpi(a.bonusCoins, '보너스 코인')}${kpi(a.attendanceCoins, '출석 지급 코인 · 조회 장부')}${kpi(a.attendance?.total, '누적 출석 일수')}${kpi(a.coinsBought, '돈으로 산 코인')}${kpi(a.couponCoins, '쿠폰으로 받은 코인')}${kpi(a.coinsSpent, '쓴 코인')}${kpi(a.passesHeld, '보유 AI CHAT 토큰')}${kpi(a.passesBought, '산 AI CHAT 토큰')}${kpi(a.couponPasses, '쿠폰으로 받은 토큰')}${kpi(a.passesUsed, '쓴 AI CHAT 토큰')}</div>
    <p class="note cutline-notice">쓴 코인 ${esc(num(a.coinsSpent))} = 작품 ${esc(num(a.coinsOnStories))} + AI CHAT 토큰 구매 ${esc(num(a.coinsOnPasses))} + 방 시작 ${esc(num(a.coinsOnRooms))} · 코인 결제 ${esc(num(a.purchases))}번 · 토큰을 낸 방 ${esc(num(a.rooms))}개 · 쓴 작품 참여권 ${esc(num(a.vouchersUsed))}장</p>
    <h3>소장한 작품 ${esc(num((a.stories || []).length))}편</h3>
    <div class="tablewrap"><table><thead><tr><th scope="col">작품</th><th scope="col">산 값</th><th scope="col">산 때</th><th scope="col">남은 참여권</th></tr></thead><tbody>${(a.stories || []).length ? a.stories.map(st => `<tr><td>${esc(st.title)}</td><td>${st.priceCoins == null ? '기록 없음' : esc(num(st.priceCoins)) + '코인'}</td><td>${st.purchasedAt ? esc(when(st.purchasedAt)) : '—'}</td><td>${esc(num(st.vouchersLeft))}장</td></tr>`).join('') : '<tr><td colspan="4">소장한 작품이 없습니다.</td></tr>'}</tbody></table></div></dialog>`;
  const accountRows = (accounts?.rows || []).map((a, i) => `<tr><td>${who(a)}</td><td>${esc(a.provider || '—')}</td><td>${esc(num(a.coins))}</td><td>${esc(num(a.coinsBought))}</td><td>${esc(num(a.couponCoins))}</td><td>${esc(num(a.coinsSpent))}</td><td><button type="button" class="btn" data-open-dialog="mc-account-${i}">${esc(num((a.stories || []).length))}편 보기</button>${storyDialog(a, i)}</td><td>${esc(num(a.passesBought))} + 쿠폰 ${esc(num(a.couponPasses))}</td><td>${esc(num(a.passesUsed))}</td><td>${esc(num(a.passesHeld))}</td><td>${a.lastAt ? esc(when(a.lastAt)) : '—'}</td></tr>`);
  const accountPart = !accounts
    ? table('계정별 코인·작품·AI CHAT 토큰', ['안내'], ['<tr><td>계정별 내역을 불러오지 못했습니다. MURDERCHAT 서버가 이 기능을 배포한 뒤에 표시됩니다.</td></tr>'])
    : table('계정별 코인·작품·AI CHAT 토큰', ['계정', '로그인', '보유 코인', '돈으로 산 코인', '쿠폰 코인', '쓴 코인', '소장 작품', '산 AI CHAT 토큰', '쓴 AI CHAT 토큰', '보유 AI CHAT 토큰', '마지막 활동'],
      accountRows.length ? accountRows : ['<tr><td colspan="11">아직 코인이나 쿠폰을 쓴 계정이 없습니다.</td></tr>'],
      `코인 장부의 최근 ${esc(num(accounts.ledgerLimit))}줄을 계정별로 더한 값입니다.${accounts.truncated ? ' 장부가 이보다 길어 오래된 내역은 빠져 있습니다.' : ''} 「소장 작품」의 버튼을 누르면 그 계정이 산 작품 목록과 자세한 내역이 팝업으로 뜹니다. 코인이나 쿠폰을 한 번도 쓰지 않은 계정은 나오지 않습니다.`);
  const attendanceRows=(accounts?.rows||[]).map(a=>'<tr><td>'+who(a)+'</td><td>'+esc(a.attendance?.lastDay||'—')+'</td><td>'+orDash(a.attendance?.streak)+'</td><td>'+orDash(a.attendance?.total)+'</td><td>'+orDash(a.attendanceCoins)+'</td><td>'+orDash(a.bonusCoins)+'</td></tr>');
  const bonusRows=(accounts?.rows||[]).flatMap(a=>(a.bonusHistory?.rows||[]).map(r=>'<tr><td>'+who(a)+'</td><td>'+esc(when(r.grantedAt))+'</td><td>'+(r.source==='attendance_ticket'?'7일차 뽑기':'출석')+'</td><td>'+orDash(r.amount)+'</td><td>'+orDash(r.used)+'</td><td>'+orDash(r.remaining)+'</td><td>'+esc(when(r.expiresAt))+'</td><td>'+orDash(r.expired)+'</td></tr>'));
  const attendancePart=table('출석 보상 현황',['계정','최근 출석일','연속 출석','누적 출석','지급 코인 · 조회 장부','잔여 보너스 코인'],attendanceRows.length?attendanceRows:['<tr><td colspan="6">조회된 출석 계정이 없습니다.</td></tr>'],'지급 합계는 조회된 장부 범위 기준이며, 누적 출석은 계정의 전체 출석 기록입니다.')
    +table('보너스 코인 발급·사용·소멸 내역',['계정','발급 시각','사유','발급','사용','잔여','소멸 시각','소멸 수량'],bonusRows.length?bonusRows:['<tr><td colspan="8">최근 30일 보너스 내역이 없거나 서버가 아직 내역을 제공하지 않습니다.</td></tr>'],'발급일부터 1개월(30일)간 보관·조회합니다. 한국 시간 기준입니다. 기능 적용 전에 이미 사용·소멸된 내역은 누락될 수 있습니다. 계정은 조회된 장부 범위 내에서 표시합니다.');
  const aiPart = table('공급자별 API 사용량', ['공급자', ...usageHeaders], totals)
    + table('일별 모델 사용량', ['날짜', '공급자', '모델', ...usageHeaders, '예상 비용'], details.length ? details : ['<tr><td colspan="9">아직 기록된 요청이 없습니다.</td></tr>'])
    + table('모델별 API 단가', ['모델', '입력', '출력'], prices,
      '2026년 11월 12일 기준 · 표준 유료 텍스트 토큰 100만 개당 USD. 예상 비용은 기록된 토큰에 이 단가를 적용한 값이며, 캐시 할인과 무료 사용량은 반영하지 않습니다.');
  return renderMurderchatTabs({accounts:accountPart,plays:playPart,rewards:attendancePart,coupons:couponPart,ai:aiPart});
}
export function renderUsage(data = {}) {
  const s = data.storage || {}, b = data.bandwidth || {}, c = data.cost || {}, p = data.prices || {}, r = data.releases || {};
  const card = (value, label) => `<div class="kpi"><b>${esc(value)}</b><small>${esc(label)}</small></div>`;
  const categoryNames = { manuscripts: '원고', previews: '미리보기', covers: '표지', other: '기타' };
  const rows = Object.entries(s.categories || {}).map(([key, value]) => `<tr><td>${esc(categoryNames[key] || key)}</td><td>${esc(formatBytes(value.bytes))}</td><td>${known(value.objects) ? value.objects.toLocaleString('ko-KR') : '미수집'}</td></tr>`).join('');
  const sources = (p.sources || []).map(source => typeof source === 'string' ? link(source, source) : link(source.url, source.title || source.label || source.url)).join(' · ');
  const rateNames = { storageUsdPerGibMonth: 'Cloud Storage 저장 용량', storageEgressUsdPerGib: 'Cloud Storage 외부 전송', hostingStorageUsdPerGibMonth: 'Hosting 저장 용량', hostingTransferUsdPerGib: 'Hosting 전송' };
  const rateRows = p.rateDetails || Object.entries(p.rates || {}).map(([key,value]) => ({ label: rateNames[key] || key, value, unit: /month/i.test(key) ? 'USD / GiB·월' : 'USD / GiB' }));
  const rates = rateRows.map(row => `<tr><td>${esc(row.label)}</td><td>${esc(known(row.value) ? row.value : '미확인')} ${esc(row.unit)}</td><td>${esc(row.region || p.region || '공식 기준 참조')}</td><td>${esc(row.freeTier || '공식 기준 참조')}</td></tr>`).join('');
  const costRows = (c.items || []).map(item => `<tr><td>${esc(item.label)}</td><td>${esc(money(item.observedEstimate))}</td><td>${esc(money(item.forecastEstimate))}</td><td>${esc(item.basis)}</td></tr>`).join('');
  const elapsedDays = known(data.period?.elapsedDays) ? data.period.elapsedDays.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) : '미확인';
  const componentRows = (b.components || []).map(item => `<tr><td>${esc(item.label || item.id)}</td><td>${esc(formatBytes(item.bytes))}</td><td>${esc(item.status || '미수집')}</td></tr>`).join('');
  return `<div class="note">${esc(data.projectId || 'cutline-antstudio')} · 집계 ${esc(data.month || '')} · 측정 ${esc(date(data.measuredAt || data.generatedAt))}<br>스토리지 ${esc(s.status || '미수집')} · 대역폭 ${esc(b.status || '미수집')} · 비용 ${esc(c.status || '미수집')}</div>
    <div class="kpis">${card(formatBytes(s.bytes), '현재 저장 용량')}${card(known(s.objects) ? s.objects.toLocaleString('ko-KR') : '미수집', '현재 객체 수')}${card(formatBytes(b.observedBytes), '이번 달 관측 전송량 · 진단용')}${card(formatBytes(b.forecastBytes), '월말 예상 전송량 · 진단용')}${card(money(c.observedEstimate), '이번 달 사용 비용 추정 (USD)')}${card(money(c.forecastEstimate), '월말 비용 추정 (USD)')}</div>
    <div class="note cutline-notice">관측 전송량에는 내부·중복 트래픽이 포함되며, 청구 대역폭이 아닙니다.<br>비용은 현재 저장 용량이 유지된다는 가정과 인터넷·Hosting 전송 기준을 적용한 참고 추정입니다. 무료 한도·컴퓨팅·Firestore·작업 요금·세금은 제외되며, 실제 청구액이 아닙니다. 미수집 항목은 0으로 계산하지 않습니다.<br>${esc(s.truncated ? '저장소 조회가 일부만 완료되어 용량은 불완전합니다.' : '')}</div>
    <details class="note cutline-notice"><summary>수집 범위·비용 계산 원문</summary><p>${esc(b.coverage || '전송량 수집 범위를 확인하지 못했습니다.')}</p><p>${esc(c.disclaimer || '비용 계산 원문 미수집')}</p></details>
    <section class="card cutline-section"><div class="card-h"><h2>서비스별 관측 전송량</h2><span class="muted">진단용 · 서비스 간 중복 포함 가능</span></div><div class="tablewrap"><table><thead><tr><th>서비스</th><th>관측 전송량</th><th>수집 상태</th></tr></thead><tbody>${componentRows || '<tr><td colspan="3">서비스별 전송량 미수집</td></tr>'}</tbody></table></div></section>
    <section class="card"><div class="card-h"><h2>저장소 구성</h2><span class="muted">현재 객체 크기 · 월평균 용량과 다를 수 있음</span></div><div class="tablewrap"><table><thead><tr><th>종류</th><th>저장 용량</th><th>객체 수</th></tr></thead><tbody>${rows || '<tr><td colspan="3">저장소 구성 미수집</td></tr>'}</tbody></table></div></section>
    <section class="card cutline-section"><div class="card-h"><h2>서비스별 비용 추정</h2><span class="muted">${esc(elapsedDays)} / ${esc(data.period?.totalDays ?? '미확인')}일 경과</span></div><div class="tablewrap"><table><thead><tr><th>서비스</th><th>이번 달</th><th>월말 예상</th><th>계산 기준</th></tr></thead><tbody>${costRows || '<tr><td colspan="4">비용 상세 수집 대기</td></tr>'}</tbody></table></div></section>
    <section class="card cutline-section"><div class="card-h"><h2>Firebase 표준 요금 기준</h2><span class="muted">확인 ${esc(date(p.verifiedAt))}</span></div><div class="note">${sources || '공식 요금 기준 수집 대기'}<br>리전·서비스·무료 할당량·저장 기간에 따라 비용이 달라집니다.</div><div class="tablewrap"><table><thead><tr><th>항목</th><th>단가</th><th>리전</th><th>무료 할당</th></tr></thead><tbody>${rates || '<tr><td colspan="4">단가 확인 대기</td></tr>'}</tbody></table></div></section>
    <section class="card cutline-section"><div class="card-h"><h2>Firebase 최신 업데이트</h2><span class="muted">${esc(r.status || '미수집')} · 확인 ${esc(date(r.checkedAt))}</span></div><div class="note">${(r.items || []).map(item => `<p>${link(item.url, item.title)}<br><small>${esc(date(item.publishedAt))}</small></p>`).join('') || '업데이트 피드를 아직 가져오지 못했습니다.'}</div></section>
    ${(data.errors || []).length ? `<div class="note">일부 수집 실패: ${esc(data.errors.map(e => typeof e === 'string' ? e : e.message || e.code).join(' · '))}</div>` : ''}`;
}
