import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/publish/now
 * body: { postId: string }
 * เผยแพร่โพสต์ที่อนุมัติแล้วทันที (ปุ่ม "เผยแพร่เดี๋ยวนี้" ในคิวอนุมัติ)
 * ใช้ลองใหม่กับโพสต์ที่ล้มเหลวได้ด้วย
 */
export const Route = createFileRoute("/api/publish/now")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireUser, requireBrandManager, json, errorResponse, HttpError } = await import(
          "@/lib/server-auth.server"
        );

        try {
          const user = await requireUser(request);
          const body = (await request.json().catch(() => ({}))) as { postId?: string };
          const postId = body.postId?.trim();
          if (!postId) throw new HttpError(400, "ไม่ได้ระบุโพสต์");

          const { data: post, error } = await user.supabase
            .from("posts")
            .select("id, brand_id, status")
            .eq("id", postId)
            .maybeSingle();
          if (error) throw new HttpError(500, error.message);
          if (!post) throw new HttpError(403, "ไม่พบโพสต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง");

          if (!["approved", "failed", "publishing"].includes(post.status as string)) {
            throw new HttpError(400, "ต้องอนุมัติโพสต์ก่อนจึงจะเผยแพร่ได้");
          }

          // สั่งเผยแพร่ทันทีคือการข้ามเวลาที่ผู้อนุมัติตั้งไว้ — จำกัดไว้ที่เจ้าของ/ผู้อนุมัติ
          await requireBrandManager(user, post.brand_id as string);

          const { db } = await import("@/lib/db.server");
          const { data: claimed } = await db
            .from("posts")
            .update({ status: "publishing", publishing_started_at: new Date().toISOString() })
            .eq("id", postId)
            .in("status", ["approved", "failed"])
            .select("id");

          if (!claimed?.length) {
            throw new HttpError(409, "โพสต์นี้กำลังถูกเผยแพร่อยู่ ลองรีเฟรชอีกครั้ง");
          }

          const { publishPost } = await import("@/lib/publish.server");
          const summary = await publishPost(postId);

          return json({
            ok: summary.failed === 0,
            published: summary.published,
            failed: summary.failed,
            skipped: summary.skipped,
            errors: summary.errors,
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
