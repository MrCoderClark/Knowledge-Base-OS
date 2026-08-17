import sanitizeHtml from "sanitize-html";

/**
 * Sanitize editor-produced HTML before storing/rendering. Even though the CSP
 * blocks inline scripts/handlers, we never trust client HTML: strip everything
 * outside the Tiptap StarterKit tag set. Displayed via dangerouslySetInnerHTML.
 */
export function sanitizeDocumentHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "strong", "em", "s", "a", "br", "hr",
    ],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
