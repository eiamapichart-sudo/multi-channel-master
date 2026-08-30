import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/oauth/youtube/callback
 * Google พาผู้ใช้กลับมาที่นี่พร้อม ?code=...&state=...
 *
 * Google ให้สิทธิ์ทีละบัญชี (ไม่มีรายการช่องให้เลือกเหมือนเพจ Facebook)
 * จึงผูกช่องให้เสร็จในขั้นตอนนี้เลย แล้วเด้งกลับหน้าตั้งค่า
 *
 * access token / refresh token ไม่เคยถูกส่งออกไปฝั่งเบราว์เซอร์
 */
export const Route = createFileRoute("/api/oauth/youtube/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { youtubeAppOrigin, youtubeRedirectUri } = await import(
          "@/lib/youtube-redirect.server"
        );
        const origin = youtubeAppOrigin(request);

        const back = (params: Record<string, string>) => {
          const url = new URL("/settings", origin);
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
          return new Response(null, { status: 302, headers: { location: url.toString() } });
        };

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const ytError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

        if (ytError) return back({ yt_error: `YouTube: ${ytError}` });
        if (!code || !state) return back({ yt_error: "ลิงก์กลับจาก Google ไม่สมบูรณ์" });

        const { db } = await import("@/lib/db.server");

        const { data: session } = await db
          .from("oauth_sessions")
          .select("state, brand_id, user_id, status, expires_at")
          .eq("state", state)
          .eq("platform", "youtube")
          .maybeSingle();

        if (!session) return back({ yt_error: "คำขอเชื่อมต่อไม่ถูกต้อง กรุณาลองใหม่" });
        if (new Date(session.expires_at) < new Date()) {
          await db.from("oauth_sessions").delete().eq("state", state);
          return back({ yt_error: "คำขอเชื่อมต่อหมดอายุ กรุณากดเชื่อมต่อใหม่" });
        }
        if (session.status !== "pending") {
          return back({ yt_error: "ลิงก์นี้ถูกใช้ไปแล้ว กรุณากดเชื่อมต่อใหม่" });
        }

        try {
          const yt = await import("@/lib/youtube.server");

          const tokens = await yt.exchangeCodeForToken(code, youtubeRedirectUri(request));

          const channel = await yt.getChannelInfo(tokens.accessToken);
          const externalId = channel.channelId;
          if (!externalId) throw new Error("Google ไม่ได้ส่งรหัสช่องกลับมา");

          const accountName = channel.handle ? `${channel.title} (${channel.handle})` : channel.title;

          const { data: existing } = await db
            .from("channel_accounts")
            .select("id")
            .eq("brand_id", session.brand_id)
            .eq("platform", "youtube")
            .eq("external_id", externalId)
            .maybeSingle();

          const patch = {
            account_name: accountName,
            external_id: externalId,
            avatar_url: channel.avatarUrl,
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
              .insert({ brand_id: session.brand_id, platform: "youtube", ...patch })
              .select("id")
              .single();
            if (error) throw new Error(error.message);
            channelAccountId = inserted.id;
          }

          // Google ส่ง refresh token มาเฉพาะตอนที่ผู้ใช้กดยินยอมใหม่จริงๆ
          // ถ้ารอบนี้ไม่ได้มา ต้องเก็บของเดิมไว้ ไม่งั้นต่ออายุเองไม่ได้อีกเลย
          const { data: previous } = await db
            .from("channel_credentials")
            .select("refresh_token")
            .eq("channel_account_id", channelAccountId)
            .maybeSingle();

          const refreshToken =
            tokens.refreshToken ?? (previous?.refresh_token as string | null) ?? null;

          const { error: credentialError } = await db.from("channel_credentials").upsert(
            {
              channel_account_id: channelAccountId,
              platform: "youtube",
              external_id: externalId,
              access_token: tokens.accessToken,
              token_expires_at: tokens.expiresAt?.toISOString() ?? null,
              refresh_token: refreshToken,
              // Google ไม่บอกวันหมดอายุของ refresh token — ปล่อยว่างไว้
              refresh_expires_at: null,
              scopes: tokens.scopes.length ? tokens.scopes : null,
              meta: { channel_title: channel.title, handle: channel.handle },
              connected_by: session.user_id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "channel_account_id" },
          );
          if (credentialError) throw new Error(credentialError.message);

          await db.from("oauth_sessions").delete().eq("state", state);

          return back({ yt_ok: accountName });
        } catch (error) {
          console.error("[youtube-callback]", error);
          await db.from("oauth_sessions").delete().eq("state", state);
          const { humanizeYouTubeError } = await import("@/lib/youtube.server");
          return back({ yt_error: humanizeYouTubeError(error) });
        }
      },
    },
  },
});
