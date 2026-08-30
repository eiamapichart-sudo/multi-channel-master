import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/components/app/MediaPicker";
import { TikTokPostOptions } from "@/components/app/TikTokPostOptions";
import { YouTubePostOptions } from "@/components/app/YouTubePostOptions";
import {
  TIKTOK_DEFAULT_OPTIONS,
  parseTikTokOptions,
  validateTikTokOptions,
  type TikTokPostOptionsValue,
} from "@/lib/tiktok-options";
import {
  YOUTUBE_DEFAULT_OPTIONS,
  parseYouTubeOptions,
  validateYouTubeOptions,
  type YouTubePostOptionsValue,
} from "@/lib/youtube-options";
import {
  PLATFORMS,
  STATUS_META,
  isoToLocalInput,
  localInputToIso,
  type Platform,
  type PostStatus,
} from "@/lib/platforms";

const searchSchema = z.object({ id: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/compose")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "สร้างโพสต์ — Social Post" },
      {
        name: "description",
        content:
          "เขียนโพสต์ครั้งเดียว แนบรูปหรือคลิปจากเครื่องเป็นอัลบัม เลือกหลายเพจหลายช่องทาง และตั้งเวลาล่วงหน้า",
      },
      { property: "og:title", content: "สร้างโพสต์ — Social Post" },
      {
        property: "og:description",
        content: "เขียนครั้งเดียว แนบอัลบัม เลือกหลายเพจ ตั้งเวลา แล้วส่งเข้าคิวอนุมัติ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComposePage,
});

type ChannelAccount = { id: string; platform: Platform; account_name: string };

function ComposePage() {
  const { id } = Route.useSearch();
  const { brandId, brands, setBrandId } = useBrand();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [draftBrand, setDraftBrand] = useState<string | null>(brandId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [status, setStatus] = useState<PostStatus>("draft");
  const [tiktokOptions, setTiktokOptions] =
    useState<TikTokPostOptionsValue>(TIKTOK_DEFAULT_OPTIONS);
  const [youtubeOptions, setYoutubeOptions] =
    useState<YouTubePostOptionsValue>(YOUTUBE_DEFAULT_OPTIONS);

  useEffect(() => {
    if (brandId) setDraftBrand(brandId);
  }, [brandId]);

  const activeBrand = draftBrand ?? brandId ?? brands[0]?.id ?? null;

  const { data: accounts = [] } = useQuery({
    queryKey: ["channels", activeBrand],
    enabled: !!activeBrand,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_accounts")
        .select("id, platform, account_name")
        .eq("brand_id", activeBrand!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChannelAccount[];
    },
  });

  const { data: post } = useQuery({
    queryKey: ["post", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "*, post_targets(id, platform, channel_account_id, status, error_message, tiktok_options, youtube_options)",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!post) return;
    setTitle(post.title ?? "");
    setBody(post.body ?? "");
    setMediaPaths((post.media_urls as string[] | null) ?? []);
    setScheduledAt(isoToLocalInput(post.scheduled_at));
    setStatus(post.status as PostStatus);
    setDraftBrand(post.brand_id);
    const targets = (post.post_targets ?? []) as {
      platform: Platform;
      channel_account_id: string | null;
      tiktok_options?: unknown;
      youtube_options?: unknown;
    }[];
    setAccountIds(targets.map((t) => t.channel_account_id).filter((v): v is string => !!v));
    setPlatforms([...new Set(targets.filter((t) => !t.channel_account_id).map((t) => t.platform))]);
    // ตัวเลือก TikTok เก็บไว้ที่ target ของ TikTok — ดึงกลับมาแสดงตอนแก้ไขโพสต์เดิม
    const savedTikTok = targets.find((t) => t.platform === "tiktok" && t.tiktok_options);
    setTiktokOptions(
      savedTikTok ? parseTikTokOptions(savedTikTok.tiktok_options) : TIKTOK_DEFAULT_OPTIONS,
    );
    // ตัวเลือก YouTube เก็บไว้ที่ target ของ YouTube — ดึงกลับมาแสดงตอนแก้ไขโพสต์เดิม
    const savedYouTube = targets.find((t) => t.platform === "youtube" && t.youtube_options);
    setYoutubeOptions(
      savedYouTube ? parseYouTubeOptions(savedYouTube.youtube_options) : YOUTUBE_DEFAULT_OPTIONS,
    );
  }, [post]);

  const locked = status === "published" || status === "publishing";

  const selectedPlatformSet = new Set<Platform>([
    ...platforms,
    ...accounts.filter((a) => accountIds.includes(a.id)).map((a) => a.platform),
  ]);

  // บัญชี TikTok ที่ถูกเลือกอยู่ — ใช้ดึงตัวเลือกความเป็นส่วนตัวที่บัญชีนั้นใช้ได้จริง
  const tiktokAccountId =
    accounts.find((a) => a.platform === "tiktok" && accountIds.includes(a.id))?.id ?? null;
  const tiktokSelected = selectedPlatformSet.has("tiktok");

  // ช่อง YouTube ที่ถูกเลือกอยู่ — ใช้แสดงชื่อช่องในแผงตัวเลือก
  const youtubeAccountName =
    accounts.find((a) => a.platform === "youtube" && accountIds.includes(a.id))?.account_name ??
    null;
  const youtubeSelected = selectedPlatformSet.has("youtube");

  const save = useMutation({
    mutationFn: async (nextStatus: PostStatus) => {
      if (!activeBrand) throw new Error("กรุณาเลือกแบรนด์ก่อน");
      if (!body.trim() && mediaPaths.length === 0)
        throw new Error("ใส่เนื้อหาหรือแนบสื่ออย่างน้อย 1 อย่าง");
      if (accountIds.length === 0 && platforms.length === 0)
        throw new Error("เลือกช่องทางอย่างน้อย 1 ช่องทาง");

      // TikTok บังคับให้ผู้ใช้เลือกตัวเลือกเองก่อนโพสต์ — กันไว้ตั้งแต่ตอนบันทึก
      if (tiktokSelected && nextStatus !== "draft") {
        const problem = validateTikTokOptions(tiktokOptions);
        if (problem) throw new Error(`TikTok: ${problem}`);
      }

      // YouTube บังคับให้มีชื่อคลิป และต้องเลือกความเป็นส่วนตัวกับป้ายทำเพื่อเด็กเอง
      if (youtubeSelected && nextStatus !== "draft") {
        const problem = validateYouTubeOptions(youtubeOptions);
        if (problem) throw new Error(`YouTube: ${problem}`);
      }

      const payload = {
        brand_id: activeBrand,
        title: title.trim() || null,
        body: body.trim(),
        media_url: mediaPaths[0] ?? null,
        media_urls: mediaPaths,
        scheduled_at: localInputToIso(scheduledAt),
        status: nextStatus,
      };

      let postId = id;
      if (postId) {
        const { error } = await supabase.from("posts").update(payload).eq("id", postId);
        if (error) throw error;
        const { error: delError } = await supabase
          .from("post_targets")
          .delete()
          .eq("post_id", postId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase.from("posts").insert(payload).select("id").single();
        if (error) throw error;
        postId = data.id;
      }

      // แนบตัวเลือก TikTok เฉพาะแถวของ TikTok ช่องทางอื่นไม่ใช้คอลัมน์นี้
      const ttOptions = tiktokSelected ? tiktokOptions : null;
      const ytOptions = youtubeSelected ? youtubeOptions : null;
      const rows = [
        ...accounts
          .filter((a) => accountIds.includes(a.id))
          .map((a) => ({
            post_id: postId!,
            platform: a.platform,
            channel_account_id: a.id,
            tiktok_options: a.platform === "tiktok" ? ttOptions : null,
            youtube_options: a.platform === "youtube" ? ytOptions : null,
          })),
        ...platforms.map((platform) => ({
          post_id: postId!,
          platform,
          channel_account_id: null,
          tiktok_options: platform === "tiktok" ? ttOptions : null,
          youtube_options: platform === "youtube" ? ytOptions : null,
        })),
      ];

      const { error: targetError } = await supabase.from("post_targets").insert(rows);
      if (targetError) throw targetError;

      return postId!;
    },
    onSuccess: (postId, nextStatus) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(nextStatus === "pending" ? "ส่งขออนุมัติแล้ว" : "บันทึกร่างแล้ว");
      navigate({ to: "/" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("ลบโพสต์แล้ว");
      navigate({ to: "/" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ลบไม่สำเร็จ"),
  });

  const toggleAccount = (accountId: string) =>
    setAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((p) => p !== accountId) : [...prev, accountId],
    );

  const togglePlatform = (platform: Platform) =>
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );

  const tightestLimit = Math.min(
    ...(selectedPlatformSet.size
      ? [...selectedPlatformSet].map((p) => PLATFORMS.find((x) => x.id === p)!.limit)
      : [PLATFORMS[0]!.limit]),
  );
  const over = body.length > tightestLimit;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {id ? "แก้ไขโพสต์" : "โพสต์ใหม่"}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${STATUS_META[status].className}`}
        >
          {STATUS_META[status].label}
        </span>
      </div>

      {brands.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="brand">โพสต์ในชื่อแบรนด์</Label>
          <select
            id="brand"
            value={activeBrand ?? ""}
            onChange={(e) => {
              setDraftBrand(e.target.value);
              setAccountIds([]);
              if (!brandId) setBrandId(null);
            }}
            disabled={locked}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <section className="space-y-2">
        <Label>รูปและคลิป</Label>
        <MediaPicker
          brandId={activeBrand}
          paths={mediaPaths}
          onChange={setMediaPaths}
          disabled={locked}
        />
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="body">เนื้อหาโพสต์</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          placeholder="เขียนครั้งเดียว ส่งออกทุกช่องทางที่เลือก ✨"
          disabled={locked}
          className="rounded-2xl text-base"
        />
        <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
          {body.length.toLocaleString("th-TH")} / {tightestLimit.toLocaleString("th-TH")} ตัวอักษร
          (จำกัดตามช่องทางที่สั้นสุด)
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">หัวข้อภายใน (ไม่ส่งออก)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น โปรโมชันสงกรานต์"
          disabled={locked}
          className="rounded-xl"
        />
      </div>

      <fieldset className="space-y-3" disabled={locked}>
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
                      aria-pressed={platforms.includes(platform.id)}
                      className={`size-6 shrink-0 rounded-full border-2 transition-colors ${
                        platforms.includes(platform.id)
                          ? "border-primary bg-primary"
                          : "border-input"
                      }`}
                    />
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {pageAccounts.filter((a) => accountIds.includes(a.id)).length}/
                      {pageAccounts.length}
                    </span>
                  )}
                </div>

                {pageAccounts.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {pageAccounts.map((account) => {
                      const on = accountIds.includes(account.id);
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
        <section className="space-y-2">
          <TikTokPostOptions
            channelAccountId={tiktokAccountId}
            value={tiktokOptions}
            onChange={setTiktokOptions}
          />
        </section>
      ) : null}

      {youtubeSelected ? (
        <section className="space-y-2">
          <YouTubePostOptions
            accountName={youtubeAccountName}
            value={youtubeOptions}
            onChange={setYoutubeOptions}
          />
        </section>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="schedule">เวลาเผยแพร่ (เวลาไทย)</Label>
        <Input
          id="schedule"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          disabled={locked}
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">
          เว้นว่างได้ถ้ายังไม่กำหนดเวลา — โพสต์จะรออยู่ในคิวหลังอนุมัติ
        </p>
      </div>

      {!locked ? (
        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="h-12 rounded-xl text-base font-semibold"
            onClick={() => save.mutate("pending")}
            disabled={save.isPending || over}
          >
            ส่งขออนุมัติ
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-xl"
            onClick={() => save.mutate("draft")}
            disabled={save.isPending}
          >
            บันทึกเป็นร่าง
          </Button>
          {id ? (
            <Button
              variant="ghost"
              className="h-11 text-destructive hover:text-destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              ลบโพสต์นี้
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-secondary p-4 text-sm text-muted-foreground">
          โพสต์นี้เผยแพร่แล้ว จึงแก้ไขไม่ได้
        </p>
      )}
    </div>
  );
}
