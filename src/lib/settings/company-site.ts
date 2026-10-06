const STORAGE_KEY = "site-kenshin:company-site:v1";
const CHANGED_EVENT = "company-site-changed";

export function normalizeCompanySiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) {
    throw new Error("自社サイトのURLを入力してください（2048文字以内）。");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("https:// または http:// で始まるURLを入力してください。");
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname) {
    throw new Error("https:// または http:// で始まるURLを入力してください。");
  }
  if (url.username || url.password) {
    throw new Error("ユーザー名やパスワードを含まないURLを入力してください。");
  }
  url.hash = "";
  return url.href;
}

export function readCompanySiteUrl(): string {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? normalizeCompanySiteUrl(value) : "";
  } catch {
    return "";
  }
}

export function companySiteServerSnapshot(): string {
  return "";
}

export function subscribeCompanySite(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED_EVENT, callback);
  };
}

/** 空文字は登録解除。保存できなかった場合は呼び出し元で案内する。 */
export function saveCompanySiteUrl(value: string): void {
  if (value) window.localStorage.setItem(STORAGE_KEY, normalizeCompanySiteUrl(value));
  else window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGED_EVENT));
}
