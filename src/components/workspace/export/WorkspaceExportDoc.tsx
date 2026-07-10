import type { WorkspaceExport } from "@/modules/workspace/types";
import { parseMarkdownLite, splitBold } from "@/lib/markdown-lite";
import { formatMoney } from "@/lib/format";

// Documento exportable (print-to-PDF): SIEMPRE claro — papel blanco y tinta
// oscura, en pantalla y al imprimir. Los bloques evitan cortarse entre páginas.

function MdText({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((span, i) =>
        span.bold ? (
          <strong key={i} className="font-semibold">
            {span.text}
          </strong>
        ) : (
          <span key={i}>{span.text}</span>
        ),
      )}
    </>
  );
}

function MarkdownLite({ source }: { source: string }) {
  const blocks = parseMarkdownLite(source);
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          const sizes = { 1: "text-lg", 2: "text-base", 3: "text-sm" } as const;
          return (
            <h4 key={i} className={`${sizes[block.level]} font-bold text-neutral-900`}>
              <MdText text={block.text} />
            </h4>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="list-disc pl-5 text-[13px] leading-relaxed">
              {block.items.map((item, j) => (
                <li key={j}>
                  <MdText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed">
            <MdText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-neutral-200 pt-5">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

const GENERATION_LABELS: Record<string, string> = {
  guion: "Guion",
  estrategia: "Estrategia (IA)",
  diagnostico: "Diagnóstico (IA)",
  imagen: "Imagen",
};

function fecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export default function WorkspaceExportDoc({
  data,
  includePlan,
  includeAnnex,
}: {
  data: WorkspaceExport;
  includePlan: boolean;
  includeAnnex: boolean;
}) {
  const { profile } = data;
  const contactBits = [
    profile.contactEmail,
    profile.contactPhone,
  ].filter(Boolean);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 bg-white p-10 text-neutral-800 shadow-card print:max-w-none print:p-0 print:shadow-none">
      {/* Portada / cabecera */}
      <header className="break-inside-avoid">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Ficha de cliente y estrategia
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
          {data.clientName}
        </h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[12.5px] sm:grid-cols-3">
          {profile.businessName && (
            <div>
              <dt className="font-semibold text-neutral-500">Negocio</dt>
              <dd>{profile.businessName}</dd>
            </div>
          )}
          {profile.industry && (
            <div>
              <dt className="font-semibold text-neutral-500">Industria</dt>
              <dd>{profile.industry}</dd>
            </div>
          )}
          {contactBits.length > 0 && (
            <div>
              <dt className="font-semibold text-neutral-500">Contacto</dt>
              <dd>{contactBits.join(" · ")}</dd>
            </div>
          )}
          {data.deal && (
            <div>
              <dt className="font-semibold text-neutral-500">Acuerdo</dt>
              <dd>
                {data.deal.title} — {formatMoney(data.deal.value, data.deal.currency)}
              </dd>
            </div>
          )}
          <div>
            <dt className="font-semibold text-neutral-500">Fecha</dt>
            <dd>{fecha(data.exportedAt)}</dd>
          </div>
        </dl>
        {Object.keys(profile.extra).length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[12.5px] sm:grid-cols-3">
            {Object.entries(profile.extra).map(([k, v]) => (
              <div key={k}>
                <dt className="font-semibold text-neutral-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {/* Estrategia */}
      <Section title="Estrategia">
        {profile.strategyDoc?.trim() ? (
          <MarkdownLite source={profile.strategyDoc} />
        ) : (
          <p className="text-[13px] italic text-neutral-400">
            Sin documento de estrategia todavía. Escríbelo en la pestaña Ficha del
            espacio (o copia la última generación de IA).
          </p>
        )}
      </Section>

      {profile.notes?.trim() && (
        <Section title="Notas">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {profile.notes}
          </p>
        </Section>
      )}

      {/* Plan de trabajo */}
      {includePlan && (
        <Section title="Plan de trabajo">
          <div className="flex flex-col gap-5">
            {data.columns.map((column) => (
              <div key={column.name} className="break-inside-avoid">
                <h4 className="text-[13.5px] font-bold text-neutral-900">
                  {column.name}
                </h4>
                {column.sopContent?.trim() && (
                  <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-500">
                    {column.sopContent}
                  </p>
                )}
                {column.cards.length > 0 ? (
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[13px]">
                    {column.cards.map((card, i) => (
                      <li key={i}>
                        <span className="font-medium">{card.title}</span>
                        {card.description && (
                          <span className="text-neutral-500"> — {card.description}</span>
                        )}
                        {(card.assignee || card.dueDate) && (
                          <span className="text-[11.5px] text-neutral-400">
                            {" "}
                            ({[card.assignee, card.dueDate].filter(Boolean).join(" · ")})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12px] italic text-neutral-400">
                    Sin tareas en esta fase.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Anexos IA */}
      {includeAnnex && data.latestGenerations.length > 0 && (
        <Section title="Anexos — últimas generaciones de IA">
          <div className="flex flex-col gap-5">
            {data.latestGenerations.map((g) => (
              <div key={g.type} className="break-inside-avoid">
                <h4 className="text-[13px] font-bold text-neutral-900">
                  {GENERATION_LABELS[g.type] ?? g.type}
                  <span className="ml-2 text-[11px] font-normal text-neutral-400">
                    {fecha(g.createdAt)}
                  </span>
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-neutral-600">
                  {g.outputText}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <footer className="border-t border-neutral-200 pt-4 text-center text-[10.5px] text-neutral-400">
        Documento generado desde Partner Manager · {fecha(data.exportedAt)}
      </footer>
    </article>
  );
}
