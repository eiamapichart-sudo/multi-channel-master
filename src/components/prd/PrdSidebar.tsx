import { useEffect, useState } from "react";
import type { Section } from "@/content/prd";

export function PrdSidebar({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-88px 0px -65% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="สารบัญ" className="no-print">
      <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        สารบัญ
      </p>
      <ol className="mt-4 space-y-1">
        {sections.map((section) => {
          const isActive = active === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={`flex gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <span className="font-mono text-[11px] leading-6 opacity-70">
                  {section.number}
                </span>
                <span className="leading-6">{section.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
