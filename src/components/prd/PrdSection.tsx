import type { Section } from "@/content/prd";
import { PrdBlock } from "./PrdBlocks";

export function PrdSection({ section }: { section: Section }) {
  return (
    <section id={section.id} className="scroll-mt-24 border-t border-border pt-10">
      <p className="font-mono text-xs tracking-widest text-primary">{section.number}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">
        {section.title}
      </h2>
      {section.summary ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{section.summary}</p>
      ) : null}
      <div className="mt-6 space-y-5">
        {section.blocks.map((block, i) => (
          <PrdBlock key={i} block={block} />
        ))}
      </div>
    </section>
  );
}
