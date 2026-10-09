import { keywordHint, keywordKey, normalizeSeed } from "./model";
import type { KeywordReport, KeywordSuggestion, SuggestionSource } from "./types";

const SOURCES: SuggestionSource[] = ["google", "bing"];

export function suggestionUrl(source: SuggestionSource, query: string): URL {
  const url = new URL(source === "google" ? "https://suggestqueries.google.com/complete/search" : "https://api.bing.com/osjson.aspx");
  if (source === "google") {
    url.searchParams.set("client", "firefox");
    url.searchParams.set("hl", "ja");
    url.searchParams.set("q", query);
  } else {
    url.searchParams.set("market", "ja-JP");
    url.searchParams.set("query", query);
  }
  return url;
}

export function parseSuggestions(data: unknown): string[] {
  if (!Array.isArray(data) || !Array.isArray(data[1]) || data[1].some((s: unknown) => typeof s !== "string")) {
    throw new Error("検索候補の応答形式が変更されています。");
  }
  return [...new Set((data[1] as string[]).map((s) => s.normalize("NFKC").replace(/\s+/g, " ").trim()).filter((s) => s.length > 0 && s.length <= 120 && !/[\u0000-\u001f\u007f]/.test(s)))].slice(0, 20);
}

export async function fetchKeywordReport(seedInput: string, expanded: boolean, signal?: AbortSignal): Promise<KeywordReport> {
  const seed = normalizeSeed(seedInput);
  // 利用者が実行したときだけ、基本2件・追加調査でも最大8件に限定する。
  const queries = expanded ? [seed, `${seed} 費用`, `${seed} 導入`, `${seed} とは`] : [seed];
  const fetched = await Promise.all(queries.flatMap((query) => SOURCES.map(async (source) => {
    try {
      const response = await fetch(suggestionUrl(source, query), {
        headers: { Accept: "application/json" },
        redirect: "error",
        next: { revalidate: 86400 },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error("検索候補を取得できませんでした。");
      const suggestions = parseSuggestions(await response.json());
      return { source, query, suggestions, status: suggestions.length ? "ok" as const : "empty" as const };
    } catch {
      return { source, query, suggestions: [], status: "unavailable" as const };
    }
  })));
  if (signal?.aborted) throw signal.reason;
  const merged = new Map<string, KeywordSuggestion>();
  for (const row of fetched) {
    for (const keyword of row.suggestions) {
      const key = keywordKey(keyword);
      const existing = merged.get(key);
      if (existing) {
        if (!existing.sources.includes(row.source)) existing.sources.push(row.source);
        if (!existing.queries.includes(row.query)) existing.queries.push(row.query);
      } else {
        merged.set(key, { keyword, sources: [row.source], queries: [row.query], ...keywordHint(keyword) });
      }
    }
  }
  return {
    seed,
    generatedAt: new Date().toISOString(),
    expanded,
    suggestions: [...merged.values()],
    fetches: fetched.map(({ source, query, status, suggestions }) => ({ source, query, status, count: suggestions.length })),
  };
}
