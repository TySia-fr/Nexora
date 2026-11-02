/**
 * Renders schema.org data. JSON.stringify output with "<" escaped can't close the
 * script element, so data built from database text is safe to embed.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
