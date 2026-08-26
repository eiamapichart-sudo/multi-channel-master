import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * client ฝั่งเซิร์ฟเวอร์แบบคลายชนิดข้อมูล
 *
 * ตารางใหม่ (channel_credentials, oauth_sessions) และคอลัมน์ที่เพิ่งเพิ่ม
 * ยังไม่มีใน src/integrations/supabase/types.ts ซึ่ง Lovable เป็นคนสร้างให้อัตโนมัติ
 * ตัวนี้เลยคลายชนิดลงเพื่อไม่ให้ TypeScript ฟ้องก่อนที่ types.ts จะถูกสร้างใหม่
 *
 * เมื่อ Lovable รีเฟรช types.ts แล้ว จะเปลี่ยนกลับไปใช้ supabaseAdmin ตรงๆ ก็ได้
 */
export const db = supabaseAdmin as unknown as SupabaseClient<any, "public", any>;
