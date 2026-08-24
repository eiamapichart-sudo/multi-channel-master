import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { PostCard, type PostRow } from "@/components/app/PostCard";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "ปฏิทินเผยแพร่ — Social Publisher" },
      {
        name: "description",
        content: "ดูคิวโพสต์ที่ตั้งเวลาไว้ล่วงหน้าเรียงตามวัน ตามเวลาไทย ทุกช่องทางในมุมมองเดียว",
      },
      { property: "og:title", content: "ปฏิทินเผยแพร่ — Social Publisher" },
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

function CalendarPage() {
  const { brandId } = useBrand();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["calendar", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, body, media_url, scheduled_at, status, post_targets(id, platform, status)")
        .eq("brand_id", brandId!)
        .not("scheduled_at", "is", null)
        .order("scheduled_at", { ascending: true });
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
      <h1 className="font-display text-xl font-semibold text-foreground">ปฏิทินเผยแพร่</h1>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          ยังไม่มีโพสต์ที่ตั้งเวลาไว้
        </p>
      ) : (
        Object.entries(groups).map(([day, items]) => (
          <section key={day} className="space-y-3">
            <h2 className="font-display text-sm font-semibold text-primary">{day}</h2>
            <ul className="space-y-3">
              {items.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
