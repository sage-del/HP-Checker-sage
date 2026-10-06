import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGa4OrganicReport, fetchGscSearchReport } from "../client";
import type { GoogleIntegrationConfig } from "../auth";
vi.mock("../auth", () => ({ getGoogleAccessToken: vi.fn(async () => "test-token"), clearGoogleAccessToken: vi.fn() }));
const config = { ga4PropertyId: "123", gscSiteUrl: "sc-domain:example.com" } as GoogleIntegrationConfig;
const range = { startDate: "2026-09-01", endDate: "2026-09-28" };
afterEach(() => vi.unstubAllGlobals());

describe("GSCデータの取得", () => {
  it("合計とページは匿名化語句の欠落を避けて独立取得し、両ソースでデバイスを揃える", async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        requests.push(body);
        const dimension = body.dimensions.join(",");
        const rows =
          dimension === ""
            ? [{ clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }]
            : dimension === "page"
              ? [{ keys: ["https://example.com/"], clicks: 90, impressions: 900, ctr: 0.1, position: 6 }]
              : dimension === "query,page"
                ? [{ keys: ["検索語", "https://example.com/"], clicks: 20, impressions: 100, ctr: 0.2, position: 8 }]
                : [];
        return Response.json({ rows });
      }),
    );
    const report = await fetchGscSearchReport(config, range, 200, undefined, { device: "mobile" });
    expect(report.totals.clicks).toBe(100);
    expect(report.topPages[0].clicks).toBe(90);
    expect(report.queryPages[0].clicks).toBe(20);
    expect(requests).toHaveLength(4);
    for (const request of requests) {
      expect(request.type).toBe("web");
      expect(request.dimensionFilterGroups).toEqual([
        { filters: [{ dimension: "device", operator: "equals", expression: "MOBILE" }] },
      ]);
    }
  });
});
describe("GA4の主要成果", () => {
  it("Google自然検索の全訪問を母数とし、選択イベントの回数は別レポートで取得する", async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        requests.push(body);
        if (requests.length === 1)
          return Response.json({
            rows: [
              {
                dimensionValues: [{ value: "example.com" }, { value: "/product" }],
                metricValues: ["100", "80", "60", "20", ".08"].map((value) => ({ value })),
              },
            ],
            totals: [{ metricValues: ["100", "80", "60", "20", ".08"].map((value) => ({ value })) }],
            rowCount: 1,
          });
        return Response.json({
          rows: [
            { dimensionValues: [{ value: "example.com" }, { value: "/product" }], metricValues: [{ value: "12" }] },
          ],
          totals: [{ metricValues: [{ value: "12" }] }],
        });
      }),
    );
    const report = await fetchGa4OrganicReport(config, range, 200, undefined, {
      keyEvent: "generate_lead",
      device: "mobile",
    });
    expect(report.totals.sessions).toBe(100);
    expect(report.totals.keyEvents).toBe(12);
    expect(report.totals.sessionKeyEventRate).toBe(0.08);
    expect(report.landingPages[0].keyEvents).toBe(12);
    expect(report.landingPages[0].hostname).toBe("example.com");
    expect(requests[0].dimensionFilter).toEqual({
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "sessionSourceMedium",
              stringFilter: { matchType: "EXACT", value: "google / organic" },
            },
          },
          { filter: { fieldName: "deviceCategory", stringFilter: { matchType: "EXACT", value: "mobile" } } },
        ],
      },
    });
    expect(JSON.stringify(requests[0])).not.toContain('"fieldName":"eventName"');
    expect(JSON.stringify(requests[1])).toContain('"fieldName":"eventName"');
  });
});
