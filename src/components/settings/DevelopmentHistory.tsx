import history from "@/data/development-history.json";
import { systemArchitecture } from "@/lib/system/architecture";
import { formatUpdateTime, groupUpdatesByDay } from "@/lib/updates/history";

export function DevelopmentHistory() {
  const groups = groupUpdatesByDay(history.commits);
  const repositoryUrl = `https://github.com/${systemArchitecture.repository.name}`;
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <p className="text-sm font-bold text-ink">開発・改善の記録</p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        使いやすさを整える改善、不具合の修正、新しい機能の追加。その積み重ねを、制作に関わった人たちのGitHubの記録からたどれます。
        小さな見直しや試行錯誤も含めて、開発の歩みをご覧ください。
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <p className="text-muted">収録した更新 {history.commits.length} 件 · {groups.length} 日分 · 日本時間（JST）</p>
        <a href={`${repositoryUrl}/commits/${systemArchitecture.repository.branch}`} target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">GitHubで最新の履歴を見る ↗</a>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        この公開版に含まれる直近最大100件のコミットを表示しています。履歴はデプロイ時に更新されます。
        {history.shallow && "ビルド環境で取得できた範囲の履歴です。"}
        GitHubの閲覧には、リポジトリへのアクセス権が必要な場合があります。
      </p>
      {groups.length === 0 ? <p className="mt-6 text-[13px] text-muted">更新履歴はまだありません。</p> : (
        <div className="mt-6 space-y-6">
          {groups.map(({ day, entries }) => (
            <section key={day} aria-label={`${day}の更新`}>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-ink"><time dateTime={day}>{day.replaceAll("-", "/")}</time></h3>
                <span className="text-[12px] text-muted">{entries.length} 件の更新</span>
              </div>
              <ol className="mt-3 space-y-4 border-l-2 border-line pl-4">
                {entries.map((commit) => (
                  <li key={commit.sha}>
                    <p className="break-words text-[13px] font-bold leading-relaxed text-ink">{commit.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                      <time dateTime={commit.date}>{formatUpdateTime(commit.date)}</time>
                      <span className="break-all">{commit.author}</span>
                      <a href={`${repositoryUrl}/commit/${commit.sha}`} target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline" aria-label={`${commit.title}の変更をGitHubで見る`}>変更を見る ↗ <span className="font-mono">{commit.sha.slice(0, 7)}</span></a>
                    </div>
                    {commit.body && (
                      <details className="mt-2 text-[12px] text-muted">
                        <summary className="cursor-pointer font-bold text-accent">更新の背景・詳細</summary>
                        <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{commit.body}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
