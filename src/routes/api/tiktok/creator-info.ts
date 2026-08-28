import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/tiktok/creator-info
 * body: { channelAccountId: string }
 * → ข้อมูลบัญชี TikTok + ตัวเลือกความเป็นส่วนตัวที่บัญชีนั้นใช้ได้จริง
 *
 * ทำไมต้องมี: กติกา App Review ของ TikTok บังคับให้แอปเรียก creator_info
 * ก่อนแสดงฟอร์มโพสต์ทุกครั้ง แล้วแสดงตัวเลือกตามที่ได้กลับมา
 * ห้ามใช้รายการที่ hardcode ไว้ และห้ามเลือกให้ผู้ใช้ล่วงหน้า
 */
export const Route = createFileRoute("/api/tiktok/creator-info")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireUser, requireBrandManager, json, errorResponse, HttpError } =
          await import("@/lib/server-auth.server");

        try {
          const user = await requireUser(request);

          const body = (await request.json().catch(() => ({}))) as { channelAccountId?: string };
          const channelAccountId = body.channelAccountId?.trim();
          if (!channelAccountId) throw new HttpError(400, "ไม่ได้ระบุบัญชี TikTok");

          const { db } = await import("@/lib/db.server");
          const { data: account, error: accountError } = await db
            .from("channel_accounts")
            .select("id, brand_id, platform, account_name, connected")
            .eq("id", channelAccountId)
            .maybeSingle();

          if (accountError) throw new HttpError(500, accountError.message);
          if (!account) throw new HttpError(404, "ไม่พบบัญชีนี้");
          if (account.platform !== "tiktok") throw new HttpError(400, "บัญชีนี้ไม่ใช่ TikTok");

          // ผู้ใช้ต้องมีสิทธิ์ดูแลแบรนด์ที่เป็นเจ้าของบัญชีนี้
          await requireBrandManager(user, account.brand_id);

          const { getTikTokAccessToken } = await import("@/lib/tiktok-token.server");
          const { accessToken, scopes } = await getTikTokAccessToken(channelAccountId);

          const { getCreatorInfo } = await import("@/lib/tiktok.server");
          const creator = await getCreatorInfo(accessToken);

          return json({
            creator,
            /** มีสิทธิ์โพสต์ขึ้นโปรไฟล์เลยหรือไม่ (ถ้าไม่มี จะส่งเข้ากล่องร่างแทน) */
            canDirectPost: scopes.includes("video.publish"),
            accountName: account.account_name,
          });
        } catch (error) {
          const { humanizeTikTokError } = await import("@/lib/tiktok.server");
          const { errorResponse: respond } = await import("@/lib/server-auth.server");
          // แปลง error ของ TikTok เป็นข้อความที่ผู้ใช้อ่านรู้เรื่องก่อนส่งกลับ
          if (error instanceof Error && error.name === "TikTokError") {
            return respond(new Error(humanizeTikTokError(error)));
          }
          return errorResponse(error);
        }
      },
    },
  },
});
