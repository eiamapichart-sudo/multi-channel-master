import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * client ฝั่งเบราว์เซอร์แบบคลายชนิดข้อมูล
 * ใช้เฉพาะตอนอ่านคอลัมน์ที่เพิ่งเพิ่ม (external_id, avatar_url, connected_at, last_error)
 * ซึ่งยังไม่มีใน types.ts ที่ Lovable สร้างอัตโนมัติ
 */
export const sb = supabase as unknown as SupabaseClient<any, "public", any>;
