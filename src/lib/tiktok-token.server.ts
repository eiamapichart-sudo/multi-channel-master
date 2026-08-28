/**
 * tiktok-token.server.ts — ดึง access token ของบัญชี TikTok ที่ใช้งานได้จริง
 *
 * แยกออกมาเพื่อให้ route ที่ต้องคุยกับ TikTok แบบสดๆ (เช่น creator_info)
 * ใช้ตรรกะต่ออายุ token ชุดเดียวกับตอนเผยแพร่ ไม่ต้องเขียนซ้ำ
 *
 * ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น — ห้าม import จาก component
 */

type CredentialRow = {
  access_token: string;
  token_expires_at: string | null;
  refresh_token: string | null;
  refresh_expires_at: string | null;
  scopes: string[] | null;
  meta: Record<string, unknown> | null;
};

/** เผื่อเวลาไว้ 10 นาที กัน token หมดอายุระหว่างที่กำลังยิง API */
const REFRESH_MARGIN_MS = 10 * 60_000;

export async function getTikTokAccessToken(channelAccountId: string): Promise<{
  accessToken: string;
  scopes: string[];
  meta: Record<string, unknown> | null;
}> {
  const { db } = await import("@/lib/db.server");

  const { data, error } = await db
    .from("channel_credentials")
    .select("access_token, token_expires_at, refresh_token, refresh_expires_at, scopes, meta")
    .eq("channel_account_id", channelAccountId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const credential = data as CredentialRow | null;
  if (!credential?.access_token) {
    throw new Error("ยังไม่ได้เชื่อมต่อบัญชี TikTok นี้ — กดเชื่อมต่อในหน้าตั้งค่าก่อน");
  }

  const expiresAt = credential.token_expires_at ? new Date(credential.token_expires_at) : null;
  const stillFresh = !expiresAt || expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS;

  if (stillFresh) {
    return {
      accessToken: credential.access_token,
      scopes: credential.scopes ?? [],
      meta: credential.meta,
    };
  }

  if (!credential.refresh_token) {
    throw new Error(
      "สิทธิ์ TikTok หมดอายุ และไม่มีรหัสต่ออายุ — กดเชื่อมต่อ TikTok ใหม่ในหน้าตั้งค่า",
    );
  }
  if (credential.refresh_expires_at && new Date(credential.refresh_expires_at) < new Date()) {
    throw new Error("สิทธิ์ TikTok หมดอายุแล้ว — กดเชื่อมต่อ TikTok ใหม่ในหน้าตั้งค่า");
  }

  const { refreshAccessToken } = await import("@/lib/tiktok.server");
  const tokens = await refreshAccessToken(credential.refresh_token);

  await db
    .from("channel_credentials")
    .update({
      access_token: tokens.accessToken,
      token_expires_at: tokens.expiresAt?.toISOString() ?? null,
      // TikTok อาจออก refresh token ใหม่มาด้วย ต้องเขียนทับของเดิมเสมอ
      refresh_token: tokens.refreshToken ?? credential.refresh_token,
      refresh_expires_at:
        tokens.refreshExpiresAt?.toISOString() ?? credential.refresh_expires_at ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("channel_account_id", channelAccountId);

  return {
    accessToken: tokens.accessToken,
    scopes: tokens.scopes.length ? tokens.scopes : (credential.scopes ?? []),
    meta: credential.meta,
  };
}
