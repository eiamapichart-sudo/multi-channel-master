import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      { title: "สร้างโพสต์ — Social Publisher" },
      {
        name: "description",
        content: "เขียนโพสต์ครั้งเดียว เลือกช่องทาง Facebook Instagram TikTok YouTube LINE และตั้งเวลาล่วงหน้า",
      },
      { property: "og:title", content: "สร้างโพสต์ — Social Publisher" },
      {
        property: "og:description",
        content: "เขียนครั้งเดียว เลือกช่องทาง ตั้งเวลา แล้วส่งเข้าคิวอนุมัติ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComposePage,
});

function ComposePage() {
  const { id } = Route.useSearch();
  const { brandId } = useBrand();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selected, setSelected] = useState<Platform[]>(["facebook"]);
  const [status, setStatus] = useState<PostStatus>("draft");

  const { data: post } = useQuery({
    queryKey: ["post", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, post_targets(id, platform, status, error_message)")
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
    setMediaUrl(post.media_url ?? "");
    setScheduledAt(isoToLocalInput(post.scheduled_at));
    setStatus(post.status as PostStatus);
    const targets = (post.post_targets ?? []) as { platform: Platform }[];
    if (targets.length) setSelected(targets.map((t) => t.platform));
  }, [post]);

  const locked = status === "published" || status === "publishing";

  const save = useMutation({
    mutationFn: async (nextStatus: PostStatus) => {
      if (!brandId) throw new Error("กรุณาเลือกแบรนด์ก่อน");
      if (!body.trim()) throw new Error("กรุณาใส่เนื้อหาโพสต์");
      if (selected.length === 0) throw new Error("เลือกช่องทางอย่างน้อย 1 ช่องทาง");

      const payload = {
        brand_id: brandId,
        title: title.trim() || null,
        body: body.trim(),
        media_url: mediaUrl.trim() || null,
        scheduled_at: localInputToIso(scheduledAt),
        status: nextStatus,
      };

      let postId = id;
      if (postId) {
        const { error } = await supabase.from("posts").update(payload).eq("id", postId);
        if (error) throw error;
        const { error: delError } = await supabase.from("post_targets").delete().eq("post_id", postId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase.from("posts").insert(payload).select("id").single();
        if (error) throw error;
        postId = data.id;
      }

      const { error: targetError } = await supabase
        .from("post_targets")
        .insert(selected.map((platform) => ({ post_id: postId!, platform })));
      if (targetError) throw targetError;

      return postId!;
    },
    onSuccess: (postId, nextStatus) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
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

  const toggle = (platform: Platform) =>
    setSelected((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );

  const tightestLimit = Math.min(
    ...(selected.length
      ? selected.map((p) => PLATFORMS.find((x) => x.id === p)!.limit)
      : [PLATFORMS[0]!.limit]),
  );
  const over = body.length > tightestLimit;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {id ? "แก้ไขโพสต์" : "สร้างโพสต์"}
        </h1>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_META[status].className}`}
        >
          {STATUS_META[status].label}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">หัวข้อภายใน (ไม่ส่งออก)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น โปรโมชันสงกรานต์"
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">เนื้อหาโพสต์</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="เขียนครั้งเดียว ส่งออกทุกช่องทางที่เลือก"
          disabled={locked}
        />
        <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
          {body.length.toLocaleString("th-TH")} / {tightestLimit.toLocaleString("th-TH")} ตัวอักษร
          (จำกัดตามช่องทางที่สั้นสุด)
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="media">ลิงก์รูปหรือวิดีโอ</Label>
        <Input
          id="media"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://…"
          inputMode="url"
          disabled={locked}
        />
      </div>

      <fieldset className="space-y-2" disabled={locked}>
        <legend className="text-sm font-medium text-foreground">ช่องทางที่จะส่งออก</legend>
        <div className="grid gap-2">
          {PLATFORMS.map((platform) => {
            const active = selected.includes(platform.id);
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => toggle(platform.id)}
                aria-pressed={active}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">{platform.label}</span>
                  <span className="block text-xs text-muted-foreground">{platform.note}</span>
                </span>
                <span
                  className={`size-5 shrink-0 rounded-full border-2 ${
                    active ? "border-primary bg-primary" : "border-input"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="schedule">เวลาเผยแพร่ (เวลาไทย)</Label>
        <Input
          id="schedule"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          disabled={locked}
        />
        <p className="text-xs text-muted-foreground">
          เว้นว่างได้ถ้ายังไม่กำหนดเวลา — โพสต์จะรออยู่ในคิวหลังอนุมัติ
        </p>
      </div>

      {!locked ? (
        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="h-11"
            onClick={() => save.mutate("pending")}
            disabled={save.isPending || over}
          >
            ส่งขออนุมัติ
          </Button>
          <Button
            variant="outline"
            className="h-11"
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
        <p className="rounded-lg border border-border bg-secondary p-4 text-sm text-muted-foreground">
          โพสต์นี้เผยแพร่แล้ว จึงแก้ไขไม่ได้
        </p>
      )}
    </div>
  );
}
