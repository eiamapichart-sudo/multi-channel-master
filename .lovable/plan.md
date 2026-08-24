# PRD: ระบบโพสต์ครั้งเดียวไปทุกช่องทาง (Social Publisher) + หน้าเว็บ PRD

## เป้าหมาย
เขียนโพสต์ครั้งเดียว เลือกช่องทางที่จะไป ตั้งเวลาล่วงหน้าได้ ผ่านการอนุมัติก่อนเผยแพร่ รองรับหลายแบรนด์/ลูกค้า และเชื่อมกับ ERP เดิมของคุณ (FastAPI + PostgreSQL) ในเฟสถัดไป

## สิ่งที่จะส่งมอบรอบนี้
1. เอกสาร PRD ฉบับเต็ม (ภาษาไทย) เก็บไว้ในโปรเจกต์
2. หน้าเว็บอ่าน PRD ที่หน้าแรก `/` — สารบัญด้านข้าง, เนื้อหาแบ่งเป็นส่วน, อ่านง่ายทั้งมือถือและจอใหญ่, ปุ่มพิมพ์/บันทึก PDF
3. ยังไม่ต่อ API ของแพลตฟอร์มจริง และยังไม่เปิดฐานข้อมูลในรอบนี้ (ระบุไว้เป็นเฟสถัดไปใน PRD)

## โครงเนื้อหา PRD
1. ภาพรวมและปัญหาที่แก้
2. กลุ่มผู้ใช้และ persona: เจ้าของเอเจนซี, ผู้ดูแลแบรนด์ (Editor), ผู้อนุมัติ (Approver/ลูกค้า), ผู้ดู (Viewer)
3. ขอบเขต MVP / นอกขอบเขต
4. ช่องทางรอบแรก: Facebook Page, Instagram, TikTok, YouTube, LINE OA — ตารางข้อจำกัดต่อช่องทาง (ชนิดสื่อ, ความยาวข้อความ, สัดส่วน/ขนาดวิดีโอ, จำนวนรูป, การตั้งเวลา, สิทธิ์/permission ที่ต้องขอ)
5. Flow หลัก
   - Compose: เนื้อหากลาง + ปรับแต่งรายช่องทาง (override caption, hashtag, thumbnail)
   - เลือกช่องทาง + บัญชีปลายทาง
   - ตั้งเวลา: ทันที / กำหนดเวลา / คิวตามช่วงเวลา, timezone Asia/Bangkok
   - อนุมัติ: Draft → Pending approval → Approved → Scheduled → Published / Failed
   - ปฏิทินคอนเทนต์ + มุมมองรายการ, แก้/เลื่อน/ยกเลิกโพสต์ที่ยังไม่ออก
   - ผลลัพธ์: สถานะรายช่องทาง, ลิงก์โพสต์, เหตุผลที่ล้มเหลว, ปุ่มลองใหม่
6. Multi-brand / multi-client: workspace ต่อแบรนด์, สิทธิ์ (Owner/Admin/Editor/Approver/Viewer), แยกข้อมูลระหว่างแบรนด์
7. คลังสื่อ (Media library) และการนำกลับมาใช้
8. โมเดลข้อมูลระดับแนวคิด: workspace, brand, social_account, post, post_target, media, approval, publish_job, audit_log
9. สถาปัตยกรรม: คิวงานตั้งเวลา, retry แบบ backoff, การจัดการโทเคนหมดอายุ, rate limit ของแต่ละแพลตฟอร์ม
10. การเชื่อมกับ ERP ของคุณ (ปรับตามข้อมูลที่คุณส่งมา)
    - ERP ปัจจุบัน: Python 3.12 + FastAPI 0.115, PostgreSQL 16 (SQLAlchemy 2.0 + Alembic), Jinja2 + vanilla JS, Ubuntu 24.04/nginx/systemd (2 core 2GB), 73 ตาราง, 8 กลุ่มงาน/35 เมนูย่อย, มีคิวเบื้องหลังตัดคลิป/ถอดเสียงอยู่แล้ว
    - แนวทางที่เสนอ: ให้ Social Publisher เป็นโมดูล "การตลาด" ที่คุยกับ ERP ผ่าน REST + webhook แบบ service-to-service (API key/HMAC) ไม่แชร์ตารางกันตรง ๆ เพื่อลดความเสี่ยงกับ 73 ตารางเดิม
    - จุดเชื่อมที่ระบุไว้: campaign/ลูกค้า/สินค้า mapping, ดึงสื่อจากคิวตัดคลิปของ ERP มาใช้เป็น media, ส่งผลการโพสต์ (post_id, ลิงก์, เวลาโพสต์, ยอด engagement) กลับเข้า ERP เพื่อผูกกับแคมเปญ/ต้นทุน
    - เอกสารกำหนด contract: endpoint, payload ตัวอย่าง, field mapping ต่อ 1 โพสต์, การ auth, การ retry/idempotency key
    - ข้อจำกัดทรัพยากรเซิร์ฟเวอร์ (2 core 2GB): PRD จะระบุว่าให้งานหนักด้านสื่ออยู่ฝั่ง ERP เดิม ส่วน Publisher เน้น orchestration
    - ทางเลือกระยะยาว: ย้ายทั้ง ERP มาสร้างใหม่บน stack นี้ — ระบุเป็น "เฟส 5 (ตัวเลือก)" พร้อมข้อดี/ข้อเสีย ไม่ตัดสินในรอบนี้
11. ความปลอดภัยและ compliance: การเก็บโทเคน, สิทธิ์ระดับแถว, audit log
12. เมตริกความสำเร็จ + เฟสงาน (MVP → อนุมัติหลายชั้น → analytics → เชื่อม ERP → ตัวเลือกย้าย ERP)
13. คำถามค้าง / สมมติฐาน (เช่น ขอ schema ตารางที่เกี่ยวข้องกับการตลาดของ ERP, ตัวอย่าง OpenAPI ของ ERP)

## รายละเอียดทางเทคนิคของหน้าเว็บ PRD
- เขียนใหม่ `src/routes/index.tsx` เป็นหน้า PRD (แทน placeholder)
- เนื้อหาเก็บใน `src/content/prd.ts` (โครงเป็น sections) เพื่อให้แก้ง่ายและ render สารบัญอัตโนมัติ
- คอมโพเนนต์: `PrdLayout`, `PrdSidebar` (สารบัญ + scroll spy), `PrdSection`, `ChannelMatrixTable`, `StatusFlowDiagram`, `ErpIntegrationDiagram`
- ใช้ design token ใน `src/styles.css` (โทนเอกสารเชิงธุรกิจ) ไม่ hardcode สี
- SEO: `head()` ในหน้า index ตั้ง title/description/og เฉพาะของหน้า PRD
- ปุ่ม "พิมพ์ / บันทึก PDF" ใช้ `window.print()` + print styles
- ภาพที่คุณอัปโหลดใช้เป็นข้อมูลอ้างอิงเท่านั้น ไม่ฝังในหน้าเว็บ

## สิ่งที่อยากได้จากคุณต่อไป (ไม่บล็อกรอบนี้)
schema/OpenAPI ของ ERP ส่วนการตลาดและลูกค้า เพื่อเปลี่ยนส่วน field mapping จากโครงให้เป็นของจริง
