import Link from "next/link";
import { Fragment } from "react";
import type { Block, Inline } from "@/lib/mini-markdown";

/** Inline runs as React text: bold and links where marked, never HTML. */
export function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.href) {
          return part.href.startsWith("/") ? (
            <Link key={index} href={part.href}>{part.text}</Link>
          ) : (
            <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
          );
        }
        return part.bold ? <strong key={index}>{part.text}</strong> : <Fragment key={index}>{part.text}</Fragment>;
      })}
    </>
  );
}

/** The mini-markdown blocks of a long-form page (the blog, 2026-11-02). */
export function MiniMarkdown({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "h2":
            return <h2 key={index} className="h3">{block.text}</h2>;
          case "h3":
            return <h3 key={index} className="h4">{block.text}</h3>;
          case "label":
            return <p key={index}><strong>{block.text}</strong></p>;
          case "p":
            return <p key={index}><InlineText parts={block.parts} /></p>;
          case "ul":
            return <ul key={index} className="stack-2">{block.items.map((item, n) => <li key={n}><InlineText parts={item} /></li>)}</ul>;
          case "ol":
            return <ol key={index} className="stack-2">{block.items.map((item, n) => <li key={n}><InlineText parts={item} /></li>)}</ol>;
          case "code":
            return <pre key={index}>{block.text}</pre>;
        }
      })}
    </>
  );
}
