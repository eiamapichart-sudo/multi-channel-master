import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PenSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { PostCard, type PostRow } from "@/components/app/PostCard";
import { STATUS_META, type PostStatus } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "โพสต์ทั้งหมด — Social Publisher" },
      {
        name: "description",
        content: "ดูโพสต์ทุกช่องทางของแบรนด์ในที่เดียว ทั้งร่าง รออนุมัติ ตั้งเวลา และเผยแพร่แล้ว",
      },
      { property: "og:title", content: "โพสต์ทั้งหมด — Social Publisher" },
      {
        property: "og:description",
        content: "จัดการโพสต์โซเชียลหลายช่องทางของทุกแบรนด์ในหน้าเดียว",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedPage,
});

const FILTERS: { key: "all" | PostStatus; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "draft", label: STATUS_META.draft.label },
  { key: "pending", label: STATUS_META.pending.label },
  { key: "approved", label: STATUS_META.approved.label },
  { key: "published", label: STATUS_META.published.label },
];

function FeedPage() {
  const { brandId, brands, loading } = useBrand();
  const [filter, setFilter] = useState<"all" | PostStatus>("all");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, body, media_url, scheduled_at, status, post_targets(id, platform, status)")
        .eq("brand_id", brandId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PostRow[];
    },
  });

  if (!loading && brands.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <h1 className="font-display text-lg font-semibold text-foreground">เริ่มด้วยการเพิ่มแบรนด์</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          แต่ละแบรนด์มีช่องทางและคิวโพสต์ของตัวเอง เพิ่มแบรนด์แรกได้ที่หน้าตั้งค่า
        </p>
        <Link
          to="/settings"
          className="mt-5 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          ไปหน้าตั้งค่า
        </Link>
      </section>
    );
  }

  const visible = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-foreground">โพสต์ทั้งหมด</h1>
        <Link
          to="/compose"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <PenSquare className="size-4" /> สร้าง
        </Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลดโพสต์…</p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีโพสต์ในหมวดนี้</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((post) => (
            <li key={post.id}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
