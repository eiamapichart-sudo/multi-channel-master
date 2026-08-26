/**
 * URL ปลายทางที่ Facebook จะส่งผู้ใช้กลับมาหลังกดอนุญาต
 *
 * ค่านี้ต้องตรงเป๊ะกับที่ใส่ในช่อง "Valid OAuth Redirect URIs" ของแอป Meta
 * ให้ตั้ง secret ชื่อ FACEBOOK_REDIRECT_URI เสมอ เช่น
 *   https://multi-channel-master.lovable.app/api/oauth/facebook/callback
 *
 * ความปลอดภัย: จงใจไม่อ่าน x-forwarded-host เพราะ header นั้นผู้เรียกปลอมได้
 * ถ้าเชื่อ header จะเปิดช่องให้ redirect ผู้ใช้ไปโดเมนคนอื่นพร้อม state (open redirect)
 */
function fallbackOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function facebookRedirectUri(request: Request): string {
  const explicit = process.env["FACEBOOK_REDIRECT_URI"]?.trim();
  if (explicit) return explicit;
  return `${fallbackOrigin(request)}/api/oauth/facebook/callback`;
}

/** หน้าเว็บที่จะพาผู้ใช้กลับไปหลังจบขั้นตอน — ผูกกับค่าที่ตั้งไว้เท่านั้น */
export function appOrigin(request: Request): string {
  const explicit = process.env["FACEBOOK_REDIRECT_URI"]?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      console.error("[facebook] FACEBOOK_REDIRECT_URI ไม่ใช่ URL ที่ถูกต้อง");
    }
  }
  return fallbackOrigin(request);
}
