import type { NextRequest } from "next/server";
import { fetchKeywordReport } from "@/lib/keywords/client";
import { normalizeSeed } from "@/lib/keywords/model";

export const runtime = "nodejs";
export const maxDuration = 15;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest) {
  let seed: string;
  const expanded = request.nextUrl.searchParams.get("expanded");
  try {
    seed = normalizeSeed(request.nextUrl.searchParams.get("q"));
    if (expanded !== null && !["true", "false"].includes(expanded)) throw new Error("追加調査の指定が不正です。");
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers });
  }
  const report = await fetchKeywordReport(seed, expanded === "true", request.signal);
  // 部分取得・全取得失敗でも取得状況を返す。空の成功と通信失敗を区別する。
  return Response.json(report, { headers });
}
