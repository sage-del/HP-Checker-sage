import { clearGoogleAccessToken, getGoogleAccessToken, type GoogleIntegrationConfig } from "./auth";
import type {
  Ga4LandingPage,
  Ga4OrganicReport,
  GscMetricRow,
  GscQueryPageRow,
  GscSearchReport,
  SeoDateRange,
} from "./types";

export class GoogleApiError extends Error {
  constructor(
    public readonly source: "ga4" | "gsc",
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

async function googlePost<T>(
  config: GoogleIntegrationConfig,
  source: "ga4" | "gsc",
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getGoogleAccessToken(config, Date.now(), signal);
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
    if (response.status === 401 && attempt === 0) {
      clearGoogleAccessToken();
      continue;
    }
    const json = (await response.json().catch(() => null)) as T | null;
    if (!response.ok || !json)
      throw new GoogleApiError(
        source,
        response.status,
        `${source.toUpperCase()} API の取得に失敗しました（HTTP ${response.status}）`,
      );
    return json;
  }
  throw new GoogleApiError(source, 401, `${source.toUpperCase()} API の認証に失敗しました`);
}

const number = (value: string | number | undefined) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const rate = (engaged: number, sessions: number) => (sessions > 0 ? engaged / sessions : null);
export interface AnalyticsFilters {
  device?: "desktop" | "mobile" | "tablet";
  keyEvent?: string;
}
interface Ga4Row {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}
interface Ga4Response {
  rows?: Ga4Row[];
  totals?: Ga4Row[];
  rowCount?: number;
  metadata?: { subjectToThresholding?: boolean; dataLossFromOtherRow?: boolean };
}

export async function fetchGa4OrganicReport(
  config: GoogleIntegrationConfig,
  dateRange: SeoDateRange,
  limit = 100,
  signal?: AbortSignal,
  options: AnalyticsFilters = {},
): Promise<Ga4OrganicReport> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${config.ga4PropertyId}:runReport`;
  const filters = [
    { filter: { fieldName: "sessionSourceMedium", stringFilter: { matchType: "EXACT", value: "google / organic" } } },
    ...(options.device
      ? [{ filter: { fieldName: "deviceCategory", stringFilter: { matchType: "EXACT", value: options.device } } }]
      : []),
  ];
  const dimensions = [{ name: "hostName" }, { name: "landingPagePlusQueryString" }];
  const metrics = [
    { name: "sessions" },
    { name: "activeUsers" },
    { name: "engagedSessions" },
    { name: "keyEvents" },
    ...(options.keyEvent ? [{ name: `sessionKeyEventRate:${options.keyEvent}` }] : []),
  ];
  const base = {
    dateRanges: [dateRange],
    dimensionFilter: { andGroup: { expressions: filters } },
    metricAggregations: ["TOTAL"],
  };
  const rowLimit = Math.min(Math.max(limit, 1), 1000);
  const response = await googlePost<Ga4Response>(
    config,
    "ga4",
    url,
    {
      ...base,
      dimensions,
      metrics,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(rowLimit),
    },
    signal,
  );
  // 成果回数と「成果が起きたセッションの割合」は別の指標。イベントで絞るのは回数レポートのみ。
  const eventResponse = options.keyEvent
    ? await googlePost<Ga4Response>(
        config,
        "ga4",
        url,
        {
          ...base,
          dimensions,
          metrics: [{ name: "keyEvents" }],
          dimensionFilter: {
            andGroup: {
              expressions: [
                ...filters,
                { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: options.keyEvent } } },
              ],
            },
          },
          limit: "10000",
        },
        signal,
      )
    : null;
  const eventKey = (row: Ga4Row) => `${row.dimensionValues?.[0]?.value}|${row.dimensionValues?.[1]?.value}`;
  const events = new Map(
    (eventResponse?.rows ?? []).map((row) => [eventKey(row), number(row.metricValues?.[0]?.value)]),
  );
  const landingPages: Ga4LandingPage[] = (response.rows ?? []).map((row) => {
    const m = row.metricValues ?? [];
    const sessions = number(m[0]?.value);
    const engaged = number(m[2]?.value);
    return {
      hostname: row.dimensionValues?.[0]?.value || "(not set)",
      path: row.dimensionValues?.[1]?.value || "(not set)",
      sessions,
      activeUsers: number(m[1]?.value),
      engagedSessions: engaged,
      keyEvents: eventResponse ? (events.get(eventKey(row)) ?? 0) : number(m[3]?.value),
      engagementRate: rate(engaged, sessions),
      sessionKeyEventRate: options.keyEvent && sessions > 0 ? number(m[4]?.value) : null,
    };
  });
  const m = response.totals?.[0]?.metricValues ?? [];
  const sessions = number(m[0]?.value);
  const engaged = number(m[2]?.value);
  const dataQuality: string[] = [];
  if (response.metadata?.subjectToThresholding || eventResponse?.metadata?.subjectToThresholding)
    dataQuality.push("GA4のしきい値により一部のデータが非表示になる可能性があります。");
  if (response.metadata?.dataLossFromOtherRow || eventResponse?.metadata?.dataLossFromOtherRow)
    dataQuality.push("GA4の集約行により、一部のページを識別できない可能性があります。");
  if ((eventResponse?.rowCount ?? 0) > 10000) dataQuality.push("成果回数のページ別取得上限に達しています。");
  return {
    propertyId: config.ga4PropertyId,
    dateRange,
    keyEvent: options.keyEvent,
    landingPages,
    limited: (response.rowCount ?? 0) > rowLimit,
    dataQuality,
    totals: {
      sessions,
      activeUsers: number(m[1]?.value),
      engagedSessions: engaged,
      keyEvents: eventResponse ? number(eventResponse.totals?.[0]?.metricValues?.[0]?.value) : number(m[3]?.value),
      engagementRate: rate(engaged, sessions),
      sessionKeyEventRate: options.keyEvent && sessions > 0 ? number(m[4]?.value) : null,
    },
  };
}

/** 順序を持つファネルではなく、測定された行動の一覧。 */
export async function fetchGa4Events(
  config: GoogleIntegrationConfig,
  dateRange: SeoDateRange,
  signal?: AbortSignal,
  options: AnalyticsFilters = {},
) {
  const response = await googlePost<Ga4Response>(
    config,
    "ga4",
    `https://analyticsdata.googleapis.com/v1beta/properties/${config.ga4PropertyId}:runReport`,
    {
      dateRanges: [dateRange],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: "sessionSourceMedium",
                stringFilter: { matchType: "EXACT", value: "google / organic" },
              },
            },
            ...(options.device
              ? [
                  {
                    filter: {
                      fieldName: "deviceCategory",
                      stringFilter: { matchType: "EXACT", value: options.device },
                    },
                  },
                ]
              : []),
          ],
        },
      },
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: "1000",
    },
    signal,
  );
  return (response.rows ?? []).map((row) => ({
    name: row.dimensionValues?.[0]?.value || "(not set)",
    count: number(row.metricValues?.[0]?.value),
  }));
}

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}
interface GscResponse {
  rows?: GscRow[];
}
function gscMetrics(row: GscRow) {
  return {
    clicks: number(row.clicks),
    impressions: number(row.impressions),
    ctr: number(row.ctr),
    position: number(row.position),
  };
}

export async function fetchGscSearchReport(
  config: GoogleIntegrationConfig,
  dateRange: SeoDateRange,
  limit = 100,
  signal?: AbortSignal,
  options: AnalyticsFilters = {},
): Promise<GscSearchReport> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.gscSiteUrl)}/searchAnalytics/query`;
  const base = {
    ...dateRange,
    type: "web",
    dataState: "final",
    ...(options.device
      ? {
          dimensionFilterGroups: [
            { filters: [{ dimension: "device", operator: "equals", expression: options.device.toUpperCase() }] },
          ],
        }
      : {}),
  };
  // 匿名化された検索語句の欠落を合計・ページ指標へ持ち込まないよう、それぞれ独立取得。
  const [total, pages, queries, pairs] = await Promise.all([
    googlePost<GscResponse>(config, "gsc", url, { ...base, dimensions: [], rowLimit: 1 }, signal),
    googlePost<GscResponse>(
      config,
      "gsc",
      url,
      { ...base, dimensions: ["page"], rowLimit: Math.min(limit, 1000) },
      signal,
    ),
    googlePost<GscResponse>(
      config,
      "gsc",
      url,
      { ...base, dimensions: ["query"], rowLimit: Math.min(limit, 1000) },
      signal,
    ),
    googlePost<GscResponse>(
      config,
      "gsc",
      url,
      { ...base, dimensions: ["query", "page"], rowLimit: Math.min(Math.max(limit * 5, 100), 25000) },
      signal,
    ),
  ]);
  const toMetric = (row: GscRow): GscMetricRow => ({ key: row.keys?.[0] || "(not set)", ...gscMetrics(row) });
  const queryPages: GscQueryPageRow[] = (pairs.rows ?? []).map((row) => ({
    query: row.keys?.[0] || "(not set)",
    page: row.keys?.[1] || "(not set)",
    ...gscMetrics(row),
  }));
  return {
    siteUrl: config.gscSiteUrl,
    dateRange,
    totals: gscMetrics(total.rows?.[0] ?? {}),
    topPages: (pages.rows ?? []).map(toMetric),
    topQueries: (queries.rows ?? []).map(toMetric),
    queryPages,
    limited:
      (pages.rows?.length ?? 0) >= Math.min(limit, 1000) ||
      queryPages.length >= Math.min(Math.max(limit * 5, 100), 25000),
  };
}
