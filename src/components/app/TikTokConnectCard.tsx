import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Music2, RefreshCw } from "lucide-react";
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

/** อ่านค่า ?tt_ok= / ?tt_error= ที่ callback ส่งกลับมา แล้วล้าง URL ให้สะอาด */
function useTikTokCallbackParams() {
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ttOk = params.get("tt_ok");
    const ttError = params.get("tt_error");
    if (!ttOk && !ttError) return;

    setOk(ttOk);
    setError(ttError);

    params.delete("tt_ok");
    params.delete("tt_error");
    const next = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (next ? `?${next}` : ""));
  }, []);

  return { ok, error };
}

export function TikTokConnectCard({ brandId }: { brandId: string | null }) {
  const queryClient = useQueryClient();
  const { ok, error } = useTikTokCallbackParams();

  useEffect(() => {
    if (error) toast.error(error);
    if (ok) {
      toast.success(`เชื่อมต่อ TikTok ${ok} แล้ว`);
      queryClient.invalidateQueries({ queryKey: ["tiktok-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    }
  }, [ok, error, queryClient]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["tiktok-accounts", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error: queryError } = await sb
        .from("channel_accounts")
        .select("id, account_name, external_id, avatar_url, connected, last_error")
        .eq("brand_id", brandId!)
        .eq("platform", "tiktok")
        .order("account_name", { ascending: true });
      if (queryError) throw queryError;
      return data as ConnectedAccount[];
    },
  });

  const startConnect = useMutation({
    mutationFn: async () => {
      if (!brandId) throw new Error("เลือกแบรนด์ก่อนเชื่อมต่อ");
      return apiFetch<{ url: string }>("/api/oauth/tiktok/start", {
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
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15">
          <Music2 className="size-5 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">TikTok</p>
          <p className="text-xs text-muted-foreground">
            {connected.length
              ? `เชื่อมต่อแล้ว ${connected.length} บัญชี — ตั้งเวลาลงคลิปได้`
              : "เชื่อมต่อเพื่อให้ระบบอัปคลิปขึ้น TikTok ตามเวลาที่ตั้งไว้"}
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
          <Music2 className="size-4" />
        )}
        {connected.length ? "เชื่อมต่อใหม่ / เพิ่มบัญชี" : "เชื่อมต่อ TikTok"}
      </Button>

      <p className="text-[11px] leading-5 text-muted-foreground">
        TikTok ลงได้เฉพาะคลิปวิดีโอ 1 คลิปต่อโพสต์ (ไฟล์ .mp4 ไม่เกิน 60MB)
        ถ้าแอปยังไม่ผ่านการตรวจของ TikTok ระบบจะส่งคลิปเข้ากล่องร่างในแอป TikTok ให้กดโพสต์เอง
      </p>
    </div>
  );
}
