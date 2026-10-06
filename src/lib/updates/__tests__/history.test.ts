import { describe, expect, it } from "vitest";
import { formatUpdateTime, groupUpdatesByDay, type DevelopmentCommit } from "../history";

const commit = (sha: string, date: string): DevelopmentCommit => ({ sha, date, author: "製作者", title: "改善", body: "" });

describe("開発履歴の日本時間での表示", () => {
  it("UTCの日付境界をまたぐ更新を日本時間でまとめ、新しい順に並べる", () => {
    const older = commit("older", "2026-10-01T14:59:00Z");
    const midnight = commit("midnight", "2026-10-01T15:00:00Z");
    const later = commit("later", "2026-10-02T03:00:00Z");
    const input = [older, midnight, later];
    expect(groupUpdatesByDay(input)).toEqual([
      { day: "2026-10-02", entries: [later, midnight] },
      { day: "2026-10-01", entries: [older] },
    ]);
    expect(input).toEqual([older, midnight, later]);
    expect(formatUpdateTime(midnight.date)).toBe("00:00");
  });

  it("異なるオフセットも同じ日時として扱う", () => {
    expect(groupUpdatesByDay([
      commit("jst", "2026-10-02T12:00:00+09:00"),
      commit("utc", "2026-10-02T03:00:00Z"),
    ])).toHaveLength(1);
    expect(groupUpdatesByDay([])).toEqual([]);
  });
});
