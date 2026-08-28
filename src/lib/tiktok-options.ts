/**
 * tiktok-options.ts — ตัวเลือกที่ TikTok "บังคับ" ให้ถามผู้ใช้ก่อนโพสต์
 *
 * ใช้ได้ทั้งฝั่งหน้าเว็บและฝั่งเซิร์ฟเวอร์ (ไม่มีการเรียก API ในไฟล์นี้)
 *
 * ทำไมต้องมีไฟล์นี้:
 * กติกา App Review ของ TikTok กำหนดว่าแอปต้องแสดงตัวเลือกความเป็นส่วนตัว
 * ตามที่ creator_info ส่งกลับมา และต้องเคารพสิ่งที่ผู้ใช้เลือก ห้ามเลือกให้ล่วงหน้า
 * รวมถึงต้องมีช่องเปิดเผยเนื้อหาเชิงพาณิชย์และป้ายเนื้อหาที่สร้างด้วย AI
 * ถ้าขาดข้อใดข้อหนึ่ง แอปจะไม่ผ่าน audit และโพสต์สาธารณะไม่ได้ตลอดไป
 */

export type TikTokPrivacyLevel =
  "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

/** ข้อมูลบัญชีที่ creator_info ส่งกลับมา — กำหนดว่าผู้ใช้เลือกอะไรได้บ้าง */
export type TikTokCreatorInfo = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** ตัวเลือกความเป็นส่วนตัวที่บัญชีนี้ใช้ได้จริง */
  privacyOptions: TikTokPrivacyLevel[];
  /** บัญชีนี้ปิดคอมเมนต์ไว้ที่ระดับบัญชีอยู่แล้วหรือไม่ */
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSec: number | null;
};

export type TikTokPostOptionsValue = {
  /** null = ผู้ใช้ยังไม่ได้เลือก — ห้ามเดาให้ */
  privacyLevel: TikTokPrivacyLevel | null;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  /** เปิดเผยว่าเป็นเนื้อหาเชิงพาณิชย์หรือไม่ (สวิตช์แม่) */
  disclose: boolean;
  /** โปรโมทธุรกิจของตัวเอง */
  brandOrganic: boolean;
  /** ได้รับค่าตอบแทนจากแบรนด์อื่น (paid partnership) */
  brandContent: boolean;
  /** เนื้อหาสร้างหรือดัดแปลงด้วย AI */
  isAigc: boolean;
};

export const TIKTOK_DEFAULT_OPTIONS: TikTokPostOptionsValue = {
  privacyLevel: null,
  disableComment: false,
  disableDuet: false,
  disableStitch: false,
  disclose: false,
  brandOrganic: false,
  brandContent: false,
  isAigc: false,
};

export const TIKTOK_PRIVACY_LABELS: Record<TikTokPrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: "สาธารณะ — ทุกคนดูได้",
  MUTUAL_FOLLOW_FRIENDS: "เพื่อน — เฉพาะคนที่ติดตามกันทั้งสองฝ่าย",
  FOLLOWER_OF_CREATOR: "ผู้ติดตาม — เฉพาะคนที่ติดตามบัญชีนี้",
  SELF_ONLY: "ส่วนตัว — เห็นคนเดียว",
};

const PRIVACY_VALUES = Object.keys(TIKTOK_PRIVACY_LABELS) as TikTokPrivacyLevel[];

export const isPrivacyLevel = (value: unknown): value is TikTokPrivacyLevel =>
  typeof value === "string" && PRIVACY_VALUES.includes(value as TikTokPrivacyLevel);

/** อ่านค่าที่เก็บไว้ในคอลัมน์ jsonb ให้กลับมาเป็นรูปที่ใช้งานได้ (ทนค่าเพี้ยน) */
export function parseTikTokOptions(raw: unknown): TikTokPostOptionsValue {
  if (!raw || typeof raw !== "object") return { ...TIKTOK_DEFAULT_OPTIONS };
  const r = raw as Record<string, unknown>;
  const bool = (key: string) => r[key] === true;
  return {
    privacyLevel: isPrivacyLevel(r["privacyLevel"]) ? r["privacyLevel"] : null,
    disableComment: bool("disableComment"),
    disableDuet: bool("disableDuet"),
    disableStitch: bool("disableStitch"),
    disclose: bool("disclose"),
    brandOrganic: bool("brandOrganic"),
    brandContent: bool("brandContent"),
    isAigc: bool("isAigc"),
  };
}

/**
 * ตรวจตามกติกาของ TikTok — คืนข้อความปัญหา ถ้าไม่มีปัญหาคืน null
 *
 * กติกาที่ TikTok บังคับ:
 * 1. ต้องเลือกความเป็นส่วนตัวเอง ห้ามให้ระบบเลือกให้
 * 2. ถ้าเปิดเผยว่าเป็นเนื้อหาเชิงพาณิชย์ ต้องระบุอย่างน้อยหนึ่งประเภท
 * 3. เนื้อหาที่ได้รับค่าตอบแทนจากแบรนด์ (paid partnership) โพสต์แบบส่วนตัวไม่ได้
 */
export function validateTikTokOptions(
  value: TikTokPostOptionsValue,
  creator?: Pick<TikTokCreatorInfo, "privacyOptions"> | null,
): string | null {
  if (!value.privacyLevel) return "เลือกว่าใครดูคลิปนี้บน TikTok ได้บ้าง";

  if (creator?.privacyOptions?.length && !creator.privacyOptions.includes(value.privacyLevel)) {
    return "ตัวเลือกความเป็นส่วนตัวนี้บัญชี TikTok นี้ใช้ไม่ได้ — เลือกใหม่อีกครั้ง";
  }

  if (value.disclose && !value.brandOrganic && !value.brandContent) {
    return "เปิดเผยเนื้อหาเชิงพาณิชย์แล้ว ต้องเลือกอย่างน้อย 1 ประเภท";
  }

  if (value.brandContent && value.privacyLevel === "SELF_ONLY") {
    return "เนื้อหาที่ได้รับค่าตอบแทนจากแบรนด์ โพสต์แบบส่วนตัวไม่ได้ — เปลี่ยนความเป็นส่วนตัวก่อน";
  }

  return null;
}

/** ข้อความสรุปการเปิดเผยที่ TikTok กำหนดให้แสดงให้ผู้ใช้เห็นก่อนโพสต์ */
export function tiktokDisclosureNotice(value: TikTokPostOptionsValue): string | null {
  if (!value.disclose) return null;
  if (value.brandContent && value.brandOrganic) {
    return 'คลิปจะติดป้าย "ได้รับการสนับสนุน" บน TikTok';
  }
  if (value.brandContent) return 'คลิปจะติดป้าย "ได้รับการสนับสนุน" บน TikTok';
  if (value.brandOrganic) return 'คลิปจะติดป้าย "โปรโมทธุรกิจของตัวเอง" บน TikTok';
  return null;
}
