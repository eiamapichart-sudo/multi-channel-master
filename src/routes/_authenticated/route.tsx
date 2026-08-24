import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, CheckCircle2, Home, PenSquare, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandProvider, useBrand } from "@/hooks/useBrand";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/", label: "หน้าหลัก", icon: Home },
  { to: "/compose", label: "สร้างโพสต์", icon: PenSquare },
  { to: "/calendar", label: "ปฏิทิน", icon: CalendarDays },
  { to: "/approvals", label: "อนุมัติ", icon: CheckCircle2 },
  { to: "/settings", label: "ตั้งค่า", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [session, loading, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      </div>
    );
  }

  return (
    <BrandProvider>
      <div className="min-h-dvh bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <TopBar />
        <main className="mx-auto w-full max-w-2xl px-4 pt-4">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </BrandProvider>
  );
}

function TopBar() {
  const { brands, brandId, setBrandId, brand } = useBrand();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-widest text-primary">SOCIAL PUBLISHER</p>
          <p className="truncate font-display text-sm font-semibold text-foreground">
            {brand?.name ?? "ยังไม่มีแบรนด์"}
          </p>
        </div>
        {brands.length > 0 ? (
          <select
            aria-label="เลือกแบรนด์"
            value={brandId ?? ""}
            onChange={(e) => setBrandId(e.target.value)}
            className="max-w-[45%] truncate rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <Link
            to="/settings"
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            เพิ่มแบรนด์
          </Link>
        )}
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex w-full max-w-2xl">
        {NAV.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
