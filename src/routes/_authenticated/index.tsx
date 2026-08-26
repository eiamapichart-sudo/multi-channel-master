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
      { title: "ฟีดโพสต์ — Social Post" },
      {
        name: "description",
        content:
          "ดูโพสต์ทุกช่องทางทั้งแบบรายแบรนด์และภาพรวมทุกแบรนด์ ทั้งร่าง รออนุมัติ ตั้งเวลา และเผยแพร่แล้ว",
      },
      { property: "og:title", content: "ฟีดโพสต์ — Social Post" },
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

const SELECT =
  "id, brand_id, title, body, media_url, media_urls, scheduled_at, status, post_targets(id, platform, status)";

function FeedPage() {
  const { brandId, brands, loading, isAll, brandName } = useBrand();
  const [filter, setFilter] = useState<"all" | PostStatus>("all");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", brandId ?? "all"],
    enabled: brands.length > 0,
    queryFn: async () => {
      let query = supabase.from("posts").select(SELECT).order("created_at", { ascending: false });
      if (brandId) query = query.eq("brand_id", brandId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PostRow[];
    },
  });

  if (!loading && brands.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <h1 className="font-display text-lg font-bold text-foreground">เริ่มด้วยการเพิ่มแบรนด์</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          แต่ละแบรนด์มีช่องทางและคิวโพสต์ของตัวเอง เพิ่มแบรนด์แรกได้ที่หน้าตั้งค่า
        </p>
        <Link
          to="/settings"
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-[var(--gradient-brand)] px-5 text-sm font-semibold text-primary-foreground"
        >
          ไปหน้าตั้งค่า
        </Link>
      </section>
    );
  }

  const visible = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {isAll ? "ภาพรวมทุกแบรนด์" : "ฟีดโพสต์"}
        </h1>
        <Link
          to="/compose"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--gradient-brand)] px-3.5 text-sm font-semibold text-primary-foreground"
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
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key
                ? "border-primary bg-primary/15 text-primary"
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
              <PostCard post={post} brandName={isAll ? brandName(post.brand_id) : undefined} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
