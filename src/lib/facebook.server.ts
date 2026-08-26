/**
 * facebook.server.ts — ตัวห่อ Meta Graph API (ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น)
 *
 * ห้าม import ไฟล์นี้จาก component หรือ route file ตรงๆ
 * ให้เรียกด้วย dynamic import ข้างใน handler
 */
import { createHmac } from "node:crypto";

export const GRAPH_VERSION = process.env["FACEBOOK_GRAPH_VERSION"] ?? "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const APP_ID = () => process.env["FACEBOOK_APP_ID"] ?? "";
const APP_SECRET = () => process.env["FACEBOOK_APP_SECRET"] ?? "";
/** ใส่เฉพาะเมื่อใช้ Facebook Login for Business แบบมี Configuration ID */
const CONFIG_ID = () => process.env["FACEBOOK_CONFIG_ID"] ?? "";

/** สิทธิ์ที่ Social Post ต้องใช้ — แค่เห็นรายชื่อเพจกับโพสต์ ไม่ยุ่งกับแชท/คอมเมนต์ */
export const FB_SCOPES = (
  process.env["FACEBOOK_SCOPES"] ??
  "pages_show_list,pages_read_engagement,pages_manage_posts"
).trim();

export function assertFacebookConfigured() {
  if (!APP_ID() || !APP_SECRET()) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า FACEBOOK_APP_ID / FACEBOOK_APP_SECRET — เพิ่มใน Lovable Cloud → Secrets",
    );
  }
}

export class FacebookError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
    this.name = "FacebookError";
  }
}

/** Meta แนะนำให้แนบ appsecret_proof ทุก call ฝั่งเซิร์ฟเวอร์ กัน token ถูกขโมยไปใช้ที่อื่น */
function appSecretProof(accessToken: string): string | null {
  const secret = APP_SECRET();
  if (!secret) return null;
  return createHmac("sha256", secret).update(accessToken).digest("hex");
}

async function parseOrThrow(res: Response, context: string) {
  const text = await res.text();
  let json: Record<string, any> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new FacebookError(`${context}: Facebook ตอบกลับผิดรูปแบบ (HTTP ${res.status})`, res.status);
  }
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new FacebookError(
      `${context}: ${e.message ?? `HTTP ${res.status}`}`,
      res.status,
      e.code,
      e.error_subcode,
    );
  }
  return json;
}

export async function graphGet(
  path: string,
  params: Record<string, string | undefined>,
  accessToken?: string,
) {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
    const proof = appSecretProof(accessToken);
    if (proof) url.searchParams.set("appsecret_proof", proof);
  }
  return parseOrThrow(await fetch(url.toString()), `GET ${path}`);
}

export async function graphPost(
  path: string,
  body: Record<string, string | number | boolean | undefined>,
  accessToken: string,
) {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null && v !== "") form.set(k, String(v));
  }
  form.set("access_token", accessToken);
  const proof = appSecretProof(accessToken);
  if (proof) form.set("appsecret_proof", proof);

  const res = await fetch(`${GRAPH}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return parseOrThrow(res, `POST ${path}`);
}

/** URL หน้าขออนุญาตของ Facebook ที่ผู้ใช้ต้องถูกพาไป */
export function buildLoginUrl(redirectUri: string, state: string): string {
  assertFacebookConfigured();
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", APP_ID());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", FB_SCOPES);
  if (CONFIG_ID()) url.searchParams.set("config_id", CONFIG_ID());
  return url.toString();
}

/** code → user access token อายุสั้น */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  assertFacebookConfigured();
  const json = await graphGet("oauth/access_token", {
    client_id: APP_ID(),
    client_secret: APP_SECRET(),
    redirect_uri: redirectUri,
    code,
  });
  return json.access_token as string;
}

/** user token อายุสั้น → อายุยาว (~60 วัน) — จำเป็น เพราะ page token ที่ได้ต่อจากนี้จะไม่หมดอายุ */
export async function exchangeForLongLivedToken(shortToken: string) {
  assertFacebookConfigured();
  const json = await graphGet("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: APP_ID(),
    client_secret: APP_SECRET(),
    fb_exchange_token: shortToken,
  });
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : null;
  return {
    accessToken: json.access_token as string,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

export type FbPage = {
  id: string;
  name: string;
  accessToken: string;
  category: string | null;
  avatarUrl: string | null;
  canCreateContent: boolean;
};

/** รายชื่อเพจที่ผู้ใช้เป็นแอดมิน พร้อม Page access token ของแต่ละเพจ */
export async function listPages(userToken: string): Promise<FbPage[]> {
  const pages: FbPage[] = [];
  let after: string | undefined;
  let guard = 0;

  do {
    const json = await graphGet(
      "me/accounts",
      { fields: "id,name,access_token,category,tasks,picture{url}", limit: "100", after },
      userToken,
    );
    for (const p of json.data ?? []) {
      pages.push({
        id: String(p.id),
        name: String(p.name ?? p.id),
        accessToken: String(p.access_token ?? ""),
        category: p.category ?? null,
        avatarUrl: p.picture?.data?.url ?? null,
        canCreateContent: Array.isArray(p.tasks) ? p.tasks.includes("CREATE_CONTENT") : true,
      });
    }
    after = json.paging?.next ? json.paging?.cursors?.after : undefined;
  } while (after && ++guard < 20);

  return pages.filter((p) => p.accessToken);
}

/** เช็คว่า token ยังใช้ได้อยู่ไหม */
export async function debugToken(inputToken: string) {
  assertFacebookConfigured();
  const json = await graphGet("debug_token", {
    input_token: inputToken,
    access_token: `${APP_ID()}|${APP_SECRET()}`,
  });
  const d = json.data ?? {};
  return {
    valid: Boolean(d.is_valid),
    expiresAt: d.expires_at ? new Date(d.expires_at * 1000) : null,
    scopes: (d.scopes ?? []) as string[],
    error: (d.error?.message as string | undefined) ?? null,
  };
}

export type PublishResult = { postId: string; permalink: string };

/** โพสต์ข้อความล้วน */
export async function publishTextPost(
  pageId: string,
  pageToken: string,
  message: string,
): Promise<PublishResult> {
  const json = await graphPost(`${pageId}/feed`, { message }, pageToken);
  return { postId: String(json.id), permalink: permalinkFromPostId(String(json.id)) };
}

/** อัปรูปแบบยังไม่เผยแพร่ คืน photo id — ใช้คุมลำดับรูปในอัลบัมให้ตรงเป๊ะ */
async function uploadUnpublishedPhoto(pageId: string, pageToken: string, imageUrl: string) {
  const json = await graphPost(
    `${pageId}/photos`,
    { url: imageUrl, published: false, temporary: true },
    pageToken,
  );
  return String(json.id);
}

/** โพสต์รูป 1–10 รูป เรียงตามลำดับใน imageUrls เป๊ะๆ */
export async function publishPhotoPost(
  pageId: string,
  pageToken: string,
  message: string,
  imageUrls: string[],
): Promise<PublishResult> {
  if (imageUrls.length === 0) throw new Error("ไม่มีรูปให้โพสต์");
  if (imageUrls.length > 10) throw new Error("โพสต์เดียวแนบรูปได้ไม่เกิน 10 รูป");

  const mediaIds: string[] = [];
  for (const url of imageUrls) {
    mediaIds.push(await uploadUnpublishedPhoto(pageId, pageToken, url));
  }

  const body: Record<string, string | number | boolean> = {};
  if (message) body.message = message;
  mediaIds.forEach((id, i) => {
    body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });

  const json = await graphPost(`${pageId}/feed`, body, pageToken);
  return { postId: String(json.id), permalink: permalinkFromPostId(String(json.id)) };
}

/** โพสต์วิดีโอ — ให้ Facebook ไปดึงไฟล์เองจาก URL */
export async function publishVideoPost(
  pageId: string,
  pageToken: string,
  message: string,
  videoUrl: string,
): Promise<PublishResult> {
  const json = await graphPost(
    `${pageId}/videos`,
    { file_url: videoUrl, description: message },
    pageToken,
  );
  const videoId = String(json.id);
  return { postId: videoId, permalink: `https://www.facebook.com/${pageId}/videos/${videoId}` };
}

/** ลิงก์เปิดโพสต์จริงบน Facebook */
export function permalinkFromPostId(postId: string): string {
  const [pageId, storyId] = postId.split("_");
  if (pageId && storyId) return `https://www.facebook.com/${pageId}/posts/${storyId}`;
  return `https://www.facebook.com/${postId}`;
}

/** แปลง error ของ Meta เป็นข้อความไทยที่ผู้ใช้อ่านรู้เรื่อง */
export function humanizeFacebookError(error: unknown): string {
  if (error instanceof FacebookError) {
    if (error.code === 190) return "การเชื่อมต่อ Facebook หมดอายุ — กดเชื่อมต่อใหม่ในหน้าตั้งค่า";
    if (error.code === 200 || error.code === 10)
      return "สิทธิ์ไม่พอสำหรับโพสต์ลงเพจนี้ — ตรวจว่าเป็นแอดมินเพจ และแอปได้สิทธิ์ pages_manage_posts";
    if (error.code === 4 || error.code === 17 || error.code === 32)
      return "Facebook จำกัดจำนวนคำขอชั่วคราว — ระบบจะลองใหม่รอบถัดไป";
    if (error.code === 100) return `Facebook ปนิเสธคำขอ: ${error.message}`;
    return error.message;
  }
  return error instanceof Error ? error.message : "เผยแพร่ไม่สำเร็จ";
}
