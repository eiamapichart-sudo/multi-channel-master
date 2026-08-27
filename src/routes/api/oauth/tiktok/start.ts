import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/oauth/tiktok/start
 * body: { brandId: string }
 * → { url } ให้ฝั่งหน้าเว็บพาผู้ใช้ไปหน้าอนุญาตของ TikTok
 */
export const Route = createFileRoute("/api/oauth/tiktok/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireUser, requireBrandManager, json, errorResponse, HttpError } = await import(
          "@/lib/server-auth.server"
        );

        try {
          const user = await requireUser(request);

          const body = (await request.json().catch(() => ({}))) as { brandId?: string };
          const brandId = body.brandId?.trim();
          if (!brandId) throw new HttpError(400, "ไม่ได้ระบุแบรนด์");
          await requireBrandManager(user, brandId);

          const { buildLoginUrl, assertTikTokConfigured } = await import("@/lib/tiktok.server");
          assertTikTokConfigured();

          const { db } = await import("@/lib/db.server");
          const { tiktokRedirectUri } = await import("@/lib/tiktok-redirect.server");

          const state = `${globalThis.crypto.randomUUID()}${globalThis.crypto.randomUUID()}`.replace(
            /-/g,
            "",
          );

          const { error } = await db.from("oauth_sessions").insert({
            state,
            platform: "tiktok",
            brand_id: brandId,
            user_id: user.userId,
            status: "pending",
          });
          if (error) throw new HttpError(500, error.message);

          return json({ url: buildLoginUrl(tiktokRedirectUri(request), state), state });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
