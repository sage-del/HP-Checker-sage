import { csvCell } from "@/lib/report/csv";
import { SOURCE_LABELS, type KeywordIntent, type KeywordReport } from "./types";

export function normalizeSeed(value: unknown): string {
  if (typeof value !== "string") throw new Error("検索キーワードを入力してください。");
  const seed = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!seed || seed.length > 80 || /[\u0000-\u001f\u007f]/.test(seed)) {
    throw new Error("検索キーワードは1〜80文字で入力してください。");
  }
  return seed;
}

export const keywordKey = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ja-JP");

/** 語句に含まれる表現からの分類。検索意図を確定したり需要を推計したりしない。 */
export function keywordHint(keyword: string): { intent: KeywordIntent; advice: string } {
  if (/費用|料金|価格|見積|比較|おすすめ|cost|price/i.test(keyword)) {
    return { intent: "費用・比較", advice: "費用を左右する条件や比較ポイントを、確認できた事実で説明する。" };
  }
  if (/導入|設置|運用|設定|システム|装置|ユニット|system/i.test(keyword)) {
    return { intent: "導入・運用", advice: "対応設備・導入手順・運用方法を説明し、相談時の確認事項を示す。" };
  }
  if (/とは|なぜ|方法|仕組み|意味|what|how/i.test(keyword)) {
    return { intent: "疑問・基礎知識", advice: "冒頭で疑問に答え、仕組みや用途を具体例とともに説明する。" };
  }
  return { intent: "要確認", advice: "検索結果を確認し、自社のサービスと対象者に合う語句か判断する。" };
}

export function keywordCsv(report: KeywordReport): string {
  const rows = [
    ["検索候補", "取得元", "取得時の検索語句", "分類のヒント", "内容づくりのヒント", "取得実行日時", "検索数"],
    ...report.suggestions.map((s) => [s.keyword, s.sources.map((p) => SOURCE_LABELS[p]).join(" / "), s.queries.join(" / "), s.intent, s.advice, report.generatedAt, "未取得"]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function keywordBrief(report: KeywordReport, selected: string[]): string {
  const rows = report.suggestions.filter((s) => selected.includes(s.keyword));
  return [
    `「${report.seed}」のページ改善を検討してください。`,
    `取得実行日時: ${report.generatedAt}`,
    "以下は検索候補であり、検索数・需要・自社への適合は未確認です。GSCと実際の検索結果を確認してから優先順位を判断してください。",
    ...rows.map((s) => `- ${s.keyword}（${s.sources.map((p) => SOURCE_LABELS[p]).join(" / ")}）: ${s.advice}`),
    "既存ページとの重複を確認し、未確認の費用・性能・実績を創作せず、まず改善案を作成してください。",
  ].join("\n");
}
