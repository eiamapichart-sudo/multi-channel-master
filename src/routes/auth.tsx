import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/app/SiteFooter";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — Social Post" },
      {
        name: "description",
        content: "เข้าสู่ระบบเพื่อจัดการโพสต์หลายช่องทาง ตั้งเวลาล่วงหน้า และอนุมัติคอนเทนต์",
      },
      { property: "og:title", content: "เข้าสู่ระบบ — Social Post" },
      {
        property: "og:description",
        content: "จัดการโพสต์โซเชียลหลายช่องทางในที่เดียว พร้อมขั้นตอนอนุมัติ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [session, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("สมัครสำเร็จ ตรวจอีเมลเพื่อยืนยันได้เลย");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      return;
    }
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <p className="font-mono text-xs tracking-widest text-primary">SOCIAL PUBLISHER</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">
          {mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชีใหม่"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          โพสต์ครั้งเดียว ส่งออกทุกช่องทาง ตั้งเวลาล่วงหน้าได้
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="name">ชื่อที่แสดง</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {mode === "signin" ? "เข้าสู่ระบบ" : "สมัครใช้งาน"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          หรือ
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="outline" className="h-11 w-full" onClick={google}>
          เข้าสู่ระบบด้วย Google
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "ยังไม่มีบัญชี? สมัครใช้งาน" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
        </button>
      </div>
    </main>
  );
}
