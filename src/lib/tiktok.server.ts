/**
 * tiktok.server.ts — ตัวห่อ TikTok Content Posting API (ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น)
 *
 * ห้าม import ไฟล์นี้จาก component หรือ route file ตรงๆ
 * ให้เรียกด้วย dynamic import ข้างใน handler
 *
 * ทำไมอัปโหลดไฟล์ตรง (FILE_UPLOAD) ไม่ใช่ PULL_FROM_URL:
 * PULL_FROM_URL บังคับให้โดเมนของลิงก์ผ่านการยืนยันในหน้า TikTok Developer
 * ซึ่งลิงก์ไฟล์ของเราอยู่บนโดเมนคลังไฟล์ที่ยืนยันไม่ได้ → เราจึงส่ง byte ขึ้นให้ TikTok เอง
 */
const OPEN_API = "https://open.tiktokapis.com/v2";
const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";

const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 180_000;
const withTimeout = (ms = REQUEST_TIMEOUT_MS) => AbortSignal.timeout(ms);

/** เพดานขนาดไฟล์ที่เรากล้าโหลดเข้าหน่วยความจำเซิร์ฟเวอร์ */
export const TIKTOK_MAX_VIDEO_BYTES = 60 * 1024 * 1024;

const CLIENT_KEY = () => process.env["TIKTOK_CLIENT_KEY"] ?? "";
const CLIENT_SECRET = () => process.env["TIKTOK_CLIENT_SECRET"] ?? "";

/**
 * สิทธิ์ที่ขอ
 * - video.publish = โพสต์ขึ้นหน้าโปรไฟล์ได้จริง (ต้องผ่าน audit ของ TikTok)
 * - video.upload  = ส่งเข้ากล่องร่างในแอป TikTok ให้ครีเอเตอร์กดโพสต์เอง
 */
export const TIKTOK_SCOPES = (
  process.env["TIKTOK_SCOPES"] ?? "user.info.basic,video.upload,video.publish"
).trim();

export function assertTikTokConfigured() {
  if (!CLIENT_KEY() || !CLIENT_SECRET()) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET — เพิ่มใน Lovable Cloud → Secrets",
    );
  }
}

export class TikTokError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "TikTokError";
  }
}

async function parseOrThrow(res: Response, context: string): Promise<any> {
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new TikTokError(`${context}: TikTok ตอบกลับผิดรูปแบบ (HTTP ${res.status})`, res.status);
  }

  const errCode: string | undefined = json.error?.code ?? json.error ?? undefined;
  const errMessage: string | undefined =
    json.error?.message ?? json.error_description ?? undefined;

  if (!res.ok || (errCode && errCode !== "ok")) {
    throw new TikTokError(
      `${context}: ${errMessage ?? errCode ?? `HTTP ${res.status}`}`,
      res.status,
      typeof errCode === "string" ? errCode : undefined,
    );
  }
  return json;
}

async function apiPost(path: string, token: string, body: unknown, context: string) {
  const res = await fetch(`${OPEN_API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body ?? {}),
    signal: withTimeout(),
  });
  return parseOrThrow(res, context);
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function buildLoginUrl(redirectUri: string, state: string): string {
  assertTikTokConfigured();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_key", CLIENT_KEY());
  url.searchParams.set("scope", TIKTOK_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export type TikTokTokens = {
  accessToken: string;
  expiresAt: Date | null;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
  openId: string;
  scopes: string[];
};

function readTokens(json: any): TikTokTokens {
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new TikTokError("TikTok ไม่ได้ส่งสิทธิ์เข้าถึงกลับมา", 500);
  const now = Date.now();
  return {
    accessToken,
    expiresAt: json.expires_in ? new Date(now + Number(json.expires_in) * 1000) : null,
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    refreshExpiresAt: json.refresh_expires_in
      ? new Date(now + Number(json.refresh_expires_in) * 1000)
      : null,
    openId: String(json.open_id ?? ""),
    scopes: String(json.scope ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

async function tokenRequest(form: Record<string, string>, context: string) {
  assertTikTokConfigured();
  const body = new URLSearchParams({
    client_key: CLIENT_KEY(),
    client_secret: CLIENT_SECRET(),
    ...form,
  });
  const res = await fetch(`${OPEN_API}/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: withTimeout(),
  });
  return readTokens(await parseOrThrow(res, context));
}

export function exchangeCodeForToken(code: string, redirectUri: string) {
  // TikTok ส่ง code มาแบบ URL-encoded (มี * ต่อท้าย) → ต้องคลายก่อนส่งกลับไป
  return tokenRequest(
    {
      code: decodeURIComponent(code),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    },
    "แลกรหัสเชื่อมต่อ TikTok",
  );
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest(
    { grant_type: "refresh_token", refresh_token: refreshToken },
    "ต่ออายุสิทธิ์ TikTok",
  );
}

export type TikTokCreator = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  privacyOptions: string[];
  maxDurationSec: number | null;
};

/** ข้อมูลครีเอเตอร์ + ตัวเลือกความเป็นส่วนตัวที่ใช้ได้จริง (TikTok บังคับให้ถามก่อนโพสต์) */
export async function getCreatorInfo(token: string): Promise<TikTokCreator> {
  const json = await apiPost("/post/publish/creator_info/query/", token, {}, "ดึงข้อมูลบัญชี TikTok");
  const d = json.data ?? {};
  return {
    username: String(d.creator_username ?? ""),
    displayName: String(d.creator_nickname ?? d.creator_username ?? "TikTok"),
    avatarUrl: d.creator_avatar_url ? String(d.creator_avatar_url) : null,
    privacyOptions: Array.isArray(d.privacy_level_options)
      ? d.privacy_level_options.map(String)
      : [],
    maxDurationSec: d.max_video_post_duration_sec ? Number(d.max_video_post_duration_sec) : null,
  };
}

/** ข้อมูลโปรไฟล์แบบเบา ใช้ตอนเชื่อมต่อ (ไม่ต้องมีสิทธิ์โพสต์) */
export async function getUserInfo(token: string) {
  const url = new URL(`${OPEN_API}/user/info/`);
  url.searchParams.set("fields", "open_id,display_name,avatar_url,username");
  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
    signal: withTimeout(),
  });
  const json = await parseOrThrow(res, "ดึงโปรไฟล์ TikTok");
  const u = json.data?.user ?? {};
  return {
    openId: u.open_id ? String(u.open_id) : "",
    displayName: String(u.display_name ?? "TikTok"),
    username: u.username ? String(u.username) : "",
    avatarUrl: u.avatar_url ? String(u.avatar_url) : null,
  };
}

// ---------------------------------------------------------------------------
// การเผยแพร่
// ---------------------------------------------------------------------------

export type TikTokPublishResult = { postId: string; permalink: string; inbox: boolean };

export function tiktokPermalink(username: string, postId: string) {
  if (username && postId) return `https://www.tiktok.com/@${username}/video/${postId}`;
  return username ? `https://www.tiktok.com/@${username}` : "https://www.tiktok.com";
}

/** ดาวน์โหลดคลิปจากคลังไฟล์เข้าหน่วยความจำเพื่อส่งต่อให้ TikTok */
async function fetchVideo(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: withTimeout(UPLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new TikTokError(`อ่านไฟล์วิดีโอไม่สำเร็จ (HTTP ${res.status})`, res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new TikTokError("ไฟล์วิดีโอว่างเปล่า", 400);
  if (buf.byteLength > TIKTOK_MAX_VIDEO_BYTES) {
    throw new TikTokError(
      `คลิปใหญ่เกินไป (${Math.round(buf.byteLength / 1024 / 1024)}MB) — TikTok ผ่านระบบนี้รับได้ไม่เกิน ${TIKTOK_MAX_VIDEO_BYTES / 1024 / 1024}MB`,
      413,
    );
  }
  return buf;
}

async function uploadChunk(uploadUrl: string, bytes: Uint8Array, mime: string) {
  const size = bytes.byteLength;
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": mime,
      "content-length": String(size),
      "content-range": `bytes 0-${size - 1}/${size}`,
    },
    body: bytes as unknown as BodyInit,
    signal: withTimeout(UPLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new TikTokError(`อัปโหลดคลิปขึ้น TikTok ไม่สำเร็จ (HTTP ${res.status})`, res.status);
  }
}

export type TikTokPostOptions = {
  /** โพสต์ขึ้นโปรไฟล์เลย (ต้องมีสิทธิ์ video.publish และแอปผ่าน audit) */
  directPost: boolean;
  title: string;
  privacyLevel?: string;
  mime?: string;
};

/**
 * ส่งคลิปขึ้น TikTok
 * - directPost = true  → โพสต์ขึ้นโปรไฟล์จริง
 * - directPost = false → เข้ากล่องร่างในแอป TikTok ให้เจ้าของบัญชีกดโพสต์เอง
 *
 * onPublishId ถูกเรียกทันทีที่ TikTok ออกรหัสงานให้ เพื่อให้ฝั่งเรียกจดไว้กันโพสต์ซ้ำ
 */
export async function publishTikTokVideo(
  token: string,
  videoUrl: string,
  options: TikTokPostOptions,
  onPublishId?: (publishId: string) => Promise<void>,
): Promise<{ publishId: string }> {
  const bytes = await fetchVideo(videoUrl);
  const size = bytes.byteLength;

  const sourceInfo = {
    source: "FILE_UPLOAD",
    video_size: size,
    chunk_size: size,
    total_chunk_count: 1,
  };

  const path = options.directPost
    ? "/post/publish/video/init/"
    : "/post/publish/inbox/video/init/";

  const body = options.directPost
    ? {
        post_info: {
          title: options.title.slice(0, 2200),
          privacy_level: options.privacyLevel ?? "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: sourceInfo,
      }
    : { source_info: sourceInfo };

  const init = await apiPost(path, token, body, "เริ่มงานโพสต์ TikTok");
  const publishId = String(init.data?.publish_id ?? "");
  const uploadUrl = String(init.data?.upload_url ?? "");
  if (!publishId || !uploadUrl) throw new TikTokError("TikTok ไม่ได้ให้ปลายทางอัปโหลด", 500);

  await onPublishId?.(publishId);
  await uploadChunk(uploadUrl, bytes, options.mime ?? "video/mp4");

  return { publishId };
}

export type TikTokJobState =
  /** ยังประมวลผลอยู่ — รอบหน้ามาเช็คต่อได้ */
  | { state: "processing" }
  /** สำเร็จ */
  | { state: "done"; postId: string; inbox: boolean }
  /** งานนี้ตายแล้ว เริ่มใหม่ได้ */
  | { state: "failed"; reason: string };

/** เช็คสถานะงานโพสต์ — ใช้ทั้งตอนรอผลและตอนลองใหม่เพื่อกันโพสต์ซ้ำ */
export async function fetchPublishStatus(
  token: string,
  publishId: string,
): Promise<TikTokJobState> {
  let json: any;
  try {
    json = await apiPost(
      "/post/publish/status/fetch/",
      token,
      { publish_id: publishId },
      "ตรวจสถานะโพสต์ TikTok",
    );
  } catch (error) {
    return { state: "failed", reason: error instanceof Error ? error.message : "ตรวจสถานะไม่สำเร็จ" };
  }

  const d = json.data ?? {};
  const status = String(d.status ?? "");
  const ids: string[] = Array.isArray(d.publicaly_available_post_id)
    ? d.publicaly_available_post_id.map(String)
    : Array.isArray(d.publicly_available_post_id)
      ? d.publicly_available_post_id.map(String)
      : [];

  if (status === "PUBLISH_COMPLETE") {
    return { state: "done", postId: ids[0] ?? publishId, inbox: ids.length === 0 };
  }
  if (status === "SEND_TO_USER_INBOX") return { state: "done", postId: publishId, inbox: true };
  if (status === "FAILED") {
    return { state: "failed", reason: humanizeTikTokReason(String(d.fail_reason ?? "")) };
  }
  return { state: "processing" };
}

/** รอผลงานโพสต์แบบสั้น ๆ — ถ้ายังไม่จบให้ฝั่งเรียกไปตามเก็บรอบหน้า */
export async function waitForPublish(
  token: string,
  publishId: string,
  tries = 8,
  delayMs = 3000,
): Promise<TikTokJobState> {
  let last: TikTokJobState = { state: "processing" };
  for (let i = 0; i < tries; i += 1) {
    last = await fetchPublishStatus(token, publishId);
    if (last.state !== "processing") return last;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
}

function humanizeTikTokReason(reason: string): string {
  const map: Record<string, string> = {
    picture_size_check_failed: "ขนาดรูปไม่ผ่านเกณฑ์ของ TikTok",
    video_pull_failed: "TikTok ดึงไฟล์วิดีโอไม่สำเร็จ",
    file_format_check_failed: "รูปแบบไฟล์วิดีโอไม่รองรับ — ใช้ .mp4 (H.264/AAC)",
    duration_check_failed: "ความยาวคลิปไม่ผ่านเกณฑ์ของบัญชีนี้",
    frame_rate_check_failed: "เฟรมเรตของคลิปไม่ผ่านเกณฑ์ของ TikTok",
    video_bitrate_check_failed: "บิตเรตของคลิปสูงเกินเกณฑ์ของ TikTok",
    internal: "TikTok ขัดข้องภายใน ลองใหม่อีกครั้ง",
  };
  return map[reason] ?? (reason ? `TikTok ปฏิเสธคลิปนี้ (${reason})` : "TikTok ปฏิเสธคลิปนี้");
}

export function humanizeTikTokError(error: unknown): string {
  if (!(error instanceof TikTokError)) {
    return error instanceof Error ? error.message : "เผยแพร่ TikTok ไม่สำเร็จ";
  }

  const code = error.code ?? "";
  if (code === "access_token_invalid" || code === "access_token_expired" || error.httpStatus === 401) {
    return "สิทธิ์เข้าถึง TikTok หมดอายุ — กดเชื่อมต่อ TikTok ใหม่ในหน้าตั้งค่า";
  }
  if (code === "scope_not_authorized" || code === "scope_permission_missed") {
    return "บัญชี TikTok ยังไม่ได้ให้สิทธิ์โพสต์ — กดเชื่อมต่อใหม่และติ๊กอนุญาตทุกข้อ";
  }
  if (code === "unaudited_client_can_only_post_to_private_accounts") {
    return "แอป TikTok ยังไม่ผ่านการตรวจ (audit) — โพสต์สาธารณะยังไม่ได้ ระบบจะส่งเข้ากล่องร่างในแอป TikTok ให้แทน";
  }
  if (code === "spam_risk_too_many_posts" || code === "spam_risk_user_banned_from_posting") {
    return "TikTok จำกัดการโพสต์ของบัญชีนี้ชั่วคราว — รอแล้วลองใหม่";
  }
  if (code === "rate_limit_exceeded") return "เรียก TikTok ถี่เกินไป — ระบบจะลองใหม่ให้";
  if (code === "url_ownership_unverified") {
    return "TikTok ยังไม่ยืนยันโดเมนไฟล์ — ระบบใช้การอัปโหลดตรงอยู่แล้ว ลองใหม่อีกครั้ง";
  }
  return error.message;
}
