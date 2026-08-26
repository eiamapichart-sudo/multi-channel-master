import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
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

type ApprovalRow = {
  id: string;
  brand_id: string;
  title: string | null;
  body: string;
  scheduled_at: string | null;
  status: PostStatus;
  post_targets: { id: string; platform: string; channel_account_id: string | null }[];
};

function ApprovalsPage() {
  const { brandId, brands, isAll, brandName } = useBrand();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select("id, brand_id, title, body, scheduled_at, status, post_targets(id, platform, channel_account_id)")
        .in("status", ["pending", "approved"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (brandId) query = query.eq("brand_id", brandId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ApprovalRow[];
    },
  });

  const targetLabel = (target: ApprovalRow["post_targets"][number]) => {
    const account = accounts.find((a) => a.id === target.channel_account_id);
    return account ? `${platformLabel(target.platform)} · ${account.account_name}` : platformLabel(target.platform);
  };

  const decide = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: PostStatus }) => {
      const patch =
        next === "approved"
          ? { status: next, approved_by: user?.id ?? null, approved_at: new Date().toISOString() }
          : next === "published"
            ? { status: next, published_at: new Date().toISOString() }
            : { status: next, approved_by: null, approved_at: null };
      const { error } = await supabase.from("posts").update(patch).eq("id", id);
      if (error) throw error;
      if (next === "published") {
        await supabase.from("post_targets").update({ status: "published" }).eq("post_id", id);
      }
    },
    onSuccess: (_data, { next }) => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(
        next === "approved" ? "อนุมัติแล้ว" : next === "published" ? "ทำเครื่องหมายว่าเผยแพร่แล้ว" : "ตีกลับให้แก้ไข",
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ"),
  });

  return (
    <div className="space-y-4 pb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">คิวอนุมัติ</h1>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีโพสต์รออนุมัติ</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
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

              <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex gap-2">
                  <dt className="font-semibold text-foreground">ปลายทาง</dt>
                  <dd>{post.post_targets.map(targetLabel).join(", ") || "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold text-foreground">เวลา</dt>
                  <dd>{formatThaiDateTime(post.scheduled_at)}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {post.status === "pending" ? (
                  <>
                    <Button
                      className="h-11 flex-1 rounded-xl font-semibold"
                      onClick={() => decide.mutate({ id: post.id, next: "approved" })}
                      disabled={decide.isPending}
                    >
                      อนุมัติ
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => decide.mutate({ id: post.id, next: "draft" })}
                      disabled={decide.isPending}
                    >
                      ตีกลับ
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    className="h-11 flex-1 rounded-xl"
                    onClick={() => decide.mutate({ id: post.id, next: "published" })}
                    disabled={decide.isPending}
                  >
                    ทำเครื่องหมายว่าเผยแพร่แล้ว
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="rounded-2xl border border-dashed border-border p-4 text-xs leading-6 text-muted-foreground">
        เฟสนี้การเผยแพร่ยังเป็นการบันทึกสถานะด้วยมือ เมื่อผูก API ของแต่ละช่องทาง
        (Facebook, Instagram, TikTok, YouTube, LINE) ระบบจะส่งออกอัตโนมัติตามเวลาที่ตั้งไว้
      </p>
    </div>
  );
}
