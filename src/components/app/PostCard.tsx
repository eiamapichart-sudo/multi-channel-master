import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Images, Play } from "lucide-react";
import { signMedia, type MediaItem } from "@/lib/media";
import { formatThaiDateTime, platformShort, STATUS_META, type PostStatus } from "@/lib/platforms";

export type PostRow = {
  id: string;
  brand_id?: string;
  title: string | null;
  body: string;
  media_url: string | null;
  media_urls?: string[] | null;
  scheduled_at: string | null;
  status: PostStatus;
  post_targets: { id: string; platform: string; status: string }[];
};

export function PostCard({ post, brandName }: { post: PostRow; brandName?: string }) {
  const status = STATUS_META[post.status];
  const paths = post.media_urls?.length ? post.media_urls : post.media_url ? [post.media_url] : [];
  const [cover, setCover] = useState<MediaItem | null>(null);

  useEffect(() => {
    let alive = true;
    if (paths.length === 0) return;
    signMedia(paths.slice(0, 1))
      .then((items) => alive && setCover(items[0] ?? null))
      .catch(() => alive && setCover(null));
    return () => {
      alive = false;
    };
  }, [paths.join("|")]);

  return (
    <Link
      to="/compose"
      search={{ id: post.id }}
      className="block rounded-2xl border border-border bg-card p-3.5 transition-colors active:bg-secondary/60"
    >
      <div className="flex gap-3">
        {paths.length ? (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
            {cover?.kind === "video" ? (
              <>
                <video src={cover.url} className="size-full object-cover" muted playsInline />
                <Play className="absolute inset-0 m-auto size-5 text-background" />
              </>
            ) : cover ? (
              <img src={cover.url} alt="" className="size-full object-cover" loading="lazy" />
            ) : null}
            {paths.length > 1 ? (
              <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-md bg-foreground/70 px-1 py-0.5 font-mono text-[9px] text-background">
                <Images className="size-2.5" />
                {paths.length}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 font-display text-sm font-semibold text-foreground">
              {post.title?.trim() || post.body.slice(0, 60) || "ไม่มีหัวข้อ"}
            </p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          {brandName ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-accent">{brandName}</p>
          ) : null}

          {post.body ? (
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.body}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {post.post_targets.map((target) => (
              <span
                key={target.id}
                className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-secondary-foreground"
              >
                {platformShort(target.platform)}
              </span>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {formatThaiDateTime(post.scheduled_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
