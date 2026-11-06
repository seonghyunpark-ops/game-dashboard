const money = v => Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
export function summarizeFinance(report, adRows, month, adCurrency) {
  const rows = [];
  if (report?.bunny && Number.isFinite(report.bunny.amount)) rows.push({ category: 'Bunny', app: '계정 전체', currency: 'USD', expense: report.bunny.amount, income: 0, basis: '계정 청구 API 월 집계 · 체험 중 0으로 표시될 수 있음', status: '조회됨' });
  if (report?.firebase?.status === 'ready') for (const row of report.firebase.rows || []) rows.push({ category: 'Firebase / GCP', app: row.project || '공통', currency: row.currency, expense: row.net, income: 0, usage: row.cost, basis: `크레딧 전 사용료 ${money(row.cost)} · 크레딧 ${money(row.credits)} · 지출은 크레딧을 뺀 금액`, status: '결제 내보내기' });
  const ad = adRows ? {currency:adCurrency,amount:adRows.filter(r=>r.date.slice(0,7)===month).reduce((s,r)=>s+r.earnings,0)} : report?.admob;
  if (ad && Number.isFinite(ad.amount)) rows.push({ category: '광고 수익', app: 'AdMob 전체', currency: ad.currency, expense: 0, income: ad.amount, basis: 'AdMob 예상 수익 · 입금액 아님', status: '조회됨' });
  const totals = {};
  for (const r of rows) { const t = totals[r.currency] ??= { income: 0, expense: 0, net: 0 }; t.income += r.income; t.expense += r.expense; t.net = t.income - t.expense; }
  // 크레딧이 사용료를 전부 덮으면 지출이 0이라, 실제로 쓴 양은 따로 합칩니다. 지출 총합에는 더하지 않습니다.
  const usage = {};
  for (const r of rows) if (r.usage !== undefined) usage[r.currency] = (usage[r.currency] || 0) + r.usage;
  return { rows, totals, usage, missing: [!report?.bunny && 'Bunny', report?.firebase?.status !== 'ready' && 'Firebase 결제 내보내기', !(ad && Number.isFinite(ad.amount)) && '광고 수익'].filter(Boolean) };
}
