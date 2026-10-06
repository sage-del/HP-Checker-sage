import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

const originalUser = process.env.BASIC_AUTH_USER;
const originalPassword = process.env.BASIC_AUTH_PASSWORD;

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalUser === undefined) delete process.env.BASIC_AUTH_USER;
  else process.env.BASIC_AUTH_USER = originalUser;
  if (originalPassword === undefined) delete process.env.BASIC_AUTH_PASSWORD;
  else process.env.BASIC_AUTH_PASSWORD = originalPassword;
});

describe("proxy automation authentication", () => {
  it("automation API は専用Bearer認証へ渡し、通常画面はBasic認証で保護する", () => {
    process.env.BASIC_AUTH_USER = "admin";
    process.env.BASIC_AUTH_PASSWORD = "monitor-password";

    const automation = proxy(
      new NextRequest("https://example.com/api/automation/seo-report", {
        headers: { authorization: "Bearer automation-key" },
      }),
    );
    expect(automation.status).toBe(200);
    expect(automation.headers.get("x-middleware-next")).toBe("1");

    const page = proxy(new NextRequest("https://example.com/"));
    expect(page.status).toBe(401);
    expect(page.headers.get("www-authenticate")).toContain("Basic");
  });
});


describe("Google分析画面のアクセス制限", () => {
  it("本番でパスワードがないと画面とAPIを止め、公開診断は利用できる", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.BASIC_AUTH_PASSWORD;
    for (const path of ["/analytics/gsc", "/analytics/ga4", "/api/analytics/report"]) {
      expect(proxy(new NextRequest(`https://example.com${path}`)).status).toBe(503);
    }
    expect(proxy(new NextRequest("https://example.com/")).status).toBe(200);
    expect(proxy(new NextRequest("https://example.com/api/automation/seo-report")).status).toBe(200);
  });
});
