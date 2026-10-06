import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAnalytics, safeAnalyticsError } from "../server";
import { fetchGa4OrganicReport, fetchGscSearchReport, GoogleApiError } from "@/lib/google/client";
import { demoReport } from "../demo";
vi.mock("@/lib/google/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/google/auth")>();
  return { ...original, readGoogleConfig: vi.fn(() => ({})) };
});
vi.mock("@/lib/google/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/google/client")>();
  return {
    ...original,
    fetchGa4OrganicReport: vi.fn(),
    fetchGscSearchReport: vi.fn(),
    fetchGa4Events: vi.fn(async () => []),
  };
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
describe("片方の失敗と比較の欠測", () => {
  it("GA4の失敗でもGSCを返し、前期間の失敗を0に置き換えない", async () => {
    vi.mocked(fetchGa4OrganicReport).mockRejectedValue(new GoogleApiError("ga4", 403, "非公開のAPI診断"));
    vi.mocked(fetchGscSearchReport)
      .mockResolvedValueOnce(demoReport().gsc.current!)
      .mockRejectedValueOnce(new Error("secret-internal-error"));
    const data = await loadAnalytics({ startDate: "2026-09-01", endDate: "2026-09-28" });
    expect(data.gsc.current?.totals.clicks).toBe(585);
    expect(data.gsc.previous).toBeNull();
    expect(data.gsc.comparisonError).toBeTruthy();
    expect(data.ga4.current).toBeNull();
    expect(data.ga4.error).toContain("閲覧権限");
    expect(JSON.stringify(data)).not.toContain("secret-internal-error");
  });
  it("空欄を明示した場合は既定の主要成果を選択しない", async () => {
    vi.stubEnv("GA4_PRIMARY_KEY_EVENT", "generate_lead");
    vi.mocked(fetchGa4OrganicReport).mockRejectedValue(new Error("未接続"));
    vi.mocked(fetchGscSearchReport).mockRejectedValue(new Error("未接続"));
    const data = await loadAnalytics({ keyEvent: "" });
    expect(data.keyEvent).toBe("");
    expect(fetchGa4OrganicReport).toHaveBeenCalledWith(expect.anything(), expect.anything(), 200, undefined, { keyEvent: undefined, device: undefined });
  });

  it("入力の誤りはAPI取得前に拒否する", async () => {
    await expect(loadAnalytics({ keyEvent: "bad:event" })).rejects.toThrow("イベント名");
    await expect(loadAnalytics({ device: "unknown" })).rejects.toThrow("デバイス");
    expect(fetchGa4OrganicReport).not.toHaveBeenCalled();
    expect(safeAnalyticsError(new Error("token=secret"))).not.toContain("secret");
  });
});
