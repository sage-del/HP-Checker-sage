import { readGoogleConfig, GoogleConfigError } from "@/lib/google/auth";
import {
  fetchGa4Events,
  fetchGa4OrganicReport,
  fetchGscSearchReport,
  GoogleApiError,
  type AnalyticsFilters,
} from "@/lib/google/client";
import type { Ga4OrganicReport, GscSearchReport } from "@/lib/google/types";
import { resolveAnalyticsRange, type AnalyticsReport, type AnalyticsSource, type SourceReport } from "./model";

export function connectionStatus(source: AnalyticsSource) {
  try {
    readGoogleConfig(process.env, source);
    return { configured: true, message: "設定済み・接続は取得時に確認" };
  } catch (error) {
    return {
      configured: false,
      message: error instanceof GoogleConfigError ? error.message : "Google連携の設定を確認してください。",
    };
  }
}
export function safeAnalyticsError(error: unknown) {
  if (error instanceof GoogleConfigError) return error.message;
  if (error instanceof GoogleApiError) {
    if (error.status === 403)
      return "閲覧権限またはAPIの有効化を確認してください。サービスアカウントをプロパティに追加する必要があります。";
    if (error.status === 400)
      return "プロパティ・期間・主要成果のイベント名を確認してください。選んだイベントがGA4のキーイベントに登録されているかも確認してください。";
    if (error.status === 429) return "Google APIの取得上限に達しました。時間をおいて再取得してください。";
  }
  return "Googleから取得できませんでした。認証設定を確認し、時間をおいて再取得してください。";
}
async function sourceReport<T>(current: () => Promise<T>, previous: () => Promise<T>): Promise<SourceReport<T>> {
  const [c, p] = await Promise.allSettled([current(), previous()]);
  return {
    current: c.status === "fulfilled" ? c.value : null,
    previous: p.status === "fulfilled" ? p.value : null,
    error: c.status === "rejected" ? safeAnalyticsError(c.reason) : null,
    comparisonError: p.status === "rejected" ? safeAnalyticsError(p.reason) : null,
  };
}
export async function loadAnalytics(
  input: { startDate?: string; endDate?: string; keyEvent?: string; device?: string; comparisonEndDate?: string },
  signal?: AbortSignal,
): Promise<AnalyticsReport> {
  const ranges = resolveAnalyticsRange(input);
  const keyEvent = (input.keyEvent ?? process.env.GA4_PRIMARY_KEY_EVENT ?? "").trim();
  if (keyEvent && !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(keyEvent))
    throw new Error("主要成果には40文字以内のGA4イベント名を指定してください。");
  if (input.device && !["all", "desktop", "mobile", "tablet"].includes(input.device))
    throw new Error("デバイスの指定が不正です。");
  const options: AnalyticsFilters = {
    keyEvent: keyEvent || undefined,
    device: input.device && input.device !== "all" ? (input.device as AnalyticsFilters["device"]) : undefined,
  };
  const getGsc = (range: typeof ranges.dateRange) =>
    fetchGscSearchReport(readGoogleConfig(process.env, "gsc"), range, 200, signal, options);
  const getGa4 = async (range: typeof ranges.dateRange, events = false) => {
    const config = readGoogleConfig(process.env, "ga4");
    const data = await fetchGa4OrganicReport(config, range, 200, signal, options);
    if (events) {
      try {
        data.eventCounts = await fetchGa4Events(config, range, signal, options);
      } catch {
        data.dataQuality = [
          ...(data.dataQuality ?? []),
          "行動イベントの一覧は取得できませんでした。ページ別指標は取得できています。",
        ];
      }
    }
    return data;
  };
  const [gsc, ga4] = await Promise.all([
    sourceReport<GscSearchReport>(
      () => getGsc(ranges.dateRange),
      () => getGsc(ranges.previousRange),
    ),
    sourceReport<Ga4OrganicReport>(
      () => getGa4(ranges.dateRange, true),
      () => getGa4(ranges.previousRange),
    ),
  ]);
  return { ...ranges, generatedAt: new Date().toISOString(), keyEvent, device: input.device || "all", gsc, ga4 };
}
