import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { isVideoPath, removeMedia, signMedia, uploadMedia, type MediaItem } from "@/lib/media";

type Props = {
  brandId: string | null;
  paths: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
};

export function MediaPicker({ brandId, paths, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);

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
  }, [paths.join("|")]);

  const currentKind: "image" | "video" | null = paths.length
    ? isVideoPath(paths[0]!)
      ? "video"
      : "image"
    : null;

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!brandId) {
      toast.error("เลือกแบรนด์ก่อนอัปโหลด");
      return;
    }
    const list = Array.from(files);
    const kinds = new Set(list.map((f) => (f.type.startsWith("video/") ? "video" : "image")));
    if (kinds.size > 1) {
      toast.error("โพสต์เดียวกันผสมรูปกับวิดีโอไม่ได้ — เลือกรูปทั้งหมด หรือวิดีโอทั้งหมด");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const nextKind = [...kinds][0] as "image" | "video";
    if (currentKind && nextKind !== currentKind) {
      toast.error(
        currentKind === "image"
          ? "โพสต์นี้เป็นอัลบัมรูป เพิ่มได้เฉพาะรูป"
          : "โพสต์นี้เป็นวิดีโอ เพิ่มได้เฉพาะวิดีโอ",
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const added = await uploadMedia(brandId, list);
      onChange([...paths, ...added]);
      toast.success(`อัปโหลด ${added.length} ไฟล์แล้ว`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const drop = async (path: string) => {
    onChange(paths.filter((p) => p !== path));
    void removeMedia(path);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= paths.length) return;
    const next = [...paths];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={currentKind === "video" ? "video/*" : currentKind === "image" ? "image/*" : "image/*,video/*"}
        multiple
        className="sr-only"
        onChange={(e) => void pick(e.target.files)}
      />

      <div className="grid grid-cols-3 gap-2">
        {items.map((item, index) => (
          <div
            key={item.path}
            className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary"
          >
            {item.kind === "video" ? (
              <video src={item.url} className="size-full object-cover" muted playsInline />
            ) : (
              <img src={item.url} alt={`สื่อลำดับที่ ${index + 1}`} className="size-full object-cover" loading="lazy" />
            )}
            {items.length > 1 ? (
              <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">
                {index + 1}
              </span>
            ) : null}
            {item.kind === "video" ? (
              <Video className="absolute bottom-1.5 left-1.5 size-4 text-primary-foreground drop-shadow" />
            ) : null}
            {!disabled ? (
              <button
                type="button"
                aria-label="ลบไฟล์นี้"
                onClick={() => void drop(item.path)}
                className="absolute right-1.5 top-1.5 rounded-full bg-foreground/70 p-1 text-background"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            {!disabled && items.length > 1 ? (
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1">
                <button
                  type="button"
                  aria-label={`เลื่อนลำดับที่ ${index + 1} ไปก่อนหน้า`}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-full bg-foreground/70 px-2 py-0.5 text-xs font-bold text-background disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`เลื่อนลำดับที่ ${index + 1} ไปถัดไป`}
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="rounded-full bg-foreground/70 px-2 py-0.5 text-xs font-bold text-background disabled:opacity-30"
                >
                  →
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {!disabled ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-card text-xs font-medium text-muted-foreground transition-colors active:bg-secondary"
          >
            {busy ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <ImagePlus className="size-6 text-primary" />
            )}
            {busy
              ? "กำลังอัปโหลด"
              : currentKind === "video"
                ? "เพิ่มวิดีโอ"
                : currentKind === "image"
                  ? "เพิ่มรูป"
                  : "เลือกรูป/คลิป"}
          </button>
        ) : null}
      </div>

      {!disabled ? (
        <p className="text-xs text-muted-foreground">
          ตัวเลขบนรูปคือลำดับที่จะโพสต์ในอัลบัม (กด ← → เพื่อสลับลำดับ) • หนึ่งโพสต์เลือกได้เฉพาะรูปทั้งหมด
          หรือวิดีโอทั้งหมด • ไฟล์ละไม่เกิน 50MB
        </p>
      ) : null}
    </div>
  );
}
