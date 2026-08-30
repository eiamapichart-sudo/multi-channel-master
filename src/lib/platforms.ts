export type Platform = "facebook" | "instagram" | "tiktok" | "youtube" | "line";

export const PLATFORMS: {
  id: Platform;
  label: string;
  short: string;
  limit: number;
  note: string;
}[] = [
  { id: "facebook", label: "Facebook Page", short: "FB", limit: 5000, note: "ข้อความ + รูป/วิดีโอ/ลิงก์" },
  { id: "instagram", label: "Instagram", short: "IG", limit: 2200, note: "ต้องมีรูปหรือวิดีโอ" },
  { id: "tiktok", label: "TikTok", short: "TT", limit: 2200, note: "วิดีโอเท่านั้น" },
  { id: "youtube", label: "YouTube", short: "YT", limit: 5000, note: "วิดีโอ / Shorts" },
  { id: "line", label: "LINE OA", short: "LINE", limit: 1000, note: "Broadcast ถึงผู้ติดตาม" },
];

export const platformLabel = (id: string) =>
  PLATFORMS.find((p) => p.id === id)?.label ?? id;

export const platformShort = (id: string) => PLATFORMS.find((p) => p.id === id)?.short ?? id;

export type PostStatus = "draft" | "pending" | "approved" | "publishing" | "published" | "failed";

export const STATUS_META: Record<PostStatus, { label: string; className: string }> = {
  draft: { label: "ร่าง", className: "bg-secondary text-secondary-foreground" },
  pending: { label: "รออนุมัติ", className: "bg-accent/20 text-accent-foreground" },
  approved: { label: "อนุมัติแล้ว", className: "bg-primary/15 text-primary" },
  publishing: { label: "กำลังเผยแพร่", className: "bg-primary/15 text-primary" },
  published: { label: "เผยแพร่แล้ว", className: "bg-primary text-primary-foreground" },
  failed: { label: "ล้มเหลว", className: "bg-destructive/15 text-destructive" },
};

const BKK = "Asia/Bangkok";

export function formatThaiDateTime(value?: string | null) {
  if (!value) return "ยังไม่ตั้งเวลา";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BKK,
  }).format(new Date(value));
}

/** Convert an ISO timestamp to a value usable by <input type="datetime-local"> in Bangkok time. */
export function isoToLocalInput(value?: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: BKK,
  }).format(new Date(value));
  return parts.replace(" ", "T");
}

/** Interpret a datetime-local value as Bangkok time and return an ISO string. */
export function localInputToIso(value: string) {
  if (!value) return null;
    const y = Number(value.slice(0, 4));
  const fixed = y > 2400 ? String(y - 543) + value.slice(4) : value;
  return new Date(fixed + ":00+07:00").toISOString();
}
