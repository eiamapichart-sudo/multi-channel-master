/**
 * facebook.server.ts — ตัวห่อ Meta Graph API (ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น)
 *
 * ห้าม import ไฟล์นี้จาก component หรือ route file ตรงๆ
 * ให้เรียกด้วย dynamic import ข้างใน handler
 */
import { createHmac } from "node:crypto";

export const GRAPH_VERSION = process.env["FACEBOOK_GRAPH_VERSION"] ?? "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** ไม่มี timeout = คำขอค้างได้ไม่จำกัด ซึ่งแปลว่าอาจโพสต์ไปแล้วแต่เราไม่รู้ แล้วไปโพสต์ซ้ำ */
const REQUEST_TIMEOUT_MS = 30_000;
const withTimeout = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS);

const APP_ID = () => process.env["FACEBOOK_APP_ID"] ?? "";
const APP_SECRET = () => process.env["FACEBOOK_APP_SECRET"] ?? "";
/** ใส่เฉพาะเมื่อใช้ Facebook Login for Business แบบมี Configuration ID */
const CONFIG_ID = () => process.env["FACEBOOK_CONFIG_ID"] ?? "";

/** สิทธิ์ที่ Social Post ต้องใช้ — ใช้เฉพาะกรณีแอปแบบเก่าที่ยังรับ scope */
export const FB_SCOPES = (
  process.env["FACEBOOK_SCOPES"] ??
  "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish"
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
    throw new FacebookError(
      `${context}: Facebook ตอบกลับผิดรูปแบบ (HTTP ${res.status})`,
      res.status,
    );
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
  return parseOrThrow(await fetch(url.toString(), { signal: withTimeout() }), `GET ${path}`);
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
    signal: withTimeout(),
  });
  return parseOrThrow(res, `POST ${path}`);
}

/** ใช้ลบโพสต์ที่เคยส่งขึ้นเพจไปแล้ว */
export async function graphDelete(path: string, accessToken: string) {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", accessToken);
  const proof = appSecretProof(accessToken);
  if (proof) url.searchParams.set("appsecret_proof", proof);
  const res = await fetch(url.toString(), { method: "DELETE", signal: withTimeout() });
  return parseOrThrow(res, `DELETE ${path}`);
}

/** URL หน้าขออนุญาตของ Facebook ที่ผู้ใช้ต้องถูกพาไป */
export function buildLoginUrl(redirectUri: string, state: string): string {
  assertFacebookConfigured();
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", APP_ID());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  // แอปที่ใช้ Facebook Login for Business รับได้เฉพาะ config_id
  // ถ้าส่ง scope ไปด้วย Meta จะตอบ "Invalid Scopes" แล้วเปิดหน้าอนุญาตไม่ได้เลย
  if (CONFIG_ID()) {
    url.searchParams.set("config_id", CONFIG_ID());
  } else {
    url.searchParams.set("scope", FB_SCOPES);
  }
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

/** user token อายุสั้น → อายุยาว (~60 วัน) */
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

export type IgAccount = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type FbPage = {
  id: string;
  name: string;
  accessToken: string;
  category: string | null;
  avatarUrl: string | null;
  canCreateContent: boolean;
  /** บัญชี Instagram Business/Creator ที่ผูกกับเพจนี้ (ถ้ามี) */
  instagram: IgAccount | null;
};

/** รายชื่อเพจที่ผู้ใช้เป็นแอดมิน พร้อม Page access token */
export async function listPages(userToken: string): Promise<FbPage[]> {
  const pages: FbPage[] = [];
  let after: string | undefined;
  let guard = 0;

  do {
    const json = await graphGet(
      "me/accounts",
      {
        fields:
          "id,name,access_token,category,tasks,picture{url},instagram_business_account{id,username,profile_picture_url}",
        limit: "100",
        after,
      },
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
        instagram: p.instagram_business_account?.id
          ? {
              id: String(p.instagram_business_account.id),
              username: String(
                p.instagram_business_account.username ?? p.instagram_business_account.id,
              ),
              avatarUrl: p.instagram_business_account.profile_picture_url ?? null,
            }
          : null,
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

/** อัปรูปแบบยังไม่เผยแพร่ คืน photo id */
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
    if (error.code === 100) return `Facebook ปฏิเสธคำขอ: ${error.message}`;
    return error.message;
  }
  return error instanceof Error ? error.message : "เผยแพร่ไม่สำเร็จ";
}

// ---------------------------------------------------------------------------
// Instagram — โพสต์ผ่านบัญชี Business/Creator ที่ผูกกับเพจ Facebook
// ใช้ Page access token ตัวเดียวกับเพจที่ผูกไว้
// ---------------------------------------------------------------------------

/** จำนวนครั้งและระยะห่างในการถามสถานะคลิปที่ Instagram กำลังประมวลผล */
const IG_POLL_TRIES = 30;
const IG_POLL_DELAY_MS = 3000;
/** รูปพร้อมเร็วกว่าคลิปมาก ไม่ต้องรอนาน */
const IG_IMAGE_POLL_TRIES = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** สร้าง "ตะกร้า" (container) หนึ่งใบ คืน id ไว้เอาไปสั่งเผยแพร่ */
async function createIgContainer(
  igUserId: string,
  token: string,
  body: Record<string, string | number | boolean | undefined>,
) {
  const json = await graphPost(`${igUserId}/media`, body, token);
  const id = json.id ? String(json.id) : "";
  if (!id) throw new Error("Instagram ไม่คืนรหัสสื่อกลับมา");
  return id;
}

/** คลิปต้องรอ Instagram ประมวลผลให้เสร็จก่อนถึงจะเผยแพร่ได้ */
async function waitForIgContainer(containerId: string, token: string, tries = IG_POLL_TRIES) {
  for (let i = 0; i < tries; i += 1) {
    const json = await graphGet(containerId, { fields: "status_code,status" }, token);
    const code = String(json.status_code ?? "");
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram ประมวลผลไฟล์ไม่สำเร็จ: ${json.status ?? code}`);
    }
    await sleep(IG_POLL_DELAY_MS);
  }
  throw new Error("Instagram ใช้เวลาประมวลผลคลิปนานผิดปกติ — ระบบจะลองใหม่รอบถัดไป");
}

async function publishIgContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<PublishResult> {
  const json = await graphPost(`${igUserId}/media_publish`, { creation_id: containerId }, token);
  const mediaId = String(json.id ?? "");
  if (!mediaId) throw new Error("Instagram ไม่คืนรหัสโพสต์กลับมา");

  let permalink = `https://www.instagram.com/p/${mediaId}`;
  try {
    const info = await graphGet(mediaId, { fields: "permalink" }, token);
    if (info.permalink) permalink = String(info.permalink);
  } catch {
    // ถ้าขอลิงก์ไม่ได้ก็ไม่เป็นไร โพสต์ขึ้นแล้ว
  }
  return { postId: mediaId, permalink };
}

/**
 * โพสต์ลง Instagram
 * - รูป 1 ใบ → โพสต์เดี่ยว
 * - รูป 2–10 ใบ → carousel เรียงตามลำดับที่ส่งมา
 * - คลิป 1 ไฟล์ → Reels
 * Instagram ไม่รับโพสต์ข้อความล้วน และไม่รับรูปปนคลิปในโพสต์เดียว
 */
export async function publishInstagramPost(
  igUserId: string,
  token: string,
  caption: string,
  mediaUrls: string[],
  kind: "image" | "video",
  /** เรียกทันทีที่ได้รหัส container เพื่อให้ฝั่งเรียกจดไว้ก่อนสั่งเผยแพร่จริง */
  onContainer?: (containerId: string) => Promise<void>,
): Promise<PublishResult> {
  if (mediaUrls.length === 0) {
    throw new Error("Instagram ต้องมีรูปหรือคลิปอย่างน้อย 1 ไฟล์ — โพสต์ข้อความล้วนไม่ได้");
  }

  if (kind === "video") {
    if (mediaUrls.length > 1) {
      throw new Error("Instagram โพสต์คลิปได้ 1 ไฟล์ต่อโพสต์ — แยกเป็นหลายโพสต์แทน");
    }
    const containerId = await createIgContainer(igUserId, token, {
      media_type: "REELS",
      video_url: mediaUrls[0]!,
      caption,
    });
    await waitForIgContainer(containerId, token);
    await onContainer?.(containerId);
    return publishIgContainer(igUserId, token, containerId);
  }

  if (mediaUrls.length > 10) throw new Error("Instagram แนบรูปได้ไม่เกิน 10 ใบต่อโพสต์");

  if (mediaUrls.length === 1) {
    const containerId = await createIgContainer(igUserId, token, {
      image_url: mediaUrls[0]!,
      caption,
    });
    await waitForIgContainer(containerId, token, IG_IMAGE_POLL_TRIES);
    await onContainer?.(containerId);
    return publishIgContainer(igUserId, token, containerId);
  }

  const children: string[] = [];
  for (const url of mediaUrls) {
    const child = await createIgContainer(igUserId, token, {
      image_url: url,
      is_carousel_item: true,
    });
    // ลูกทุกใบต้องพร้อมก่อน ไม่งั้นตัวแม่จะสร้างไม่ผ่าน
    await waitForIgContainer(child, token, IG_IMAGE_POLL_TRIES);
    children.push(child);
  }
  const carouselId = await createIgContainer(igUserId, token, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
  });
  await waitForIgContainer(carouselId, token, IG_IMAGE_POLL_TRIES);
  await onContainer?.(carouselId);
  return publishIgContainer(igUserId, token, carouselId);
}

/** โพสต์ล่าสุดของบัญชี Instagram — ใช้ทวนสอบว่ารอบก่อนขึ้นไปแล้วหรือยัง */
async function latestIgMedia(igUserId: string, token: string): Promise<PublishResult | null> {
  try {
    const json = await graphGet(`${igUserId}/media`, { fields: "id,permalink", limit: "1" }, token);
    const first = (json["data"] ?? [])[0];
    if (!first?.id) return null;
    const id = String(first.id);
    return { postId: id, permalink: String(first.permalink ?? instagramPermalinkFallback(id)) };
  } catch {
    return null;
  }
}

export type IgContainerState =
  /** พร้อมสั่งเผยแพร่ */
  | { state: "ready" }
  /** รอบก่อนขึ้นไปแล้ว — เอาผลมาบันทึก ไม่ต้องโพสต์ใหม่ */
  | { state: "published"; result: PublishResult }
  /** หมดอายุหรือพัง — ทิ้งแล้วเริ่มใหม่ได้ */
  | { state: "gone" };

/**
 * ตรวจว่าสื่อที่ค้างไว้จากรอบก่อนอยู่ในสภาพไหน
 * นี่คือด่านที่กันไม่ให้โพสต์ซ้ำ และกันไม่ให้โพสต์ค้างถาวรเพราะใบเดิมตายไปแล้ว
 */
export async function inspectIgContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<IgContainerState> {
  let code = "";
  try {
    const json = await graphGet(containerId, { fields: "status_code" }, token);
    code = String(json["status_code"] ?? "");
  } catch {
    return { state: "gone" };
  }

  if (code === "PUBLISHED") {
    const latest = await latestIgMedia(igUserId, token);
    return latest ? { state: "published", result: latest } : { state: "gone" };
  }
  if (code === "FINISHED") return { state: "ready" };
  if (code === "IN_PROGRESS") {
    await waitForIgContainer(containerId, token);
    return { state: "ready" };
  }
  return { state: "gone" };
}

/**
 * สั่งเผยแพร่ container ที่เคยสร้างค้างไว้จากรอบก่อน
 * ใช้ตอนลองใหม่ เพื่อไม่ให้สร้างสื่อใบใหม่แล้วกลายเป็นโพสต์ซ้ำ
 */
export async function publishExistingIgContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<PublishResult> {
  return publishIgContainer(igUserId, token, containerId);
}

/** ลิงก์โพสต์ Instagram จากรหัสสื่อ (เผื่อขอ permalink ไม่ได้) */
export function instagramPermalinkFallback(mediaId: string) {
  return `https://www.instagram.com/p/${mediaId}`;
}

// ---------------------------------------------------------------------------
// การลบ
// ---------------------------------------------------------------------------

/** ลบโพสต์ออกจากเพจ Facebook จริง */
export async function deleteFacebookPost(postId: string, pageToken: string) {
  await graphDelete(postId, pageToken);
}

/**
 * Instagram ไม่เปิดให้ลบโพสต์ผ่าน API
 * ฟังก์ชันนี้มีไว้ให้ฝั่งเรียกใช้รู้ตัวและแจ้งผู้ใช้ ไม่ใช่ให้เงียบหาย
 */
export const INSTAGRAM_DELETE_UNSUPPORTED =
  "Instagram ไม่เปิดให้ลบโพสต์ผ่าน API — ต้องเข้าไปลบเองในแอป Instagram";
