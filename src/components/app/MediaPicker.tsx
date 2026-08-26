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

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!brandId) {
      toast.error("เลือกแบรนด์ก่อนอัปโหลด");
      return;
    }
    setBusy(true);
    try {
      const added = await uploadMedia(brandId, Array.from(files));
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

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        onChange={(e) => void pick(e.target.files)}
      />

      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.path}
            className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary"
          >
            {item.kind === "video" ? (
              <video src={item.url} className="size-full object-cover" muted playsInline />
            ) : (
              <img src={item.url} alt="สื่อที่แนบ" className="size-full object-cover" loading="lazy" />
            )}
            {item.kind === "video" ? (
              <Video className="absolute left-2 top-2 size-4 text-primary-foreground drop-shadow" />
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
            {busy ? "กำลังอัปโหลด" : "เลือกรูป/คลิป"}
          </button>
        ) : null}
      </div>

      {!disabled ? (
        <p className="text-xs text-muted-foreground">
          เลือกได้หลายไฟล์พร้อมกันเพื่อโพสต์เป็นอัลบัม (ไฟล์ละไม่เกิน 50MB)
        </p>
      ) : null}
    </div>
  );
}
