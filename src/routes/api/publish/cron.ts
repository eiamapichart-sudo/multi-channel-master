import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/publish/cron
 *
 * ตัวจับเวลาโพสต์ — ให้ Lovable Cloud → Jobs เรียกทุก 1 นาที
 * ต้องแนบ header: Authorization: Bearer LOVABLE_CRON_SECRET
 *
 * แต่ละรอบจะ:
 *   1. กู้งานที่ค้างสถานะ "กำลังเผยแพร่" นานผิดปกติ
 *   2. หยิบโพสต์ที่อนุมัติแล้วและถึงเวลาแล้วมาเผยแพร่
 *   3. เก็บกวาดคำขอ OAuth ที่หมดอายุ
 */
export const Route = createFileRoute("/api/publish/cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        try {
          const { runDuePosts, recoverStuck } = await import("@/lib/publish.server");
          const { db } = await import("@/lib/db.server");

          const recovered = await recoverStuck();
          const results = await runDuePosts();
          await db.rpc("purge_expired_oauth_sessions");

          const published = results.reduce((sum, r) => sum + r.published, 0);
          const failed = results.reduce((sum, r) => sum + r.failed, 0);

          if (results.length) {
            console.log(
              `[publish-cron] โพสต์ ${results.length} รายการ · สำเร็จ ${published} · ล้มเหลว ${failed}`,
            );
          }

          return new Response(
            JSON.stringify({ recovered, posts: results.length, published, failed, results }),
            { headers: { "content-type": "application/json; charset=utf-8" } },
          );
        } catch (error) {
          console.error("[publish-cron]", error);
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "cron failed" }),
            { status: 500, headers: { "content-type": "application/json; charset=utf-8" } },
          );
        }
      },
    },
  },
});
