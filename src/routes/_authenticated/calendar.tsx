import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { PostCard, type PostRow } from "@/components/app/PostCard";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "ปฏิทินเผยแพร่ — Social Post" },
      {
        name: "description",
        content: "ดูคิวโพสต์ที่ตั้งเวลาไว้ล่วงหน้าเรียงตามวัน ตามเวลาไทย ทุกช่องทางและทุกแบรนด์ในมุมมองเดียว",
      },
      { property: "og:title", content: "ปฏิทินเผยแพร่ — Social Post" },
      {
        property: "og:description",
        content: "คิวโพสต์ล่วงหน้าทุกช่องทาง เรียงตามวันในเวลาไทย",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));

const SELECT =
  "id, brand_id, title, body, media_url, media_urls, scheduled_at, status, post_targets(id, platform, status)";

function CalendarPage() {
  const { brandId, brands, isAll, brandName } = useBrand();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["calendar", brandId ?? "all"],
    enabled: brands.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select(SELECT)
        .not("scheduled_at", "is", null)
        .order("scheduled_at", { ascending: true });
      if (brandId) query = query.eq("brand_id", brandId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PostRow[];
    },
  });

  const groups = posts.reduce<Record<string, PostRow[]>>((acc, post) => {
    const key = dayLabel(post.scheduled_at!);
    (acc[key] ??= []).push(post);
    return acc;
  }, {});

  return (
    <div className="space-y-5 pb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">ปฏิทินเผยแพร่</h1>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          ยังไม่มีโพสต์ที่ตั้งเวลาไว้
        </p>
      ) : (
        Object.entries(groups).map(([day, items]) => (
          <section key={day} className="space-y-3">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
              {day}
            </h2>
            <ul className="space-y-3">
              {items.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} brandName={isAll ? brandName(post.brand_id) : undefined} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
