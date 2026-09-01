import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useMyProfile, useTeamNames } from "@/hooks/useProfile";
import { MediaStrip } from "@/components/app/MediaStrip";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatThaiDateTime, platformLabel, STATUS_META, type PostStatus } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "รออนุมัติ — Social Post" },
      {
        name: "description",
        content: "ตรวจและอนุมัติโพสต์ก่อนเผยแพร่ ดูเพจปลายทางและเวลาที่ตั้งไว้ ทั้งรายแบรนด์และภาพรวม",
      },
      { property: "og:title", content: "รออนุมัติ — Social Post" },
      {
        property: "og:description",
        content: "คิวอนุมัติโพสต์ก่อนเผยแพร่ พร้อมรายละเอียดเพจและเวลา",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApprovalsPage,
});

type TargetRow = {
  id: string;
  platform: string;
  channel_account_id: string | null;
  status: string;
  error_message: string | null;
  external_url: string | null;
};

type ApprovalRow = {
  id: string;
  brand_id: string;
  title: string | null;
  body: string;
  media_url: string | null;
  media_urls: string[] | null;
  scheduled_at: string | null;
  status: PostStatus;
  approved_by: string | null;
  approved_at: string | null;
  post_targets: TargetRow[];
};

function ApprovalsPage() {
  const { brandId, brands, isAll, brandName } = useBrand();
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const myName = profile?.display_name?.trim() ?? "";
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);


  const { data: accounts = [] } = useQuery({
    queryKey: ["all-channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channel_accounts").select("id, account_name");
      if (error) throw error;
      return data as { id: string; account_name: string }[];
    },
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["approvals", brandId ?? "all"],
    enabled: brands.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select(
          "id, brand_id, title, body, media_url, media_urls, scheduled_at, status, approved_by, approved_at, post_targets(id, platform, channel_account_id, status, error_message, external_url)",
        )
        .in("status", ["pending", "approved", "publishing", "failed"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (brandId) query = query.eq("brand_id", brandId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ApprovalRow[];
    },
  });

  const { data: teamNames = {} } = useTeamNames(posts.map((p) => p.approved_by));

  const targetLabel = (target: TargetRow) => {
    const account = accounts.find((a) => a.id === target.channel_account_id);
    return account
      ? `${platformLabel(target.platform)} · ${account.account_name}`
      : platformLabel(target.platform);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["approvals"] });
    queryClient.invalidateQueries({ queryKey: ["posts"] });
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
  };

  const bulkDecide = useMutation({
    mutationFn: async ({ ids, next }: { ids: string[]; next: PostStatus }) => {
      const patch =
        next === "approved"
          ? { status: next, approved_by: user?.id ?? null, approved_at: new Date().toISOString() }
          : { status: next, approved_by: null, approved_at: null };
      const { error } = await supabase.from("posts").update(patch).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count, { next }) => {
      invalidate();
      setSelected([]);
      toast.success(
        next === "approved" ? `อนุมัติแล้ว ${count} โพสต์` : `ตีกลับให้แก้ไข ${count} โพสต์`,
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ"),
  });

  const decide = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: PostStatus }) => {
      const patch =
        next === "approved"
          ? { status: next, approved_by: user?.id ?? null, approved_at: new Date().toISOString() }
          : { status: next, approved_by: null, approved_at: null };
      const { error } = await supabase.from("posts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { next }) => {
      invalidate();
      toast.success(next === "approved" ? "อนุมัติแล้ว" : "ตีกลับให้แก้ไข");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ"),
  });

  const publishNow = useMutation({
    mutationFn: (postId: string) =>
      apiFetch<{ ok: boolean; published: number; failed: number; errors: string[] }>(
        "/api/publish/now",
        { method: "POST", body: JSON.stringify({ postId }) },
      ),
    onSuccess: (result) => {
      invalidate();
      if (result.published > 0 && result.failed === 0) {
        toast.success(`เผยแพร่แล้ว ${result.published} เพจ`);
      } else if (result.published > 0) {
        toast.warning(`สำเร็จ ${result.published} เพจ · ไม่สำเร็จ ${result.failed} เพจ`);
      } else {
        toast.error(result.errors[0] ?? "ยังไม่มีเพจที่เผยแพร่ได้ — ตรวจการเชื่อมต่อในหน้าตั้งค่า");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "เผยแพร่ไม่สำเร็จ"),
  });

  const busy = decide.isPending || publishNow.isPending || bulkDecide.isPending;
  const needsName = !myName;

  const pendingPosts = posts.filter((p) => p.status === "pending");
  const pendingIds = pendingPosts.map((p) => p.id);
  const selectedPending = selected.filter((id) => pendingIds.includes(id));
  const allSelected = pendingIds.length > 0 && selectedPending.length === pendingIds.length;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-4 pb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">คิวอนุมัติ</h1>

      {needsName ? (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-semibold text-foreground">ตั้งชื่อของคุณก่อนอนุมัติ</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ระบบจะบันทึกว่าใครเป็นคนอนุมัติแต่ละโพสต์ — ไปใส่ชื่อที่หน้าตั้งค่าก่อนนะ
          </p>
          <Link
            to="/settings"
            className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            ไปตั้งชื่อ
          </Link>
        </div>
      ) : null}

      {pendingIds.length > 1 ? (
        <div className="sticky top-2 z-10 space-y-2 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              รออนุมัติ {pendingIds.length} โพสต์ · เลือกแล้ว {selectedPending.length}
            </p>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? [] : pendingIds)}
              className="text-xs font-semibold text-primary"
            >
              {allSelected ? "ล้างที่เลือก" : "เลือกทั้งหมด"}
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              className="h-11 flex-1 rounded-xl font-semibold"
              disabled={busy || needsName || selectedPending.length === 0}
              onClick={() => bulkDecide.mutate({ ids: selectedPending, next: "approved" })}
            >
              อนุมัติที่เลือก ({selectedPending.length})
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              disabled={busy || selectedPending.length === 0}
              onClick={() => bulkDecide.mutate({ ids: selectedPending, next: "draft" })}
            >
              ตีกลับที่เลือก
            </Button>
          </div>
        </div>
      ) : null}


      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีโพสต์รออนุมัติ</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const failedTargets = post.post_targets.filter((t) => t.status === "failed");
            const publishedTargets = post.post_targets.filter((t) => t.status === "published");
            const isPublishingThis = publishNow.isPending && publishNow.variables === post.id;

            return (
              <li
                key={post.id}
                className={`rounded-2xl border bg-card p-4 ${
                  selected.includes(post.id) ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {post.status === "pending" && pendingIds.length > 1 ? (
                    <input
                      type="checkbox"
                      aria-label="เลือกโพสต์นี้เพื่ออนุมัติหรือตีกลับพร้อมกัน"
                      checked={selected.includes(post.id)}
                      onChange={() => toggle(post.id)}
                      className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--primary))]"
                    />
                  ) : null}
                  <p className="min-w-0 flex-1 font-display text-sm font-semibold text-foreground">
                    {post.title?.trim() || post.body.slice(0, 60) || "ไม่มีหัวข้อ"}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_META[post.status].className}`}
                  >
                    {STATUS_META[post.status].label}
                  </span>
                </div>

                {isAll ? (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-accent">
                    {brandName(post.brand_id)}
                  </p>
                ) : null}

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {post.body}
                </p>

                <MediaStrip paths={post.media_urls?.length ? post.media_urls : post.media_url ? [post.media_url] : []} />

                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <dt className="font-semibold text-foreground">ปลายทาง</dt>
                    <dd>{post.post_targets.map(targetLabel).join(", ") || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold text-foreground">เวลา</dt>
                    <dd>{formatThaiDateTime(post.scheduled_at)}</dd>
                  </div>
                  {post.approved_by ? (
                    <div className="flex gap-2">
                      <dt className="font-semibold text-foreground">อนุมัติโดย</dt>
                      <dd>
                        {teamNames[post.approved_by] ?? "ผู้ใช้ในทีม"}
                        {post.approved_at ? ` · ${formatThaiDateTime(post.approved_at)}` : ""}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {publishedTargets.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {publishedTargets.map((t) => (
                      <li key={t.id}>
                        <a
                          href={t.external_url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                          <ExternalLink className="size-3.5" />
                          เปิดโพสต์บน {targetLabel(t)}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {failedTargets.length > 0 ? (
                  <ul className="mt-3 space-y-1 rounded-xl bg-destructive/10 p-3">
                    {failedTargets.map((t) => (
                      <li key={t.id} className="text-xs leading-5 text-destructive">
                        <span className="font-semibold">{targetLabel(t)}:</span>{" "}
                        {t.error_message ?? "เผยแพร่ไม่สำเร็จ"}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {post.status === "pending" ? (
                    <>
                      <Button
                        className="h-11 flex-1 rounded-xl font-semibold"
                        onClick={() => decide.mutate({ id: post.id, next: "approved" })}
                        disabled={busy || needsName}
                      >
                        อนุมัติ
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 flex-1 rounded-xl"
                        onClick={() => decide.mutate({ id: post.id, next: "draft" })}
                        disabled={busy}
                      >
                        ตีกลับ
                      </Button>
                    </>
                  ) : post.status === "publishing" ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> กำลังส่งขึ้นเพจ…
                    </p>
                  ) : (
                    <>
                      <Button
                        className="h-11 flex-1 rounded-xl font-semibold"
                        onClick={() => publishNow.mutate(post.id)}
                        disabled={busy}
                      >
                        {isPublishingThis
                          ? "กำลังเผยแพร่…"
                          : post.status === "failed"
                            ? "ลองเผยแพร่ใหม่"
                            : "เผยแพร่เดี๋ยวนี้"}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl"
                        onClick={() => decide.mutate({ id: post.id, next: "draft" })}
                        disabled={busy}
                      >
                        ตีกลับ
                      </Button>
                    </>
                  )}
                </div>

                {post.status === "approved" && post.scheduled_at ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    ตั้งเวลาไว้แล้ว — ระบบจะส่งขึ้นเพจให้เองเมื่อถึงเวลา ไม่ต้องกดอะไรเพิ่ม
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
