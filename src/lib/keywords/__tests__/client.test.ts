import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchKeywordReport, parseSuggestions } from "../client";
import { keywordBrief, keywordCsv, normalizeSeed } from "../model";

afterEach(() => vi.unstubAllGlobals());

describe("無料検索候補の取得", () => {
  it("取得元を残して表記違いをまとめ、検索数を作らない", async () => {
    const fetcher = vi.fn(async (url: URL) => Response.json(["IoT", url.hostname.startsWith("suggest") ? ["ＩｏＴ 費用", "IoT 導入"] : ["iot 費用", "IoT とは"]]));
    vi.stubGlobal("fetch", fetcher);
    const report = await fetchKeywordReport("IoT", false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(report.suggestions).toHaveLength(3);
    expect(report.suggestions[0]).toMatchObject({ keyword: "IoT 費用", sources: ["google", "bing"], intent: "費用・比較" });
    expect(report.suggestions[0]).not.toHaveProperty("volume");
    expect(keywordCsv(report)).toContain("未取得");
    const brief = keywordBrief(report, ["IoT とは"]);
    expect(brief).toContain("IoT とは");
    expect(brief).not.toContain("- IoT 導入");
    expect(brief).toContain("検索数・需要・自社への適合は未確認");
  });

  it("空の成功と通信・形式エラーを区別し、部分取得を保持する", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => url.hostname.startsWith("suggest") ? Response.json(["IoT", []]) : new Response("blocked", { status: 429 })));
    const empty = await fetchKeywordReport("IoT", false);
    expect(empty.fetches.map((f) => f.status)).toEqual(["empty", "unavailable"]);
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => url.hostname.startsWith("suggest") ? Response.json({ changed: true }) : Response.json(["IoT", ["IoT 導入"]])));
    const partial = await fetchKeywordReport("IoT", false);
    expect(partial.fetches.map((f) => f.status)).toEqual(["unavailable", "ok"]);
    expect(partial.suggestions[0].sources).toEqual(["bing"]);
  });

  it("追加調査でも固定された送信先に最大8件だけ送り、認証情報は送らない", async () => {
    const fetcher = vi.fn(async () => Response.json(["IoT", []]));
    vi.stubGlobal("fetch", fetcher);
    await fetchKeywordReport("IoT & 電源", true);
    expect(fetcher).toHaveBeenCalledTimes(8);
    for (const [url, init] of fetcher.mock.calls as unknown as [URL, RequestInit][]) {
      expect(["suggestqueries.google.com", "api.bing.com"]).toContain(url.hostname);
      expect(url.searchParams.get("q") ?? url.searchParams.get("query")).toContain("IoT & 電源");
      expect(init.headers).toEqual({ Accept: "application/json" });
      expect(init.redirect).toBe("error");
    }
  });

  it("中断された調査を成功として返さない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("aborted"); }));
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(fetchKeywordReport("IoT", false, controller.signal)).rejects.toThrow("cancelled");
  });

  it("不正な入力・候補を拒否し、CSVの数式を無効化する", async () => {
    expect(() => normalizeSeed(" ")).toThrow();
    expect(() => normalizeSeed("a".repeat(81))).toThrow();
    expect(() => parseSuggestions(["IoT", [42]])).toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(["IoT", ["=1+1", "a".repeat(121), "\u0000bad"]])));
    const report = await fetchKeywordReport("IoT", false);
    expect(report.suggestions).toHaveLength(1);
    expect(keywordCsv(report)).toContain("'=1+1");
  });
});
