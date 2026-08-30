import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { sb } from "@/lib/supabase-loose";
import { Button } from "@/components/ui/button";

type ConnectedAccount = {
  id: string;
  account_name: string;
  external_id: string | null;
  avatar_url: string | null;
  connected: boolean;
  last_error: string | null;
};

/** อ่านค่า ?yt_ok= / ?yt_error= ที่ callback ส่งกลับมา แล้วล้าง URL ให้สะอาด */
function useYouTubeCallbackParams() {
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ytOk = params.get("yt_ok");
    const ytError = params.get("yt_error");
    if (!ytOk && !ytError) return;

    setOk(ytOk);
    setError(ytError);

    params.delete("yt_ok");
    params.delete("yt_error");
    const next = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (next ? `?${next}` : ""));
  }, []);

  return { ok, error };
}

export function YouTubeConnectCard({ brandId }: { brandId: string | null }) {
  const queryClient = useQueryClient();
  const { ok, error } = useYouTubeCallbackParams();

  useEffect(() => {
    if (error) toast.error(error);
    if (ok) {
      toast.success(`เชื่อมต่อ YouTube ${ok} แล้ว`);
      queryClient.invalidateQueries({ queryKey: ["youtube-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    }
  }, [ok, error, queryClient]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["youtube-accounts", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error: queryError } = await sb
        .from("channel_accounts")
        .select("id, account_name, external_id, avatar_url, connected, last_error")
        .eq("brand_id", brandId!)
        .eq("platform", "youtube")
        .order("account_name", { ascending: true });
      if (queryError) throw queryError;
      return data as ConnectedAccount[];
    },
  });

  const startConnect = useMutation({
    mutationFn: async () => {
      if (!brandId) throw new Error("เลือกแบรนด์ก่อนเชื่อมต่อ");
      return apiFetch<{ url: string }>("/api/oauth/youtube/start", {
        method: "POST",
        body: JSON.stringify({ brandId }),
      });
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "เริ่มเชื่อมต่อไม่สำเร็จ"),
  });

  const connected = accounts.filter((a) => a.connected && a.external_id);
  const broken = accounts.filter((a) => a.last_error);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
          <Play className="size-5 text-destructive" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">YouTube</p>
          <p className="text-xs text-muted-foreground">
            {connected.length
              ? `เชื่อมต่อแล้ว ${connected.length} ช่อง — ตั้งเวลาลงคลิปได้`
              : "เชื่อมต่อเพื่อให้ระบบอัปคลิปขึ้น YouTube ตามเวลาที่ตั้งไว้"}
          </p>
        </div>
      </div>

      {connected.length > 0 ? (
        <ul className="space-y-1.5">
          {connected.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2"
            >
              {account.avatar_url ? (
                <img
                  src={account.avatar_url}
                  alt=""
                  className="size-7 shrink-0 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="size-7 shrink-0 rounded-full bg-secondary" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {account.account_name}
              </span>
              {account.last_error ? (
                <AlertTriangle className="size-4 shrink-0 text-destructive" />
              ) : (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {broken.length > 0 ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
          {broken[0]!.last_error}
        </p>
      ) : null}

      <Button
        variant={connected.length ? "outline" : "default"}
        className="h-11 w-full rounded-xl font-semibold"
        onClick={() => startConnect.mutate()}
        disabled={startConnect.isPending || !brandId}
      >
        {startConnect.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : connected.length ? (
          <RefreshCw className="size-4" />
        ) : (
          <Play className="size-4" />
        )}
        {connected.length ? "เชื่อมต่อใหม่ / เปลี่ยนช่อง" : "เชื่อมต่อ YouTube"}
      </Button>

      <p className="text-[11px] leading-5 text-muted-foreground">
        YouTube ลงได้เฉพาะคลิปวิดีโอ 1 คลิปต่อโพสต์ ทั้ง Shorts และวิดีโอปกติใช้ปุ่มเดียวกัน
        ถ้าแอปยังไม่ผ่านการตรวจของ Google คลิปที่อัปจะถูกตั้งเป็นส่วนตัวไว้ก่อน
      </p>
    </div>
  );
}
