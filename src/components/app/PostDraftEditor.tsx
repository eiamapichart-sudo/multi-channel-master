import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/components/app/MediaPicker";
import { TikTokPostOptions } from "@/components/app/TikTokPostOptions";
import { YouTubePostOptions } from "@/components/app/YouTubePostOptions";
import { useClipInfo } from "@/lib/use-clip-info";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import type { TikTokPostOptionsValue } from "@/lib/tiktok-options";
import type { YouTubePostOptionsValue } from "@/lib/youtube-options";

export type ChannelAccount = { id: string; platform: Platform; account_name: string };

/** โพสต์หนึ่งใบในชุดที่กำลังเขียน — หนึ่งหน้าเขียนโพสต์ถือได้หลายใบ */
export type PostDraft = {
  key: string;
  title: string;
  body: string;
  mediaPaths: string[];
  scheduledAt: string;
  accountIds: string[];
  platforms: Platform[];
  tiktokOptions: TikTokPostOptionsValue;
  youtubeOptions: YouTubePostOptionsValue;
};

export function draftPlatformSet(draft: PostDraft, accounts: ChannelAccount[]) {
  return new Set<Platform>([
    ...draft.platforms,
    ...accounts.filter((a) => draft.accountIds.includes(a.id)).map((a) => a.platform),
  ]);
}

export function draftCharLimit(draft: PostDraft, accounts: ChannelAccount[]) {
  const set = draftPlatformSet(draft, accounts);
  return Math.min(
    ...(set.size
      ? [...set].map((p) => PLATFORMS.find((x) => x.id === p)!.limit)
      : [PLATFORMS[0]!.limit]),
  );
}

type Props = {
  draft: PostDraft;
  brandId: string | null;
  accounts: ChannelAccount[];
  disabled?: boolean | undefined;
  onChange: (patch: Partial<PostDraft>) => void;
};

export function PostDraftEditor({ draft, brandId, accounts, disabled, onChange }: Props) {
  const clip = useClipInfo(draft.mediaPaths);
  const selectedPlatformSet = draftPlatformSet(draft, accounts);

  const tiktokAccountId =
    accounts.find((a) => a.platform === "tiktok" && draft.accountIds.includes(a.id))?.id ?? null;
  const tiktokSelected = selectedPlatformSet.has("tiktok");

  const youtubeAccountName =
    accounts.find((a) => a.platform === "youtube" && draft.accountIds.includes(a.id))
      ?.account_name ?? null;
  const youtubeSelected = selectedPlatformSet.has("youtube");

  const toggleAccount = (accountId: string) =>
    onChange({
      accountIds: draft.accountIds.includes(accountId)
        ? draft.accountIds.filter((p) => p !== accountId)
        : [...draft.accountIds, accountId],
    });

  const togglePlatform = (platform: Platform) =>
    onChange({
      platforms: draft.platforms.includes(platform)
        ? draft.platforms.filter((p) => p !== platform)
        : [...draft.platforms, platform],
    });

  const limit = draftCharLimit(draft, accounts);
  const over = draft.body.length > limit;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <Label>รูปและคลิป</Label>
        <MediaPicker
          brandId={brandId}
          paths={draft.mediaPaths}
          onChange={(paths) => onChange({ mediaPaths: paths })}
          disabled={disabled ?? false}
        />
      </section>

      <div className="space-y-1.5">
        <Label htmlFor={`body-${draft.key}`}>เนื้อหาโพสต์</Label>
        <Textarea
          id={`body-${draft.key}`}
          value={draft.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={7}
          placeholder="เขียนครั้งเดียว ส่งออกทุกช่องทางที่เลือก ✨"
          disabled={disabled}
          className="rounded-2xl text-base"
        />
        <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
          {draft.body.length.toLocaleString("th-TH")} / {limit.toLocaleString("th-TH")} ตัวอักษร
          (จำกัดตามช่องทางที่สั้นสุด)
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`title-${draft.key}`}>หัวข้อภายใน (ไม่ส่งออก)</Label>
        <Input
          id={`title-${draft.key}`}
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="เช่น โปรโมชันสงกรานต์"
          disabled={disabled}
          className="rounded-xl"
        />
      </div>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-semibold text-foreground">ช่องทางที่จะส่งออก</legend>
        <div className="space-y-4">
          {PLATFORMS.map((platform) => {
            const pageAccounts = accounts.filter((a) => a.platform === platform.id);
            const platformOn = selectedPlatformSet.has(platform.id);
            return (
              <div
                key={platform.id}
                className={`rounded-2xl border p-3 transition-colors ${
                  platformOn ? "border-primary/60 bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {platform.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{platform.note}</span>
                  </span>
                  {pageAccounts.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      aria-pressed={draft.platforms.includes(platform.id)}
                      aria-label={`เลือกช่องทาง ${platform.label}`}
                      className={`size-6 shrink-0 rounded-full border-2 transition-colors ${
                        draft.platforms.includes(platform.id)
                          ? "border-primary bg-primary"
                          : "border-input"
                      }`}
                    />
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {pageAccounts.filter((a) => draft.accountIds.includes(a.id)).length}/
                      {pageAccounts.length}
                    </span>
                  )}
                </div>

                {pageAccounts.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {pageAccounts.map((account) => {
                      const on = draft.accountIds.includes(account.id);
                      return (
                        <li key={account.id}>
                          <button
                            type="button"
                            onClick={() => toggleAccount(account.id)}
                            aria-pressed={on}
                            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                              on
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-background text-muted-foreground"
                            }`}
                          >
                            <span className="truncate">{account.account_name}</span>
                            <span
                              className={`size-5 shrink-0 rounded-full border-2 ${
                                on ? "border-primary bg-primary" : "border-input"
                              }`}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
          เพิ่มเพจได้หลายเพจต่อช่องทางที่หน้าตั้งค่า แล้วเลือกส่งพร้อมกันได้เลย
        </p>
      </fieldset>

      {tiktokSelected ? (
        <TikTokPostOptions
          channelAccountId={tiktokAccountId}
          clip={clip}
          value={draft.tiktokOptions}
          onChange={(value) => onChange({ tiktokOptions: value })}
        />
      ) : null}

      {youtubeSelected ? (
        <YouTubePostOptions
          accountName={youtubeAccountName}
          brandId={brandId}
          clip={clip}
          value={draft.youtubeOptions}
          onChange={(value) => onChange({ youtubeOptions: value })}
        />
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`schedule-${draft.key}`}>เวลาเผยแพร่ (เวลาไทย)</Label>
        <Input
          id={`schedule-${draft.key}`}
          type="datetime-local"
          value={draft.scheduledAt}
          onChange={(e) => onChange({ scheduledAt: e.target.value })}
          disabled={disabled}
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">
          เว้นว่างได้ถ้ายังไม่กำหนดเวลา — โพสต์จะรออยู่ในคิวหลังอนุมัติ
        </p>
      </div>
    </div>
  );
}
