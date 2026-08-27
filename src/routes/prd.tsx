import { createFileRoute } from "@tanstack/react-router";
import { prdMeta, sections } from "@/content/prd";
import { PrdSection } from "@/components/prd/PrdSection";
import { PrdSidebar } from "@/components/prd/PrdSidebar";
import { SiteFooter } from "@/components/app/SiteFooter";

const description =
  "PRD ระบบโพสต์ครั้งเดียวไปทุกช่องทางโซเชียล: Facebook, Instagram, TikTok, YouTube, LINE OA พร้อมตั้งเวลาล่วงหน้า ระบบอนุมัติ หลายแบรนด์ และแนวทางเชื่อมต่อ ERP";

export const Route = createFileRoute("/prd")({
  head: () => ({
    meta: [
      { title: "PRD: Social Publisher — โพสต์ครั้งเดียวไปทุกช่องทาง" },
      { name: "description", content: description },
      { property: "og:title", content: "PRD: Social Publisher — โพสต์ครั้งเดียวไปทุกช่องทาง" },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrdPage,
});

function PrdPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
          <p className="font-mono text-xs tracking-widest text-primary">
            PRODUCT REQUIREMENTS DOCUMENT · {prdMeta.version}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2.6rem]">
            {prdMeta.productName} — เขียนโพสต์ครั้งเดียว ส่งออกทุกช่องทาง ตั้งเวลาล่วงหน้าได้
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-8 text-muted-foreground">
            เอกสารกำหนดความต้องการสำหรับระบบเผยแพร่คอนเทนต์รวมศูนย์ รองรับหลายแบรนด์ มีขั้นตอนอนุมัติ
            และออกแบบให้ต่อเข้ากับระบบ ERP เดิม (FastAPI + PostgreSQL) ในเฟสถัดไป
          </p>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <dl className="grid grid-cols-2 gap-x-10 gap-y-4 text-sm sm:grid-cols-4">
              {[
                { label: "เจ้าของเอกสาร", value: prdMeta.owner },
                { label: "อัปเดต", value: prdMeta.updated },
                { label: "สถานะ", value: prdMeta.status },
                { label: "ช่องทางเฟสแรก", value: `${prdMeta.channels.length} ช่องทาง` },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-display font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              onClick={() => window.print()}
              className="no-print inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              พิมพ์ / บันทึกเป็น PDF
            </button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-2">
            {prdMeta.channels.map((channel) => (
              <li
                key={channel}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {channel}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl gap-12 px-6 py-12">
        <aside className="no-print hidden w-64 shrink-0 lg:block">
          <div className="sticky top-8">
            <PrdSidebar sections={sections} />
          </div>
        </aside>

        <article className="print-full min-w-0 max-w-3xl flex-1 space-y-12">
          {sections.map((section) => (
            <PrdSection key={section.id} section={section} />
          ))}

          <footer className="border-t border-border pt-8 text-sm text-muted-foreground">
            <p>
              ขั้นตอนถัดไป: ส่ง schema หรือ OpenAPI ของ ERP ส่วนการตลาดและลูกค้า เพื่อเปลี่ยนส่วน
              field mapping ในหัวข้อ 10 ให้เป็นของจริง จากนั้นเริ่มสร้าง MVP ตามเฟส 1
            </p>
          </footer>
        </article>
      </main>
      <SiteFooter className="no-print" />
    </div>
  );
}
