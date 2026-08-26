import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/oauth/facebook/callback
 * Facebook พาผู้ใช้กลับมาที่นี่พร้อม ?code=...&state=...
 *
 * ที่นี่จะ:
 *   1. ตรวจ state ว่าเป็นของจริงและยังไม่หมดอายุ
 *   2. แลก code → user token อายุสั้น → อายุยาว (~60 วัน)
 *   3. ดึงรายชื่อเพจที่ผู้ใช้เป็นแอดมิน แล้วพักไว้ใน oauth_sessions
 *   4. ส่งกลับหน้าตั้งค่า ให้ผู้ใช้ติ๊กเลือกเพจที่จะผูก
 *
 * หมายเหตุ: Page access token ไม่เคยถูกส่งออกไปฝั่งเบราว์เซอร์เลย
 */
export const Route = createFileRoute("/api/oauth/facebook/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { appOrigin, facebookRedirectUri } = await import("@/lib/facebook-redirect.server");
        const origin = appOrigin(request);

        const back = (params: Record<string, string>) => {
          const url = new URL("/settings", origin);
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
          return new Response(null, { status: 302, headers: { location: url.toString() } });
        };

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const fbError =
          url.searchParams.get("error_description") ?? url.searchParams.get("error");

        if (fbError) return back({ fb_error: `Facebook: ${fbError}` });
        if (!code || !state) return back({ fb_error: "ลิงก์กลับจาก Facebook ไม่สมบูรณ์" });

        const { db } = await import("@/lib/db.server");

        const { data: session } = await db
          .from("oauth_sessions")
          .select("state, brand_id, user_id, status, expires_at")
          .eq("state", state)
          .eq("platform", "facebook")
          .maybeSingle();

        if (!session) return back({ fb_error: "คำขอเชื่อมต่อไม่ถูกต้อง กรุณาลองใหม่" });
        if (new Date(session.expires_at) < new Date()) {
          await db.from("oauth_sessions").delete().eq("state", state);
          return back({ fb_error: "คำขอเชื่อมต่อหมดอายุ กรุณากดเชื่อมต่อใหม่" });
        }
        if (session.status !== "pending") {
          return back({ fb_error: "ลิงก์นี้ถูกใช้ไปแล้ว กรุณากดเชื่อมต่อใหม่" });
        }

        try {
          const fb = await import("@/lib/facebook.server");

          const shortToken = await fb.exchangeCodeForToken(code, facebookRedirectUri(request));
          const longLived = await fb.exchangeForLongLivedToken(shortToken);
          const pages = await fb.listPages(longLived.accessToken);

          if (pages.length === 0) {
            await db.from("oauth_sessions").delete().eq("state", state);
            return back({
              fb_error:
                "ไม่พบเพจที่คุณเป็นแอดมิน — ต้องเป็น Facebook Page (ไม่ใช่โปรไฟล์ส่วนตัว) และบัญชีต้องมีสิทธิ์แอดมิน",
            });
          }

          await db
            .from("oauth_sessions")
            .update({
              status: "ready",
              user_access_token: longLived.accessToken,
              token_expires_at: longLived.expiresAt?.toISOString() ?? null,
              accounts: pages.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                avatarUrl: p.avatarUrl,
                canCreateContent: p.canCreateContent,
              })),
              expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
            })
            .eq("state", state);

          return back({ fb: state });
        } catch (error) {
          console.error("[facebook-callback]", error);
          await db.from("oauth_sessions").delete().eq("state", state);
          const { humanizeFacebookError } = await import("@/lib/facebook.server");
          return back({ fb_error: humanizeFacebookError(error) });
        }
      },
    },
  },
});
