"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Field, Input } from "@/components/ui";
import { ConnectionGuide, type AnalyticsConnection } from "./ConnectionGuide";
import { ImprovementPlan } from "./ImprovementPlan";
import {
  buildPageInsights,
  change,
  pageIdentity,
  percent,
  type AnalyticsReport,
  type AnalyticsSource,
  type PageInsight,
} from "@/lib/analytics/model";
import { demoReport } from "@/lib/analytics/demo";

export interface AnalyticsConditions {
  startDate: string;
  endDate: string;
  keyEvent: string;
  device: string;
  comparisonEndDate?: string;
}
const reportCache = new Map<string, { data: AnalyticsReport; sample: boolean }>();
const conditionKey = (value: AnalyticsConditions) =>
  JSON.stringify([value.startDate, value.endDate, value.keyEvent, value.device, value.comparisonEndDate ?? ""]);
function conditionParams(value: AnalyticsConditions) {
  const params = new URLSearchParams({
    startDate: value.startDate,
    endDate: value.endDate,
    keyEvent: value.keyEvent,
    device: value.device,
  });
  if (value.comparisonEndDate) params.set("comparisonEndDate", value.comparisonEndDate);
  return params;
}
const number = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("ja-JP"));
const buckets: Array<{ kind: PageInsight["kind"] | "all"; label: string }> = [
  { kind: "all", label: "すべて" },
  { kind: "conversion", label: "成果につなげる" },
  { kind: "growth", label: "集客を伸ばす" },
  { kind: "maintain", label: "強みを展開" },
  { kind: "review", label: "役割を見直す" },
  { kind: "observe", label: "確認・蓄積" },
];
function safePageLabel(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

export function AnalyticsWorkspace({
  source,
  connection,
  initial,
  initialPage = "",
}: {
  source: AnalyticsSource;
  connection: AnalyticsConnection;
  initial: AnalyticsConditions;
  initialPage?: string;
}) {
  const [conditions, setConditions] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [data, setData] = useState<AnalyticsReport | null>(() => reportCache.get(conditionKey(initial))?.data ?? null);
  const [sample, setSample] = useState(() => reportCache.get(conditionKey(initial))?.sample ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedUrl, setSelectedUrl] = useState(initialPage);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("priority");
  const [brand, setBrand] = useState("");
  const [queryMode, setQueryMode] = useState("all");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const pages = useMemo(() => buildPageInsights(data?.gsc.current ?? null, data?.ga4.current ?? null), [data]);
  const selected = pages.find((p) => p.url === selectedUrl) ?? pages[0];
  const visiblePages = pages
    .filter(
      (p) =>
        (filter === "all" || p.kind === filter) && safePageLabel(p.url).toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "sessions"
        ? (b.visit?.sessions ?? -1) - (a.visit?.sessions ?? -1)
        : sort === "impressions"
          ? (b.search?.impressions ?? -1) - (a.search?.impressions ?? -1)
          : b.priority - a.priority,
    );
  const gsc = data?.gsc.current;
  const ga4 = data?.ga4.current;
  const queryTerms = brand
    .split(/[,、\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const queries =
    gsc?.queryPages
      .filter((q) => pageIdentity(q.page) === pageIdentity(selected?.url ?? ""))
      .filter((q) => {
        if (queryMode === "all" || !queryTerms.length) return true;
        const branded = queryTerms.some((term) => q.query.toLowerCase().includes(term));
        return queryMode === "brand" ? branded : !branded;
      }) ?? [];
  const href = (tab: AnalyticsSource) => {
    const params = conditionParams(applied);
    if (selectedUrl) params.set("page", selectedUrl);
    return `/analytics/${tab}?${params.toString()}`;
  };
  async function load(next = conditions) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    setNotice("");
    setSample(false);
    setData(null);
    try {
      const response = await fetch(`/api/analytics/report?${conditionParams(next).toString()}`, {
        cache: "no-store",
        signal: abort.signal,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "取得できませんでした。");
      setData(json as AnalyticsReport);
      setApplied(next);
      reportCache.clear();
      reportCache.set(conditionKey(next), { data: json as AnalyticsReport, sample: false });
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "取得できませんでした。");
    } finally {
      if (controller.current === abort) setLoading(false);
    }
  }
  function demo() {
    controller.current?.abort();
    setLoading(false);
    const example = demoReport();
    setSample(true);
    setData(example);
    setError("");
    setNotice("");
    const next = { ...example.dateRange, keyEvent: example.keyEvent, device: example.device };
    setConditions(next);
    setApplied(next);
    setSelectedUrl("");
    reportCache.clear();
    reportCache.set(conditionKey(next), { data: example, sample: true });
  }
  function select(page: PageInsight) {
    setSelectedUrl(page.url);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
  function compareAfter(date: string) {
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time)) return;
    const end = new Date(time + 28 * 86400000).toISOString().slice(0, 10);
    const availableEnd = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    if (end > availableEnd) {
      setNotice(
        `改善後28日が揃う ${new Date(time + 31 * 86400000).toISOString().slice(0, 10)} ごろに比較できます。それまでは期間を変えて経過を確認してください。`,
      );
      return;
    }
    const next = {
      ...conditions,
      startDate: new Date(time + 86400000).toISOString().slice(0, 10),
      endDate: end,
      comparisonEndDate: new Date(time - 86400000).toISOString().slice(0, 10),
    };
    setConditions(next);
    if (sample) {
      setNotice("サンプルの数値は固定です。実データを取得すると、改善前後28日の比較を表示します。");
      return;
    }
    void load(next);
  }
  const totals =
    source === "gsc"
      ? [
          {
            label: "検索で見つかった回数",
            value: number(gsc?.totals.impressions),
            delta: gsc ? change(gsc.totals.impressions, data?.gsc.previous?.totals.impressions) : "表示回数",
          },
          {
            label: "検索から選ばれた回数",
            value: number(gsc?.totals.clicks),
            delta: gsc ? change(gsc.totals.clicks, data?.gsc.previous?.totals.clicks) : "クリック数",
          },
          { label: "表示からクリックへ", value: percent(gsc?.totals.ctr), delta: "クリック率（CTR）" },
          {
            label: "検索結果での位置",
            value: gsc ? gsc.totals.position.toFixed(1) : "—",
            delta: "平均掲載順位・低いほど上位",
          },
        ]
      : [
          {
            label: "Google検索からの訪問",
            value: number(ga4?.totals.sessions),
            delta: ga4 ? change(ga4.totals.sessions, data?.ga4.previous?.totals.sessions) : "セッション数",
          },
          {
            label: data?.keyEvent ? "選んだ成果の発生回数" : "全キーイベントの回数",
            value: number(ga4?.totals.keyEvents),
            delta: ga4
              ? change(ga4.totals.keyEvents, data?.ga4.previous?.totals.keyEvents)
              : "主要成果の選択で絞れます",
          },
          {
            label: "成果が起きた訪問の割合",
            value: percent(ga4?.totals.sessionKeyEventRate),
            delta: "セッション キーイベント レート",
          },
          { label: "関心のある訪問の割合", value: percent(ga4?.totals.engagementRate), delta: "エンゲージメント率" },
        ];
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <header className="mb-6">
        <p className="text-[11px] font-bold tracking-widest text-accent">検索 → 訪問 → 成果 → 改善</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">
              {source === "gsc" ? "検索で選ばれるページへ" : "検索からの訪問を、事業の成果へ"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {source === "gsc"
                ? "順位だけを追う前に、誰のどんな疑問に答えるか。入口ページを選び、訪問後の成果も見ながら次の改善を決めましょう。"
                : "アクセス数の先にある、製品への関心・資料請求・問い合わせ。どの入口ページの、どの案内を直すかを考えましょう。"}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={demo}>
            サンプルで操作を試す
          </Button>
        </div>
      </header>
      <nav aria-label="Google分析" className="mb-5 flex gap-2 border-b border-line pb-3">
        {(["gsc", "ga4"] as const).map((tab) => (
          <Link
            key={tab}
            href={href(tab)}
            aria-current={source === tab ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === source ? "bg-accent text-on-brand" : "bg-panel text-muted hover:text-accent"}`}
          >
            {tab === "gsc" ? "GSC · 検索の改善" : "GA4 · 訪問と成果"}
          </Link>
        ))}
      </nav>
      <ol className="mb-5 grid gap-2 sm:grid-cols-4" aria-label="改善の進め方">
        {[
          "改善するページを3つ選ぶ",
          "検索意図と内容を確かめる",
          "導線を見直し変更を記録",
          "改善前後の成果を比べる",
        ].map((text, i) => (
          <li key={text} className="rounded-lg border border-line bg-panel p-3">
            <span className="text-[11px] font-bold text-accent">STEP {i + 1}</span>
            <p className="mt-1 text-[12px] font-bold">{text}</p>
          </li>
        ))}
      </ol>
      <ConnectionGuide connection={connection} sample={sample} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="mt-5 rounded-xl border border-line bg-panel p-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field htmlFor="analytics-start" label="開始日">
            <Input
              id="analytics-start"
              type="date"
              required
              value={conditions.startDate}
              onChange={(e) =>
                setConditions({ ...conditions, startDate: e.target.value, comparisonEndDate: undefined })
              }
            />
          </Field>
          <Field htmlFor="analytics-end" label="終了日">
            <Input
              id="analytics-end"
              type="date"
              required
              value={conditions.endDate}
              onChange={(e) => setConditions({ ...conditions, endDate: e.target.value, comparisonEndDate: undefined })}
            />
          </Field>
          <Field htmlFor="analytics-device" label="デバイス">
            <select
              id="analytics-device"
              className="h-11 w-full rounded-lg border border-line bg-panel px-3 text-sm"
              value={conditions.device}
              onChange={(e) => setConditions({ ...conditions, device: e.target.value })}
            >
              <option value="all">すべて</option>
              <option value="desktop">パソコン</option>
              <option value="mobile">スマートフォン</option>
              <option value="tablet">タブレット</option>
            </select>
          </Field>
          <Field htmlFor="analytics-event" label="主要な成果イベント" hint="不明なら空欄で始められます">
            <Input
              id="analytics-event"
              placeholder="例：generate_lead"
              value={conditions.keyEvent}
              onChange={(e) => setConditions({ ...conditions, keyEvent: e.target.value })}
            />
          </Field>
          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={!connection.gsc.configured && !connection.ga4.configured}
            >
              同じ条件でデータを取得
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          GA4は google /
          organic、GSCはウェブ検索。国はどちらもすべて。既定は3日前までの28日間、前期間は同じ長さで比較します。GSCの日付は太平洋時間、GA4はプロパティのタイムゾーンです。
        </p>
      </form>
      {loading && (
        <p role="status" className="mt-4 text-sm text-accent">
          検索・訪問・成果を取得しています。片方が取得できなくても、取得できた指標を表示します。
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-fail bg-fail-soft p-4 text-sm text-fail">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-lg bg-accent-soft p-4 text-sm text-accent">
          {notice}
        </p>
      )}
      {sample && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-warn bg-warn-soft p-4 text-[13px] font-bold text-ink"
        >
          操作説明用のサンプルです。実サイトの数値・成果ではありません。期間や成果の変更を反映するには、実データを取得してください。
        </div>
      )}
      {data && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          <span>対象：{gsc?.siteUrl ?? `GA4 プロパティ ${ga4?.propertyId ?? "未取得"}`}</span>
          <span>
            {data.dateRange.startDate}〜{data.dateRange.endDate}
          </span>
          <span>
            比較：{data.previousRange.startDate}〜{data.previousRange.endDate}
          </span>
          <span>成果：{data.keyEvent || "未選択（全キーイベント）"}</span>
        </div>
      )}
      {data &&
        (["gsc", "ga4"] as const).map((s) => (
          <div key={s}>
            {data[s].error && (
              <p role="alert" className="mt-3 rounded-lg bg-warn-soft p-3 text-[13px]">
                {s.toUpperCase()}：{data[s].error}
              </p>
            )}
            {data[s].comparisonError && (
              <p className="mt-2 text-[12px] text-muted">
                {s.toUpperCase()}の前期間は取得できませんでした：{data[s].comparisonError}
              </p>
            )}
          </div>
        ))}
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-panel p-5">
            <dt className="text-[12px] font-bold text-muted">{item.label}</dt>
            <dd className="mt-3 text-3xl font-bold tabular-nums text-ink">{item.value}</dd>
            <p className="mt-2 text-[11px] text-muted">{item.delta}</p>
          </div>
        ))}
      </dl>
      {!data && (
        <div className="mt-5 rounded-xl border border-dashed border-accent/30 bg-accent-soft/30 p-6">
          <h2 className="text-base font-bold">まずは、改善するページを決めるところから</h2>
          <p className="mt-2 text-sm text-muted">
            データを取得すると、検索状況と訪問後の成果を並べた候補が表示されます。サンプルでは「ページ選択 → 仮説 →
            Codexへの依頼 → 変更記録 → 比較」の流れを体験できます。
          </p>
          <Button className="mt-4" size="sm" onClick={demo}>
            改善の流れをサンプルで見る
          </Button>
        </div>
      )}
      {data && (
        <>
          {(gsc?.limited || ga4?.limited) && (
            <p className="mt-3 text-[12px] text-muted">
              取得できた上位200ページを表示しています。全ページを網羅するものではありません。検索語句・ページの組み合わせも取得上限があります。
            </p>
          )}
          {ga4?.dataQuality?.map((message) => (
            <p key={message} className="mt-2 text-[12px] text-warn">
              {message}
            </p>
          ))}
          {ga4 && (!data.keyEvent || ga4.totals.keyEvents === 0) && (
            <div className="mt-4 rounded-lg bg-warn-soft p-4 text-[13px]">
              {!data.keyEvent
                ? "主要な成果が未選択です。全キーイベントの回数には補助的な行動も含まれるため、問い合わせの成果とは扱いません。GA4タブで測定中のイベントを確認しましょう。"
                : "選んだ成果の回数が0です。導線を評価する前に、キーイベントの設定と送信完了の計測を確認しましょう。"}
            </div>
          )}
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">最初に確認したい3ページ</h2>
                <p className="mt-1 text-[12px] text-muted">検索需要とページ別の成果から、改善仮説を立てる候補です。</p>
              </div>
              <span className="text-[11px] text-muted">候補の選定基準は下部で確認できます</span>
            </div>
            {pages.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {pages.slice(0, 3).map((page, i) => (
                  <button
                    key={page.url}
                    onClick={() => select(page)}
                    className={`rounded-xl border bg-panel p-5 text-left transition hover:border-accent focus-visible:outline-accent ${page.url === selected?.url ? "border-accent" : "border-line"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-accent">候補 {i + 1}</span>
                      <Badge tone={page.kind === "maintain" ? "pass" : page.kind === "conversion" ? "warn" : "info"}>
                        {page.label}
                      </Badge>
                    </div>
                    <p className="mt-3 break-all text-sm font-bold">{safePageLabel(page.url)}</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-muted">{page.reason}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
                      <span>
                        検索クリック <strong>{number(page.search?.clicks)}</strong>
                      </span>
                      <span>
                        訪問 <strong>{number(page.visit?.sessions)}</strong>
                      </span>
                      <span>
                        成果率 <strong>{percent(page.visit?.sessionKeyEventRate)}</strong>
                      </span>
                    </div>
                    <p className="mt-3 text-[12px] font-bold text-accent">このページを確認 →</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-panel p-5 text-sm text-muted">
                この条件のページデータはありません。期間・デバイス・プロパティを確認してください。GA4のホスト名や入口ページが
                (not set) の行は照合対象に含めません。
              </p>
            )}
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-bold">入口ページ別に、次の改善を選ぶ</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {buckets.map((b) => (
                <button
                  key={b.kind}
                  type="button"
                  aria-pressed={filter === b.kind}
                  onClick={() => setFilter(b.kind)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${filter === b.kind ? "border-accent bg-accent-soft text-accent" : "border-line bg-panel text-muted"}`}
                >
                  {b.label} · {b.kind === "all" ? pages.length : pages.filter((p) => p.kind === b.kind).length}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Field htmlFor="page-search" label="ページを探す" className="min-w-48 flex-1">
                <Input
                  id="page-search"
                  value={search}
                  placeholder="URLの一部を入力"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <Field htmlFor="page-sort" label="並び順">
                <select
                  id="page-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-11 rounded-lg border border-line bg-panel px-3 text-sm"
                >
                  <option value="priority">改善候補順</option>
                  <option value="sessions">訪問が多い順</option>
                  <option value="impressions">検索で見つかる順</option>
                </select>
              </Field>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-panel">
              <table className="w-full min-w-[760px] text-[12px]">
                <thead className="bg-surface text-left text-muted">
                  <tr>
                    {[
                      "入口ページ / 改善の方向",
                      "表示回数",
                      "クリック",
                      "CTR",
                      "訪問",
                      data.keyEvent ? "成果回数" : "全キーイベント",
                      "成果率",
                      "",
                    ].map((label, i) => (
                      <th key={i} className="px-3 py-3 font-bold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiblePages.map((page) => (
                    <tr
                      key={page.url}
                      className={`border-t border-line ${selected?.url === page.url ? "bg-accent-soft/30" : ""}`}
                    >
                      <td className="max-w-80 px-3 py-3">
                        <p className="break-all font-bold">{safePageLabel(page.url)}</p>
                        <p className="mt-1 text-[11px] text-accent">{page.label}</p>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{number(page.search?.impressions)}</td>
                      <td className="px-3 py-3 tabular-nums">{number(page.search?.clicks)}</td>
                      <td className="px-3 py-3">{percent(page.search?.ctr)}</td>
                      <td className="px-3 py-3">{number(page.visit?.sessions)}</td>
                      <td className="px-3 py-3">{number(page.visit?.keyEvents)}</td>
                      <td className="px-3 py-3">{percent(page.visit?.sessionKeyEventRate)}</td>
                      <td className="px-3 py-3">
                        <button
                          className="whitespace-nowrap font-bold text-accent hover:underline"
                          onClick={() => select(page)}
                          aria-label={`${safePageLabel(page.url)}を確認`}
                        >
                          確認 →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visiblePages.length && (
                <p className="p-5 text-[13px] text-muted">この絞り込みに一致するページはありません。</p>
              )}
            </div>
          </section>
          {selected && (
            <section ref={detailRef} className="mt-8 scroll-mt-4 rounded-xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-accent">選択中の入口ページ</p>
                  <h2 className="mt-1 break-all text-lg font-bold">{safePageLabel(selected.url)}</h2>
                </div>
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-bold text-accent hover:underline"
                >
                  実際のページを開く ↗
                </a>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{selected.reason}</p>
              {source === "gsc" ? (
                <>
                  <div className="mt-5 flex flex-wrap items-end gap-3">
                    <Field
                      htmlFor="brand-terms"
                      label="指名検索の語句"
                      hint="社名・製品名をカンマ区切りで入力"
                      className="flex-1"
                    >
                      <Input
                        id="brand-terms"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="例：会社名, 製品名"
                      />
                    </Field>
                    <Field htmlFor="query-mode" label="検索語句の表示">
                      <select
                        id="query-mode"
                        className="h-11 rounded-lg border border-line bg-panel px-3 text-sm"
                        value={queryMode}
                        onChange={(e) => setQueryMode(e.target.value)}
                      >
                        <option value="all">すべて</option>
                        <option value="brand" disabled={!queryTerms.length}>
                          指名検索
                        </option>
                        <option value="nonbrand" disabled={!queryTerms.length}>
                          課題・用途の検索
                        </option>
                      </select>
                    </Field>
                  </div>
                  <h3 className="mt-5 text-sm font-bold">このページに求められている情報</h3>
                  <p className="mt-1 text-[12px] text-muted">
                    検索語句から訪問者の疑問を読み取り、本文が答えているか確認します。
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[500px] text-[12px]">
                      <thead className="border-b border-line text-left text-muted">
                        <tr>
                          {["検索語句", "表示", "クリック", "CTR 前→今回", "順位 前→今回", "確認すること"].map((t) => (
                            <th key={t} className="px-2 py-2">
                              {t}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queries.slice(0, 30).map((q) => {
                          const previous = data.gsc.previous?.queryPages.find(
                            (old) => old.query === q.query && pageIdentity(old.page) === pageIdentity(q.page),
                          );
                          return (
                            <tr key={`${q.query}|${q.page}`} className="border-b border-line">
                              <td className="px-2 py-3 font-bold">
                                {q.query}
                                <Link href={`/keywords?q=${encodeURIComponent(q.query)}`} className="mt-1 block text-xs font-normal text-accent underline">関連する検索候補を調べる</Link>
                              </td>
                              <td className="px-2 py-3">{number(q.impressions)}</td>
                              <td className="px-2 py-3">{number(q.clicks)}</td>
                              <td className="whitespace-nowrap px-2 py-3">
                                {percent(previous?.ctr)} → {percent(q.ctr)}
                              </td>
                              <td className="whitespace-nowrap px-2 py-3">
                                {previous ? previous.position.toFixed(1) : "—"} → {q.position.toFixed(1)}
                              </td>
                              <td className="px-2 py-3 text-muted">
                                {q.impressions >= 100 && q.ctr < 0.03 && q.position <= 20
                                  ? "タイトルで内容が伝わるか"
                                  : "この疑問に本文で答えているか"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!queries.length && (
                      <p className="py-4 text-[13px] text-muted">
                        このページの検索語句は取得範囲内にありません。匿名化・取得上限の影響があり、検索需要がないとは判断できません。
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-muted">
                    上位30語句を表示。CTRは同じ語句・デバイスで、平均順位の変化も併せて比較します。語句の絞り込みはこの一覧に適用します。GA4の成果はページ単位の指標で、各検索語句の成果ではありません。
                  </p>
                </>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      title: "訪問数も合わせて見る",
                      value: `${number(selected.visit?.sessions)} 回`,
                      text: "少ない訪問で高い成果率が出ても、期間を広げて確認します。",
                    },
                    {
                      title: "主要成果の回数",
                      value: `${number(selected.visit?.keyEvents)} 回`,
                      text: data.keyEvent
                        ? `対象は ${data.keyEvent}。ボタンクリックと送信完了を区別します。`
                        : "主要成果を選ぶと、問い合わせなどに絞れます。",
                    },
                    {
                      title: "成果が起きた訪問の割合",
                      value: percent(selected.visit?.sessionKeyEventRate),
                      text: "成果回数 ÷ 訪問数ではなく、GA4のセッション キーイベント レートです。",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-lg bg-surface p-4">
                      <h3 className="text-[12px] font-bold">{item.title}</h3>
                      <p className="mt-2 text-xl font-bold">{item.value}</p>
                      <p className="mt-2 text-[12px] leading-relaxed text-muted">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
              <ImprovementPlan
                key={`${sample}:${selected.url}`}
                page={selected}
                report={data}
                sample={sample}
                onCompare={compareAfter}
              />
              <PageComparison page={selected} data={data} />
            </section>
          )}
          {source === "ga4" && (
            <section className="mt-8 rounded-xl border border-line bg-panel p-5">
              <h2 className="text-lg font-bold">行動の計測を確認する</h2>
              <p className="mt-1 text-[13px] text-muted">
                製品への関心 → 問い合わせへの案内 → フォーム入力 →
                送信完了。まず、必要な行動が測定されているか確認します。
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "製品への関心", event: "view_item", hint: "記事から適切な製品へ案内できているか" },
                  {
                    label: "問い合わせへの案内",
                    event: "contact_click",
                    hint: "仕様・用途・実績が相談の判断材料になるか",
                  },
                  { label: "フォーム入力", event: "form_start", hint: "入力項目やスマホでの操作に問題がないか" },
                  {
                    label: "送信完了",
                    event: data.keyEvent || "generate_lead",
                    hint: "クリックと送信完了を別々に測定しているか",
                  },
                ].map((step, i) => {
                  const measured = ga4?.eventCounts?.find((e) => e.name === step.event);
                  return (
                    <div key={i} className="rounded-lg bg-surface p-4">
                      <p className="text-[11px] font-bold text-accent">確認 {i + 1}</p>
                      <h3 className="mt-1 text-sm font-bold">{step.label}</h3>
                      <p className="mt-2 text-xl font-bold">{measured ? `${number(measured.count)} 回` : "未確認"}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-muted">{step.event}</p>
                      <p className="mt-2 text-[12px] text-muted">{step.hint}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted">
                上記は計測の確認例です。イベント名はサイトの実装により異なります。表示回数はサイト全体の行動回数で、同じ訪問者の順序や離脱率を表すファネルではありません。経路・離脱の分析はGA4の経路データ探索と併せて確認します。
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] font-bold text-accent">
                  測定されたイベント一覧から、主要な成果を探す
                </summary>
                <p className="mt-2 text-[12px] text-muted">
                  送信完了に対応するイベントをGA4でキーイベントに設定してから選択してください。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ga4?.eventCounts?.map((event) => (
                    <button
                      key={event.name}
                      className="rounded-lg border border-line px-3 py-2 text-[12px] hover:border-accent"
                      onClick={() => {
                        setConditions({ ...conditions, keyEvent: event.name });
                        setNotice(
                          `${event.name} を条件に入力しました。キーイベントへの登録を確認し、「同じ条件でデータを取得」を押してください。`,
                        );
                      }}
                    >
                      <span className="font-mono">{event.name}</span> · {number(event.count)}回
                    </button>
                  ))}
                </div>
                {!ga4?.eventCounts?.length && (
                  <p className="mt-3 text-[12px] text-muted">この条件のイベントは取得できていません。</p>
                )}
              </details>
            </section>
          )}
        </>
      )}
      <details className="mt-8 rounded-xl border border-line bg-panel p-5">
        <summary className="cursor-pointer text-sm font-bold">数字の読み方と、候補の選定基準</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[12px] leading-relaxed text-muted">
          <li>GSCのクリックとGA4のセッションは測定方法・対象範囲が異なり、一致しません。変化の傾向を比較します。</li>
          <li>
            成果を含む分類は主要成果が選択され、全体に成果があり、30訪問以上のページで行います。50訪問以上で全体の成果率を下回るページは導線の確認候補です。これらは実務上の目安です。
          </li>
          <li>
            平均順位4〜20位、表示100回以上の検索語句を集客改善の候補とします。CTR
            3%未満は見せ方の確認目安です。Google公式の合格基準ではなく、語句・デバイス・近い順位で検証します。
          </li>
          <li>
            入口ページはホスト・パス・クエリで照合します。計測用パラメータ（utm_、gclid等）と通信方式は区別せず、サブドメインや末尾スラッシュ、意味のあるクエリは保持します。GSCのcanonical
            URLとGA4の実URLが異なる場合は照合できません。
          </li>
          <li>
            検索語句には匿名化されたデータがあります。短い滞在時間だけで悪いページと判断せず、目的に合う行動・成果と併せて確認します。
          </li>
          <li>
            前後比較だけで改善の効果を断定しません。季節性、計測・同意設定、未変更の類似ページ、前年同時期も確認します。
          </li>
        </ul>
      </details>
    </main>
  );
}

function PageComparison({ page, data }: { page: PageInsight; data: AnalyticsReport }) {
  const previousPage = buildPageInsights(data.gsc.previous, data.ga4.previous).find(
    (p) => pageIdentity(p.url) === pageIdentity(page.url),
  );
  const metrics: Array<{ label: string; current?: number | null; previous?: number | null; rate?: boolean }> = [
    { label: "検索クリック", current: page.search?.clicks, previous: previousPage?.search?.clicks },
    { label: "Google検索の訪問", current: page.visit?.sessions, previous: previousPage?.visit?.sessions },
    {
      label: data.keyEvent ? "選んだ成果の回数" : "全キーイベント回数",
      current: page.visit?.keyEvents,
      previous: previousPage?.visit?.keyEvents,
    },
    {
      label: "成果が起きた訪問の割合",
      current: page.visit?.sessionKeyEventRate,
      previous: previousPage?.visit?.sessionKeyEventRate,
      rate: true,
    },
  ];
  const clickChange = page.search && previousPage?.search ? page.search.clicks - previousPage.search.clicks : null;
  const sessionChange =
    page.visit && previousPage?.visit && previousPage.visit.sessions > 0
      ? page.visit.sessions / previousPage.visit.sessions - 1
      : null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold">改善前後の変化を、成果まで確認する</h3>
      <p className="mt-1 text-[12px] text-muted">
        {data.previousRange.startDate}〜{data.previousRange.endDate} → {data.dateRange.startDate}〜
        {data.dateRange.endDate}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg bg-surface p-4">
            <p className="text-[12px] font-bold">{metric.label}</p>
            <p className="mt-2 text-lg font-bold">
              {metric.rate ? percent(metric.previous) : number(metric.previous)} →{" "}
              {metric.rate ? percent(metric.current) : number(metric.current)}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {metric.current == null
                ? "現在値未取得"
                : metric.rate && metric.previous != null
                  ? `${((metric.current - metric.previous) * 100).toFixed(1)} ポイント`
                  : change(metric.current, metric.previous)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-muted">
        {clickChange != null && clickChange >= 0 && sessionChange != null && sessionChange < -0.3
          ? "検索クリックが減っていないのに訪問数が大きく減っています。SEO施策の前にGA4の計測・同意設定を確認しましょう。"
          : "クリックが増えても成果が増えない場合は、増えた検索語句とページ内容・問い合わせ導線を確認しましょう。"}{" "}
        前期間の上位ページに含まれない値は「—」で表示し、0として扱いません。
      </p>
    </div>
  );
}
