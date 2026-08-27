/**
 * publish.server.ts — หัวใจของการเผยแพร่จริง
 *
 * ใช้ทั้งจากปุ่ม "เผยแพร่เดี๋ยวนี้" และจาก cron ที่วิ่งทุกนาที
 * ทุกฟังก์ชันในไฟล์นี้ใช้ service role → อย่า import จากฝั่ง client เด็ดขาด
 */
import { db } from "@/lib/db.server";
import {
  assertFacebookConfigured,
  humanizeFacebookError,
  inspectIgContainer,
  instagramPermalinkFallback,
  permalinkFromPostId,
  publishExistingIgContainer,
  publishInstagramPost,
  publishPhotoPost,
  publishTextPost,
  publishVideoPost,
  type PublishResult,
} from "@/lib/facebook.server";

const MEDIA_BUCKET = "post-media";
const SIGNED_URL_TTL = 60 * 30;
const BATCH_SIZE = 10;
/** จำนวนครั้งที่ยอมให้ลองใหม่ต่อหนึ่งปลายทางก่อนหยุด */
export const MAX_ATTEMPTS = 3;
/** ช่องทางที่ระบบส่งขึ้นได้จริงแล้ว */
const LIVE_PLATFORMS = ["facebook", "instagram", "tiktok"];

const isVideoPath = (path: string) => /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(path.split("?")[0] ?? "");


type TargetRow = {
  id: string;
  platform: string;
  channel_account_id: string | null;
  override_body: string | null;
  status: string;
  attempt_count: number;
  external_id: string | null;
  /** Instagram: รหัส container ที่สร้างค้างไว้ ใช้ต่อยอดตอนลองใหม่ กันโพสต์ซ้ำ */
  pending_external_id: string | null;
};

export type PublishSummary = {
  postId: string;
  published: number;
  failed: number;
  skipped: number;
  errors: string[];
};

/** เขียนผลลัพธ์ลงฐานข้อมูลแบบลองซ้ำ — กันกรณีโพสต์ขึ้นเพจแล้วแต่บันทึกไม่ติด */
async function updateWithRetry(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  attempts = 3,
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const { error } = await db.from(table).update(patch).eq("id", id);
    if (!error) return true;
    console.error(`[publish] เขียน ${table}/${id} ไม่สำเร็จ (ครั้งที่ ${i + 1})`, error.message);
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return false;
}

/** แปลง path ในคลังไฟล์เป็น URL ชั่วคราวที่ Facebook เข้าถึงได้ */
async function signMediaPaths(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) throw new Error(`สร้างลิงก์ไฟล์ไม่สำเร็จ: ${error.message}`);

  return paths.map((path) => {
    const hit = data?.find((d) => d.path === path);
    if (!hit?.signedUrl) throw new Error(`ไม่พบไฟล์ในคลัง: ${path}`);
    return hit.signedUrl.startsWith("http")
      ? hit.signedUrl
      : `${process.env["SUPABASE_URL"]}/storage/v1${hit.signedUrl}`;
  });
}

/** ยิงโพสต์ขึ้นเพจ Facebook หนึ่งเพจ */
async function publishToFacebook(
  pageId: string,
  pageToken: string,
  message: string,
  mediaPaths: string[],
): Promise<PublishResult> {
  if (mediaPaths.length === 0) {
    if (!message.trim()) throw new Error("โพสต์ว่าง — ต้องมีข้อความหรือสื่ออย่างน้อยหนึ่งอย่าง");
    return publishTextPost(pageId, pageToken, message);
  }

  const videos = mediaPaths.filter(isVideoPath);
  if (videos.length > 0) {
    if (videos.length !== mediaPaths.length) throw new Error("โพสต์เดียวผสมรูปกับวิดีโอไม่ได้");
    if (videos.length > 1) {
      throw new Error("Facebook โพสต์วิดีโอได้ 1 คลิปต่อโพสต์ — แยกเป็นหลายโพสต์แทน");
    }
    const [url] = await signMediaPaths(videos);
    return publishVideoPost(pageId, pageToken, message, url!);
  }

  const urls = await signMediaPaths(mediaPaths);
  return publishPhotoPost(pageId, pageToken, message, urls);
}

/**
 * โพสต์ลง Instagram หนึ่งบัญชี
 * - ถ้ารอบก่อนสร้าง container ค้างไว้ (pending_external_id) จะตรวจและต่อยอดจากใบเดิม
 *   เพื่อไม่ให้เกิดโพสต์ซ้ำบน IG
 */
async function publishToInstagram(
  target: TargetRow,
  igUserId: string,
  token: string,
  caption: string,
  mediaPaths: string[],
): Promise<PublishResult> {
  if (mediaPaths.length === 0) {
    throw new Error("Instagram ต้องมีรูปหรือคลิปอย่างน้อย 1 ไฟล์ — โพสต์ข้อความล้วนไม่ได้");
  }

  const videos = mediaPaths.filter(isVideoPath);
  if (videos.length > 0 && videos.length !== mediaPaths.length) {
    throw new Error("Instagram ไม่รับรูปปนคลิปในโพสต์เดียว — เลือกอย่างใดอย่างหนึ่ง");
  }
  const kind = videos.length > 0 ? "video" : "image";

  // รอบก่อนอาจสร้าง container ไว้แล้วแต่ยังไม่ได้สั่งเผยแพร่ → ใช้ใบเดิมต่อ
  if (target.pending_external_id) {
    const state = await inspectIgContainer(igUserId, token, target.pending_external_id);
    if (state.state === "published") return state.result;
    if (state.state === "ready") {
      return publishExistingIgContainer(igUserId, token, target.pending_external_id);
    }
    // gone → ใบเดิมตายแล้ว สร้างใหม่ด้านล่าง
  }

  const urls = await signMediaPaths(mediaPaths);
  return publishInstagramPost(igUserId, token, caption, urls, kind, async (containerId) => {
    // จดรหัส container ไว้ก่อนสั่งเผยแพร่จริง — ถ้าพังตรงนี้ รอบหน้าจะมาต่อจากใบนี้
    await updateWithRetry("post_targets", target.id, { pending_external_id: containerId });
  });
}

type CredentialRow = {
  access_token: string;
  token_expires_at: string | null;
  refresh_token: string | null;
  refresh_expires_at: string | null;
  scopes: string[] | null;
  meta: Record<string, unknown> | null;
};

/**
 * ต่ออายุสิทธิ์ TikTok ให้เอง — access token ของ TikTok อายุแค่ ~24 ชม.
 * ถ้าเหลือน้อยกว่า 10 นาที (หรือหมดแล้ว) จะใช้ refresh token ขอใหม่และบันทึกทับ
 */
async function ensureTikTokToken(
  channelAccountId: string,
  credential: CredentialRow,
): Promise<string> {
  const expiresAt = credential.token_expires_at ? new Date(credential.token_expires_at) : null;
  const fresh = !expiresAt || expiresAt.getTime() - Date.now() > 10 * 60_000;
  if (fresh) return credential.access_token;

  if (!credential.refresh_token) {
    throw new Error("สิทธิ์ TikTok หมดอายุ และไม่มีรหัสต่ออายุ — กดเชื่อมต่อ TikTok ใหม่ในหน้าตั้งค่า");
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
      refresh_token: tokens.refreshToken ?? credential.refresh_token,
      refresh_expires_at:
        tokens.refreshExpiresAt?.toISOString() ?? credential.refresh_expires_at ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("channel_account_id", channelAccountId);

  return tokens.accessToken;
}

/**
 * โพสต์คลิปลง TikTok หนึ่งบัญชี
 *
 * - TikTok รับได้ 1 คลิปต่อโพสต์ และไม่รับรูปผ่านช่องทางนี้
 * - ถ้ารอบก่อนสร้างงานค้างไว้ (pending_external_id = publish_id) จะไปเช็คสถานะงานเดิมก่อน
 *   เพื่อไม่ให้เกิดคลิปซ้ำบนโปรไฟล์
 * - ถ้าแอปยังไม่ผ่าน audit ของ TikTok จะส่งเข้ากล่องร่างในแอปให้ครีเอเตอร์กดโพสต์เอง
 */
async function publishToTikTok(
  target: TargetRow,
  token: string,
  caption: string,
  mediaPaths: string[],
  credential: CredentialRow,
): Promise<PublishResult> {
  const tt = await import("@/lib/tiktok.server");

  if (mediaPaths.length === 0) throw new Error("TikTok ต้องมีคลิปวิดีโอ 1 คลิป — โพสต์ข้อความล้วนไม่ได้");
  const videos = mediaPaths.filter(isVideoPath);
  if (videos.length !== mediaPaths.length) throw new Error("TikTok รับได้เฉพาะไฟล์วิดีโอ");
  if (videos.length > 1) throw new Error("TikTok โพสต์ได้ 1 คลิปต่อโพสต์ — แยกเป็นหลายโพสต์แทน");

  const username = String((credential.meta as { username?: string } | null)?.username ?? "");

  // งานค้างจากรอบก่อน → เช็คก่อนว่ามันขึ้นไปแล้วหรือยัง
  if (target.pending_external_id) {
    const state = await tt.fetchPublishStatus(token, target.pending_external_id);
    if (state.state === "done") {
      return { postId: state.postId, permalink: tt.tiktokPermalink(username, state.postId) };
    }
    if (state.state === "processing") {
      const waited = await tt.waitForPublish(token, target.pending_external_id, 5);
      if (waited.state === "done") {
        return { postId: waited.postId, permalink: tt.tiktokPermalink(username, waited.postId) };
      }
      if (waited.state === "processing") {
        throw new Error("TikTok ยังประมวลผลคลิปอยู่ — ระบบจะตามเก็บผลให้ในรอบถัดไป");
      }
    }
    // failed → เริ่มงานใหม่ด้านล่าง
  }

  const [url] = await signMediaPaths(videos);
  const scopes = credential.scopes ?? [];
  const canDirectPost = scopes.includes("video.publish");
  const privacyOptions = ((credential.meta as { privacy_options?: string[] } | null)
    ?.privacy_options ?? []) as string[];
  const privacyLevel = privacyOptions.includes("PUBLIC_TO_EVERYONE")
    ? "PUBLIC_TO_EVERYONE"
    : (privacyOptions[0] ?? "SELF_ONLY");

  const remember = async (publishId: string) => {
    // จดรหัสงานก่อนอัปโหลดจริง — ถ้าพังกลางทาง รอบหน้าจะมาต่อจากงานนี้ ไม่โพสต์ซ้ำ
    await updateWithRetry("post_targets", target.id, { pending_external_id: publishId });
  };

  let publishId: string;
  try {
    ({ publishId } = await tt.publishTikTokVideo(
      token,
      url!,
      { directPost: canDirectPost, title: caption, privacyLevel },
      remember,
    ));
  } catch (error) {
    // แอปยังไม่ผ่าน audit → ถอยไปใช้กล่องร่างในแอป TikTok แทน ไม่ให้โพสต์ตกหล่น
    const unaudited =
      error instanceof tt.TikTokError &&
      (error.code === "unaudited_client_can_only_post_to_private_accounts" ||
        error.code === "scope_not_authorized");
    if (!canDirectPost || !unaudited) throw error;
    ({ publishId } = await tt.publishTikTokVideo(
      token,
      url!,
      { directPost: false, title: caption },
      remember,
    ));
  }

  const state = await tt.waitForPublish(token, publishId);
  if (state.state === "failed") throw new Error(state.reason);
  if (state.state === "processing") {
    throw new Error("TikTok ยังประมวลผลคลิปอยู่ — ระบบจะตามเก็บผลให้ในรอบถัดไป");
  }

  return { postId: state.postId, permalink: tt.tiktokPermalink(username, state.postId) };
}



/**
 * เผยแพร่โพสต์หนึ่งโพสต์ไปทุกเพจที่เลือกไว้
 * ปลอดภัยที่จะเรียกซ้ำ — ปลายทางที่ส่งไปแล้วจะถูกข้าม
 */
export async function publishPost(postId: string): Promise<PublishSummary> {
  const summary: PublishSummary = { postId, published: 0, failed: 0, skipped: 0, errors: [] };

  const { data: post, error: postError } = await db
    .from("posts")
    .select("id, brand_id, body, media_url, media_urls, status")
    .eq("id", postId)
    .maybeSingle();
  if (postError) throw new Error(postError.message);
  if (!post) throw new Error("ไม่พบโพสต์นี้");

  const { data: targetRows, error: targetError } = await db
    .from("post_targets")
    .select(
      "id, platform, channel_account_id, override_body, status, attempt_count, external_id, pending_external_id",
    )
    .eq("post_id", postId);
  if (targetError) throw new Error(targetError.message);

  const targets = (targetRows ?? []) as TargetRow[];
  const mediaPaths: string[] = (post.media_urls as string[] | null)?.length
    ? (post.media_urls as string[])
    : post.media_url
      ? [post.media_url as string]
      : [];

  for (const target of targets) {
    if (target.status === "published") {
      summary.skipped += 1;
      continue;
    }

    if (!LIVE_PLATFORMS.includes(target.platform) || !target.channel_account_id) {
      summary.skipped += 1;
      continue;
    }

    if (target.attempt_count >= MAX_ATTEMPTS) {
      summary.skipped += 1;
      continue;
    }

    if (target.external_id) {
      await updateWithRetry("post_targets", target.id, {
        status: "published",
        external_url:
          target.platform === "instagram"
            ? instagramPermalinkFallback(target.external_id)
            : target.platform === "tiktok"
              ? `https://www.tiktok.com/video/${target.external_id}`
              : permalinkFromPostId(target.external_id),
        error_message: null,
        published_at: new Date().toISOString(),
      });
      summary.published += 1;
      continue;
    }


    const { data: claimed } = await db
      .from("post_targets")
      .update({
        status: "publishing",
        attempt_count: target.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .in("status", ["queued", "failed"])
      .select("id");
    if (!claimed || claimed.length === 0) {
      summary.skipped += 1;
      continue;
    }

    const isTikTok = target.platform === "tiktok";

    try {
      if (isTikTok) {
        const { assertTikTokConfigured } = await import("@/lib/tiktok.server");
        assertTikTokConfigured();
      } else {
        assertFacebookConfigured();
      }

      const { data: account, error: accountError } = await db
        .from("channel_accounts")
        .select("id, account_name, external_id, connected")
        .eq("id", target.channel_account_id)
        .maybeSingle();
      if (accountError) throw new Error(accountError.message);
      if (!account?.external_id || !account.connected) {
        throw new Error(
          target.platform === "instagram"
            ? "บัญชี Instagram นี้ยังไม่ได้เชื่อมต่อ — กดเชื่อมต่อ Facebook ในหน้าตั้งค่าก่อน"
            : isTikTok
              ? "บัญชี TikTok นี้ยังไม่ได้เชื่อมต่อ — กดเชื่อมต่อ TikTok ในหน้าตั้งค่าก่อน"
              : "เพจนี้ยังไม่ได้เชื่อมต่อ Facebook — กดเชื่อมต่อในหน้าตั้งค่าก่อน",
        );
      }

      const { data: credentialRow, error: credentialError } = await db
        .from("channel_credentials")
        .select("access_token, token_expires_at, refresh_token, refresh_expires_at, scopes, meta")
        .eq("channel_account_id", target.channel_account_id)
        .maybeSingle();
      if (credentialError) throw new Error(credentialError.message);
      const credential = credentialRow as CredentialRow | null;
      if (!credential?.access_token) {
        throw new Error("ไม่พบสิทธิ์เข้าถึงบัญชี — กดเชื่อมต่อใหม่ในหน้าตั้งค่า");
      }
      // TikTok ต่ออายุเองได้ ส่วน Meta ต้องให้ผู้ใช้กดเชื่อมใหม่
      if (
        !isTikTok &&
        credential.token_expires_at &&
        new Date(credential.token_expires_at) < new Date()
      ) {
        throw new Error("สิทธิ์เข้าถึงบัญชีหมดอายุ — กดเชื่อมต่อใหม่ในหน้าตั้งค่า");
      }

      const accessToken = isTikTok
        ? await ensureTikTokToken(target.channel_account_id, credential)
        : credential.access_token;

      const message = (target.override_body ?? post.body ?? "").trim();
      const result = isTikTok
        ? await publishToTikTok(target, accessToken, message, mediaPaths, credential)
        : target.platform === "instagram"
          ? await publishToInstagram(target, account.external_id, accessToken, message, mediaPaths)
          : await publishToFacebook(account.external_id, accessToken, message, mediaPaths);


      const saved = await updateWithRetry("post_targets", target.id, {
        status: "published",
        external_id: result.postId,
        external_url: result.permalink,
        pending_external_id: null,
        error_message: null,
        published_at: new Date().toISOString(),
      });

      if (!saved) {
        console.error(
          `[publish] โพสต์ขึ้นเพจสำเร็จแต่บันทึกสถานะไม่ได้ target=${target.id} fb=${result.postId}`,
        );
        summary.errors.push(
          "โพสต์ขึ้นเพจแล้วแต่บันทึกสถานะในระบบไม่สำเร็จ — ตรวจหน้าเพจก่อนกดลองใหม่",
        );
      }

      await db
        .from("channel_accounts")
        .update({ last_error: null })
        .eq("id", target.channel_account_id);
      summary.published += 1;
    } catch (error) {
      let message: string;
      if (isTikTok) {
        const { humanizeTikTokError } = await import("@/lib/tiktok.server");
        message = humanizeTikTokError(error);
      } else {
        message = humanizeFacebookError(error);
      }
      summary.failed += 1;
      summary.errors.push(message);


      await updateWithRetry("post_targets", target.id, { status: "failed", error_message: message });

      if (target.channel_account_id) {
        await db
          .from("channel_accounts")
          .update({ last_error: message })
          .eq("id", target.channel_account_id);
      }
    }
  }

  await syncPostStatus(postId);
  return summary;
}

/** อัปเดตสถานะของโพสต์ให้ตรงกับผลของทุกปลายทาง */
async function syncPostStatus(postId: string) {
  const { data } = await db
    .from("post_targets")
    .select("status, platform, channel_account_id, attempt_count")
    .eq("post_id", postId);

  const rows = (data ?? []) as TargetRow[];
  const anyPublished = rows.some((r) => r.status === "published");
  const anyFailed = rows.some((r) => r.status === "failed");
  const anyRetryable = rows.some(
    (r) =>
      ["facebook", "instagram"].includes(r.platform) &&
      r.channel_account_id &&
      ["queued", "publishing"].includes(r.status) &&
      r.attempt_count < MAX_ATTEMPTS,
  );

  const publishedAt = anyPublished ? { published_at: new Date().toISOString() } : {};

  if (anyFailed) {
    await db
      .from("posts")
      .update({ status: "failed", ...publishedAt })
      .eq("id", postId);
    return;
  }
  if (anyPublished) {
    await db
      .from("posts")
      .update({ status: "published", ...publishedAt })
      .eq("id", postId);
    return;
  }
  if (anyRetryable) {
    await db.from("posts").update({ status: "approved" }).eq("id", postId);
    return;
  }
  await db.from("posts").update({ status: "failed" }).eq("id", postId);
}

/**
 * หยิบโพสต์ที่ถึงเวลาแล้วมาเผยแพร่ (เรียกจาก cron ทุกนาที)
 * เลือกจาก "ปลายทางที่ส่งได้จริง" เป็นตัวตั้ง → คิวไม่ตัน
 */
export async function runDuePosts(): Promise<PublishSummary[]> {
  const nowIso = new Date().toISOString();

  const { data: dueTargets, error } = await db
    .from("post_targets")
    .select("post_id, posts!inner(id, status, scheduled_at)")
    .in("platform", ["facebook", "instagram"])
    .not("channel_account_id", "is", null)
    .in("status", ["queued", "failed"])
    .lt("attempt_count", MAX_ATTEMPTS)
    .in("posts.status", ["approved", "failed"])
    .not("posts.scheduled_at", "is", null)
    .lte("posts.scheduled_at", nowIso)
    .limit(200);
  if (error) throw new Error(error.message);
  if (!dueTargets?.length) return [];

  const byPost = new Map<string, string>();
  for (const row of dueTargets as unknown as {
    post_id: string;
    posts: { scheduled_at: string };
  }[]) {
    if (!byPost.has(row.post_id)) byPost.set(row.post_id, row.posts?.scheduled_at ?? nowIso);
  }
  const ordered = [...byPost.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .slice(0, BATCH_SIZE)
    .map(([id]) => id);

  const results: PublishSummary[] = [];
  for (const postId of ordered) {
    const { data: claimed } = await db
      .from("posts")
      .update({ status: "publishing", publishing_started_at: new Date().toISOString() })
      .eq("id", postId)
      .in("status", ["approved", "failed"])
      .select("id");
    if (!claimed?.length) continue;

    try {
      results.push(await publishPost(postId));
    } catch (err) {
      console.error("[publish] post", postId, err);
      await db.from("posts").update({ status: "failed" }).eq("id", postId);
      results.push({
        postId,
        published: 0,
        failed: 1,
        skipped: 0,
        errors: [err instanceof Error ? err.message : "เผยแพร่ไม่สำเร็จ"],
      });
    }
  }
  return results;
}

/** กู้งานที่ค้างสถานะ "กำลังเผยแพร่" นานผิดปกติ ทั้งระดับโพสต์และปลายทาง */
export async function recoverStuck(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();

  const { data: stuckTargets } = await db
    .from("post_targets")
    .update({
      status: "failed",
      error_message: "การเผยแพร่ค้างกลางทาง ระบบยกเลิกให้แล้ว — ตรวจหน้าเพจก่อนกดลองใหม่",
    })
    .eq("status", "publishing")
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`)
    .select("id");

  const { data: stuckPosts } = await db
    .from("posts")
    .update({ status: "approved" })
    .eq("status", "publishing")
    .or(`publishing_started_at.is.null,publishing_started_at.lt.${cutoff}`)
    .select("id");

  return { targets: stuckTargets?.length ?? 0, posts: stuckPosts?.length ?? 0 };
}
