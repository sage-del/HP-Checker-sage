"use server";

/**
 * 監視画面のサーバーアクション（フォームの送信先）。
 * アクセス制限は proxy.ts が全リクエストの手前で掛ける。
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPublicHost, FetchError, normalizeUrl } from "@/lib/analyzer/fetch";
import { getDb } from "@/lib/monitor/db";
import {
  addSite,
  deleteSite,
  DuplicateSiteError,
  markAlertRead,
  markAllAlertsRead,
  updateSite,
} from "@/lib/monitor/store";

export interface AddSiteState {
  error?: string;
}

const MAX_NAME = 60;

export async function addSiteAction(_prev: AddSiteState, form: FormData): Promise<AddSiteState> {
  const rawUrl = String(form.get("url") ?? "");

  let url: URL;
  try {
    url = normalizeUrl(rawUrl);
    await assertPublicHost(url);
  } catch (err) {
    return { error: err instanceof FetchError ? err.message : "URL を確認してください" };
  }
  const name = String(form.get("name") ?? "").trim().slice(0, MAX_NAME) || url.hostname;

  let id: number;
  try {
    id = (await addSite(await getDb(), { url: url.toString(), name })).id;
  } catch (err) {
    if (err instanceof DuplicateSiteError) return { error: err.message };
    throw err;
  }
  revalidatePath("/monitor", "layout");
  // 登録したサイトの詳細へ（そこで「今すぐ診断」できる）
  redirect(`/monitor/sites/${id}`);
}

function idOf(form: FormData): number {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid id");
  return id;
}

export async function updateSiteAction(form: FormData): Promise<void> {
  const id = idOf(form);
  const patch: Parameters<typeof updateSite>[2] = {};
  const name = form.get("name");
  if (typeof name === "string" && name.trim()) patch.name = name.trim().slice(0, MAX_NAME);
  await updateSite(await getDb(), id, patch);
  revalidatePath("/monitor", "layout");
}

export async function deleteSiteAction(form: FormData): Promise<void> {
  await deleteSite(await getDb(), idOf(form));
  revalidatePath("/monitor", "layout");
  redirect("/monitor");
}

export async function markAlertReadAction(form: FormData): Promise<void> {
  await markAlertRead(await getDb(), idOf(form));
  revalidatePath("/monitor", "layout");
}

export async function markAllAlertsReadAction(): Promise<void> {
  await markAllAlertsRead(await getDb());
  revalidatePath("/monitor", "layout");
}
