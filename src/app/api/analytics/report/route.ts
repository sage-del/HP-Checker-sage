import { type NextRequest } from "next/server";
import { checkBasicAuth } from "@/lib/monitor/auth";
import { loadAnalytics } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!password && process.env.NODE_ENV === "production")
    return Response.json(
      { error: "Google分析データの閲覧にはアクセス制限の設定が必要です。" },
      { status: 503, headers },
    );
  if (
    password &&
    !checkBasicAuth(request.headers.get("authorization"), process.env.BASIC_AUTH_USER || "admin", password)
  )
    return Response.json({ error: "認証が必要です。" }, { status: 401, headers });
  const params = request.nextUrl.searchParams;
  try {
    const data = await loadAnalytics(
      {
        startDate: params.get("startDate") || undefined,
        endDate: params.get("endDate") || undefined,
        keyEvent: params.get("keyEvent") ?? undefined,
        device: params.get("device") || undefined,
        comparisonEndDate: params.get("comparisonEndDate") || undefined,
      },
      AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    );
    return Response.json(data, { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "分析の条件を確認してください。" },
      { status: 400, headers },
    );
  }
}
