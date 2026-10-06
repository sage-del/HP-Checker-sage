"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import {
  companySiteServerSnapshot,
  normalizeCompanySiteUrl,
  readCompanySiteUrl,
  saveCompanySiteUrl,
  subscribeCompanySite,
} from "@/lib/settings/company-site";

export function CompanySiteSettings() {
  const saved = useSyncExternalStore(subscribeCompanySite, readCompanySiteUrl, companySiteServerSnapshot);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage("");
    let normalized: string;
    try {
      normalized = normalizeCompanySiteUrl(draft ?? saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "URLを確認してください。");
      return;
    }
    try {
      saveCompanySiteUrl(normalized);
      setDraft(null);
      setMessage("自社サイトのURLを保存しました。");
    } catch {
      setError("保存できませんでした。ブラウザの保存設定を確認してください。");
    }
  }

  function remove() {
    setError(null);
    setMessage("");
    try {
      saveCompanySiteUrl("");
      setDraft(null);
      setMessage("自社サイトの登録を解除しました。");
    } catch {
      setError("登録を解除できませんでした。ブラウザの保存設定を確認してください。");
    }
  }

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(
        `サイト健診の自動化APIを使って、${saved} のサイト診断・GA4・GSCを取得し、SEO改善の優先順位を調べてください。未取得のデータは推測せず、サイトの修正はまだ行わないでください。`,
      );
      setMessage("分析依頼をコピーしました。Codexに貼り付けてください。");
    } catch {
      setMessage("コピーできませんでした。登録したURLをCodexへの依頼に貼り付けてください。");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <form onSubmit={save} noValidate>
        <Field
          label="自社サイトのURL"
          htmlFor="company-site-url"
          hint="登録したURLは、サイト診断画面に自動入力されます。"
          error={error}
        >
          <Input
            id="company-site-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com/"
            maxLength={2048}
            value={draft ?? saved}
            invalid={Boolean(error)}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
              setMessage("");
            }}
          />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">保存する</Button>
          <Button variant="secondary" disabled={!saved} onClick={remove}>登録を解除</Button>
        </div>
      </form>
      {saved && (
        <div className="mt-4 border-t border-line pt-4 text-[13px]">
          <p className="text-muted">登録中のサイト</p>
          <a href={saved} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-bold text-accent hover:underline">
            {saved}
          </a>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href="/" className="font-bold text-accent hover:underline">サイト診断へ →</Link>
            <Button variant="secondary" size="sm" onClick={copyRequest}>Codexへの分析依頼をコピー</Button>
          </div>
        </div>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        このブラウザに保存されます。別の端末やブラウザには共有されません。登録だけでは診断を開始しません。
      </p>
      <p role="status" className="mt-2 text-[13px] text-accent">{message}</p>
    </div>
  );
}
