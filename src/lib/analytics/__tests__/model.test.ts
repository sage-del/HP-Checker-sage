import { describe, expect, it } from "vitest";
import { demoReport } from "../demo";
import { buildPageInsights, pageIdentity, resolveAnalyticsRange } from "../model";

describe("分析条件とページ照合", () => {
  it("確定データを待つ28日間と同じ長さの前期間を作る", () => {
    expect(resolveAnalyticsRange({}, new Date("2026-10-06T12:00:00Z"))).toEqual({
      dateRange: { startDate: "2026-09-06", endDate: "2026-10-03" },
      previousRange: { startDate: "2026-08-09", endDate: "2026-09-05" },
    });
    expect(
      resolveAnalyticsRange(
        { startDate: "2026-09-02", endDate: "2026-09-29", comparisonEndDate: "2026-08-31" },
        new Date("2026-10-06"),
      ),
    ).toEqual({
      dateRange: { startDate: "2026-09-02", endDate: "2026-09-29" },
      previousRange: { startDate: "2026-08-04", endDate: "2026-08-31" },
    });
  });
  it("不正な暦日・未来・逆転・長すぎる期間と重複した比較を拒否する", () => {
    for (const input of [
      { startDate: "2026-02-30" },
      { endDate: "2027-01-01" },
      { startDate: "2026-10-05", endDate: "2026-09-01" },
      { startDate: "2020-01-01" },
      { comparisonEndDate: "2026-10-04" },
    ])
      expect(() => resolveAnalyticsRange(input, new Date("2026-10-06"))).toThrow();
  });
  it("ホスト・意味のあるクエリを保持し、計測パラメータだけを除く", () => {
    expect(pageIdentity("https://EXAMPLE.com/product?id=2&utm_source=google#g")).toBe("example.com/product?id=2");
    expect(pageIdentity("https://other.example.com/product?id=2")).not.toBe(
      pageIdentity("https://example.com/product?id=2"),
    );
    expect(pageIdentity("https://example.com/product/")).not.toBe(pageIdentity("https://example.com/product"));
    expect(pageIdentity("javascript:alert(1)")).toBeNull();
  });
});
describe("根拠のある改善候補", () => {
  it("検索・訪問・成果率を照合し、導線改善と集客改善を区別する", () => {
    const data = demoReport();
    const list = buildPageInsights(data.gsc.current, data.ga4.current);
    expect(list[0].kind).toBe("conversion");
    expect(list.find((p) => p.url.endsWith("/guide/cost"))?.kind).toBe("growth");
    expect(list.find((p) => p.url.endsWith("/cases/factory"))?.kind).toBe("maintain");
  });
  it("成果が未選択、全体で0、欠測、少ない訪問では成果を断定しない", () => {
    const data = demoReport();
    const ga4 = data.ga4.current!;
    const gsc = data.gsc.current!;
    const withoutOutcome = { ...ga4, keyEvent: undefined };
    expect(buildPageInsights(gsc, withoutOutcome).some((p) => p.kind === "conversion" || p.kind === "maintain")).toBe(
      false,
    );
    expect(
      buildPageInsights(gsc, { ...ga4, totals: { ...ga4.totals, keyEvents: 0 } }).some((p) => p.kind === "conversion"),
    ).toBe(false);
    expect(buildPageInsights(gsc, null).every((p) => p.visit === null)).toBe(true);
    expect(
      buildPageInsights(gsc, { ...ga4, landingPages: ga4.landingPages.map((p) => ({ ...p, sessions: 10 })) }).every(
        (p) => p.kind === "observe",
      ),
    ).toBe(true);
  });
  it("計測用クエリで分かれた訪問をセッション重みで合算し、成果回数から率を作らない", () => {
    const data = demoReport();
    const ga4 = data.ga4.current!;
    const p = ga4.landingPages[0];
    const list = buildPageInsights(data.gsc.current, {
      ...ga4,
      landingPages: [
        { ...p, sessions: 100, keyEvents: 20, sessionKeyEventRate: 0.1 },
        { ...p, path: p.path + "?utm_source=x", sessions: 50, keyEvents: 2, sessionKeyEventRate: 0.04 },
      ],
    });
    const visit = list.find((x) => x.url.endsWith(p.path))?.visit;
    expect(visit?.sessions).toBe(150);
    expect(visit?.keyEvents).toBe(22);
    expect(visit?.sessionKeyEventRate).toBeCloseTo(0.08);
  });
  it("別ホストや(not set)の訪問を同じページの成果として付けない", () => {
    const data = demoReport();
    const ga4 = data.ga4.current!;
    const list = buildPageInsights(data.gsc.current, {
      ...ga4,
      landingPages: ga4.landingPages.map((p) => ({ ...p, hostname: "another.example.com" })),
    });
    expect(list.filter((p) => p.search).every((p) => p.visit === null)).toBe(true);
    const unset = buildPageInsights(null, {
      ...ga4,
      landingPages: [{ ...ga4.landingPages[0], hostname: "(not set)" }],
    });
    expect(unset).toEqual([]);
  });
});
