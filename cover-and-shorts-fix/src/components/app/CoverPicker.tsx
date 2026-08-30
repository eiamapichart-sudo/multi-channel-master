import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { removeMedia, signMedia, uploadMedia } from "@/lib/media";
import { Button } from "@/components/ui/button";

/**
 * ตัวเลือกรูปปกคลิป — อัปรูปเดียว เก็บเป็น path ในคลังไฟล์เดียวกับสื่อของโพสต์
 *
 * ใช้กับช่องทางที่อัปรูปปกเองได้ (ตอนนี้คือ YouTube)
 * TikTok ใช้ไม่ได้ เพราะ API เขาให้เลือกได้แค่เฟรมจากในคลิป
 */
export function CoverPicker({
  brandId,
  value,
  onChange,
  disabled,
  maxBytes,
  hint,
}: {
  brandId: string | null;
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  /** เพดานขนาดไฟล์ของปลายทาง เช่น YouTube รับไม่เกิน 2MB */
  maxBytes?: number;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    signMedia([value])
      .then((items) => alive && setPreviewUrl(items[0]?.url ?? null))
      .catch(() => alive && setPreviewUrl(null));
    return () => {
      alive = false;
    };
  }, [value]);

  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!brandId) {
      toast.error("เลือกแบรนด์ก่อนอัปรูปปก");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("รูปปกต้องเป็นไฟล์รูปภาพ (JPEG หรือ PNG)");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (maxBytes && file.size > maxBytes) {
      toast.error(
        `รูปปกใหญ่เกินไป (${Math.round(file.size / 1024 / 1024)}MB) — รับไม่เกิน ${Math.round(maxBytes / 1024 / 1024)}MB`,
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const [path] = await uploadMedia(brandId, [file]);
      if (path) onChange(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปรูปปกไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = async () => {
    const path = value;
    onChange(null);
    if (path) await removeMedia(path).catch(() => undefined);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => void pick(e.target.files)}
      />

      {value && previewUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
          <img
            src={previewUrl}
            alt="รูปปกที่เลือก"
            className="h-16 w-28 shrink-0 rounded-lg object-cover"
          />
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">เลือกรูปปกแล้ว</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => void clear()}
            disabled={disabled || busy}
            aria-label="เอารูปปกออก"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy || !brandId}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          เลือกรูปปก
        </Button>
      )}

      {hint ? <p className="text-[11px] leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
