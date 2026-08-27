/**
 * URL ปลายทางที่ TikTok จะส่งผู้ใช้กลับมาหลังกดอนุญาต
 *
 * ต้องตรงเป๊ะกับช่อง "Redirect URI" ในหน้า TikTok for Developers เช่น
 *   https://multi-channel-master.lovable.app/api/oauth/tiktok/callback
 *
 * ความปลอดภัย: จงใจไม่อ่าน x-forwarded-host เพราะปลอมได้ (เสี่ยง open redirect)
 */
function fallbackOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function tiktokRedirectUri(request: Request): string {
  const explicit = process.env["TIKTOK_REDIRECT_URI"]?.trim();
  if (explicit) return explicit;
  return `${fallbackOrigin(request)}/api/oauth/tiktok/callback`;
}

/** หน้าเว็บที่จะพาผู้ใช้กลับไปหลังจบขั้นตอน */
export function tiktokAppOrigin(request: Request): string {
  const explicit = process.env["TIKTOK_REDIRECT_URI"]?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      console.error("[tiktok] TIKTOK_REDIRECT_URI ไม่ใช่ URL ที่ถูกต้อง");
    }
  }
  return fallbackOrigin(request);
}
