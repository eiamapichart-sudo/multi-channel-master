import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type DeleteResponse = { ok: boolean; removedFromPage: number; problems: string[] };

type Props = {
  postId: string;
  /** ปลายทางที่เผยแพร่ขึ้นช่องทางจริงไปแล้ว — ใช้ตัดสินว่าจะถามเรื่องลบบนเพจไหม */
  publishedPlatforms: string[];
  title?: string | undefined;
  onDeleted?: (() => void) | undefined;
  children: ReactNode;
};

export function DeletePostDialog({
  postId,
  publishedPlatforms,
  title,
  onDeleted,
  children,
}: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [alsoRemote, setAlsoRemote] = useState(true);

  const isLive = publishedPlatforms.length > 0;
  const hasInstagram = publishedPlatforms.includes("instagram");
  const hasFacebook = publishedPlatforms.includes("facebook");

  const remove = useMutation({
    mutationFn: () =>
      apiFetch<DeleteResponse>("/api/posts/delete", {
        method: "POST",
        body: JSON.stringify({ postId, deleteRemote: isLive && alsoRemote }),
      }),
    onSuccess: (result) => {
      setOpen(false);
      for (const key of ["posts", "calendar", "approvals"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      queryClient.removeQueries({ queryKey: ["post", postId] });

      if (result.problems.length > 0) {
        toast.warning("ลบออกจากระบบแล้ว แต่บางช่องทางลบให้ไม่ได้", {
          description: result.problems.join(" · "),
          duration: 8000,
        });
      } else if (result.removedFromPage > 0) {
        toast.success(`ลบโพสต์แล้ว รวมถึงบนเพจอีก ${result.removedFromPage} จุด`);
      } else {
        toast.success("ลบโพสต์แล้ว");
      }
      onDeleted?.();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ลบไม่สำเร็จ"),
  });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && setOpen(next)}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>ลบโพสต์นี้?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {title?.trim() ? `“${title.trim()}” ` : ""}
              จะถูกลบออกจากระบบพร้อมไฟล์รูปและคลิปที่แนบไว้ กู้คืนไม่ได้
            </span>
            {isLive ? (
              <span className="block text-destructive">โพสต์นี้เผยแพร่ขึ้นช่องทางจริงไปแล้ว</span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLive ? (
          <div className="space-y-2 rounded-xl border border-border bg-secondary/60 p-3">
            {hasFacebook ? (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={alsoRemote}
                  onChange={(e) => setAlsoRemote(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
                />
                <span>
                  ลบออกจากเพจ Facebook ด้วย
                  <span className="block text-xs text-muted-foreground">
                    ถ้าไม่ติ๊ก โพสต์จะยังค้างอยู่บนเพจ
                  </span>
                </span>
              </label>
            ) : null}
            {hasInstagram ? (
              <p className="text-xs text-muted-foreground">
                Instagram ไม่เปิดให้ลบผ่าน API — ต้องเข้าไปลบเองในแอป Instagram
              </p>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
          <Button
            variant="destructive"
            className="rounded-xl"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "กำลังลบ…" : "ลบเลย"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
