// Mini-parser de markdown para el documento de estrategia del export: títulos
// (#, ##, ###), listas con "- "/"* " y **negritas**. Deliberadamente pequeño y
// sin dependencias (PR-13: "no meterle tanta chimba"); cualquier otra cosa se
// renderiza como párrafo con los saltos de línea respetados.

export type MdBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

export interface MdSpan {
  bold: boolean;
  text: string;
}

export function parseMarkdownLite(source: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let list: string[] | null = null;
  let paragraph: string[] = [];

  const flushList = () => {
    if (list && list.length) blocks.push({ kind: "list", items: list });
    list = null;
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    }
    paragraph = [];
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);

    if (line === "") {
      flushList();
      flushParagraph();
    } else if (heading) {
      flushList();
      flushParagraph();
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
    } else if (bullet) {
      flushParagraph();
      list = list ?? [];
      list.push(bullet[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushList();
  flushParagraph();
  return blocks;
}

/**
 * Divide un texto en tramos normales/negrita según pares de `**`. Un `**`
 * sin cierre deja el texto entero como normal (nunca "come" contenido).
 */
export function splitBold(text: string): MdSpan[] {
  const parts = text.split("**");
  // parts alterna normal/negrita/normal/… — si es par, hay un ** sin cierre.
  if (parts.length % 2 === 0) {
    return [{ bold: false, text }];
  }
  return parts
    .map((part, i) => ({ bold: i % 2 === 1, text: part }))
    .filter((span) => span.text !== "");
}
