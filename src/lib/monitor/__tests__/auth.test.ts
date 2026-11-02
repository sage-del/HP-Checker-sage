import { describe, expect, it } from "vitest";
import { checkBasicAuth, safeEqual } from "../auth";
import { splitBudget } from "../run";

describe("auth", () => {
  const basic = (s: string) => `Basic ${Buffer.from(s).toString("base64")}`;

  it("compares strings safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("checks basic auth, including non-ASCII passwords and colons", () => {
    expect(checkBasicAuth(basic("admin:pass"), "admin", "pass")).toBe(true);
    expect(checkBasicAuth(basic("admin:pa:ss"), "admin", "pa:ss")).toBe(true);
    expect(checkBasicAuth(basic("admin:パスワード"), "admin", "パスワード")).toBe(true);
    expect(checkBasicAuth(basic("admin:wrong"), "admin", "pass")).toBe(false);
    expect(checkBasicAuth(basic("root:pass"), "admin", "pass")).toBe(false);
    expect(checkBasicAuth(basic("nocolon"), "admin", "pass")).toBe(false);
    expect(checkBasicAuth("Bearer x", "admin", "pass")).toBe(false);
    expect(checkBasicAuth("Basic !!!", "admin", "pass")).toBe(false);
    expect(checkBasicAuth(null, "admin", "pass")).toBe(false);
  });

});


describe("manual run budget", () => {
  it("keeps crawling and link checking within the requested budget", () => {
    expect(splitBudget(270_000)).toEqual({ crawlMs: 210_000, linkMs: 45_000 });
    const small = splitBudget(60_000);
    expect(small.crawlMs + small.linkMs).toBeLessThanOrEqual(60_000);
  });
});
