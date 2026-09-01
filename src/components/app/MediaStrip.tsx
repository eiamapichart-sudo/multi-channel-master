import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { signMedia, type MediaItem } from "@/lib/media";

/** แถบแสดงรูป/คลิปของโพสต์ พร้อมเลขลำดับตามที่จะลงจริง */
export function MediaStrip({ paths }: { paths: string[] }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const key = paths.join("|");

  useEffect(() => {
    let alive = true;
    if (paths.length === 0) {
      setItems([]);
      return;
    }
    signMedia(paths)
      .then((next) => alive && setItems(next))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [key]);

  if (paths.length === 0) return null;

  return (
    <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {(items.length ? items : paths.map((path) => ({ path, url: "", kind: "image" as const }))).map(
        (item, index) => (
          <li
            key={item.path}
            className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary"
          >
            {item.url && item.kind === "video" ? (
              <>
                <video src={item.url} className="size-full object-cover" muted playsInline />
                <Play className="absolute inset-0 m-auto size-6 text-background" />
              </>
            ) : item.url ? (
              <img src={item.url} alt={`สื่อลำดับที่ ${index + 1}`} className="size-full object-cover" loading="lazy" />
            ) : null}
            {paths.length > 1 ? (
              <span className="absolute left-1 top-1 rounded-md bg-foreground/75 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-background">
                {index + 1}
              </span>
            ) : null}
          </li>
        ),
      )}
    </ul>
  );
}
