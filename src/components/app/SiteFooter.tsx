import { Link } from "@tanstack/react-router";

/**
 * Footer ที่แสดงลิงก์ไปยังหน้านโยบายความเป็นส่วนตัวและข้อกำหนดการใช้งาน
 * ปรากฏบนทุกหน้า ใช้ semantic tokens จึงปรับสีตามธีม (dark/light) ของหน้านั้นอัตโนมัติ
 */
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-border bg-background/60 px-4 py-6 ${className}`}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Social Post
        </p>
        <nav className="flex items-center gap-4 text-xs">
          <Link
            to="/privacy"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
