import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/oauth/youtube/start
 * body: { brandId: string }
 * → { url } ให้ฝั่งหน้าเว็บพาผู้ใช้ไปหน้าอนุญาตของ Google
 */
export const Route = createFileRoute("/api/oauth/youtube/start")({
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

          const { buildLoginUrl, assertYouTubeConfigured } = await import("@/lib/youtube.server");
          assertYouTubeConfigured();

          const { db } = await import("@/lib/db.server");
          const { youtubeRedirectUri } = await import("@/lib/youtube-redirect.server");

          const state = `${globalThis.crypto.randomUUID()}${globalThis.crypto.randomUUID()}`.replace(
            /-/g,
            "",
          );

          const { error } = await db.from("oauth_sessions").insert({
            state,
            platform: "youtube",
            brand_id: brandId,
            user_id: user.userId,
            status: "pending",
          });
          if (error) throw new HttpError(500, error.message);

          return json({ url: buildLoginUrl(youtubeRedirectUri(request), state), state });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
