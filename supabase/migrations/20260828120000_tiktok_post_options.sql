-- ตัวเลือกที่ TikTok บังคับให้ถามผู้ใช้ก่อนโพสต์ (ความเป็นส่วนตัว, ดูเอ็ต/สติทช์/คอมเมนต์,
-- การเปิดเผยเนื้อหาเชิงพาณิชย์, ป้ายเนื้อหา AI)
--
-- เก็บเป็น jsonb หนึ่งคอลัมน์ เพราะเป็นข้อมูลเฉพาะของ TikTok ช่องทางเดียว
-- ไม่ควรไปเพิ่มคอลัมน์แยก 7 ช่องในตารางที่ใช้ร่วมกันทุกแพลตฟอร์ม
--
-- โครงสร้างที่เก็บ (ดู src/lib/tiktok-options.ts):
-- {
--   "privacyLevel": "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS"
--                 | "FOLLOWER_OF_CREATOR" | "SELF_ONLY",
--   "disableComment": bool, "disableDuet": bool, "disableStitch": bool,
--   "disclose": bool, "brandOrganic": bool, "brandContent": bool,
--   "isAigc": bool
-- }

alter table public.post_targets
  add column if not exists tiktok_options jsonb;

comment on column public.post_targets.tiktok_options is
  'ตัวเลือกก่อนโพสต์ที่ผู้ใช้เลือกเองสำหรับ TikTok — จำเป็นต่อการผ่าน App Review ของ TikTok';
