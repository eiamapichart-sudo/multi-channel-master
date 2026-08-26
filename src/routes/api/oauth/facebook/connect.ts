import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/oauth/facebook/connect
 * body: { state: string, pageIds: string[] }
 *
 * บันทึกเพจที่ผู้ใช้เลือกลง channel_accounts + เก็บ Page access token ลง channel_credentials
 * แล้วลบ session ทิ้ง (ใช้ได้ครั้งเดียว)
 */
export const Route = createFileRoute("/api/oauth/facebook/connect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireUser, requireBrandManager, json, errorResponse, HttpError } = await import(
          "@/lib/server-auth.server"
        );

        try {
          const user = await requireUser(request);
          const body = (await request.json().catch(() => ({}))) as {
            state?: string;
            pageIds?: string[];
          };

          const state = body.state?.trim();
          const pageIds = [...new Set(body.pageIds ?? [])].filter(Boolean);
          if (!state) throw new HttpError(400, "ไม่พบรหัสคำขอ");
          if (pageIds.length === 0) throw new HttpError(400, "เลือกเพจอย่างน้อย 1 เพจ");

          const { db } = await import("@/lib/db.server");

          const { data: session } = await db
            .from("oauth_sessions")
            .select("state, brand_id, user_id, status, user_access_token, token_expires_at, expires_at")
            .eq("state", state)
            .eq("platform", "facebook")
            .maybeSingle();

          if (!session || session.user_id !== user.userId) {
            throw new HttpError(404, "ไม่พบคำขอเชื่อมต่อนี้");
          }
          if (new Date(session.expires_at) < new Date()) {
            throw new HttpError(410, "คำขอหมดอายุ กรุณากดเชื่อมต่อใหม่");
          }
          if (session.status !== "ready" || !session.user_access_token) {
            throw new HttpError(409, "คำขอยังไม่พร้อม กรุณาลองใหม่");
          }
          await requireBrandManager(user, session.brand_id);

          const fb = await import("@/lib/facebook.server");
          const allPages = await fb.listPages(session.user_access_token);
          const chosen = allPages.filter((p) => pageIds.includes(p.id));

          if (chosen.length === 0) {
            throw new HttpError(400, "ไม่พบเพจที่เลือกในบัญชี Facebook นี้แล้ว");
          }

          const connected: { id: string; name: string }[] = [];
          const skipped: { name: string; reason: string }[] = [];

          for (const page of chosen) {
            if (!page.canCreateContent) {
              skipped.push({ name: page.name, reason: "บัญชีนี้ไม่มีสิทธิ์สร้างโพสต์บนเพจ" });
              continue;
            }

            try {
              const { data: byExternal } = await db
                .from("channel_accounts")
                .select("id")
                .eq("brand_id", session.brand_id)
                .eq("platform", "facebook")
                .eq("external_id", page.id)
                .maybeSingle();

              let channelAccountId = byExternal?.id ?? null;

              if (!channelAccountId) {
                const { data: byName } = await db
                  .from("channel_accounts")
                  .select("id")
                  .eq("brand_id", session.brand_id)
                  .eq("platform", "facebook")
                  .eq("account_name", page.name)
                  .is("external_id", null)
                  .maybeSingle();
                channelAccountId = byName?.id ?? null;
              }

              const patch = {
                account_name: page.name,
                external_id: page.id,
                avatar_url: page.avatarUrl,
                connected: true,
                connected_at: new Date().toISOString(),
                last_error: null,
              };

              if (channelAccountId) {
                const { error } = await db
                  .from("channel_accounts")
                  .update(patch)
                  .eq("id", channelAccountId);
                if (error) throw new Error(error.message);
              } else {
                const { data: inserted, error } = await db
                  .from("channel_accounts")
                  .insert({ brand_id: session.brand_id, platform: "facebook", ...patch })
                  .select("id")
                  .single();
                if (error) throw new Error(error.message);
                channelAccountId = inserted.id;
              }

              const { error: credentialError } = await db
                .from("channel_credentials")
                .upsert(
                  {
                    channel_account_id: channelAccountId,
                    platform: "facebook",
                    external_id: page.id,
                    access_token: page.accessToken,
                    token_expires_at: null,
                    scopes: fb.FB_SCOPES.split(",").map((x) => x.trim()).filter(Boolean),
                    connected_by: user.userId,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "channel_account_id" },
                );
              if (credentialError) throw new Error(credentialError.message);

              connected.push({ id: page.id, name: page.name });
            } catch (pageError) {
              console.error("[facebook-connect]", page.id, pageError);
              skipped.push({
                name: page.name,
                reason: pageError instanceof Error ? pageError.message : "บันทึกเพจนี้ไม่สำเร็จ",
              });
            }
          }

          await db.from("oauth_sessions").delete().eq("state", state);

          return json({ connected, skipped });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
