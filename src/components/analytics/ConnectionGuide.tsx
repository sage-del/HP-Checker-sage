import Link from "next/link";
import { Badge } from "@/components/ui";
export interface AnalyticsConnection {
  gsc: { configured: boolean; message: string };
  ga4: { configured: boolean; message: string };
  protected: boolean;
}
export function ConnectionGuide({ connection, sample = false }: { connection: AnalyticsConnection; sample?: boolean }) {
  return (
    <details
      className="rounded-xl border border-line bg-panel p-5"
      open={!sample && !connection.gsc.configured && !connection.ga4.configured}
    >
      <summary className="cursor-pointer text-sm font-bold text-ink">
        連携を準備する <span className="ml-2 text-[12px] font-normal text-muted">設定 → 閲覧権限 → 接続確認</span>
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["gsc", "ga4"] as const).map((source) => (
          <div key={source} className="rounded-lg bg-surface p-3">
            <div className="flex items-center gap-2">
              <strong className="text-sm">{source.toUpperCase()}</strong>
              <Badge tone={connection[source].configured ? "info" : "warn"}>
                {connection[source].configured ? "設定済み" : "準備中"}
              </Badge>
            </div>
            <p className="mt-2 text-[12px] text-muted">{connection[source].message}</p>
          </div>
        ))}
      </div>
      <ol className="mt-4 grid gap-4 text-[13px] leading-relaxed md:grid-cols-3">
        <li>
          <strong className="text-accent">01 · データを読めるようにする</strong>
          <p className="mt-1 text-muted">
            Google CloudでAnalytics Data API・Search Console
            APIを有効化します。GA4の閲覧者、GSCのユーザーに、連携用サービスアカウントを追加します。
          </p>
        </li>
        <li>
          <strong className="text-accent">02 · ツール側の連携を設定</strong>
          <p className="mt-1 text-muted">
            既存のGoogle認証、GA4プロパティID、GSCプロパティを設定します。片方のみの連携でも、それぞれの指標を確認できます。
          </p>
        </li>
        <li>
          <strong className="text-accent">03 · 主要な成果を決める</strong>
          <p className="mt-1 text-muted">
            問い合わせ送信完了などをGA4のキーイベントに設定します。不明なら、連携後の「GA4 ·
            行動の計測」からイベント名を確認しましょう。
          </p>
        </li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-4 text-[12px] font-bold text-accent">
        <Link href="/settings#google">設定の状態を確認 →</Link>
        <a href="https://support.google.com/analytics/answer/10737381?hl=ja" target="_blank" rel="noopener noreferrer">
          GA4とGSCの公式連携手順 ↗
        </a>
        <a href="https://support.google.com/analytics/answer/12946393?hl=ja" target="_blank" rel="noopener noreferrer">
          主要成果の設定手順 ↗
        </a>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        このツールは両APIから入口ページを照合します。GA4管理画面のGSCリンク設定は任意です。
        {!connection.protected && "本番で分析データを表示するには、設定でアクセス制限を有効にしてください。"}
      </p>
    </details>
  );
}
