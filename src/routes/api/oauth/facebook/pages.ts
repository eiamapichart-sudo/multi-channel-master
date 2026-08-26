import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/oauth/facebook/pages?state=...
 * → รายชื่อเพจที่ดึงมาได้จากขั้นตอน OAuth ให้ผู้ใช้เลือกว่าจะผูกเพจไหนบ้าง
 */
export const Route = createFileRoute("/api/oauth/facebook/pages")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireUser, json, errorResponse, HttpError } = await import(
          "@/lib/server-auth.server"
        );

        try {
          const user = await requireUser(request);
          const state = new URL(request.url).searchParams.get("state")?.trim();
          if (!state) throw new HttpError(400, "ไม่พบรหัสคำขอ");

          const { db } = await import("@/lib/db.server");
          const { data: session } = await db
            .from("oauth_sessions")
            .select("state, brand_id, user_id, status, accounts, expires_at")
            .eq("state", state)
            .eq("platform", "facebook")
            .maybeSingle();

          if (!session || session.user_id !== user.userId) {
            throw new HttpError(404, "ไม่พบคำขอเชื่อมต่อนี้");
          }
          if (new Date(session.expires_at) < new Date()) {
            throw new HttpError(410, "คำขอหมดอายุ กรุณากดเชื่อมต่อใหม่");
          }
          if (session.status !== "ready") {
            throw new HttpError(409, "คำขอยังไม่พร้อม กรุณาลองใหม่");
          }

          const { data: existing } = await db
            .from("channel_accounts")
            .select("external_id")
            .eq("brand_id", session.brand_id)
            .eq("platform", "facebook")
            .not("external_id", "is", null);

          return json({
            brandId: session.brand_id,
            pages: session.accounts ?? [],
            connectedIds: (existing ?? []).map((row) => row.external_id),
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
