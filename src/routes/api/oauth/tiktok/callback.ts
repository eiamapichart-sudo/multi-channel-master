import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/oauth/tiktok/callback
 * TikTok พาผู้ใช้กลับมาที่นี่พร้อม ?code=...&state=...
 *
 * TikTok ให้สิทธิ์ทีละบัญชี (ไม่มีรายการเพจให้เลือกเหมือน Facebook)
 * จึงผูกบัญชีให้เสร็จในขั้นตอนนี้เลย แล้วเด้งกลับหน้าตั้งค่า
 *
 * access token / refresh token ไม่เคยถูกส่งออกไปฝั่งเบราว์เซอร์
 */
export const Route = createFileRoute("/api/oauth/tiktok/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { tiktokAppOrigin, tiktokRedirectUri } = await import(
          "@/lib/tiktok-redirect.server"
        );
        const origin = tiktokAppOrigin(request);

        const back = (params: Record<string, string>) => {
          const url = new URL("/settings", origin);
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
          return new Response(null, { status: 302, headers: { location: url.toString() } });
        };

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const ttError =
          url.searchParams.get("error_description") ?? url.searchParams.get("error");

        if (ttError) return back({ tt_error: `TikTok: ${ttError}` });
        if (!code || !state) return back({ tt_error: "ลิงก์กลับจาก TikTok ไม่สมบูรณ์" });

        const { db } = await import("@/lib/db.server");

        const { data: session } = await db
          .from("oauth_sessions")
          .select("state, brand_id, user_id, status, expires_at")
          .eq("state", state)
          .eq("platform", "tiktok")
          .maybeSingle();

        if (!session) return back({ tt_error: "คำขอเชื่อมต่อไม่ถูกต้อง กรุณาลองใหม่" });
        if (new Date(session.expires_at) < new Date()) {
          await db.from("oauth_sessions").delete().eq("state", state);
          return back({ tt_error: "คำขอเชื่อมต่อหมดอายุ กรุณากดเชื่อมต่อใหม่" });
        }
        if (session.status !== "pending") {
          return back({ tt_error: "ลิงก์นี้ถูกใช้ไปแล้ว กรุณากดเชื่อมต่อใหม่" });
        }

        try {
          const tt = await import("@/lib/tiktok.server");

          const tokens = await tt.exchangeCodeForToken(code, tiktokRedirectUri(request));

          // ชื่อบัญชี: ลองจาก creator_info (ได้ตัวเลือกความเป็นส่วนตัวด้วย) ถ้าไม่ได้ค่อยใช้ user info
          let username = "";
          let displayName = "TikTok";
          let avatarUrl: string | null = null;
          let privacyOptions: string[] = [];

          try {
            const creator = await tt.getCreatorInfo(tokens.accessToken);
            username = creator.username;
            displayName = creator.displayName;
            avatarUrl = creator.avatarUrl;
            privacyOptions = creator.privacyOptions;
          } catch (creatorError) {
            console.warn("[tiktok-callback] creator_info ไม่ผ่าน", creatorError);
          }

          if (!username) {
            try {
              const info = await tt.getUserInfo(tokens.accessToken);
              username = info.username;
              displayName = info.displayName;
              avatarUrl = info.avatarUrl;
            } catch (infoError) {
              console.warn("[tiktok-callback] user/info ไม่ผ่าน", infoError);
            }
          }

          const externalId = tokens.openId;
          if (!externalId) throw new Error("TikTok ไม่ได้ส่งรหัสบัญชีกลับมา");

          const accountName = username ? `@${username}` : displayName;

          const { data: existing } = await db
            .from("channel_accounts")
            .select("id")
            .eq("brand_id", session.brand_id)
            .eq("platform", "tiktok")
            .eq("external_id", externalId)
            .maybeSingle();

          const patch = {
            account_name: accountName,
            external_id: externalId,
            avatar_url: avatarUrl,
            connected: true,
            connected_at: new Date().toISOString(),
            last_error: null,
          };

          let channelAccountId = existing?.id ?? null;
          if (channelAccountId) {
            const { error } = await db
              .from("channel_accounts")
              .update(patch)
              .eq("id", channelAccountId);
            if (error) throw new Error(error.message);
          } else {
            const { data: inserted, error } = await db
              .from("channel_accounts")
              .insert({ brand_id: session.brand_id, platform: "tiktok", ...patch })
              .select("id")
              .single();
            if (error) throw new Error(error.message);
            channelAccountId = inserted.id;
          }

          const { error: credentialError } = await db.from("channel_credentials").upsert(
            {
              channel_account_id: channelAccountId,
              platform: "tiktok",
              external_id: externalId,
              access_token: tokens.accessToken,
              token_expires_at: tokens.expiresAt?.toISOString() ?? null,
              refresh_token: tokens.refreshToken,
              refresh_expires_at: tokens.refreshExpiresAt?.toISOString() ?? null,
              scopes: tokens.scopes.length ? tokens.scopes : null,
              meta: { username, privacy_options: privacyOptions },
              connected_by: session.user_id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "channel_account_id" },
          );
          if (credentialError) throw new Error(credentialError.message);

          await db.from("oauth_sessions").delete().eq("state", state);

          return back({ tt_ok: accountName });
        } catch (error) {
          console.error("[tiktok-callback]", error);
          await db.from("oauth_sessions").delete().eq("state", state);
          const { humanizeTikTokError } = await import("@/lib/tiktok.server");
          return back({ tt_error: humanizeTikTokError(error) });
        }
      },
    },
  },
});
