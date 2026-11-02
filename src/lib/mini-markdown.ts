/**
 * The small piece of markdown long-form pages on this site are written in
 * (2026-11-02, /guide/how-we-run): `## ` headings, a paragraph that is only
 * `**bold**` (a label such as 「做了什么」), `- ` and `1. ` lists, fenced code
 * blocks kept verbatim, and paragraphs with inline `**bold**`.
 *
 * Deliberately not a markdown library: the text is ours, the subset is fixed,
 * and output is React elements built from these blocks — never HTML strings —
 * so nothing in the text can become markup.
 */

export type Inline = { text: string; bold?: true };
export type Block =
  | { type: "h2"; text: string }
  | { type: "label"; text: string }
  | { type: "p"; parts: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "code"; text: string };

/** Splits `**bold**` runs out of a line. An unmatched `**` stays as text. */
export function parseInline(line: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: line.slice(last, match.index) });
    parts.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts;
}

export function parseMiniMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++; // the closing fence
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i++;
      continue;
    }
    if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const marker = ordered ? /^\d+\. / : /^- /;
      const items: Inline[][] = [];
      while (i < lines.length && marker.test(lines[i])) items.push(parseInline(lines[i++].replace(marker, "")));
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    // A paragraph: consecutive non-empty lines that start nothing else.
    const text: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(```|## |- |\d+\. )/.test(lines[i])) text.push(lines[i++]);
    const joined = text.join("");
    const label = /^\*\*([^*]+)\*\*$/.exec(joined.trim());
    blocks.push(label ? { type: "label", text: label[1] } : { type: "p", parts: parseInline(joined) });
  }
  return blocks;
}
