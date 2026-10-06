import type { Ga4LandingPage, Ga4OrganicReport, GscMetricRow, GscSearchReport, SeoDateRange } from "@/lib/google/types";

export type AnalyticsSource = "gsc" | "ga4";
export interface SourceReport<T> {
  current: T | null;
  previous: T | null;
  error: string | null;
  comparisonError: string | null;
}
export interface AnalyticsReport {
  generatedAt: string;
  dateRange: SeoDateRange;
  previousRange: SeoDateRange;
  keyEvent: string;
  device: string;
  gsc: SourceReport<GscSearchReport>;
  ga4: SourceReport<Ga4OrganicReport>;
}
export interface PageInsight {
  url: string;
  search: GscMetricRow | null;
  visit: Ga4LandingPage | null;
  kind: "conversion" | "growth" | "maintain" | "review" | "observe";
  label: string;
  reason: string;
  actions: string[];
  priority: number;
}
const DAY = 86400000;
export function resolveAnalyticsRange(
  input: { startDate?: string; endDate?: string; comparisonEndDate?: string },
  now = new Date(),
) {
  // GSCの確定データが揃いやすい3日前までを既定とし、両ソースに同じ期間を渡す。
  const end = new Date(now.getTime() - 3 * DAY).toISOString().slice(0, 10);
  const start = new Date(Date.parse(end) - 27 * DAY).toISOString().slice(0, 10);
  const range = { startDate: input.startDate || start, endDate: input.endDate || end };
  for (const value of Object.values(range)) {
    const time = Date.parse(`${value}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== value
    )
      throw new Error("期間は実在する日付で指定してください。");
  }
  const days = (Date.parse(range.endDate) - Date.parse(range.startDate)) / DAY + 1;
  if (days < 1 || days > 180 || range.endDate >= now.toISOString().slice(0, 10))
    throw new Error("期間は昨日以前の連続した1〜180日で指定してください。");
  const previousEnd = input.comparisonEndDate
    ? Date.parse(`${input.comparisonEndDate}T00:00:00Z`)
    : Date.parse(range.startDate) - DAY;
  if (
    input.comparisonEndDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(input.comparisonEndDate) ||
      !Number.isFinite(previousEnd) ||
      new Date(previousEnd).toISOString().slice(0, 10) !== input.comparisonEndDate ||
      previousEnd >= Date.parse(range.startDate))
  )
    throw new Error("比較期間の終了日は対象期間より前の実在する日付で指定してください。");
  return {
    dateRange: range,
    previousRange: {
      startDate: new Date(previousEnd - (days - 1) * DAY).toISOString().slice(0, 10),
      endDate: new Date(previousEnd).toISOString().slice(0, 10),
    },
  };
}

/** ホストとパス・意味のあるクエリで照合する。サブドメイン・末尾スラッシュは保持。 */
export function pageIdentity(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    for (const key of [...url.searchParams.keys()])
      if (/^utm_/i.test(key) || /^(gclid|dclid|fbclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return `${url.host.toLowerCase()}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
export function landingUrl(page: Ga4LandingPage): string | null {
  if (!page.hostname || page.hostname === "(not set)" || !page.path.startsWith("/") || page.path.startsWith("//"))
    return null;
  try {
    const url = new URL(page.path, `https://${page.hostname}`);
    return url.hostname === page.hostname.toLowerCase() ? url.href : null;
  } catch {
    return null;
  }
}

export function buildPageInsights(gsc: GscSearchReport | null, ga4: Ga4OrganicReport | null): PageInsight[] {
  const searches = new Map<string, GscMetricRow>();
  for (const page of gsc?.topPages ?? []) {
    const id = pageIdentity(page.key);
    if (!id) continue;
    const old = searches.get(id);
    if (!old) searches.set(id, { ...page });
    else {
      const impressions = old.impressions + page.impressions;
      searches.set(id, {
        key: old.key,
        clicks: old.clicks + page.clicks,
        impressions,
        ctr: impressions ? (old.clicks + page.clicks) / impressions : 0,
        position: impressions ? (old.position * old.impressions + page.position * page.impressions) / impressions : 0,
      });
    }
  }
  const visits = new Map<string, Ga4LandingPage>();
  for (const page of ga4?.landingPages ?? []) {
    const url = landingUrl(page);
    const id = url && pageIdentity(url);
    if (!id) continue;
    const old = visits.get(id);
    if (!old) visits.set(id, { ...page });
    else {
      const sessions = old.sessions + page.sessions;
      const engaged = old.engagedSessions + page.engagedSessions;
      const sr = old.sessionKeyEventRate;
      const pr = page.sessionKeyEventRate;
      visits.set(id, {
        ...old,
        sessions,
        engagedSessions: engaged,
        keyEvents: old.keyEvents + page.keyEvents,
        engagementRate: sessions ? engaged / sessions : null,
        sessionKeyEventRate:
          sessions && sr != null && pr != null ? (sr * old.sessions + pr * page.sessions) / sessions : null,
      });
    }
  }
  const baseline = ga4?.totals.sessionKeyEventRate;
  const validOutcome = Boolean(ga4?.keyEvent && ga4.totals.keyEvents > 0 && !ga4.dataQuality?.length);
  return [...new Set([...searches.keys(), ...visits.keys()])]
    .map((id) => {
      const search = searches.get(id) ?? null;
      const visit = visits.get(id) ?? null;
      const url = search?.key || (visit && landingUrl(visit)) || "";
      const queries = gsc?.queryPages.filter((q) => pageIdentity(q.page) === id) ?? [];
      const opportunity = queries.find((q) => q.impressions >= 100 && q.position >= 4 && q.position <= 20);
      let kind: PageInsight["kind"] = "observe";
      let label = "データを確認";
      let reason = "両データの照合、主要成果の設定、十分な訪問数を確認してから改善方針を決めます。";
      let actions = [
        "入口ページが同じホスト・パスか確認する",
        "GA4で主要な成果をキーイベントに設定する",
        "訪問数と成果回数をそろえて確認する",
      ];
      const outcome = visit?.sessionKeyEventRate;
      if (validOutcome && visit && search && visit.sessions >= 30 && outcome != null && baseline != null) {
        if (visit.sessions >= 50 && outcome < baseline) {
          kind = "conversion";
          label = "訪問を成果につなげる";
          reason = "訪問数があり、成果が発生した訪問の割合がサイト全体より低いページです。";
          actions = [
            "実際の検索語句から、訪問者の疑問を書き出す",
            "不足する説明・用途・費用・仕様をページで確認する",
            "製品・資料・問い合わせへの案内を見直す",
          ];
        } else if (outcome >= baseline && opportunity) {
          kind = "growth";
          label = "成果のあるページの集客を伸ばす";
          reason = "成果率が全体以上で、平均4〜20位・表示100回以上の検索語句があります。";
          actions = [
            "事業に関係する検索語句を選ぶ",
            "検索語句の疑問に答える内容を補う",
            "タイトルと関連ページからのリンクを見直す",
          ];
        } else if (outcome >= baseline && visit.sessions >= 50) {
          kind = "maintain";
          label = "強みを維持・展開する";
          reason = "一定の訪問数があり、成果率がサイト全体以上です。";
          actions = ["成果につながる内容と導線を確認する", "関連する用途・製品ページへ改善を展開する"];
        } else {
          kind = "review";
          label = "ページの役割を見直す";
          reason = "検索テーマ・ページの目的・成果までの案内を一緒に確認する候補です。";
          actions = ["誰のどんな課題を解決するページか決める", "検索需要と内容が合っているか確認する"];
        }
      } else if (opportunity) {
        kind = "growth";
        label = "検索で伸ばせる候補";
        reason = "平均4〜20位・表示100回以上の検索語句があります。成果との関係はまだ判断していません。";
        actions = [
          "事業に関係する検索語句を選ぶ",
          "検索意図とページ内容のずれを確認する",
          "成果計測を整えて改善後を比較する",
        ];
      }
      if (visit && visit.sessions < 30) {
        kind = "observe";
        label = "訪問数を蓄積";
        reason = `訪問${visit.sessions}回では成果率を評価する材料が少ないため、期間を広げて確認します。`;
      }
      return {
        url,
        search,
        visit,
        kind,
        label,
        reason,
        actions,
        priority:
          (kind === "conversion" ? 1000 : kind === "growth" ? 500 : 0) +
          Math.log1p(search?.impressions ?? visit?.sessions ?? 0),
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

export function percent(value: number | null | undefined) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}
export function change(current: number, previous: number | null | undefined) {
  if (previous == null) return "比較未取得";
  if (previous === 0) return current === 0 ? "変化なし" : "前期間は0";
  const delta = ((current - previous) / previous) * 100;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}
