import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../report/route";
import { loadAnalytics } from "@/lib/analytics/server";
vi.mock("@/lib/analytics/server", () => ({
  loadAnalytics: vi.fn(async () => ({
    ga4: { current: null, error: "GA4未設定" },
    gsc: { current: { totals: { clicks: 12 } }, error: null },
  })),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Google分析データの保護", () => {
  it("本番の認証未設定・不一致はデータ取得前に拒否する", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "");
    expect((await GET(new NextRequest("https://example.com/api/analytics/report"))).status).toBe(503);
    vi.stubEnv("BASIC_AUTH_PASSWORD", "test-password");
    expect((await GET(new NextRequest("https://example.com/api/analytics/report"))).status).toBe(401);
    expect(loadAnalytics).not.toHaveBeenCalled();
  });
  it("認証後は部分取得を返し、キャッシュさせない", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BASIC_AUTH_USER", "admin");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "test-password");
    const response = await GET(
      new NextRequest(
        "https://example.com/api/analytics/report?keyEvent=generate_lead&device=mobile&comparisonEndDate=2026-08-31",
        { headers: { authorization: `Basic ${Buffer.from("admin:test-password").toString("base64")}` } },
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      ga4: { current: null, error: "GA4未設定" },
      gsc: { current: { totals: { clicks: 12 } } },
    });
    expect(loadAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ keyEvent: "generate_lead", device: "mobile", comparisonEndDate: "2026-08-31" }),
      expect.any(AbortSignal),
    );
  });
});
