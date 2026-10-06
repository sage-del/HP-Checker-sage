import type { AnalyticsReport } from "./model";
/** 操作説明専用。実データと混ぜず、明示的な操作でのみ表示する。 */
export function demoReport(): AnalyticsReport {
  const dateRange = { startDate: "2026-09-01", endDate: "2026-09-28" };
  const previousRange = { startDate: "2026-08-04", endDate: "2026-08-31" };
  const pages = [
    { key: "https://example.com/products/sensor", clicks: 320, impressions: 8000, ctr: 0.04, position: 6.2 },
    { key: "https://example.com/guide/cost", clicks: 180, impressions: 6000, ctr: 0.03, position: 9.4 },
    { key: "https://example.com/cases/factory", clicks: 85, impressions: 1000, ctr: 0.085, position: 3.5 },
  ];
  const gsc = {
    siteUrl: "sc-domain:example.com",
    dateRange,
    totals: { clicks: 585, impressions: 15000, ctr: 0.039, position: 7.3 },
    topPages: pages,
    topQueries: [
      { key: "工場 センサー 選び方", clicks: 180, impressions: 5000, ctr: 0.036, position: 6.8 },
      { key: "IoT 導入 費用", clicks: 95, impressions: 4000, ctr: 0.02375, position: 10.1 },
    ],
    queryPages: [
      { query: "工場 センサー 選び方", page: pages[0].key, clicks: 180, impressions: 5000, ctr: 0.036, position: 6.8 },
      { query: "IoT 導入 費用", page: pages[1].key, clicks: 95, impressions: 4000, ctr: 0.02375, position: 10.1 },
    ],
  };
  const ga4 = {
    propertyId: "sample",
    keyEvent: "generate_lead",
    dateRange,
    totals: {
      sessions: 510,
      activeUsers: 450,
      engagedSessions: 340,
      keyEvents: 17,
      engagementRate: 340 / 510,
      sessionKeyEventRate: 16 / 510,
    },
    landingPages: [
      {
        hostname: "example.com",
        path: "/products/sensor",
        sessions: 280,
        activeUsers: 240,
        engagedSessions: 180,
        keyEvents: 3,
        engagementRate: 180 / 280,
        sessionKeyEventRate: 3 / 280,
      },
      {
        hostname: "example.com",
        path: "/guide/cost",
        sessions: 150,
        activeUsers: 135,
        engagedSessions: 110,
        keyEvents: 9,
        engagementRate: 110 / 150,
        sessionKeyEventRate: 0.06,
      },
      {
        hostname: "example.com",
        path: "/cases/factory",
        sessions: 80,
        activeUsers: 75,
        engagedSessions: 50,
        keyEvents: 5,
        engagementRate: 0.625,
        sessionKeyEventRate: 0.05,
      },
    ],
    eventCounts: [
      { name: "page_view", count: 920 },
      { name: "view_item", count: 280 },
      { name: "contact_click", count: 70 },
      { name: "form_start", count: 40 },
      { name: "generate_lead", count: 17 },
    ],
  };
  return {
    generatedAt: "2026-10-01T00:00:00Z",
    dateRange,
    previousRange,
    keyEvent: "generate_lead",
    device: "all",
    gsc: {
      current: gsc,
      previous: {
        ...gsc,
        dateRange: previousRange,
        totals: { ...gsc.totals, clicks: 500, impressions: 14000 },
        topPages: pages.map((p) => ({ ...p, clicks: Math.round(p.clicks * 0.85) })),
      },
      error: null,
      comparisonError: null,
    },
    ga4: {
      current: ga4,
      previous: {
        ...ga4,
        dateRange: previousRange,
        totals: { ...ga4.totals, sessions: 460, keyEvents: 12, sessionKeyEventRate: 0.024 },
        landingPages: ga4.landingPages.map((p) => ({
          ...p,
          sessions: Math.round(p.sessions * 0.9),
          keyEvents: Math.max(0, p.keyEvents - 1),
        })),
      },
      error: null,
      comparisonError: null,
    },
  };
}
