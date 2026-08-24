import { Link } from "@tanstack/react-router";
import { formatThaiDateTime, platformShort, STATUS_META, type PostStatus } from "@/lib/platforms";

export type PostRow = {
  id: string;
  title: string | null;
  body: string;
  media_url: string | null;
  scheduled_at: string | null;
  status: PostStatus;
  post_targets: { id: string; platform: string; status: string }[];
};

export function PostCard({ post }: { post: PostRow }) {
  const status = STATUS_META[post.status];

  return (
    <Link
      to="/compose"
      search={{ id: post.id }}
      className="block rounded-xl border border-border bg-card p-4 transition-colors active:bg-secondary/60"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 font-display text-sm font-semibold text-foreground">
          {post.title?.trim() || post.body.slice(0, 60) || "ไม่มีหัวข้อ"}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      {post.body ? (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.body}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {post.post_targets.map((target) => (
          <span
            key={target.id}
            className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-secondary-foreground"
          >
            {platformShort(target.platform)}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatThaiDateTime(post.scheduled_at)}
        </span>
      </div>
    </Link>
  );
}
