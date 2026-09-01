import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Layers, Link2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sb } from "@/lib/supabase-loose";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useMyProfile, useSaveDisplayName } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FacebookConnectCard } from "@/components/app/FacebookConnectCard";
import { TikTokConnectCard } from "@/components/app/TikTokConnectCard";
import { YouTubeConnectCard } from "@/components/app/YouTubeConnectCard";

import { PLATFORMS, type Platform } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าแบรนด์และเพจ — Social Post" },
      {
        name: "description",
        content: "เพิ่มแบรนด์หรือลูกค้า ผูกได้หลายเพจต่อช่องทาง และจัดการบัญชีผู้ใช้ของคุณ",
      },
      { property: "og:title", content: "ตั้งค่าแบรนด์และเพจ — Social Post" },
      { property: "og:description", content: "จัดการแบรนด์ เพจโซเชียลหลายเพจ และบัญชีผู้ใช้" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

type ChannelRow = {
  id: string;
  platform: Platform;
  account_name: string;
  connected: boolean;
  external_id: string | null;
};

function SettingsPage() {
  const { brands, brandId, brand, isAll, setBrandId, refresh } = useBrand();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [brandName, setBrandName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [platform, setPlatform] = useState<Platform>("facebook");
  const { data: profile } = useMyProfile();
  const saveName = useSaveDisplayName();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const nameValue = displayName ?? profile?.display_name ?? "";

  const targetBrand = brandId ?? brands[0]?.id ?? null;

  const { data: channels = [] } = useQuery({
    queryKey: ["channels", targetBrand],
    enabled: !!targetBrand,
    queryFn: async () => {
      const { data, error } = await sb
        .from("channel_accounts")
        .select("id, platform, account_name, connected, external_id")
        .eq("brand_id", targetBrand!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChannelRow[];
    },
  });

  const addBrand = useMutation({
    mutationFn: async () => {
      if (!brandName.trim()) throw new Error("กรุณาใส่ชื่อแบรนด์");
      const { data, error } = await supabase
        .from("brands")
        .insert({ name: brandName.trim(), created_by: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      setBrandName("");
      refresh();
      setBrandId(id);
      toast.success("เพิ่มแบรนด์แล้ว");
    },
    onError: (error) => toast.error((error as { message?: string })?.message ?? "เพิ่มไม่สำเร็จ"),
  });

  const addChannel = useMutation({
    mutationFn: async () => {
      if (!targetBrand) throw new Error("เลือกแบรนด์ก่อน");
      if (!accountName.trim()) throw new Error("กรุณาใส่ชื่อบัญชี/เพจ");
      const { error } = await supabase
        .from("channel_accounts")
        .insert({ brand_id: targetBrand, platform, account_name: accountName.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setAccountName("");
      queryClient.invalidateQueries({ queryKey: ["channels", targetBrand] });
      toast.success("เพิ่มเพจแล้ว");
    },
    onError: (error) => toast.error((error as { message?: string })?.message ?? "เพิ่มไม่สำเร็จ"),
  });

  const removeChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("channel_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", targetBrand] });
      queryClient.invalidateQueries({ queryKey: ["facebook-pages"] });
    },
  });

  return (
    <div className="space-y-8 pb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">ตั้งค่า</h1>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-foreground">ชื่อของคุณ</h2>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            ใช้แสดงว่าใครเป็นคนอนุมัติโพสต์ — ต้องตั้งชื่อก่อนจึงจะกดอนุมัติได้
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">ชื่อที่แสดง</Label>
            <Input
              id="display-name"
              value={nameValue}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น เกด, พี่ต้น (ฝ่ายมาร์เก็ตติ้ง)"
              className="rounded-xl"
            />
          </div>
          <Button
            className="h-11 w-full rounded-xl font-semibold"
            disabled={saveName.isPending}
            onClick={() =>
              saveName.mutate(nameValue, {
                onSuccess: () => toast.success("บันทึกชื่อแล้ว"),
                onError: (error) =>
                  toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"),
              })
            }
          >
            บันทึกชื่อ
          </Button>
          {!profile?.display_name ? (
            <p className="text-xs text-destructive">ยังไม่ได้ตั้งชื่อ</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-foreground">มุมมอง / แบรนด์</h2>

        <button
          type="button"
          onClick={() => setBrandId(null)}
          className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
            isAll ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card"
          }`}
        >
          <Layers className="size-4 text-primary" />
          <span className="min-w-0">
            <span className="block font-semibold">ภาพรวมทุกแบรนด์</span>
            <span className="block text-xs text-muted-foreground">
              โหมดผู้ดูแล — เห็นโพสต์ ปฏิทิน และคิวอนุมัติของทุกแบรนด์รวมกัน
            </span>
          </span>
        </button>

        {brands.length ? (
          <ul className="space-y-2">
            {brands.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setBrandId(b.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                    b.id === brandId
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  <span className="font-semibold">{b.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{b.timezone}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีแบรนด์</p>
        )}

        <div className="flex gap-2">
          <Input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="ชื่อแบรนด์ใหม่"
            className="rounded-xl"
          />
          <Button
            className="rounded-xl"
            onClick={() => addBrand.mutate()}
            disabled={addBrand.isPending}
          >
            เพิ่ม
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-foreground">เชื่อมต่อช่องทางจริง</h2>
        <FacebookConnectCard brandId={targetBrand} />
        <TikTokConnectCard brandId={targetBrand} />
        <YouTubeConnectCard brandId={targetBrand} />
      </section>


      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-foreground">
          เพจ/บัญชีของ {brand?.name ?? brands.find((b) => b.id === targetBrand)?.name ?? "—"}
        </h2>
        {channels.length ? (
          <div className="space-y-3">
            {PLATFORMS.filter((p) => channels.some((c) => c.platform === p.id)).map((p) => {
              const group = channels.filter((c) => c.platform === p.id);
              return (
                <div key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <span className="text-sm font-semibold text-foreground">{p.label}</span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {group.length} เพจ
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {group.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm text-foreground">{c.account_name}</span>
                          {c.connected && c.external_id ? (
                            <Link2 className="size-3.5 shrink-0 text-primary" aria-label="เชื่อมต่อแล้ว" />
                          ) : null}
                        </span>
                        <button
                          type="button"
                          aria-label={`ลบ ${c.account_name}`}
                          onClick={() => removeChannel.mutate(c.id)}
                          className="rounded-lg p-2 text-muted-foreground"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่ได้ผูกเพจ</p>
        )}

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="platform">แพลตฟอร์ม</Label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account">ชื่อเพจ / บัญชี</Label>
            <Input
              id="account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="เช่น เพจหลัก, เพจสาขา 2"
              className="rounded-xl"
            />
          </div>
          <Button
            className="h-11 w-full rounded-xl font-semibold"
            onClick={() => addChannel.mutate()}
            disabled={addChannel.isPending}
          >
            เพิ่มเพจ
          </Button>
          <p className="text-xs text-muted-foreground">
            ช่องนี้ใช้จดชื่อเพจไว้ก่อนได้ ส่วน Facebook ให้กด “เชื่อมต่อ Facebook” ด้านบนแทน
            ระบบจะดึงชื่อเพจจริงมาให้เอง
          </p>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="font-display text-sm font-semibold text-foreground">บัญชีผู้ใช้</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <Button variant="outline" className="h-11 w-full rounded-xl" onClick={signOut}>
          ออกจากระบบ
        </Button>
        <a
          href="/prd"
          className="block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ดูเอกสาร PRD ของระบบ
        </a>
      </section>
    </div>
  );
}
