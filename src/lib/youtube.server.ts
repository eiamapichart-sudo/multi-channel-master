/**
 * youtube.server.ts — ตัวห่อ YouTube Data API v3 (ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น)
 *
 * ห้าม import ไฟล์นี้จาก component หรือ route file ตรงๆ
 * ให้เรียกด้วย dynamic import ข้างใน handler
 *
 * ทำไมอัปโหลดแบบ resumable:
 * YouTube ไม่มีทางให้ส่งลิงก์ไฟล์ไปให้มันดึงเอง ต้องส่ง byte ขึ้นไปเสมอ
 * วิธี resumable คือขอ "ปลายทางอัปโหลด" มาก่อน แล้วค่อยส่งไฟล์ตามไป
 * ข้อดีคือถ้าไฟล์ใหญ่แล้วหลุดกลางทาง เรารู้ว่างานไหนค้างอยู่ ไม่ต้องเริ่มใหม่ทั้งหมด
 *
 * Shorts กับวิดีโอปกติใช้ปลายทางเดียวกัน — YouTube ตัดสินเองจากความยาว สัดส่วนภาพ
 * และแท็ก #Shorts ในชื่อหรือคำบรรยาย
 */
import {
  YOUTUBE_COVER_MAX_BYTES,
  YOUTUBE_MAX_VIDEO_BYTES,
  buildYouTubeDescription,
  type YouTubePostOptionsValue,
} from "@/lib/youtube-options";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3/videos";

const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 600_000;
const withTimeout = (ms = REQUEST_TIMEOUT_MS) => AbortSignal.timeout(ms);

const CLIENT_ID = () => process.env["YOUTUBE_CLIENT_ID"] ?? "";
const CLIENT_SECRET = () => process.env["YOUTUBE_CLIENT_SECRET"] ?? "";

/**
 * สิทธิ์ที่ขอ
 * - youtube.upload   = อัปคลิปขึ้นช่องได้
 * - youtube.readonly = อ่านชื่อช่องมาแสดงในหน้าตั้งค่า
 */
export const YOUTUBE_SCOPES = (
  process.env["YOUTUBE_SCOPES"] ??
  "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"
).trim();

export function assertYouTubeConfigured() {
  if (!CLIENT_ID() || !CLIENT_SECRET()) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET — เพิ่มใน Lovable Cloud → Secrets",
    );
  }
}

export class YouTubeError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly reason?: string,
  ) {
    super(message);
    this.name = "YouTubeError";
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function parseOrThrow(res: Response, context: string): Promise<any> {
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const err = json?.error;
    const reason: string | undefined = err?.errors?.[0]?.reason ?? err?.status;
    const message: string =
      err?.errors?.[0]?.message ?? err?.message ?? err?.error_description ?? text.slice(0, 200);
    throw new YouTubeError(`${context}: ${message || `HTTP ${res.status}`}`, res.status, reason);
  }

  return json;
}

/* ------------------------------------------------------------------ OAuth */

export function buildLoginUrl(redirectUri: string, state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", CLIENT_ID());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES);
  url.searchParams.set("state", state);
  // offline + consent = บังคับให้ Google ส่ง refresh token มาให้ทุกครั้ง
  // ถ้าไม่ใส่ ครั้งที่สองเป็นต้นไปจะไม่มี refresh token แล้วต่ออายุเองไม่ได้
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

export type YouTubeTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
};

async function tokenRequest(form: Record<string, string>, context: string): Promise<YouTubeTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: withTimeout(),
  });
  const json = await parseOrThrow(res, context);

  const accessToken = String(json?.access_token ?? "");
  if (!accessToken) throw new YouTubeError("Google ไม่ได้ส่ง access token กลับมา", 500);

  const expiresIn = Number(json?.expires_in ?? 0);
  const scopeText = String(json?.scope ?? "");

  return {
    accessToken,
    refreshToken: json?.refresh_token ? String(json.refresh_token) : null,
    expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
    scopes: scopeText ? scopeText.split(/\s+/).filter(Boolean) : [],
  };
}

export function exchangeCodeForToken(code: string, redirectUri: string) {
  return tokenRequest(
    {
      code,
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    },
    "แลกรหัสเป็นสิทธิ์ YouTube",
  );
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest(
    {
      refresh_token: refreshToken,
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      grant_type: "refresh_token",
    },
    "ต่ออายุสิทธิ์ YouTube",
  );
}

/* ------------------------------------------------------------- ข้อมูลช่อง */

export type YouTubeChannel = {
  channelId: string;
  title: string;
  handle: string;
  avatarUrl: string | null;
};

/** ดึงช่องของบัญชีที่เพิ่งอนุญาต — ใช้แสดงชื่อช่องในหน้าตั้งค่า */
export async function getChannelInfo(token: string): Promise<YouTubeChannel> {
  const url = new URL(`${API}/channels`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: withTimeout(),
  });
  const json = await parseOrThrow(res, "อ่านข้อมูลช่อง YouTube");

  const item = json?.items?.[0];
  if (!item?.id) {
    throw new YouTubeError(
      "บัญชี Google นี้ยังไม่มีช่อง YouTube — สร้างช่องก่อนแล้วกดเชื่อมต่อใหม่",
      404,
      "youtubeSignupRequired",
    );
  }

  const snippet = item.snippet ?? {};
  return {
    channelId: String(item.id),
    title: String(snippet.title ?? "YouTube"),
    handle: String(snippet.customUrl ?? ""),
    avatarUrl: snippet.thumbnails?.default?.url ? String(snippet.thumbnails.default.url) : null,
  };
}

/* ------------------------------------------------------------- อัปโหลดคลิป */

type OpenVideo = {
  /** สายข้อมูลของไฟล์ ส่งต่อให้ YouTube ตรงๆ ไม่ต้องพักไว้ในหน่วยความจำ */
  stream: ReadableStream<Uint8Array>;
  size: number;
  mime: string;
};

/**
 * เปิดสายอ่านคลิปจากคลังไฟล์
 *
 * ไม่โหลดทั้งไฟล์เข้าหน่วยความจำ เพราะแอปรันบน Cloudflare Workers ซึ่งมีแรมจำกัด
 * คลิปหลักร้อยเมกฯ จะทำให้ worker ตายก่อนได้อัปเสร็จ
 * วิธีนี้ไบต์ไหลจากคลังไฟล์ผ่านเราไป YouTube เลย ใช้แรมแค่บัฟเฟอร์เล็กๆ
 */
async function openVideo(url: string): Promise<OpenVideo> {
  const res = await fetch(url, { signal: withTimeout(UPLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new YouTubeError(`อ่านไฟล์วิดีโอไม่สำเร็จ (HTTP ${res.status})`, res.status);

  const size = Number(res.headers.get("content-length") ?? "0");
  if (!Number.isFinite(size) || size <= 0) {
    throw new YouTubeError("อ่านขนาดไฟล์วิดีโอไม่ได้ — คลังไฟล์ไม่ได้บอกขนาดมา", 500);
  }
  if (size > YOUTUBE_MAX_VIDEO_BYTES) {
    throw new YouTubeError(
      `คลิปใหญ่เกินไป (${Math.round(size / 1024 / 1024)}MB) — ระบบนี้รับได้ไม่เกิน ${YOUTUBE_MAX_VIDEO_BYTES / 1024 / 1024}MB`,
      413,
    );
  }
  if (!res.body) throw new YouTubeError("อ่านไฟล์วิดีโอไม่ได้ — ไม่มีเนื้อไฟล์ส่งกลับมา", 500);

  return {
    stream: res.body,
    size,
    mime: res.headers.get("content-type") || "video/mp4",
  };
}

export type YouTubeUploadOptions = {
  choices: YouTubePostOptionsValue;
  /** ข้อความในโพสต์ — ใช้เป็นคำบรรยายสำรองถ้าผู้ใช้ไม่ได้กรอกช่องคำบรรยาย */
  fallbackDescription?: string;
  mime?: string;
};

/**
 * อัปคลิปขึ้น YouTube แบบ resumable
 *
 * onUploadUrl ถูกเรียกทันทีที่ Google ออกปลายทางอัปโหลดให้
 * ฝั่งเรียกเอาไปจดไว้ได้ เผื่อพังกลางทางจะได้รู้ว่ามีงานค้าง
 */
export async function uploadYouTubeVideo(
  token: string,
  videoUrl: string,
  options: YouTubeUploadOptions,
  onUploadUrl?: (uploadUrl: string) => Promise<void>,
): Promise<{ videoId: string }> {
  const video = await openVideo(videoUrl);
  const size = video.size;
  const mime = options.mime ?? video.mime;

  const choices = options.choices;
  const description =
    buildYouTubeDescription(choices) || (options.fallbackDescription ?? "").trim();

  const metadata = {
    snippet: {
      title: choices.title.trim().slice(0, 100),
      description: description.slice(0, 5000),
    },
    status: {
      privacyStatus: choices.privacyStatus ?? "private",
      selfDeclaredMadeForKids: choices.madeForKids === true,
    },
  };

  const initUrl = new URL(UPLOAD_API);
  initUrl.searchParams.set("uploadType", "resumable");
  initUrl.searchParams.set("part", "snippet,status");

  const init = await fetch(initUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(size),
      "x-upload-content-type": mime,
    },
    body: JSON.stringify(metadata),
    signal: withTimeout(),
  });

  if (!init.ok) {
    await parseOrThrow(init, "เริ่มงานอัปคลิป YouTube");
  }

  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new YouTubeError("YouTube ไม่ได้ให้ปลายทางอัปโหลด", 500);

  await onUploadUrl?.(uploadUrl);

  // duplex: "half" จำเป็นเมื่อ body เป็น stream — ยังไม่มีในนิยาม RequestInit มาตรฐาน
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": mime, "content-length": String(size) },
    body: video.stream,
    duplex: "half",
    signal: withTimeout(UPLOAD_TIMEOUT_MS),
  } as RequestInit & { duplex: "half" });

  const done = await parseOrThrow(put, "อัปคลิปขึ้น YouTube");
  const videoId = String(done?.id ?? "");
  if (!videoId) throw new YouTubeError("YouTube ไม่ได้ส่งรหัสคลิปกลับมา", 500);

  return { videoId };
}

/**
 * ตั้งรูปปกของคลิป (custom thumbnail)
 *
 * ใช้ scope youtube.upload ที่เรามีอยู่แล้ว รับ JPEG/PNG ไม่เกิน 2MB
 *
 * ข้อควรรู้: ช่องที่ยังไม่ยืนยันตัวตนกับ YouTube จะใช้ปกเองไม่ได้ และได้ 403 กลับมา
 * ฝั่งเรียกควรจับ error แล้วปล่อยผ่าน — คลิปขึ้นไปแล้ว ไม่ควรนับว่าโพสต์ล้มเหลวเพราะปก
 */
export async function setVideoThumbnail(
  token: string,
  videoId: string,
  imageUrl: string,
): Promise<void> {
  const res = await fetch(imageUrl, { signal: withTimeout(UPLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new YouTubeError(`อ่านไฟล์รูปปกไม่สำเร็จ (HTTP ${res.status})`, res.status);

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw new YouTubeError("ไฟล์รูปปกว่างเปล่า", 400);
  if (bytes.byteLength > YOUTUBE_COVER_MAX_BYTES) {
    throw new YouTubeError(
      `รูปปกใหญ่เกินไป (${Math.round(bytes.byteLength / 1024 / 1024)}MB) — YouTube รับไม่เกิน 2MB`,
      413,
    );
  }

  const mime = res.headers.get("content-type") ?? "image/jpeg";

  const url = new URL("https://www.googleapis.com/upload/youtube/v3/thumbnails");
  url.searchParams.set("videoId", videoId);
  url.searchParams.set("uploadType", "media");

  const put = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": mime,
      "content-length": String(bytes.byteLength),
    },
    body: bytes as unknown as BodyInit,
    signal: withTimeout(UPLOAD_TIMEOUT_MS),
  });

  await parseOrThrow(put, "ตั้งรูปปกคลิป YouTube");
}

export type YouTubeResumeState =
  /** งานเดิมอัปเสร็จไปแล้ว — เอา videoId ไปใช้ได้เลย ไม่ต้องอัปซ้ำ */
  | { state: "done"; videoId: string }
  /** ปลายทางยังอยู่แต่ไฟล์ยังไม่ครบ — เริ่มอัปใหม่ทับได้ */
  | { state: "incomplete" }
  /** ปลายทางหมดอายุหรือหาไม่เจอ — ต้องขอปลายทางใหม่ */
  | { state: "expired" };

/**
 * ถามสถานะงานอัปที่ค้างไว้จากรอบก่อน
 *
 * ต้องใช้ redirect: "manual" เพราะ YouTube ตอบ 308 เพื่อบอกว่า "ยังไม่ครบ"
 * ถ้าปล่อยให้ fetch ตามต่อเอง เราจะไม่เห็นสถานะนี้เลย
 */
export async function checkResumableUpload(uploadUrl: string): Promise<YouTubeResumeState> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-range": "bytes */*" },
      redirect: "manual",
      signal: withTimeout(),
    });
  } catch {
    return { state: "expired" };
  }

  if (res.status === 308) return { state: "incomplete" };
  if (res.status === 404 || res.status === 410) return { state: "expired" };

  if (res.ok) {
    const text = await res.text();
    try {
      const json = text ? JSON.parse(text) : {};
      const videoId = String(json?.id ?? "");
      if (videoId) return { state: "done", videoId };
    } catch {
      /* ตอบกลับไม่ใช่ JSON — ถือว่าปลายทางใช้ไม่ได้แล้ว */
    }
  }

  return { state: "expired" };
}

/* --------------------------------------------------------------- ข้อความ */

export function humanizeYouTubeError(error: unknown): string {
  if (error instanceof YouTubeError) {
    switch (error.reason) {
      case "quotaExceeded":
      case "rateLimitExceeded":
        return "โควต้า YouTube ของวันนี้เต็มแล้ว — ระบบจะลองใหม่ให้พรุ่งนี้ หรือขอเพิ่มโควต้าใน Google Cloud Console";
      case "uploadLimitExceeded":
        return "ช่องนี้อัปคลิปครบจำนวนของวันแล้ว — รอพรุ่งนี้แล้วลองใหม่";
      case "youtubeSignupRequired":
        return "บัญชี Google นี้ยังไม่มีช่อง YouTube — สร้างช่องก่อนแล้วกดเชื่อมต่อใหม่";
      case "invalidTitle":
        return "ชื่อคลิปไม่ผ่านเกณฑ์ของ YouTube — เลี่ยงอักขระพิเศษอย่าง < > แล้วลองใหม่";
      case "invalidDescription":
        return "คำบรรยายไม่ผ่านเกณฑ์ของ YouTube — เลี่ยงอักขระพิเศษอย่าง < > แล้วลองใหม่";
      case "forbidden":
      case "insufficientPermissions":
        return "สิทธิ์ไม่พอสำหรับอัปคลิป — กดเชื่อมต่อ YouTube ใหม่ในหน้าตั้งค่า";
      case "invalid_grant":
        return "สิทธิ์ YouTube หมดอายุหรือถูกถอน — กดเชื่อมต่อ YouTube ใหม่ในหน้าตั้งค่า";
      default:
        break;
    }
    if (error.httpStatus === 401) {
      return "สิทธิ์ YouTube หมดอายุ — กดเชื่อมต่อ YouTube ใหม่ในหน้าตั้งค่า";
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "อัปคลิปขึ้น YouTube ไม่สำเร็จ";
}
