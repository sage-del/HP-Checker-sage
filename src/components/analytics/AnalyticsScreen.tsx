import { AnalyticsWorkspace } from "./AnalyticsWorkspace";
import { headers } from "next/headers";
import { connectionStatus } from "@/lib/analytics/server";
import { resolveAnalyticsRange, type AnalyticsSource } from "@/lib/analytics/model";

export type AnalyticsSearchParams = Promise<Record<string, string | string[] | undefined>>;
export async function AnalyticsScreen({
  source,
  searchParams,
}: {
  source: AnalyticsSource;
  searchParams: AnalyticsSearchParams;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const defaults = resolveAnalyticsRange({}).dateRange;
  return (
    <AnalyticsWorkspace
      source={source}
      connection={{
        gsc: connectionStatus("gsc", requestHeaders),
        ga4: connectionStatus("ga4", requestHeaders),
        protected: Boolean(process.env.BASIC_AUTH_PASSWORD),
      }}
      initial={{
        startDate: value("startDate") || defaults.startDate,
        endDate: value("endDate") || defaults.endDate,
        keyEvent: value("keyEvent") ?? process.env.GA4_PRIMARY_KEY_EVENT ?? "",
        device: value("device") || "all",
        comparisonEndDate: value("comparisonEndDate"),
      }}
      initialPage={value("page")}
    />
  );
}
