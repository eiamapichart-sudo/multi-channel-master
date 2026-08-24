import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLATFORMS, platformLabel, type Platform } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าแบรนด์และช่องทาง — Social Publisher" },
      {
        name: "description",
        content: "เพิ่มแบรนด์หรือลูกค้า ผูกช่องทางโซเชียลของแต่ละแบรนด์ และจัดการบัญชีผู้ใช้ของคุณ",
      },
      { property: "og:title", content: "ตั้งค่าแบรนด์และช่องทาง — Social Publisher" },
      {
        property: "og:description",
        content: "จัดการแบรนด์ ช่องทางโซเชียล และบัญชีผู้ใช้",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { brands, brandId, brand, setBrandId, refresh } = useBrand();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [brandName, setBrandName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [platform, setPlatform] = useState<Platform>("facebook");

  const { data: channels = [] } = useQuery({
    queryKey: ["channels", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_accounts")
        .select("id, platform, account_name, connected")
        .eq("brand_id", brandId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
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
      if (!brandId) throw new Error("เลือกแบรนด์ก่อน");
      if (!accountName.trim()) throw new Error("กรุณาใส่ชื่อบัญชี/เพจ");
      const { error } = await supabase
        .from("channel_accounts")
        .insert({ brand_id: brandId, platform, account_name: accountName.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setAccountName("");
      queryClient.invalidateQueries({ queryKey: ["channels", brandId] });
      toast.success("เพิ่มช่องทางแล้ว");
    },
    onError: (error) => toast.error((error as { message?: string })?.message ?? "เพิ่มไม่สำเร็จ"),
  });

  const removeChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("channel_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels", brandId] }),
  });

  return (
    <div className="space-y-8 pb-6">
      <h1 className="font-display text-xl font-semibold text-foreground">ตั้งค่า</h1>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-foreground">แบรนด์ / ลูกค้า</h2>
        {brands.length ? (
          <ul className="space-y-2">
            {brands.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setBrandId(b.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${
                    b.id === brandId ? "border-primary bg-primary/5 text-primary" : "border-border bg-card"
                  }`}
                >
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground">{b.timezone}</span>
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
          />
          <Button onClick={() => addBrand.mutate()} disabled={addBrand.isPending}>
            เพิ่ม
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-foreground">
          ช่องทางของ {brand?.name ?? "—"}
        </h2>
        {channels.length ? (
          <ul className="space-y-2">
            {channels.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {platformLabel(c.platform)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{c.account_name}</span>
                </span>
                <button
                  type="button"
                  aria-label={`ลบ ${c.account_name}`}
                  onClick={() => removeChannel.mutate(c.id)}
                  className="rounded-md p-2 text-muted-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่ได้ผูกช่องทาง</p>
        )}

        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="platform">แพลตฟอร์ม</Label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account">ชื่อบัญชี / เพจ</Label>
            <Input
              id="account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="เช่น @mybrand"
            />
          </div>
          <Button className="w-full" onClick={() => addChannel.mutate()} disabled={addChannel.isPending}>
            เพิ่มช่องทาง
          </Button>
          <p className="text-xs text-muted-foreground">
            เฟสนี้เป็นการบันทึกรายการช่องทาง การเชื่อมต่อ API จริงจะเพิ่มในเฟสถัดไป
          </p>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="font-display text-sm font-semibold text-foreground">บัญชีผู้ใช้</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <Button variant="outline" className="h-11 w-full" onClick={signOut}>
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
