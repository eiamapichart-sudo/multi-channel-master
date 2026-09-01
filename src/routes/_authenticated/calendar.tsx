import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { PostCard, type PostRow } from "@/components/app/PostCard";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "ปฏิทินเผยแพร่ — Social Post" },
      {
        name: "description",
        content:
          "ปฏิทินรายเดือนแสดงคิวโพสต์ที่ตั้งเวลาไว้ตามเวลาไทย กดวันไหนก็เห็นงานที่จะลงวันนั้นทุกช่องทาง",
      },
      { property: "og:title", content: "ปฏิทินเผยแพร่ — Social Post" },
      {
        property: "og:description",
        content: "ปฏิทินรายเดือน กดดูงานที่จะลงในแต่ละวันได้ทันที",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

const TZ = "Asia/Bangkok";
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** คืนค่า "YYYY-MM-DD" ตามเวลาไทย */
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));

const todayKey = () => dayKey(new Date().toISOString());

const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: TZ }).format(
    new Date(Date.UTC(year, month, 15)),
  );

const fullDayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)));
};

const pad = (n: number) => String(n).padStart(2, "0");

const SELECT =
  "id, brand_id, title, body, media_url, media_urls, scheduled_at, status, post_targets(id, platform, status)";

function CalendarPage() {
  const { brandId, brands, isAll, brandName } = useBrand();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string>(todayKey());

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

  const byDay = useMemo(() => {
    const map: Record<string, PostRow[]> = {};
    for (const post of posts) {
      const key = dayKey(post.scheduled_at!);
      (map[key] ??= []).push(post);
    }
    return map;
  }, [posts]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const startWeekday = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    const list: (string | null)[] = Array.from({ length: startWeekday }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      list.push(`${cursor.year}-${pad(cursor.month + 1)}-${pad(d)}`);
    }
    return list;
  }, [cursor]);

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const next = month + delta;
      return { year: year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });

  const dayPosts = byDay[selectedDay] ?? [];
  const today = todayKey();

  return (
    <div className="space-y-5 pb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">ปฏิทินเผยแพร่</h1>

      <section className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="เดือนก่อนหน้า"
            onClick={() => shift(-1)}
            className="rounded-xl p-2 text-muted-foreground active:bg-secondary"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="font-display text-sm font-semibold text-foreground">
            {monthLabel(cursor.year, cursor.month)}
          </p>
          <button
            type="button"
            aria-label="เดือนถัดไป"
            onClick={() => shift(1)}
            className="rounded-xl p-2 text-muted-foreground active:bg-secondary"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1 font-mono text-[10px] uppercase text-muted-foreground">
              {w}
            </span>
          ))}
          {cells.map((key, index) =>
            key === null ? (
              <span key={`empty-${index}`} />
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                aria-label={fullDayLabel(key)}
                aria-pressed={key === selectedDay}
                className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                  key === selectedDay
                    ? "bg-primary font-bold text-primary-foreground"
                    : key === today
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-foreground active:bg-secondary/60"
                }`}
              >
                {Number(key.split("-")[2])}
                {(byDay[key]?.length ?? 0) > 0 ? (
                  <span
                    className={`mt-0.5 h-1 w-4 rounded-full ${
                      key === selectedDay ? "bg-primary-foreground" : "bg-accent"
                    }`}
                  />
                ) : null}
              </button>
            ),
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
          {fullDayLabel(selectedDay)} · {dayPosts.length} งาน
        </h2>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : dayPosts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">วันนี้ยังไม่มีงานที่ตั้งเวลาไว้</p>
        ) : (
          <ul className="space-y-3">
            {dayPosts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} brandName={isAll ? brandName(post.brand_id) : undefined} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
