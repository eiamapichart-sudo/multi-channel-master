import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Music2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { ClipInfo } from "@/lib/use-clip-info";
import {
  TIKTOK_PRIVACY_LABELS,
  tiktokDisclosureNotice,
  validateTikTokOptions,
  type TikTokCreatorInfo,
  type TikTokPostOptionsValue,
  type TikTokPrivacyLevel,
} from "@/lib/tiktok-options";

type CreatorResponse = {
  creator: TikTokCreatorInfo;
  canDirectPost: boolean;
  accountName: string;
};

/**
 * แผงตัวเลือกก่อนโพสต์ลง TikTok
 *
 * TikTok บังคับให้แอปทำสิ่งเหล่านี้ ไม่งั้นไม่ผ่าน App Review:
 * - แสดงชื่อบัญชีที่กำลังจะโพสต์ลงไป
 * - แสดงตัวเลือกความเป็นส่วนตัวตามที่ creator_info ส่งมา และห้ามเลือกให้ล่วงหน้า
 * - ให้ปิดคอมเมนต์ / ดูเอ็ต / สติทช์ ได้ และล็อกไว้ถ้าบัญชีปิดมาแต่ต้น
 * - มีช่องเปิดเผยเนื้อหาเชิงพาณิชย์
 * - มีป้ายเนื้อหาที่สร้างด้วย AI
 */
export function TikTokPostOptions({
  channelAccountId,
  clip,
  value,
  onChange,
}: {
  channelAccountId: string | null;
  clip: ClipInfo;
  value: TikTokPostOptionsValue;
  onChange: (next: TikTokPostOptionsValue) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tiktok-creator-info", channelAccountId],
    enabled: !!channelAccountId,
    staleTime: 60_000,
    retry: false,
    queryFn: () =>
      apiFetch<CreatorResponse>("/api/tiktok/creator-info", {
        method: "POST",
        body: JSON.stringify({ channelAccountId }),
      }),
  });

  const creator = data?.creator ?? null;

  // บัญชีที่ปิดคอมเมนต์/ดูเอ็ต/สติทช์ไว้ที่ระดับบัญชี → บังคับปิดตามและล็อกสวิตช์
  useEffect(() => {
    if (!creator) return;
    const forced: Partial<TikTokPostOptionsValue> = {};
    if (creator.commentDisabled && !value.disableComment) forced.disableComment = true;
    if (creator.duetDisabled && !value.disableDuet) forced.disableDuet = true;
    if (creator.stitchDisabled && !value.disableStitch) forced.disableStitch = true;
    if (Object.keys(forced).length) onChange({ ...value, ...forced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator]);

  const set = <K extends keyof TikTokPostOptionsValue>(key: K, next: TikTokPostOptionsValue[K]) =>
    onChange({ ...value, [key]: next });

  const problem = validateTikTokOptions(value, creator);
  const notice = tiktokDisclosureNotice(value);

  if (!channelAccountId) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4">
        <p className="text-xs leading-5 text-muted-foreground">
          เลือกบัญชี TikTok ที่จะโพสต์ก่อน แล้วตัวเลือกของ TikTok จะขึ้นตรงนี้
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15">
          <Music2 className="size-5 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">ตัวเลือกของ TikTok</p>
          {isLoading ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              กำลังอ่านข้อมูลบัญชี...
            </p>
          ) : creator ? (
            <p className="text-xs text-muted-foreground">
              จะโพสต์ลงบัญชี{" "}
              <span className="font-medium text-foreground">{creator.displayName}</span>
              {creator.username ? ` (@${creator.username})` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
          {error instanceof Error ? error.message : "อ่านข้อมูลบัญชี TikTok ไม่สำเร็จ"}
        </p>
      ) : null}

      {creator ? (
        <>
          {data && !data.canDirectPost ? (
            <p className="rounded-xl bg-secondary px-3 py-2 text-xs leading-5 text-muted-foreground">
              บัญชีนี้ยังไม่มีสิทธิ์โพสต์ขึ้นโปรไฟล์โดยตรง ระบบจะส่งคลิปเข้ากล่องร่างในแอป TikTok
              ให้กดโพสต์เอง
            </p>
          ) : null}

          {/* ความเป็นส่วนตัว — TikTok บังคับให้ผู้ใช้เลือกเอง ห้ามตั้งค่าเริ่มต้นให้ */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              ใครดูคลิปนี้ได้บ้าง <span className="text-destructive">*</span>
            </Label>
            {creator.privacyOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                บัญชีนี้ยังโพสต์ผ่านแอปภายนอกไม่ได้ — เปิดแอป TikTok แล้วตรวจสถานะบัญชีอีกครั้ง
              </p>
            ) : (
              <RadioGroup
                value={value.privacyLevel ?? ""}
                onValueChange={(next) => set("privacyLevel", next as TikTokPrivacyLevel)}
                className="gap-1.5"
              >
                {creator.privacyOptions.map((option) => (
                  <label
                    key={option}
                    htmlFor={`tt-privacy-${option}`}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value={option} id={`tt-privacy-${option}`} />
                    <span>{TIKTOK_PRIVACY_LABELS[option]}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>

          {/* การโต้ตอบ — ถ้าบัญชีปิดมาแต่ต้น ล็อกไว้ไม่ให้แก้ */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">การโต้ตอบ</Label>
            <div className="space-y-1.5">
              <ToggleRow
                id="tt-comment"
                label="ปิดคอมเมนต์"
                checked={value.disableComment}
                locked={creator.commentDisabled}
                onChange={(next) => set("disableComment", next)}
              />
              <ToggleRow
                id="tt-duet"
                label="ปิดดูเอ็ต"
                checked={value.disableDuet}
                locked={creator.duetDisabled}
                onChange={(next) => set("disableDuet", next)}
              />
              <ToggleRow
                id="tt-stitch"
                label="ปิดสติทช์"
                checked={value.disableStitch}
                locked={creator.stitchDisabled}
                onChange={(next) => set("disableStitch", next)}
              />
            </div>
          </div>

          {/* เปิดเผยเนื้อหาเชิงพาณิชย์ — TikTok บังคับให้มี */}
          <div className="space-y-2">
            <ToggleRow
              id="tt-disclose"
              label="เปิดเผยว่าเป็นเนื้อหาเชิงพาณิชย์"
              checked={value.disclose}
              onChange={(next) =>
                onChange(
                  next
                    ? { ...value, disclose: true }
                    : { ...value, disclose: false, brandOrganic: false, brandContent: false },
                )
              }
            />
            {value.disclose ? (
              <div className="space-y-1.5 rounded-xl border border-border bg-background/60 p-3">
                <ToggleRow
                  id="tt-organic"
                  label="โปรโมทธุรกิจของตัวเอง"
                  checked={value.brandOrganic}
                  onChange={(next) => set("brandOrganic", next)}
                />
                <ToggleRow
                  id="tt-branded"
                  label="ได้รับค่าตอบแทนจากแบรนด์อื่น"
                  checked={value.brandContent}
                  onChange={(next) => set("brandContent", next)}
                />
                {notice ? (
                  <p className="pt-1 text-[11px] leading-5 text-muted-foreground">{notice}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <ToggleRow
            id="tt-aigc"
            label="เนื้อหานี้สร้างหรือดัดแปลงด้วย AI"
            checked={value.isAigc}
            onChange={(next) => set("isAigc", next)}
          />

          {/* รูปปก — TikTok ไม่เปิดให้อัปรูปเอง เลือกได้แค่เฟรมจากในคลิป */}
          {clip.durationSec ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-xs font-semibold text-foreground">รูปปกคลิป</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  วินาทีที่ {(value.coverTimestampMs / 1000).toFixed(1)}
                </span>
              </div>
              <Slider
                value={[value.coverTimestampMs]}
                min={0}
                max={Math.max(0, Math.floor(clip.durationSec * 1000) - 100)}
                step={100}
                onValueChange={(next) => set("coverTimestampMs", next[0] ?? 0)}
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                TikTok ไม่เปิดให้อัปรูปปกเอง เลือกได้แค่ว่าจะใช้เฟรมวินาทีไหนของคลิปเป็นปก
              </p>
            </div>
          ) : null}

          {problem ? (
            <p className="flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {problem}
            </p>
          ) : null}

          <p className="text-[11px] leading-5 text-muted-foreground">
            เมื่อกดโพสต์ ถือว่ายอมรับ{" "}
            <a
              href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ข้อกำหนดการใช้เพลงของ TikTok
            </a>
          </p>
        </>
      ) : null}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  locked = false,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  locked?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
      <Label htmlFor={id} className="text-sm font-normal text-foreground">
        {label}
        {locked ? (
          <span className="ml-1.5 text-[11px] text-muted-foreground">(บัญชีตั้งไว้แบบนี้)</span>
        ) : null}
      </Label>
      <Switch id={id} checked={checked} disabled={locked} onCheckedChange={onChange} />
    </div>
  );
}
