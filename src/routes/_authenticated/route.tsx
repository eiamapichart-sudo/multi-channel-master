import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, CheckCircle2, Home, Layers, Plus, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ALL_BRANDS, BrandProvider, useBrand } from "@/hooks/useBrand";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/", label: "ฟีด", icon: Home },
  { to: "/calendar", label: "ปฏิทิน", icon: CalendarDays },
  { to: "/compose", label: "โพสต์", icon: Plus },
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
      <div className="dark flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      </div>
    );
  }

  return (
    <BrandProvider>
      <div className="dark min-h-dvh bg-background text-foreground pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-none fixed inset-x-0 top-0 h-56 bg-[var(--gradient-glow)]" />
        <TopBar />
        <main className="relative mx-auto w-full max-w-2xl px-4 pt-4">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </BrandProvider>
  );
}

function TopBar() {
  const { brands, brandId, setBrandId, brand, isAll } = useBrand();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--gradient-brand)] text-primary-foreground">
            <Layers className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold leading-tight tracking-tight text-foreground">
              Social Post
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {isAll ? "ภาพรวมทุกแบรนด์" : (brand?.name ?? "ยังไม่มีแบรนด์")}
            </span>
          </span>
        </div>

        {brands.length > 0 ? (
          <select
            aria-label="เลือกมุมมองแบรนด์"
            value={brandId ?? ALL_BRANDS}
            onChange={(e) => setBrandId(e.target.value === ALL_BRANDS ? null : e.target.value)}
            className="max-w-[45%] truncate rounded-xl border border-input bg-card px-3 py-2 text-xs font-medium text-foreground"
          >
            <option value={ALL_BRANDS}>ทุกแบรนด์ (ภาพรวม)</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <Link
            to="/settings"
            className="rounded-xl bg-[var(--gradient-brand)] px-3 py-2 text-xs font-semibold text-primary-foreground"
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex w-full max-w-2xl">
        {NAV.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          const isCta = item.to === "/compose";
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className={`flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={
                    isCta
                      ? "grid size-9 place-items-center rounded-2xl bg-[var(--gradient-brand)] text-primary-foreground shadow-[var(--shadow-glow)]"
                      : ""
                  }
                >
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 1.9} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
