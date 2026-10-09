import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { POST } from "../seo-report/route";
import { fetchKeywordReport } from "@/lib/keywords/client";

vi.mock("@/lib/analyzer/site", () => ({ analyzeSite: vi.fn(async () => ({ entryUrl: "https://example.com" })) }));
vi.mock("@/lib/automation/report", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/automation/report")>(),
  compactAudit: vi.fn(() => ({ entryUrl: "https://example.com" })),
  buildSeoOpportunities: vi.fn(() => []),
}));
vi.mock("@/lib/google/auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/google/auth")>(),
  readGoogleRequestConfig: vi.fn(() => ({})),
}));
vi.mock("@/lib/google/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/google/client")>(),
  fetchGa4OrganicReport: vi.fn(async () => ({ propertyId: "123" })),
  fetchGscSearchReport: vi.fn(async () => ({ siteUrl: "https://example.com" })),
}));
vi.mock("@/lib/keywords/client", () => ({ fetchKeywordReport: vi.fn(async (seed: string) => ({ seed, suggestions: [], fetches: [{ source: "google", status: "unavailable" }] })) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("自動化APIでは明示指定時だけ候補を取得し、部分失敗も診断と一緒に返す", async () => {
  vi.stubEnv("AUTOMATION_API_KEY", "test-key");
  const request = (keywordSeeds?: string[]) => new NextRequest("https://example.com/api/automation/seo-report", {
    method: "POST",
    headers: { authorization: "Bearer test-key", "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", keywordSeeds }),
  });
  const defaultReport = await (await POST(request())).json();
  expect(defaultReport).not.toHaveProperty("keywordResearch");
  expect(fetchKeywordReport).not.toHaveBeenCalled();
  const response = await POST(request(["IoT", "IoT"]));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ audit: { entryUrl: "https://example.com" }, ga4: { propertyId: "123" }, keywordResearch: [{ seed: "IoT", fetches: [{ status: "unavailable" }] }] });
  expect(fetchKeywordReport).toHaveBeenCalledTimes(1);
  expect(fetchKeywordReport).toHaveBeenCalledWith("IoT", false, expect.any(AbortSignal));
});
