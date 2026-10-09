import type { Metadata } from "next";
import { KeywordWorkspace } from "@/components/keywords/KeywordWorkspace";

export const metadata: Metadata = { title: "検索候補 · 無料キーワード調査" };

export default async function KeywordsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const seed = typeof params.q === "string" && params.q.length <= 80 ? params.q : "";
  return <KeywordWorkspace initialSeed={seed} />;
}
