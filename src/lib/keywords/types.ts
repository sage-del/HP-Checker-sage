export type SuggestionSource = "google" | "bing";
export type KeywordIntent = "費用・比較" | "導入・運用" | "疑問・基礎知識" | "要確認";

export interface KeywordSuggestion {
  keyword: string;
  sources: SuggestionSource[];
  queries: string[];
  intent: KeywordIntent;
  advice: string;
}

export interface SuggestionFetch {
  source: SuggestionSource;
  query: string;
  status: "ok" | "empty" | "unavailable";
  count: number;
}

export interface KeywordReport {
  seed: string;
  generatedAt: string;
  expanded: boolean;
  suggestions: KeywordSuggestion[];
  fetches: SuggestionFetch[];
}

export const SOURCE_LABELS: Record<SuggestionSource, string> = { google: "Google", bing: "Bing" };
