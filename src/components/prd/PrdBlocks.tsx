import type { Block } from "@/content/prd";

function Paragraph({ text }: { text: string }) {
  return <p className="text-[15px] leading-8 text-foreground/85">{text}</p>;
}

function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  if (ordered) {
    return (
      <ol className="space-y-2.5">
        {items.map((item, i) => (
          <li key={item} className="flex gap-3 text-[15px] leading-7 text-foreground/85">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[15px] leading-7 text-foreground/85">
          <span
            aria-hidden
            className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-secondary">
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-border px-4 py-3 font-display text-xs font-semibold uppercase tracking-wide text-secondary-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="align-top even:bg-muted/40">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`border-b border-border/70 px-4 py-3 leading-7 ${
                    ci === 0 ? "font-medium text-foreground" : "text-foreground/80"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ title, text }: { title?: string; text: string }) {
  return (
    <aside className="rounded-lg border-l-4 border-accent bg-accent/8 px-5 py-4">
      {title ? (
        <p className="font-display text-sm font-semibold text-accent-foreground">{title}</p>
      ) : null}
      <p className="mt-1 text-[15px] leading-7 text-foreground/80">{text}</p>
    </aside>
  );
}

function Flow({ steps }: { steps: { label: string; hint?: string }[] }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-2">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-2">
          <div className="rounded-md border border-border bg-card px-4 py-3">
            <p className="font-display text-sm font-semibold text-foreground">{step.label}</p>
            {step.hint ? (
              <p className="text-xs text-muted-foreground">{step.hint}</p>
            ) : null}
          </div>
          {i < steps.length - 1 ? (
            <span aria-hidden className="font-display text-primary">
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Cards({ items }: { items: { title: string; text: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="rounded-lg border border-border bg-card p-5">
          <p className="font-display text-sm font-semibold text-primary">{item.title}</p>
          <p className="mt-1.5 text-sm leading-7 text-foreground/80">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/70 p-4 font-mono text-xs leading-6 text-secondary-foreground">
      {text}
    </pre>
  );
}

export function PrdBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "p":
      return <Paragraph text={block.text} />;
    case "list":
      return <List items={block.items} ordered={block.ordered} />;
    case "table":
      return <Table headers={block.headers} rows={block.rows} />;
    case "note":
      return <Note title={block.title} text={block.text} />;
    case "flow":
      return <Flow steps={block.steps} />;
    case "cards":
      return <Cards items={block.items} />;
    case "code":
      return <CodeBlock text={block.text} />;
    case "h3":
      return (
        <h3 className="pt-2 font-display text-lg font-semibold text-foreground">{block.text}</h3>
      );
    default:
      return null;
  }
}
