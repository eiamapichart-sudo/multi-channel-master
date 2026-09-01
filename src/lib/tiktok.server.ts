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
import {
  isPrivacyLevel,
  type TikTokCreatorInfo,
  type TikTokPostOptionsValue,
} from "@/lib/tiktok-options";

const OPEN_API = "https://open.tiktokapis.com/v2";
const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";

const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 180_000;
const withTimeout = (ms = REQUEST_TIMEOUT_MS) => AbortSignal.timeout(ms);

/** เพดานขนาดคลิปที่ระบบนี้รับ — TikTok เองรับถึง 4GB เราจำกัดให้เท่ากับเพดานของคลังไฟล์ */
export const TIKTOK_MAX_VIDEO_BYTES = 500 * 1024 * 1024;

/**
 * ขนาดก้อนที่ส่งต่อรอบ
 *
 * TikTok บังคับให้แต่ละก้อนอยู่ระหว่าง 5MB ถึง 64MB (ก้อนสุดท้ายเกินได้ถึง 128MB)
 * เราเลือก 32MB เพราะแอปรันบน Cloudflare Workers ที่มีแรมจำกัด
 * ยิ่งก้อนใหญ่ยิ่งกินแรม ยิ่งก้อนเล็กยิ่งเปลืองจำนวนคำขอ — 32MB คือจุดที่พอดีทั้งสองด้าน
 * คลิป 500MB จะแบ่งเป็น 15 ก้อน ใช้คำขอราว 33 ครั้ง
 */
const CHUNK_BYTES = 32 * 1024 * 1024;

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
  const errMessage: string | undefined = json.error?.message ?? json.error_description ?? undefined;

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

export type TikTokCreator = TikTokCreatorInfo;

/**
 * ข้อมูลครีเอเตอร์ + ตัวเลือกความเป็นส่วนตัวที่ใช้ได้จริง
 *
 * TikTok บังคับให้เรียกทุกครั้งก่อนแสดงฟอร์มโพสต์ แล้วแสดงตัวเลือกตามที่ได้กลับมา
 * ห้าม hardcode ตัวเลือกเอง เพราะแต่ละบัญชี (เช่นบัญชีส่วนตัว) มีสิทธิ์ไม่เท่ากัน
 */
export async function getCreatorInfo(token: string): Promise<TikTokCreator> {
  const json = await apiPost(
    "/post/publish/creator_info/query/",
    token,
    {},
    "ดึงข้อมูลบัญชี TikTok",
  );
  const d = json.data ?? {};
  return {
    username: String(d.creator_username ?? ""),
    displayName: String(d.creator_nickname ?? d.creator_username ?? "TikTok"),
    avatarUrl: d.creator_avatar_url ? String(d.creator_avatar_url) : null,
    privacyOptions: (Array.isArray(d.privacy_level_options) ? d.privacy_level_options : [])
      .map(String)
      .filter(isPrivacyLevel),
    commentDisabled: d.comment_disabled === true,
    duetDisabled: d.duet_disabled === true,
    stitchDisabled: d.stitch_disabled === true,
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

/**
 * ถามขนาดและชนิดไฟล์จากคลังไฟล์ โดยไม่ดาวน์โหลดตัวไฟล์
 *
 * ลอง HEAD ก่อน ถ้าคลังไฟล์ไม่ตอบ HEAD ก็ถอยไปขอ byte แรกด้วย Range
 * แล้วอ่านขนาดจริงจากส่วนหลังของหัว content-range แทน
 */
async function probeVideo(url: string): Promise<{ size: number; mime: string }> {
  const readHeaders = (res: Response) => {
    const mime = res.headers.get("content-type") || "video/mp4";
    const cr = res.headers.get("content-range");
    const totalFromRange = cr ? Number(cr.split("/")[1] ?? "0") : 0;
    const len = Number(res.headers.get("content-length") ?? "0");
    const size = totalFromRange > 0 ? totalFromRange : len;
    return { size, mime };
  };

  const head = await fetch(url, { method: "HEAD", signal: withTimeout() }).catch(() => null);
  if (head?.ok) {
    const info = readHeaders(head);
    if (info.size > 0) return info;
  }

  const probe = await fetch(url, { headers: { range: "bytes=0-0" }, signal: withTimeout() });
  if (!probe.ok && probe.status !== 206) {
    throw new TikTokError(`อ่านไฟล์วิดีโอไม่สำเร็จ (HTTP ${probe.status})`, probe.status);
  }
  await probe.arrayBuffer();
  const info = readHeaders(probe);
  if (info.size <= 0) throw new TikTokError("อ่านขนาดไฟล์วิดีโอไม่ได้", 500);
  return info;
}

/**
 * อ่านเฉพาะช่วงไบต์ที่ต้องการจากคลังไฟล์
 *
 * หัวใจของการรองรับไฟล์ใหญ่ — เราไม่เคยถือทั้งคลิปไว้ในแรม ถือทีละก้อนเท่านั้น
 * ถ้าคลังไฟล์ไม่รองรับ Range มันจะส่งไฟล์ทั้งก้อนกลับมา ซึ่งจะจับได้จากจำนวนไบต์ที่ไม่ตรง
 */
async function readRange(url: string, start: number, endInclusive: number): Promise<Uint8Array> {
  const want = endInclusive - start + 1;
  const res = await fetch(url, {
    headers: { range: `bytes=${start}-${endInclusive}` },
    signal: withTimeout(UPLOAD_TIMEOUT_MS),
  });
  if (!res.ok && res.status !== 206) {
    throw new TikTokError(`อ่านไฟล์วิดีโอไม่สำเร็จ (HTTP ${res.status})`, res.status);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength !== want) {
    throw new TikTokError(
      `คลังไฟล์ส่งข้อมูลไม่ตรงช่วงที่ขอ (ขอ ${want} ไบต์ ได้ ${bytes.byteLength}) — คลังไฟล์อาจไม่รองรับการอ่านทีละช่วง`,
      500,
    );
  }
  return bytes;
}

/** แบ่งก้อนตามกติกาของ TikTok — ก้อนสุดท้ายกินเศษที่เหลือทั้งหมด */
function planChunks(size: number): { chunkSize: number; count: number } {
  const chunk = Math.min(CHUNK_BYTES, size);
  const count = Math.max(1, Math.floor(size / chunk));
  return count === 1 ? { chunkSize: size, count: 1 } : { chunkSize: chunk, count };
}

async function uploadChunk(
  uploadUrl: string,
  bytes: Uint8Array,
  mime: string,
  start: number,
  endInclusive: number,
  total: number,
) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": mime,
      "content-length": String(bytes.byteLength),
      "content-range": `bytes ${start}-${endInclusive}/${total}`,
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
  /** สิ่งที่ผู้ใช้เลือกเองในหน้าสร้างโพสต์ — TikTok บังคับให้เคารพค่านี้ */
  choices?: TikTokPostOptionsValue | null;
  mime?: string;
};

/**
 * แปลงตัวเลือกของผู้ใช้เป็น post_info ตามสเปกของ TikTok
 *
 * ถ้าผู้ใช้ยังไม่ได้เลือกความเป็นส่วนตัว จะไม่เดาให้ — ตกลงที่ SELF_ONLY ซึ่งปลอดภัยที่สุด
 * เพราะกติกา TikTok ห้ามโพสต์สาธารณะโดยที่ผู้ใช้ไม่ได้เลือกเอง
 */
function buildPostInfo(options: TikTokPostOptions) {
  const c = options.choices ?? null;
  return {
    title: options.title.slice(0, 2200),
    privacy_level: c?.privacyLevel ?? "SELF_ONLY",
    disable_comment: c?.disableComment ?? false,
    disable_duet: c?.disableDuet ?? false,
    disable_stitch: c?.disableStitch ?? false,
    // เปิดเผยเนื้อหาเชิงพาณิชย์ — ส่งค่าจริงเมื่อผู้ใช้เปิดสวิตช์เปิดเผยเท่านั้น
    brand_content_toggle: c?.disclose === true && c.brandContent === true,
    brand_organic_toggle: c?.disclose === true && c.brandOrganic === true,
    is_aigc: c?.isAigc === true,
    // TikTok ให้เลือกได้แค่เฟรมจากในคลิป อัปรูปปกเองไม่ได้
    video_cover_timestamp_ms: Math.max(0, Math.round(c?.coverTimestampMs ?? 0)),
  };
}

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
  const probe = await probeVideo(videoUrl);
  const size = probe.size;
  if (size > TIKTOK_MAX_VIDEO_BYTES) {
    throw new TikTokError(
      `คลิปใหญ่เกินไป (${Math.round(size / 1024 / 1024)}MB) — TikTok ผ่านระบบนี้รับได้ไม่เกิน ${TIKTOK_MAX_VIDEO_BYTES / 1024 / 1024}MB`,
      413,
    );
  }
  const { chunkSize, count } = planChunks(size);

  const sourceInfo = {
    source: "FILE_UPLOAD",
    video_size: size,
    chunk_size: chunkSize,
    total_chunk_count: count,
  };

  const path = options.directPost ? "/post/publish/video/init/" : "/post/publish/inbox/video/init/";

  // กล่องร่าง (inbox) ไม่รับ post_info — ผู้ใช้จะไปตั้งค่าเองในแอป TikTok
  const body = options.directPost
    ? { post_info: buildPostInfo(options), source_info: sourceInfo }
    : { source_info: sourceInfo };

  const init = await apiPost(path, token, body, "เริ่มงานโพสต์ TikTok");
  const publishId = String(init.data?.publish_id ?? "");
  const uploadUrl = String(init.data?.upload_url ?? "");
  if (!publishId || !uploadUrl) throw new TikTokError("TikTok ไม่ได้ให้ปลายทางอัปโหลด", 500);

  await onPublishId?.(publishId);

  // ส่งทีละก้อน อ่านจากคลังไฟล์เฉพาะช่วงที่กำลังจะส่ง แรมจึงถูกใช้แค่ก้อนละครั้ง
  const mime = options.mime ?? probe.mime;
  for (let i = 0; i < count; i += 1) {
    const start = i * chunkSize;
    const endInclusive = i === count - 1 ? size - 1 : start + chunkSize - 1;
    const bytes = await readRange(videoUrl, start, endInclusive);
    await uploadChunk(uploadUrl, bytes, mime, start, endInclusive, size);
  }

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
    return {
      state: "failed",
      reason: error instanceof Error ? error.message : "ตรวจสถานะไม่สำเร็จ",
    };
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
  if (
    code === "access_token_invalid" ||
    code === "access_token_expired" ||
    error.httpStatus === 401
  ) {
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
