/**
 * URL ปลายทางที่ Google จะส่งผู้ใช้กลับมาหลังกดอนุญาต
 *
 * ต้องตรงเป๊ะกับช่อง "Authorized redirect URIs" ในหน้า Google Cloud Console เช่น
 *   https://multi-channel-master.lovable.app/api/oauth/youtube/callback
 *
 * ความปลอดภัย: จงใจไม่อ่าน x-forwarded-host เพราะปลอมได้ (เสี่ยง open redirect)
 */
function fallbackOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function youtubeRedirectUri(request: Request): string {
  const explicit = process.env["YOUTUBE_REDIRECT_URI"]?.trim();
  if (explicit) return explicit;
  return `${fallbackOrigin(request)}/api/oauth/youtube/callback`;
}

/** หน้าเว็บที่จะพาผู้ใช้กลับไปหลังจบขั้นตอน */
export function youtubeAppOrigin(request: Request): string {
  const explicit = process.env["YOUTUBE_REDIRECT_URI"]?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      console.error("[youtube] YOUTUBE_REDIRECT_URI ไม่ใช่ URL ที่ถูกต้อง");
    }
  }
  return fallbackOrigin(request);
}
