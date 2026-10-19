export function summarizeFinance(report, adRows, month, adCurrency) {
  const rows = [];
  if (report?.bunny && Number.isFinite(report.bunny.amount)) rows.push({ category: 'Bunny', app: '계정 전체', currency: 'USD', expense: report.bunny.amount, income: 0, basis: '계정 청구 API 월 집계 · 체험 중 0으로 표시될 수 있음', status: '조회됨' });
  if (report?.firebase?.status === 'ready') for (const row of report.firebase.rows || []) rows.push({ category: 'Firebase / GCP', app: row.project || '공통', currency: row.currency, expense: row.net, income: 0, basis: `사용료 ${row.cost} + 크레딧 ${row.credits}`, status: '결제 내보내기' });
  if (adRows) rows.push({ category: '광고 수익', app: 'AdMob 전체', currency: adCurrency, expense: 0, income: adRows.filter(r => r.date.slice(0, 7) === month).reduce((s, r) => s + r.earnings, 0), basis: 'AdMob 예상 수익 · 입금액 아님', status: '조회됨' });
  const totals = {};
  for (const r of rows) { const t = totals[r.currency] ??= { income: 0, expense: 0, net: 0 }; t.income += r.income; t.expense += r.expense; t.net = t.income - t.expense; }
  return { rows, totals, missing: [!report?.bunny && 'Bunny', report?.firebase?.status !== 'ready' && 'Firebase 결제 내보내기', !adRows && '광고 수익'].filter(Boolean) };
}
