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
      { title: "รออนุมัติ — Social Publisher" },
      {
        name: "description",
        content: "ตรวจและอนุมัติโพสต์ก่อนเผยแพร่ ดูช่องทางปลายทางและเวลาที่ตั้งไว้ในหน้าจอเดียว",
      },
      { property: "og:title", content: "รออนุมัติ — Social Publisher" },
      {
        property: "og:description",
        content: "คิวอนุมัติโพสต์ก่อนเผยแพร่ พร้อมรายละเอียดช่องทางและเวลา",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApprovalsPage,
});

type ApprovalRow = {
  id: string;
  title: string | null;
  body: string;
  scheduled_at: string | null;
  status: PostStatus;
  post_targets: { id: string; platform: string }[];
};

function ApprovalsPage() {
  const { brandId } = useBrand();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["approvals", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, body, scheduled_at, status, post_targets(id, platform)")
        .eq("brand_id", brandId!)
        .in("status", ["pending", "approved"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as ApprovalRow[];
    },
  });

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
      <h1 className="font-display text-xl font-semibold text-foreground">คิวอนุมัติ</h1>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีโพสต์รออนุมัติ</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 font-display text-sm font-semibold text-foreground">
                  {post.title?.trim() || post.body.slice(0, 60) || "ไม่มีหัวข้อ"}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_META[post.status].className}`}
                >
                  {STATUS_META[post.status].label}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {post.body}
              </p>

              <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex gap-2">
                  <dt className="font-medium text-foreground">ช่องทาง</dt>
                  <dd>{post.post_targets.map((t) => platformLabel(t.platform)).join(", ") || "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-foreground">เวลา</dt>
                  <dd>{formatThaiDateTime(post.scheduled_at)}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {post.status === "pending" ? (
                  <>
                    <Button
                      className="h-10 flex-1"
                      onClick={() => decide.mutate({ id: post.id, next: "approved" })}
                      disabled={decide.isPending}
                    >
                      อนุมัติ
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => decide.mutate({ id: post.id, next: "draft" })}
                      disabled={decide.isPending}
                    >
                      ตีกลับ
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    className="h-10 flex-1"
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

      <p className="rounded-lg border border-dashed border-border p-4 text-xs leading-6 text-muted-foreground">
        เฟสนี้การเผยแพร่ยังเป็นการบันทึกสถานะด้วยมือ เมื่อผูก API ของแต่ละช่องทาง
        (Facebook, Instagram, TikTok, YouTube, LINE) ระบบจะส่งออกอัตโนมัติตามเวลาที่ตั้งไว้
      </p>
    </div>
  );
}
