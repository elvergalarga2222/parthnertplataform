import { describe, expect, it } from "vitest";
import { parseMarkdownLite, splitBold } from "./markdown-lite";

describe("parseMarkdownLite", () => {
  it("parses headings, lists and paragraphs", () => {
    const blocks = parseMarkdownLite(
      "# Estrategia\n\nContexto del cliente.\nSegunda línea.\n\n## Fases\n- Descubrimiento\n- Implementación\n* Cierre\n\nNota final.",
    );
    expect(blocks).toEqual([
      { kind: "heading", level: 1, text: "Estrategia" },
      { kind: "paragraph", text: "Contexto del cliente.\nSegunda línea." },
      { kind: "heading", level: 2, text: "Fases" },
      { kind: "list", items: ["Descubrimiento", "Implementación", "Cierre"] },
      { kind: "paragraph", text: "Nota final." },
    ]);
  });

  it("caps heading level at 3 and ignores #### as heading", () => {
    expect(parseMarkdownLite("### Tres")).toEqual([
      { kind: "heading", level: 3, text: "Tres" },
    ]);
    // #### no matchea (1-3) → párrafo.
    expect(parseMarkdownLite("#### Cuatro")[0].kind).toBe("paragraph");
  });

  it("handles empty and whitespace-only input", () => {
    expect(parseMarkdownLite("")).toEqual([]);
    expect(parseMarkdownLite("  \n \n")).toEqual([]);
  });
});

describe("splitBold", () => {
  it("splits paired ** into bold spans", () => {
    expect(splitBold("Meta: **80M COP** al mes")).toEqual([
      { bold: false, text: "Meta: " },
      { bold: true, text: "80M COP" },
      { bold: false, text: " al mes" },
    ]);
  });

  it("leaves unbalanced ** untouched", () => {
    expect(splitBold("un ** suelto")).toEqual([
      { bold: false, text: "un ** suelto" },
    ]);
  });

  it("passes plain text through", () => {
    expect(splitBold("sin negritas")).toEqual([
      { bold: false, text: "sin negritas" },
    ]);
  });
});
