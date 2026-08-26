import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Facebook, Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { sb } from "@/lib/supabase-loose";
import { Button } from "@/components/ui/button";

type PickerPage = {
  id: string;
  name: string;
  category: string | null;
  avatarUrl: string | null;
  canCreateContent: boolean;
};

type ConnectedPage = {
  id: string;
  account_name: string;
  external_id: string | null;
  avatar_url: string | null;
  connected: boolean;
  connected_at: string | null;
  last_error: string | null;
};

/** อ่านค่า ?fb= / ?fb_error= ที่ callback ส่งกลับมา แล้วล้าง URL ให้สะอาด */
function useFacebookCallbackParams() {
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fb = params.get("fb");
    const fbError = params.get("fb_error");
    if (!fb && !fbError) return;

    setState(fb);
    setError(fbError);

    params.delete("fb");
    params.delete("fb_error");
    const next = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (next ? `?${next}` : ""));
  }, []);

  return { state, error, clearState: () => setState(null) };
}

export function FacebookConnectCard({ brandId }: { brandId: string | null }) {
  const queryClient = useQueryClient();
  const { state: callbackState, error: callbackError, clearState } = useFacebookCallbackParams();
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (callbackError) toast.error(callbackError);
  }, [callbackError]);

  const { data: pages = [] } = useQuery({
    queryKey: ["facebook-pages", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("channel_accounts")
        .select("id, account_name, external_id, avatar_url, connected, connected_at, last_error")
        .eq("brand_id", brandId!)
        .eq("platform", "facebook")
        .order("account_name", { ascending: true });
      if (error) throw error;
      return data as ConnectedPage[];
    },
  });

  const { data: picker, isLoading: pickerLoading } = useQuery({
    queryKey: ["facebook-picker", callbackState],
    enabled: !!callbackState,
    retry: false,
    queryFn: () =>
      apiFetch<{ brandId: string; pages: PickerPage[]; connectedIds: string[] }>(
        `/api/oauth/facebook/pages?state=${encodeURIComponent(callbackState!)}`,
      ),
  });

  useEffect(() => {
    if (picker) setPicked(picker.connectedIds ?? []);
  }, [picker]);

  const startConnect = useMutation({
    mutationFn: async () => {
      if (!brandId) throw new Error("เลือกแบรนด์ก่อนเชื่อมต่อ");
      return apiFetch<{ url: string }>("/api/oauth/facebook/start", {
        method: "POST",
        body: JSON.stringify({ brandId }),
      });
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "เริ่มเชื่อมต่อไม่สำเร็จ"),
  });

  const confirmConnect = useMutation({
    mutationFn: () =>
      apiFetch<{ connected: { name: string }[]; skipped: { name: string; reason: string }[] }>(
        "/api/oauth/facebook/connect",
        { method: "POST", body: JSON.stringify({ state: callbackState, pageIds: picked }) },
      ),
    onSuccess: (result) => {
      clearState();
      queryClient.invalidateQueries({ queryKey: ["facebook-pages"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success(`เชื่อมต่อแล้ว ${result.connected.length} เพจ`);
      result.skipped.forEach((s) => toast.warning(`ข้าม ${s.name}: ${s.reason}`));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "บันทึกเพจไม่สำเร็จ"),
  });

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const connectedPages = pages.filter((p) => p.connected && p.external_id);
  const brokenPages = pages.filter((p) => p.last_error);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/15">
          <Facebook className="size-5 text-[#1877F2]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Facebook Page</p>
          <p className="text-xs text-muted-foreground">
            {connectedPages.length
              ? `เชื่อมต่อแล้ว ${connectedPages.length} เพจ — โพสต์ขึ้นเพจได้จริงและตั้งเวลาล่วงหน้าได้`
              : "เชื่อมต่อเพื่อให้ระบบโพสต์ขึ้นเพจได้เองตามเวลาที่ตั้งไว้"}
          </p>
        </div>
      </div>

      {connectedPages.length > 0 ? (
        <ul className="space-y-1.5">
          {connectedPages.map((page) => (
            <li
              key={page.id}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2"
            >
              {page.avatar_url ? (
                <img
                  src={page.avatar_url}
                  alt=""
                  className="size-7 shrink-0 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="size-7 shrink-0 rounded-full bg-secondary" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {page.account_name}
              </span>
              {page.last_error ? (
                <AlertTriangle className="size-4 shrink-0 text-destructive" />
              ) : (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {brokenPages.length > 0 ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
          {brokenPages[0]!.last_error}
        </p>
      ) : null}

      {callbackState ? (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-semibold text-foreground">เลือกเพจที่จะผูกกับแบรนด์นี้</p>

          {pickerLoading ? (
            <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> กำลังดึงรายชื่อเพจ…
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(picker?.pages ?? []).map((page) => {
                const on = picked.includes(page.id);
                return (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => toggle(page.id)}
                      aria-pressed={on}
                      disabled={!page.canCreateContent}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
                        on ? "border-primary bg-primary/10" : "border-border bg-background"
                      }`}
                    >
                      {page.avatarUrl ? (
                        <img src={page.avatarUrl} alt="" className="size-7 rounded-full" loading="lazy" />
                      ) : (
                        <span className="size-7 rounded-full bg-secondary" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{page.name}</span>
                        {page.category ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {page.category}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`size-5 shrink-0 rounded-full border-2 ${
                          on ? "border-primary bg-primary" : "border-input"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              className="h-11 flex-1 rounded-xl font-semibold"
              onClick={() => confirmConnect.mutate()}
              disabled={confirmConnect.isPending || picked.length === 0}
            >
              {confirmConnect.isPending ? "กำลังบันทึก…" : `ผูก ${picked.length} เพจ`}
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={clearState}>
              ยกเลิก
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant={connectedPages.length ? "outline" : "default"}
          className="h-11 w-full rounded-xl font-semibold"
          onClick={() => startConnect.mutate()}
          disabled={startConnect.isPending || !brandId}
        >
          {startConnect.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : connectedPages.length ? (
            <RefreshCw className="size-4" />
          ) : (
            <Facebook className="size-4" />
          )}
          {connectedPages.length ? "เชื่อมต่อใหม่ / เพิ่มเพจ" : "เชื่อมต่อ Facebook"}
        </Button>
      )}

      <p className="text-[11px] leading-5 text-muted-foreground">
        ต้องเป็น Facebook Page (ไม่ใช่โปรไฟล์ส่วนตัว) และบัญชีที่ล็อกอินต้องเป็นแอดมินของเพจนั้น
        ระบบเก็บเฉพาะสิทธิ์โพสต์ ไม่เข้าถึงข้อความหรือคอมเมนต์
      </p>
    </div>
  );
}
