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
export function createUsageLoader({ owner, fetcher = fetch, publish }) {
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
        const response = await fetcher(CUTLINE_ENDPOINT, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error(response.status === 403 ? 'Cutline 읽기 권한이 없습니다.' : response.status === 401 ? '로그인 세션을 갱신해 주세요.' : `Cutline 조회 실패 (${response.status})`);
        const data = await response.json();
        if (current()) publish({ data });
      } catch (error) { if (current() && error.name !== 'AbortError') publish({ error: error.message }); }
    },
  };
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
  return `<div class="note">${esc(data.projectId || 'cutline-antstudio')} · 집계 ${esc(data.month || '')} · 측정 ${esc(date(data.measuredAt || data.generatedAt))}<br>스토리지 ${esc(s.status || '미수집')} · 대역폭 ${esc(b.status || '미수집')} · 비용 ${esc(c.status || '미수집')}</div>
    <div class="kpis">${card(formatBytes(s.bytes), '현재 저장 용량')}${card(known(s.objects) ? s.objects.toLocaleString('ko-KR') : '미수집', '현재 객체 수')}${card(formatBytes(b.observedBytes), '이번 달 관측 전송량')}${card(formatBytes(b.forecastBytes), '월말 예상 전송량')}${card(money(c.observedEstimate), '이번 달 사용 비용 추정 (USD)')}${card(money(c.forecastEstimate), '월말 비용 추정 (USD)')}</div>
    <div class="note">${esc(b.coverage || '전송량 수집 범위를 확인하지 못했습니다.')}<br>${esc(c.disclaimer || '사용량에 단가를 적용한 추정치이며 최종 청구액이 아닙니다. 미수집 항목은 0으로 계산하지 않습니다.')}<br>${esc(s.truncated ? '저장소 조회가 일부만 완료되어 용량은 불완전합니다.' : '')}</div>
    <section class="card"><div class="card-h"><h2>저장소 구성</h2><span class="muted">현재 객체 크기 · 월평균 용량과 다를 수 있음</span></div><div class="tablewrap"><table><thead><tr><th>종류</th><th>저장 용량</th><th>객체 수</th></tr></thead><tbody>${rows || '<tr><td colspan="3">저장소 구성 미수집</td></tr>'}</tbody></table></div></section>
    <section class="card cutline-section"><div class="card-h"><h2>서비스별 비용 추정</h2><span class="muted">${esc(data.period?.elapsedDays ?? '미확인')} / ${esc(data.period?.totalDays ?? '미확인')}일 경과</span></div><div class="tablewrap"><table><thead><tr><th>서비스</th><th>이번 달</th><th>월말 예상</th><th>계산 기준</th></tr></thead><tbody>${costRows || '<tr><td colspan="4">비용 상세 수집 대기</td></tr>'}</tbody></table></div></section>
    <section class="card cutline-section"><div class="card-h"><h2>Firebase 표준 요금 기준</h2><span class="muted">확인 ${esc(date(p.verifiedAt))}</span></div><div class="note">${sources || '공식 요금 기준 수집 대기'}<br>리전·서비스·무료 할당량·저장 기간에 따라 비용이 달라집니다.</div><div class="tablewrap"><table><thead><tr><th>항목</th><th>단가</th><th>리전</th><th>무료 할당</th></tr></thead><tbody>${rates || '<tr><td colspan="4">단가 확인 대기</td></tr>'}</tbody></table></div></section>
    <section class="card cutline-section"><div class="card-h"><h2>Firebase 최신 업데이트</h2><span class="muted">${esc(r.status || '미수집')} · 확인 ${esc(date(r.checkedAt))}</span></div><div class="note">${(r.items || []).map(item => `<p>${link(item.url, item.title)}<br><small>${esc(date(item.publishedAt))}</small></p>`).join('') || '업데이트 피드를 아직 가져오지 못했습니다.'}</div></section>
    ${(data.errors || []).length ? `<div class="note">일부 수집 실패: ${esc(data.errors.map(e => typeof e === 'string' ? e : e.message || e.code).join(' · '))}</div>` : ''}`;
}
