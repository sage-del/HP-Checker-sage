import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../route";
import { fetchKeywordReport } from "@/lib/keywords/client";

vi.mock("@/lib/keywords/client", () => ({ fetchKeywordReport: vi.fn(async () => ({ seed: "IoT", suggestions: [], fetches: [{ source: "google", status: "unavailable" }] })) }));
afterEach(() => vi.clearAllMocks());

it("不正入力は外部アクセス前に拒否する", async () => {
  for (const path of ["", "?q=", "?q=IoT&expanded=wrong", `?q=${"a".repeat(81)}`]) {
    expect((await GET(new NextRequest(`https://example.com/api/keywords${path}`))).status).toBe(400);
  }
  expect(fetchKeywordReport).not.toHaveBeenCalled();
});

it("未取得状態も利用者に返し、ブラウザーキャッシュには残さない", async () => {
  const response = await GET(new NextRequest("https://example.com/api/keywords?q=IoT&expanded=true"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toMatchObject({ suggestions: [], fetches: [{ status: "unavailable" }] });
  expect(fetchKeywordReport).toHaveBeenCalledWith("IoT", true, expect.any(AbortSignal));
});
