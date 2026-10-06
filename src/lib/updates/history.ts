export interface DevelopmentCommit {
  sha: string;
  date: string;
  author: string;
  title: string;
  body: string;
}

const dayFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });

export function formatUpdateTime(date: string): string {
  return timeFormatter.format(new Date(date));
}

/** ホストの時差に左右されず、日本時間の日付で新しい順にまとめる。 */
export function groupUpdatesByDay(commits: readonly DevelopmentCommit[]) {
  const groups = new Map<string, DevelopmentCommit[]>();
  for (const commit of [...commits].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))) {
    const day = dayFormatter.format(new Date(commit.date));
    const entries = groups.get(day) ?? [];
    entries.push(commit);
    groups.set(day, entries);
  }
  return [...groups].map(([day, entries]) => ({ day, entries }));
}
