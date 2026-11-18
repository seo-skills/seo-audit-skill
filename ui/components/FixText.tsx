/**
 * Fix text with its code set in mono: `loading="lazy"`, `<title>`, `<head>`.
 *
 * Split into React nodes, never HTML: the fix text is ours, but a test keeps
 * raw HTML out of the renderer and there is no reason to make an exception.
 */

const CODE = /([a-z-]+="[^"]*"|<[a-z0-9]+>)/gi;

export function FixText({ text }: { text: string }) {
  const parts = text.split(CODE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="font-mono text-[0.92em]">
            {part}
          </code>
        ) : (
          part
        )
      )}
    </>
  );
}
