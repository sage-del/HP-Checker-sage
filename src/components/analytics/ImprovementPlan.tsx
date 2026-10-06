"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button, Field, Input } from "@/components/ui";
import type { PageInsight, AnalyticsReport } from "@/lib/analytics/model";
import { percent } from "@/lib/analytics/model";

interface Plan {
  hypothesis: string;
  actions: boolean[];
  changedAt: string;
  note: string;
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("seo-plan-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("seo-plan-changed", callback);
  };
}
function readSaved(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
const empty: Plan = { hypothesis: "", actions: [], changedAt: "", note: "" };
export function ImprovementPlan({
  page,
  report,
  sample,
  onCompare,
}: {
  page: PageInsight;
  report: AnalyticsReport;
  sample: boolean;
  onCompare: (date: string) => void;
}) {
  const key = `site-kenshin:seo-plan:v1:${sample ? "sample" : "live"}:${report.gsc.current?.siteUrl ?? report.ga4.current?.propertyId}:${page.url}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => readSaved(key),
    () => null,
  );
  const saved = useMemo(() => {
    try {
      const value = JSON.parse(raw || "null") as Plan | null;
      return value &&
        typeof value.hypothesis === "string" &&
        Array.isArray(value.actions) &&
        typeof value.changedAt === "string" &&
        typeof value.note === "string"
        ? value
        : empty;
    } catch {
      return empty;
    }
  }, [raw]);
  const [unsaved, setUnsaved] = useState<Plan | null>(null);
  const plan = unsaved ?? saved;
  const [message, setMessage] = useState("");
  function update(next: Plan) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setUnsaved(null);
      window.dispatchEvent(new Event("seo-plan-changed"));
      setMessage("このブラウザに保存しました。");
    } catch {
      setUnsaved(next);
      setMessage("ブラウザに保存できませんでした。必要な内容をコピーして残してください。");
    }
  }
  async function copyRequest() {
    const text = [
      sample ? "サイト健診のサンプルを使って、SEO改善の進め方を相談したいです。" : "サイト健診でSEO改善の分析をお願いします。",
      `対象ページ: ${page.url}`,
      `期間: ${report.dateRange.startDate}〜${report.dateRange.endDate}（前期間: ${report.previousRange.startDate}〜${report.previousRange.endDate}）`,
      `GA4の対象: google / organic、デバイス: ${report.device}`,
      `主要成果: ${report.keyEvent || "未選択。計測する主要成果から相談したい"}`,
      `GSC: 表示${page.search?.impressions ?? "未取得"}回、クリック${page.search?.clicks ?? "未取得"}回、CTR ${percent(page.search?.ctr)}`,
      `GA4: 訪問${page.visit?.sessions ?? "未取得"}回、${report.keyEvent ? "選んだ成果" : "全キーイベント"}${page.visit?.keyEvents ?? "未取得"}回、セッション成果率 ${percent(page.visit?.sessionKeyEventRate)}`,
      `仮説: ${plan.hypothesis || page.reason}`,
      sample
        ? "上記は画面説明用のサンプルです。実サイトの分析根拠には使用せず、実サイトへのアクセスやAPI取得は行わないでください。サンプルを題材に、改善仮説・確認の手順・検証方法を説明してください。"
        : "利用可能なサイト健診の自動化APIで技術診断・GSC・GA4を取得し、入口ページ単位で照合してください。CLIの --start-date / --end-date / --device / --key-event（主要成果が選択されている場合）を使い、対象期間と前期間をそれぞれ取得してください。検索意図とページ本文を確認し、事業に合う改善を3つまで優先順位付きで提案してください。検索語句別の問い合わせ数や未取得のデータは推測せず、訪問数が少ないページは判断を保留してください。修正はまだ行わず、改善仮説・根拠・具体的な修正案・検証方法を提示してください。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage("依頼文をコピーしました。Codexに貼り付けて分析を依頼できます。");
    } catch {
      setMessage("コピーできませんでした。ブラウザのクリップボード権限を確認してください。");
    }
  }
  return (
    <div className="mt-5 rounded-xl border border-accent/25 bg-accent-soft/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">このページの改善を進める</h3>
          <p className="mt-1 text-[12px] text-muted">仮説 → ページ確認 → 改善 → 同じ長さの期間で検証</p>
        </div>
        <Button size="sm" onClick={copyRequest}>
          Codexへの分析依頼をコピー
        </Button>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <Field htmlFor="hypothesis" label="1 · 解消したい訪問者の疑問・改善仮説">
            <textarea
              id="hypothesis"
              value={plan.hypothesis}
              onChange={(e) => update({ ...plan, hypothesis: e.target.value })}
              placeholder="例：費用を知りたい人に、見積もり条件の説明が不足している"
              className="min-h-24 w-full rounded-lg border border-line bg-panel p-3 text-sm"
            />
          </Field>
          <fieldset className="mt-4">
            <legend className="text-[13px] font-bold">2 · ページを確認して改善する</legend>
            <ul className="mt-2 space-y-2">
              {page.actions.map((action, i) => (
                <li key={action}>
                  <label className="flex items-start gap-2 text-[13px] leading-relaxed">
                    <input
                      type="checkbox"
                      className="mt-1 accent-accent"
                      checked={Boolean(plan.actions[i])}
                      onChange={(e) => {
                        const actions = [...plan.actions];
                        actions[i] = e.target.checked;
                        update({ ...plan, actions });
                      }}
                    />
                    {action}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
        <div>
          <Field htmlFor="improvement-note" label="3 · 実施した変更を記録">
            <textarea
              id="improvement-note"
              value={plan.note}
              onChange={(e) => update({ ...plan, note: e.target.value })}
              placeholder="変更したタイトル、追加した説明、見直した導線など"
              className="min-h-24 w-full rounded-lg border border-line bg-panel p-3 text-sm"
            />
          </Field>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field htmlFor="changed-date" label="改善を公開した日">
              <Input
                id="changed-date"
                type="date"
                value={plan.changedAt}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => update({ ...plan, changedAt: e.target.value })}
              />
            </Field>
            <Button variant="secondary" size="sm" disabled={!plan.changedAt} onClick={() => onCompare(plan.changedAt)}>
              4 · 改善前後28日を比較
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            記録はこのブラウザ内に保存されます。チーム間では共有されません。比較時は公開日の翌日から28日と、公開前28日を使います。
          </p>
        </div>
      </div>
      <p role="status" className="mt-3 text-[12px] text-accent">
        {message}
      </p>
    </div>
  );
}
