import type { Metadata } from "next";
import { AnalyticsScreen, type AnalyticsSearchParams } from "@/components/analytics/AnalyticsScreen";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GSC · 検索の改善" };
export default function GscPage({ searchParams }: { searchParams: AnalyticsSearchParams }) {
  return <AnalyticsScreen source="gsc" searchParams={searchParams} />;
}
