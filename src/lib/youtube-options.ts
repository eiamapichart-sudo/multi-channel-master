/**
 * youtube-options.ts — ตัวเลือกที่ผู้ใช้ต้องกรอกก่อนอัปคลิปขึ้น YouTube
 *
 * ใช้ได้ทั้งฝั่งหน้าเว็บและฝั่งเซิร์ฟเวอร์ (ไม่มีการเรียก API ในไฟล์นี้)
 *
 * ทำไมต้องมีไฟล์นี้:
 * YouTube ต่างจาก Facebook/TikTok ตรงที่ "ชื่อคลิป" เป็นข้อมูลบังคับ และแยกจากคำบรรยาย
 * ส่วนความเป็นส่วนตัวกับป้าย "ทำเพื่อเด็ก" เราจงใจไม่ตั้งค่าเริ่มต้นให้
 * เพราะเดาผิดแล้วคลิปหลุดสาธารณะ หรือผิดกติกา COPPA ได้ — ให้ผู้ใช้เลือกเองทุกครั้ง
 */

export type YouTubePrivacyStatus = "public" | "unlisted" | "private";

export type YouTubePostOptionsValue = {
  /** ชื่อคลิป — YouTube บังคับ ยาวได้ไม่เกิน 100 ตัวอักษร */
  title: string;
  /** คำบรรยายใต้คลิป ไม่เกิน 5000 ตัวอักษร */
  description: string;
  /** null = ผู้ใช้ยังไม่ได้เลือก — ห้ามเดาให้ */
  privacyStatus: YouTubePrivacyStatus | null;
  /** null = ยังไม่ได้ตอบ — YouTube บังคับให้ระบุว่าคลิปทำเพื่อเด็กหรือไม่ */
  madeForKids: boolean | null;
  /** เติม #Shorts ให้อัตโนมัติ เพื่อให้ YouTube จัดเป็น Shorts */
  asShorts: boolean;
};

export const YOUTUBE_TITLE_MAX = 100;
export const YOUTUBE_DESCRIPTION_MAX = 5000;

/** เพดานขนาดไฟล์ที่เรากล้าโหลดเข้าหน่วยความจำเซิร์ฟเวอร์ก่อนส่งต่อให้ YouTube */
export const YOUTUBE_MAX_VIDEO_BYTES = 256 * 1024 * 1024;

export const YOUTUBE_DEFAULT_OPTIONS: YouTubePostOptionsValue = {
  title: "",
  description: "",
  privacyStatus: null,
  madeForKids: null,
  asShorts: false,
};

export const YOUTUBE_PRIVACY_LABELS: Record<YouTubePrivacyStatus, string> = {
  public: "สาธารณะ — ทุกคนค้นเจอและดูได้",
  unlisted: "ไม่เป็นสาธารณะ — เฉพาะคนที่มีลิงก์",
  private: "ส่วนตัว — เห็นคนเดียว",
};

const PRIVACY_VALUES = Object.keys(YOUTUBE_PRIVACY_LABELS) as YouTubePrivacyStatus[];

export const isYouTubePrivacy = (value: unknown): value is YouTubePrivacyStatus =>
  typeof value === "string" && PRIVACY_VALUES.includes(value as YouTubePrivacyStatus);

/** อ่านค่าที่เก็บไว้ในคอลัมน์ jsonb ให้กลับมาเป็นรูปที่ใช้งานได้ (ทนค่าเพี้ยน) */
export function parseYouTubeOptions(raw: unknown): YouTubePostOptionsValue {
  if (!raw || typeof raw !== "object") return { ...YOUTUBE_DEFAULT_OPTIONS };
  const r = raw as Record<string, unknown>;
  const str = (key: string) => (typeof r[key] === "string" ? (r[key] as string) : "");
  return {
    title: str("title"),
    description: str("description"),
    privacyStatus: isYouTubePrivacy(r["privacyStatus"]) ? r["privacyStatus"] : null,
    madeForKids: typeof r["madeForKids"] === "boolean" ? r["madeForKids"] : null,
    asShorts: r["asShorts"] === true,
  };
}

/**
 * ตรวจตามกติกาของ YouTube — คืนข้อความปัญหา ถ้าไม่มีปัญหาคืน null
 *
 * 1. ต้องมีชื่อคลิป และห้ามยาวเกิน 100 ตัวอักษร
 * 2. ชื่อคลิปห้ามมี < หรือ > — YouTube ปฏิเสธทั้งคำขอ
 * 3. คำบรรยายห้ามยาวเกิน 5000 ตัวอักษร
 * 4. ต้องเลือกความเป็นส่วนตัวเอง ห้ามให้ระบบเลือกให้
 * 5. ต้องระบุว่าคลิปทำเพื่อเด็กหรือไม่ (ข้อบังคับ COPPA)
 */
export function validateYouTubeOptions(value: YouTubePostOptionsValue): string | null {
  const title = value.title.trim();
  if (!title) return "ใส่ชื่อคลิปสำหรับ YouTube ก่อน";
  if (title.length > YOUTUBE_TITLE_MAX) {
    return `ชื่อคลิปยาวเกินไป (${title.length}/${YOUTUBE_TITLE_MAX} ตัวอักษร)`;
  }
  if (title.includes("<") || title.includes(">")) {
    return "ชื่อคลิปห้ามมีเครื่องหมาย < หรือ > — YouTube ไม่รับ";
  }
  if (value.description.length > YOUTUBE_DESCRIPTION_MAX) {
    return `คำบรรยายยาวเกินไป (${value.description.length}/${YOUTUBE_DESCRIPTION_MAX} ตัวอักษร)`;
  }
  if (!value.privacyStatus) return "เลือกว่าใครดูคลิปนี้บน YouTube ได้บ้าง";
  if (value.madeForKids === null) return "ระบุว่าคลิปนี้ทำขึ้นเพื่อเด็กหรือไม่";
  return null;
}

const SHORTS_TAG = "#Shorts";

/**
 * ประกอบคำบรรยายที่จะส่งขึ้น YouTube จริง
 * ถ้าผู้ใช้ติ๊กว่าเป็น Shorts จะเติม #Shorts ให้ (ถ้ายังไม่มี) เพื่อให้ YouTube จัดประเภทถูก
 */
export function buildYouTubeDescription(value: YouTubePostOptionsValue): string {
  const base = value.description.trim();
  if (!value.asShorts) return base;
  if (/#shorts\b/i.test(`${value.title} ${base}`)) return base;
  return base ? `${base}\n\n${SHORTS_TAG}` : SHORTS_TAG;
}

/** ลิงก์ดูคลิป — Shorts มีหน้าเฉพาะของตัวเอง */
export function youtubePermalink(videoId: string, asShorts: boolean): string {
  return asShorts
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

/** ข้อความเตือนที่อยากให้ผู้ใช้เห็นก่อนกดโพสต์ */
export function youtubeShortsNotice(value: YouTubePostOptionsValue): string | null {
  if (!value.asShorts) return null;
  return "คลิปต้องเป็นแนวตั้ง 9:16 และยาวไม่เกิน 60 วินาที YouTube ถึงจะจัดให้เป็น Shorts";
}
