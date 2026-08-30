-- =====================================================================
-- Social Post — เพิ่มคอลัมน์ youtube_options สำหรับตัวเลือกก่อนโพสต์ลง YouTube
-- รันซ้ำได้ ไม่พัง ไม่ลบข้อมูลเดิม
-- =====================================================================

alter table public.post_targets
add column if not exists youtube_options jsonb;

comment on column public.post_targets.youtube_options is
'ตัวเลือกที่ผู้ใช้เลือกเองก่อนอัปคลิปขึ้น YouTube — ชื่อคลิป คำบรรยาย ความเป็นส่วนตัว ป้ายทำเพื่อเด็ก และ Shorts';
