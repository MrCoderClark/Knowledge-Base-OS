/**
 * Render a search snippet where matches are wrapped in `{{ … }}` markers
 * (emitted by ts_headline). Splits on the markers and wraps matches in <mark> —
 * plain text only, so document content is never injected as HTML.
 */
export function Highlight({ text }: { text: string }) {
  const parts = text.split(/\{\{(.*?)\}\}/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-indigo-soft px-0.5 text-indigo">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
