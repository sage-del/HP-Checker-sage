import type { Metadata } from "next";
import { AnalyticsScreen, type AnalyticsSearchParams } from "@/components/analytics/AnalyticsScreen";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GA4 · 訪問と成果" };
export default function Ga4Page({ searchParams }: { searchParams: AnalyticsSearchParams }) {
  return <AnalyticsScreen source="ga4" searchParams={searchParams} />;
}
