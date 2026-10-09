import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "../seo-report/route";

const names = [
  "AUTOMATION_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GA4_PROPERTY_ID",
  "GSC_SITE_URL",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_WORKLOAD_IDENTITY_AUDIENCE",
  "VERCEL_OIDC_TOKEN",
] as const;
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of names) {
    const value = original[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function request(method: "GET" | "POST", token?: string, body?: string) {
  return new NextRequest("http://localhost/api/automation/seo-report", {
    method,
    headers: token ? { authorization: `Bearer ${token}`, "content-type": "application/json" } : undefined,
    body: method === "POST" ? body : undefined,
  });
}

describe("/api/automation/seo-report", () => {
  it("APIキー未設定は503、不一致は401", async () => {
    delete process.env.AUTOMATION_API_KEY;
    expect((await GET(request("GET"))).status).toBe(503);

    process.env.AUTOMATION_API_KEY = "correct-key";
    expect((await GET(request("GET", "wrong-key"))).status).toBe(401);
  });

  it("認証済みGETでGoogle連携の設定状態を返す", async () => {
    process.env.AUTOMATION_API_KEY = "correct-key";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "seo-reader@example-project.iam.gserviceaccount.com",
      private_key: ["-----BEGIN PRIVATE", " KEY-----\\nTEST\\n-----END PRIVATE", " KEY-----\\n"].join(""),
    });
    process.env.GA4_PROPERTY_ID = "123456789";
    process.env.GSC_SITE_URL = "sc-domain:example.com";

    const response = await GET(request("GET", "correct-key"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ready: true,
      authMode: "service-account-key",
      ga4PropertyId: "123456789",
      gscSiteUrl: "sc-domain:example.com",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("認証後も壊れたJSONをGoogle APIより前に400で拒否する", async () => {
    process.env.AUTOMATION_API_KEY = "correct-key";
    const response = await POST(request("POST", "correct-key", "{not json"));
    expect(response.status).toBe(400);
  });

  it("検索候補の不正な入力は外部APIより前に拒否する", async () => {
    process.env.AUTOMATION_API_KEY = "correct-key";
    for (const keywordSeeds of ["IoT", ["a", "b", "c", "d"], [""], [42]]) {
      const response = await POST(request("POST", "correct-key", JSON.stringify({ url: "https://example.com", keywordSeeds })));
      expect(response.status).toBe(400);
    }
  });

  it("環境変数にトークンがなくても実行時ヘッダーで設定を確認し、秘密値を返さない", async () => {
    process.env.AUTOMATION_API_KEY = "correct-key";
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.VERCEL_OIDC_TOKEN;
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "reader@example-project.iam.gserviceaccount.com";
    process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE = "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/pool/providers/provider";
    process.env.GA4_PROPERTY_ID = "123456789";
    process.env.GSC_SITE_URL = "https://example.com/";
    const req = request("GET", "correct-key");
    req.headers.set("x-vercel-oidc-token", "private-runtime-token");
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ ready: true, authMode: "workload-identity" });
    expect(body).not.toContain("private-runtime-token");
  });
});
