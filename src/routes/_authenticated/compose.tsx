import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PostDraftEditor,
  draftCharLimit,
  draftPlatformSet,
  type ChannelAccount,
  type PostDraft,
} from "@/components/app/PostDraftEditor";
import {
  TIKTOK_DEFAULT_OPTIONS,
  parseTikTokOptions,
  validateTikTokOptions,
} from "@/lib/tiktok-options";
import {
  YOUTUBE_DEFAULT_OPTIONS,
  parseYouTubeOptions,
  validateYouTubeOptions,
} from "@/lib/youtube-options";
import {
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
          "เขียนหลายโพสต์ในรอบเดียว แนบรูปหรือคลิปเป็นอัลบัม เลือกหลายเพจหลายช่องทาง ตั้งเวลาแต่ละโพสต์ แล้วส่งอนุมัติทีเดียว",
      },
      { property: "og:title", content: "สร้างโพสต์ — Social Post" },
      {
        property: "og:description",
        content: "เขียนหลายโพสต์ในรอบเดียว เลือกหลายเพจ ตั้งเวลา แล้วส่งเข้าคิวอนุมัติพร้อมกัน",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComposePage,
});

let draftSeq = 0;
const newDraft = (base?: Partial<PostDraft>): PostDraft => ({
  key: `draft-${++draftSeq}`,
  title: "",
  body: "",
  mediaPaths: [],
  scheduledAt: "",
  accountIds: [],
  platforms: [],
  tiktokOptions: TIKTOK_DEFAULT_OPTIONS,
  youtubeOptions: YOUTUBE_DEFAULT_OPTIONS,
  ...base,
});

function ComposePage() {
  const { id } = Route.useSearch();
  const { brandId, brands, setBrandId } = useBrand();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [draftBrand, setDraftBrand] = useState<string | null>(brandId);
  const [status, setStatus] = useState<PostStatus>("draft");
  const [drafts, setDrafts] = useState<PostDraft[]>([newDraft()]);
  const [activeKey, setActiveKey] = useState<string>(() => drafts[0]!.key);

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
    setStatus(post.status as PostStatus);
    setDraftBrand(post.brand_id);
    const targets = (post.post_targets ?? []) as {
      platform: Platform;
      channel_account_id: string | null;
      tiktok_options?: unknown;
      youtube_options?: unknown;
    }[];
    const savedTikTok = targets.find((t) => t.platform === "tiktok" && t.tiktok_options);
    const savedYouTube = targets.find((t) => t.platform === "youtube" && t.youtube_options);
    const loaded = newDraft({
      title: post.title ?? "",
      body: post.body ?? "",
      mediaPaths: (post.media_urls as string[] | null) ?? [],
      scheduledAt: isoToLocalInput(post.scheduled_at),
      accountIds: targets.map((t) => t.channel_account_id).filter((v): v is string => !!v),
      platforms: [...new Set(targets.filter((t) => !t.channel_account_id).map((t) => t.platform))],
      tiktokOptions: savedTikTok
        ? parseTikTokOptions(savedTikTok.tiktok_options)
        : TIKTOK_DEFAULT_OPTIONS,
      youtubeOptions: savedYouTube
        ? parseYouTubeOptions(savedYouTube.youtube_options)
        : YOUTUBE_DEFAULT_OPTIONS,
    });
    setDrafts([loaded]);
    setActiveKey(loaded.key);
  }, [post]);

  const locked = status === "published" || status === "publishing";
  const multi = !id;

  const patchDraft = (key: string, patch: Partial<PostDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const addDraft = (base?: PostDraft) => {
    // คัดลอกโพสต์: ยกช่องทาง/ตัวเลือกมาด้วย เพื่อไม่ต้องเลือกซ้ำ แต่ได้ key ใหม่เสมอ
    const created = base ? { ...newDraft(), ...base, key: newDraft().key } : newDraft();
    setDrafts((prev) => [...prev, created]);
    setActiveKey(created.key);
  };

  const removeDraft = (key: string) =>
    setDrafts((prev) => {
      const next = prev.filter((d) => d.key !== key);
      const list = next.length ? next : [newDraft()];
      setActiveKey(list[Math.max(0, list.length - 1)]!.key);
      return list;
    });

  const validateDraft = (draft: PostDraft, index: number, nextStatus: PostStatus) => {
    const label = `โพสต์ที่ ${index + 1}`;
    if (!draft.body.trim() && draft.mediaPaths.length === 0)
      throw new Error(`${label}: ใส่เนื้อหาหรือแนบสื่ออย่างน้อย 1 อย่าง`);
    if (draft.accountIds.length === 0 && draft.platforms.length === 0)
      throw new Error(`${label}: เลือกช่องทางอย่างน้อย 1 ช่องทาง`);
    if (draft.body.length > draftCharLimit(draft, accounts))
      throw new Error(`${label}: เนื้อหายาวเกินขีดจำกัดของช่องทางที่เลือก`);
    const set = draftPlatformSet(draft, accounts);
    if (nextStatus !== "draft" && set.has("tiktok")) {
      const problem = validateTikTokOptions(draft.tiktokOptions);
      if (problem) throw new Error(`${label} · TikTok: ${problem}`);
    }
    if (nextStatus !== "draft" && set.has("youtube")) {
      const problem = validateYouTubeOptions(draft.youtubeOptions);
      if (problem) throw new Error(`${label} · YouTube: ${problem}`);
    }
  };

  const save = useMutation({
    mutationFn: async (nextStatus: PostStatus) => {
      if (!activeBrand) throw new Error("กรุณาเลือกแบรนด์ก่อน");
      drafts.forEach((draft, i) => validateDraft(draft, i, nextStatus));

      const saveOne = async (draft: PostDraft, postId?: string) => {
        const payload = {
          brand_id: activeBrand,
          title: draft.title.trim() || null,
          body: draft.body.trim(),
          media_url: draft.mediaPaths[0] ?? null,
          media_urls: draft.mediaPaths,
          scheduled_at: localInputToIso(draft.scheduledAt),
          status: nextStatus,
        };

        let savedId = postId;
        if (savedId) {
          const { error } = await supabase.from("posts").update(payload).eq("id", savedId);
          if (error) throw error;
          const { error: delError } = await supabase
            .from("post_targets")
            .delete()
            .eq("post_id", savedId);
          if (delError) throw delError;
        } else {
          const { data, error } = await supabase
            .from("posts")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          savedId = data.id;
        }

        const set = draftPlatformSet(draft, accounts);
        const ttOptions = set.has("tiktok") ? draft.tiktokOptions : null;
        const ytOptions = set.has("youtube") ? draft.youtubeOptions : null;
        const rows = [
          ...accounts
            .filter((a) => draft.accountIds.includes(a.id))
            .map((a) => ({
              post_id: savedId!,
              platform: a.platform,
              channel_account_id: a.id,
              tiktok_options: a.platform === "tiktok" ? ttOptions : null,
              youtube_options: a.platform === "youtube" ? ytOptions : null,
            })),
          ...draft.platforms.map((platform) => ({
            post_id: savedId!,
            platform,
            channel_account_id: null,
            tiktok_options: platform === "tiktok" ? ttOptions : null,
            youtube_options: platform === "youtube" ? ytOptions : null,
          })),
        ];
        const { error: targetError } = await supabase.from("post_targets").insert(rows);
        if (targetError) throw targetError;
        return savedId!;
      };

      if (id) {
        await saveOne(drafts[0]!, id);
        return 1;
      }
      // บันทึกทีละใบตามลำดับ เพื่อให้ข้อความผิดพลาดชี้ชัดว่าใบไหนมีปัญหา
      for (const draft of drafts) await saveOne(draft);
      return drafts.length;
    },
    onSuccess: (count, nextStatus) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(
        nextStatus === "pending"
          ? `ส่งขออนุมัติแล้ว ${count} โพสต์`
          : `บันทึกร่างแล้ว ${count} โพสต์`,
      );
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

  const active = drafts.find((d) => d.key === activeKey) ?? drafts[0]!;

  const draftSummary = (draft: PostDraft) =>
    draft.title.trim() || draft.body.trim().slice(0, 24) || "ยังว่าง";

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {id ? "แก้ไขโพสต์" : drafts.length > 1 ? `โพสต์ใหม่ ${drafts.length} ใบ` : "โพสต์ใหม่"}
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
              setDrafts((prev) => prev.map((d) => ({ ...d, accountIds: [] })));
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

      {multi ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            เขียนได้หลายโพสต์ในรอบเดียว — แต่ละใบเลือกช่องทางและเวลาของตัวเองได้ ส่งอนุมัติทีเดียว
            ผู้อนุมัติจะเลือกอนุมัติหรือตีกลับเฉพาะใบที่ต้องการได้
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {drafts.map((draft, i) => (
              <button
                key={draft.key}
                type="button"
                onClick={() => setActiveKey(draft.key)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                  draft.key === active.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <span className="block font-semibold">โพสต์ {i + 1}</span>
                <span className="block max-w-28 truncate">{draftSummary(draft)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => addDraft()}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-primary/60 px-3 py-2 text-xs font-semibold text-primary"
            >
              <Plus className="size-3.5" /> เพิ่มโพสต์
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1 rounded-xl text-xs"
              onClick={() => addDraft(active)}
            >
              <Copy className="mr-1 size-3.5" /> คัดลอกโพสต์นี้
            </Button>
            {drafts.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-xl text-xs text-destructive hover:text-destructive"
                onClick={() => removeDraft(active.key)}
              >
                <Trash2 className="mr-1 size-3.5" /> ลบใบนี้
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <PostDraftEditor
        key={active.key}
        draft={active}
        brandId={activeBrand}
        accounts={accounts}
        disabled={locked}
        onChange={(patch) => patchDraft(active.key, patch)}
      />

      {!locked ? (
        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="h-12 rounded-xl text-base font-semibold"
            onClick={() => save.mutate("pending")}
            disabled={save.isPending}
          >
            {drafts.length > 1 ? `ส่งขออนุมัติทั้ง ${drafts.length} โพสต์` : "ส่งขออนุมัติ"}
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
