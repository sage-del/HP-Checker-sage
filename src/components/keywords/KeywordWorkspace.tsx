"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Callout, Field, Input } from "@/components/ui";
import { keywordBrief, keywordCsv } from "@/lib/keywords/model";
import { SOURCE_LABELS, type KeywordReport } from "@/lib/keywords/types";

const intents = ["すべて", "費用・比較", "導入・運用", "疑問・基礎知識", "要確認"];

export function KeywordWorkspace({ initialSeed = "" }: { initialSeed?: string }) {
  const [seed, setSeed] = useState(initialSeed);
  const [expanded, setExpanded] = useState(false);
  const [report, setReport] = useState<KeywordReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("すべて");
  const [selected, setSelected] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function search(event: FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setReport(null);
    setSelected([]);
    setError("");
    setNotice("");
    setFilter("すべて");
    try {
      const params = new URLSearchParams({ q: seed, expanded: String(expanded) });
      const response = await fetch(`/api/keywords?${params}`, { signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "検索候補を取得できませんでした。");
      if (!abort.signal.aborted) setReport(data as KeywordReport);
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "接続できませんでした。");
    } finally {
      if (controller.current === abort) setBusy(false);
    }
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob(["\uFEFF", keywordCsv(report)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `keyword-suggestions-${report.generatedAt.slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyBrief() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(keywordBrief(report, selected));
      setNotice("選択した候補を使った改善依頼文をコピーしました。");
    } catch {
      setNotice("コピーできませんでした。下の依頼文を選択してコピーしてください。");
    }
  }

  const visible = report?.suggestions.filter((s) => filter === "すべて" || s.intent === filter) ?? [];
  const failed = report?.fetches.filter((f) => f.status === "unavailable") ?? [];
  const allFailed = !!report && failed.length === report.fetches.length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <h1 className="text-2xl font-bold text-ink">検索候補 · 無料キーワード調査</h1>
      <p className="mt-2 text-sm text-muted">サービス名や訪問者の疑問を入力し、Google・Bingの検索候補からページに追加する内容を検討できます。</p>

      <form onSubmit={search} className="my-6 space-y-4 rounded-xl border border-line bg-panel p-5">
        <Field htmlFor="keyword-seed" label="調べたいキーワード" hint="例：バッテリー監視、非常用電源 遠隔監視、IoT システム開発">
          <Input id="keyword-seed" value={seed} onChange={(e) => setSeed(e.target.value)} maxLength={80} required disabled={busy} placeholder="サービス名や関連する疑問" />
        </Field>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={expanded} onChange={(e) => setExpanded(e.target.checked)} disabled={busy} className="mt-1" />
          「費用」「導入」「とは」を付けて追加調査する
        </label>
        <p className="text-xs text-muted">入力した語句をGoogle・Bingに送信します。APIキー・有料サービスの契約は不要です。取得結果は最大24時間キャッシュされます。</p>
        <Button type="submit" loading={busy}>{busy ? "検索候補を取得中…" : "検索候補を取得"}</Button>
      </form>
      {error && <Callout tone="fail" title="取得できませんでした">{error}</Callout>}

      {report && (
        <section aria-labelledby="keyword-results" className="space-y-5">
          <div>
            <h2 id="keyword-results" className="text-xl font-bold">「{report.seed}」の検索候補</h2>
            <p className="mt-1 text-xs text-muted">取得実行：{new Date(report.generatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間） · 重複をまとめて{report.suggestions.length}件</p>
          </div>
          <Callout tone="info" title="候補を選び、実データで確かめる">
            検索候補は検索数や人気順を示しません。分類と内容づくりのヒントは語句からの目安です。自社と無関係な候補を除き、<Link href="/analytics/gsc" className="font-bold underline">GSCの表示回数・掲載順位</Link>と実際の検索結果を確認して優先順位を決めてください。
          </Callout>
          {failed.length > 0 && <Callout tone="warn" title={allFailed ? "検索候補を取得できませんでした" : "一部の取得元に接続できませんでした"}>未取得：{failed.map((f) => `${SOURCE_LABELS[f.source]}「${f.query}」`).join("、")}。時間をおいて再度お試しください。</Callout>}
          <details className="rounded-lg border border-line bg-panel p-3 text-sm">
            <summary className="cursor-pointer font-bold">取得元ごとの状況</summary>
            <ul className="mt-2 space-y-1 text-muted">{report.fetches.map((f) => <li key={`${f.source}:${f.query}`}>{SOURCE_LABELS[f.source]} · {f.query}：{f.status === "unavailable" ? "未取得" : f.status === "empty" ? "候補なし（取得成功）" : `${f.count}件取得`}</li>)}</ul>
          </details>
          {report.suggestions.length === 0 && !allFailed && <p className="text-sm text-muted">取得できた情報源には候補がありませんでした。需要がないとは判断できません。別の表現でも調べてください。</p>}
          {report.suggestions.length > 0 && <>
            <div className="flex flex-wrap items-end gap-3">
              <Field htmlFor="keyword-filter" label="分類のヒントで絞り込む">
                <select id="keyword-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-lg border border-line bg-panel px-3 text-sm">{intents.map((i) => <option key={i}>{i}</option>)}</select>
              </Field>
              <Button variant="secondary" onClick={download}>候補をCSV保存</Button>
              <a href={`https://trends.google.com/trends/explore?geo=JP&q=${encodeURIComponent(report.seed)}`} target="_blank" rel="noopener noreferrer" className="py-2 text-sm font-bold text-accent underline">Google Trendsで傾向を確認 ↗</a>
            </div>
            <p className="text-xs text-muted">元の応答順で表示しています。検索候補に含まれることだけで、自社の強みや検索意図に合うとは限りません。</p>
            <div className="space-y-3">{visible.map((s) => (
              <article key={s.keyword} className="rounded-xl border border-line bg-panel p-4">
                <label className="flex items-start gap-3 font-bold text-ink">
                  <input type="checkbox" checked={selected.includes(s.keyword)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, s.keyword] : prev.filter((k) => k !== s.keyword))} className="mt-1" />
                  <span className="min-w-0 break-words">{s.keyword}</span>
                </label>
                <p className="mt-2 text-xs text-muted">取得元：{s.sources.map((p) => SOURCE_LABELS[p]).join(" / ")} · {s.intent} · 検索数：未取得</p>
                <p className="mt-2 text-sm text-ink">{s.advice}</p>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(s.keyword)}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-accent underline">検索結果を確認 ↗</a>
              </article>
            ))}</div>
            {visible.length === 0 && <p className="text-sm text-muted">この分類の候補はありません。</p>}
            <section className="rounded-xl border border-line bg-panel p-5" aria-labelledby="keyword-brief">
              <h3 id="keyword-brief" className="font-bold">選んだ候補を改善案にする（{selected.length}件）</h3>
              <p className="my-2 text-sm text-muted">候補を選ぶと、確認事項を含めた改善依頼文を作成できます。</p>
              <Button onClick={copyBrief} disabled={selected.length === 0}>改善依頼文をコピー</Button>
              {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
              {selected.length > 0 && <textarea aria-label="改善依頼文" readOnly value={keywordBrief(report, selected)} rows={8} className="mt-3 w-full rounded-lg border border-line p-3 text-sm" />}
            </section>
          </>}
        </section>
      )}
    </main>
  );
}
