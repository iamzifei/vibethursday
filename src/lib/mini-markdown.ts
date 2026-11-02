/**
 * The small piece of markdown long-form pages on this site are written in
 * (2026-11-02, /guide/how-we-run): `## ` headings, a paragraph that is only
 * `**bold**` (a label such as 「做了什么」), `- ` and `1. ` lists, fenced code
 * blocks kept verbatim, and paragraphs with inline `**bold**`. The blog
 * (2026-11-02) added `### ` headings and `[text](/path)` links — to a site
 * path or an https URL only, so a link can never run script. 2026-11-03 added
 * `![alt](/blog/name.webp)` on a line of its own: an illustration, from the
 * blog's own folder only, so a post can never pull in an outside image.
 *
 * Deliberately not a markdown library: the text is ours, the subset is fixed,
 * and output is React elements built from these blocks — never HTML strings —
 * so nothing in the text can become markup.
 */

export type Inline = { text: string; bold?: true; href?: string };
export type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "label"; text: string }
  | { type: "p"; parts: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "code"; text: string }
  | { type: "img"; src: string; alt: string };

/** A link target this site will render: a path on the site, or https. */
function safeHref(href: string): boolean {
  // No backslash anywhere: browsers read "/\\host" as "//host", another site.
  if (href.includes("\\")) return false;
  return (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("https://");
}

/** Splits `**bold**` runs and `[text](href)` links out of a line. Anything unmatched stays as text. */
export function parseInline(line: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const prev = parts[parts.length - 1];
    if (prev && !prev.bold && !prev.href) prev.text += text;
    else parts.push({ text });
  };
  for (const match of line.matchAll(pattern)) {
    if (match[1] === undefined && !safeHref(match[3])) continue;
    if (match.index > last) pushText(line.slice(last, match.index));
    if (match[1] !== undefined) parts.push({ text: match[1], bold: true });
    else parts.push({ text: match[2], href: match[3] });
    last = match.index + match[0].length;
  }
  if (last < line.length) pushText(line.slice(last));
  return parts;
}

/** An illustration line: `![alt](/blog/name.webp)`, our own folder only. */
const IMAGE_LINE = /^!\[([^\]]+)\]\((\/blog\/[a-z0-9-]+\.(?:webp|jpg|png))\)$/;

/**
 * A heading's anchor (2026-11-03, the blog's table of contents): lower-case,
 * punctuation dropped, spaces to hyphens; CJK characters are kept, so the id
 * reads like the heading in the address bar.
 */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** The `## ` headings of a body, with unique ids — the same ids MiniMarkdown renders. */
export function tableOfContents(source: string): { id: string; text: string }[] {
  const seen = new Map<string, number>();
  return parseMiniMarkdown(source)
    .filter((block): block is { type: "h2"; text: string } => block.type === "h2")
    .map((block) => {
      const base = headingId(block.text) || "section";
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return { id: n === 1 ? base : `${base}-${n}`, text: block.text };
    });
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
    const image = IMAGE_LINE.exec(line.trim());
    if (image && !image[2].includes("..")) {
      blocks.push({ type: "img", src: image[2], alt: image[1] });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i++;
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
    while (i < lines.length && lines[i].trim() !== "" && !/^(```|## |### |- |\d+\. )/.test(lines[i])) text.push(lines[i++]);
    const joined = text.join("");
    const label = /^\*\*([^*]+)\*\*$/.exec(joined.trim());
    blocks.push(label ? { type: "label", text: label[1] } : { type: "p", parts: parseInline(joined) });
  }
  return blocks;
}
