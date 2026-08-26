/**
 * server-auth.server.ts — ตรวจตัวตนผู้ใช้ใน server route (API route)
 *
 * middleware requireSupabaseAuth ที่ Lovable สร้างไว้ใช้ได้เฉพาะกับ server function
 * ส่วน route handler ต้องตรวจ Bearer token เอง — ไฟล์นี้ทำหน้าที่นั้น
 * โดยใช้ตรรกะเดียวกับ src/integrations/supabase/auth-middleware.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type AuthedUser = {
  userId: string;
  /** client ที่ผูกสิทธิ์ของผู้ใช้คนนี้ — คิวรีผ่านตัวนี้จะถูก RLS คุมตามปกติ */
  supabase: SupabaseClient<Database>;
};

/** ดึงและตรวจ Bearer token จาก request — โยน HttpError(401) ถ้าไม่ผ่าน */
export async function requireUser(request: Request): Promise<AuthedUser> {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new HttpError(500, "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Supabase");
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || token.split(".").length !== 3) {
    throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new HttpError(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  return { userId: String(data.claims.sub), supabase };
}

/**
 * ตรวจว่าผู้ใช้เห็นแบรนด์นี้ได้จริง
 * คิวรีผ่าน client ของผู้ใช้ → RLS เป็นคนตัดสิน ไม่ต้องเขียนตรรกะสิทธิ์ซ้ำ
 */
export async function requireBrandAccess(user: AuthedUser, brandId: string) {
  const { data, error } = await user.supabase
    .from("brands")
    .select("id, name, timezone")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(403, "คุณไม่มีสิทธิ์เข้าถึงแบรนด์นี้");
  return data;
}

/**
 * ตรวจสิทธิ์ระดับ "ผู้จัดการแบรนด์" (owner / approver / แอดมินระบบ)
 *
 * ใช้กับงานที่ editor ไม่ควรทำเอง — เชื่อมต่อ/เปลี่ยน token ของเพจ และสั่งเผยแพร่ทันที
 * เรียกผ่านฟังก์ชัน can_manage_brand ที่สร้างไว้ใน migration โดยใช้ client ของผู้ใช้
 * เพื่อให้ auth.uid() ข้างในเป็นตัวผู้ใช้จริง
 */
export async function requireBrandManager(user: AuthedUser, brandId: string) {
  const brand = await requireBrandAccess(user, brandId);

  const { data, error } = await user.supabase.rpc("can_manage_brand" as never, {
    _brand_id: brandId,
  } as never);

  if (error) {
    throw new HttpError(
      500,
      `ตรวจสิทธิ์ไม่สำเร็จ (${error.message}) — ตรวจว่ารัน migration ของ Facebook แล้วหรือยัง`,
    );
  }
  if (data !== true) {
    throw new HttpError(403, "ต้องเป็นเจ้าของแบรนด์หรือผู้อนุมัติจึงจะทำรายการนี้ได้");
  }
  return brand;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error("[api]", error);
  return json({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }, 500);
}
