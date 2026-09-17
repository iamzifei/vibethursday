import { serializeJsonLd } from "@/lib/seo";

/**
 * Renders structured data into the page.
 *
 * One `<script>` per object, in the body: Next.js does not offer a metadata
 * field for JSON-LD, and crawlers read it from anywhere in the document. The
 * serialiser escapes `<`, which is the only way page copy could break out of
 * the tag.
 */
export function JsonLd({ data }: { data: readonly object[] }) {
  return (
    <>
      {data.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
        />
      ))}
    </>
  );
}
