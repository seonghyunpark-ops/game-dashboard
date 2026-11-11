import test from "node:test";
import assert from "node:assert/strict";
import { buildRequests, summarize, renderReport, fetchReport, duration } from "./ga4.js";

const rep = (dims, mets, rows) => ({ dimensionHeaders: dims.map((name) => ({ name })), metricHeaders: mets.map((name) => ({ name })), rows: rows.map(([d, m]) => ({ dimensionValues: d.map((value) => ({ value })), metricValues: m.map((value) => ({ value: String(value) })) })) });
const totals = ["activeUsers", "sessions", "userEngagementDuration", "averageSessionDuration", "screenPageViewsPerSession", "engagementRate"];
const sample = [
  rep([], totals, [[[], [100, 150, 9000, 120, 2.5, 0.6]]]),
  rep(["date"], totals, [[["20261117"], [10, 12, 600, 80, 2, 0.5]]]),
  rep(["sessionDefaultChannelGroup", "sessionSource"], ["sessions", "activeUsers", "userEngagementDuration", "screenPageViewsPerSession"], [[["Organic Social", "x.com"], [40, 30, 3000, 3]]]),
  rep(["eventName"], ["totalUsers", "eventCount"], [[["page_view"], [100, 400]], [["depth_2"], [60, 60]], [["depth_5"], [20, 20]], [["play_request"], [30, 45]]]),
  rep(["pagePath"], ["screenPageViews", "activeUsers", "userEngagementDuration"], [[["/v/<x>"], [50, 20, 400]]]),
];

test("요청은 5개이고 단계 이벤트를 걸러 읽음", () => {
  const r = buildRequests(28);
  assert.equal(r.length, 5);
  assert.deepEqual(r[3].dimensionFilter.filter.inListFilter.values.slice(0, 3), ["page_view", "depth_2", "depth_3"]);
});
test("체류시간은 1인 참여 시간, 단계는 첫 화면 대비 비율", () => {
  const d = summarize(sample);
  assert.equal(d.totals.engagementPerUser, 90);
  assert.equal(d.daily[0].date, "2026-11-17");
  assert.equal(d.steps[1].users, 60); assert.equal(d.steps[1].rate, 0.6);
  assert.equal(d.steps[2].users, 0);
  assert.equal(d.channels[0].engagementPerUser, 100);
  assert.equal(duration(90), "1분 30초"); assert.equal(duration(42), "42초");
});
test("화면 주소는 이스케이프", () => {
  const html = renderReport(summarize(sample));
  assert.ok(html.includes("/v/&lt;x&gt;")); assert.ok(!html.includes("/v/<x>"));
});
test("권한 없음은 알아들을 말로", async () => {
  const fetcher = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(fetchReport("t", "123", 28, fetcher), /보기 권한/);
});
test("게임 앱은 이벤트 순위와 화면 이름으로", () => {
  const r = buildRequests(28, { web: false });
  assert.equal(r[3].dimensionFilter, undefined);
  assert.equal(r[4].dimensions[0].name, "unifiedScreenName");
  const app = [sample[0], sample[1], sample[2], rep(["eventName"], ["totalUsers", "eventCount"], [[["ss_stage_clear"], [50, 300]]]), rep(["unifiedScreenName"], ["screenPageViews", "activeUsers", "userEngagementDuration"], [[["Game"], [900, 80, 7200]]])];
  const d = summarize(app, { web: false });
  assert.equal(d.events[0].name, "ss_stage_clear"); assert.equal(d.pages[0].path, "Game");
  const html = renderReport(d);
  assert.ok(html.includes("많이 일어난 이벤트")); assert.ok(!html.includes("몇 단계까지"));
});
