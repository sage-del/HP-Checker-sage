import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "src/data/development-history.json");
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// ソースZIPなど .git のない環境では、同梱した履歴を使う。
try {
  git(["rev-parse", "--verify", "HEAD"]);
} catch {
  if (!fs.existsSync(output)) throw new Error("更新履歴がありません。Gitのある環境で npm run history:update を実行してください。");
  console.warn("Git履歴を取得できないため、同梱した開発・更新履歴を使います。");
  process.exit(0);
}

// NUL区切りで本文の改行・引用符をそのまま保つ。作者のメールアドレスは収録しない。
const fields = git(["log", "-100", "--format=%H%x00%cI%x00%an%x00%s%x00%b%x00"]).split("\0");
const commits = [];
for (let i = 0; i + 4 < fields.length; i += 5) {
  commits.push({ sha: fields[i].trim(), date: fields[i + 1], author: fields[i + 2], title: fields[i + 3], body: fields[i + 4].trim().replace(/\n\n(?=(?:Co-Authored-By|Claude-Session|Signed-off-by):)[\s\S]*$/i, "").trim() });
}
const data = {
  revision: git(["rev-parse", "HEAD"]),
  shallow: git(["rev-parse", "--is-shallow-repository"]) === "true",
  commits,
};
fs.writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`);
console.log(`開発・更新履歴を生成しました（${commits.length}件）。`);
