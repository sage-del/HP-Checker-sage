/**
 * アクセス制限（Basic 認証）。純関数だけを置く。
 *
 * proxy.ts（全ページの手前）から使う。
 */

/** 長さの違いも含めて、比較にかかる時間が中身で変わらない文字列比較 */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Authorization: Basic … が、設定したユーザー名・パスワードと一致するか */
export function checkBasicAuth(header: string | null, user: string, password: string): boolean {
  if (!header) return false;
  const m = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
  if (!m) return false;
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  // 両方とも比べてから結果を出す（ユーザー名だけ合っているかを時間から推測させない）
  const userOk = safeEqual(decoded.slice(0, sep), user);
  const passOk = safeEqual(decoded.slice(sep + 1), password);
  return userOk && passOk;
}
