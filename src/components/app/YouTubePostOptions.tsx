import { AlertTriangle, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  YOUTUBE_DESCRIPTION_MAX,
  YOUTUBE_PRIVACY_LABELS,
  YOUTUBE_TITLE_MAX,
  validateYouTubeOptions,
  youtubeShortsNotice,
  type YouTubePostOptionsValue,
  type YouTubePrivacyStatus,
} from "@/lib/youtube-options";

/**
 * แผงตัวเลือกก่อนโพสต์ลง YouTube
 *
 * ต่างจาก TikTok ตรงที่ YouTube บังคับให้มี "ชื่อคลิป" แยกจากคำบรรยาย
 * ส่วนความเป็นส่วนตัวกับป้าย "ทำเพื่อเด็ก" เราจงใจไม่เลือกให้ล่วงหน้า
 * เพราะเดาผิดแล้วคลิปหลุดสาธารณะ หรือผิดกติกา COPPA ได้
 */
export function YouTubePostOptions({
  accountName,
  value,
  onChange,
}: {
  accountName: string | null;
  value: YouTubePostOptionsValue;
  onChange: (next: YouTubePostOptionsValue) => void;
}) {
  const set = <K extends keyof YouTubePostOptionsValue>(
    key: K,
    next: YouTubePostOptionsValue[K],
  ) => onChange({ ...value, [key]: next });

  const problem = validateYouTubeOptions(value);
  const shortsNotice = youtubeShortsNotice(value);
  const titleLength = value.title.trim().length;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
          <Play className="size-5 text-destructive" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">ตัวเลือกของ YouTube</p>
          <p className="text-xs text-muted-foreground">
            {accountName ? `จะลงที่ช่อง ${accountName}` : "เลือกช่อง YouTube ก่อน"}
          </p>
        </div>
      </div>

      {/* ชื่อคลิป — YouTube บังคับ */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="yt-title" className="text-xs font-semibold text-foreground">
            ชื่อคลิป
          </Label>
          <span
            className={`text-[11px] tabular-nums ${
              titleLength > YOUTUBE_TITLE_MAX ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {titleLength}/{YOUTUBE_TITLE_MAX}
          </span>
        </div>
        <Input
          id="yt-title"
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="เช่น เซรั่มปิดผมหงอก My Organic ใช้ยังไงให้เห็นผล"
          className="h-11 rounded-xl"
        />
      </div>

      {/* คำบรรยาย */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="yt-description" className="text-xs font-semibold text-foreground">
            คำบรรยาย
          </Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {value.description.length}/{YOUTUBE_DESCRIPTION_MAX}
          </span>
        </div>
        <Textarea
          id="yt-description"
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="เว้นว่างไว้ได้ ระบบจะใช้ข้อความในโพสต์แทน"
          rows={3}
          className="rounded-xl"
        />
      </div>

      {/* ความเป็นส่วนตัว — ไม่เลือกให้ล่วงหน้า */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">ใครดูคลิปนี้ได้บ้าง</Label>
        <RadioGroup
          value={value.privacyStatus ?? ""}
          onValueChange={(next) => set("privacyStatus", next as YouTubePrivacyStatus)}
          className="space-y-1.5"
        >
          {(Object.keys(YOUTUBE_PRIVACY_LABELS) as YouTubePrivacyStatus[]).map((level) => (
            <div
              key={level}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5"
            >
              <RadioGroupItem value={level} id={`yt-privacy-${level}`} />
              <Label
                htmlFor={`yt-privacy-${level}`}
                className="flex-1 text-sm font-normal text-foreground"
              >
                {YOUTUBE_PRIVACY_LABELS[level]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* ทำเพื่อเด็กหรือไม่ — YouTube บังคับให้ตอบทุกคลิป */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">คลิปนี้ทำขึ้นเพื่อเด็กหรือไม่</Label>
        <RadioGroup
          value={value.madeForKids === null ? "" : value.madeForKids ? "yes" : "no"}
          onValueChange={(next) => set("madeForKids", next === "yes")}
          className="space-y-1.5"
        >
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5">
            <RadioGroupItem value="no" id="yt-kids-no" />
            <Label htmlFor="yt-kids-no" className="flex-1 text-sm font-normal text-foreground">
              ไม่ได้ทำเพื่อเด็ก
            </Label>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5">
            <RadioGroupItem value="yes" id="yt-kids-yes" />
            <Label htmlFor="yt-kids-yes" className="flex-1 text-sm font-normal text-foreground">
              ทำเพื่อเด็ก
            </Label>
          </div>
        </RadioGroup>
        <p className="text-[11px] leading-5 text-muted-foreground">
          กฎหมายคุ้มครองเด็กของ YouTube บังคับให้ระบุทุกคลิป
          คลิปที่ทำเพื่อเด็กจะปิดคอมเมนต์และฟีเจอร์บางอย่างโดยอัตโนมัติ
        </p>
      </div>

      {/* Shorts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
          <Label htmlFor="yt-shorts" className="text-sm font-normal text-foreground">
            โพสต์เป็น Shorts
          </Label>
          <Switch
            id="yt-shorts"
            checked={value.asShorts}
            onCheckedChange={(next) => set("asShorts", next)}
          />
        </div>
        {shortsNotice ? (
          <p className="text-[11px] leading-5 text-muted-foreground">{shortsNotice}</p>
        ) : null}
      </div>

      {problem ? (
        <p className="flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {problem}
        </p>
      ) : null}
    </div>
  );
}
