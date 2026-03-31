/**
 * Strip emojis and playful symbols from a string (for client-facing previews only).
 * Does NOT mutate stored content; use only when rendering preview text.
 * Covers hearts, faces, symbols, and variation selectors.
 */
export function stripEmojisFromPreview(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(
      // Emoji and symbols: hearts (♥ 2665, ❤ 2764, ❣ 2763, 1F493-1F49F), faces, misc, variation selectors
      /[\u2665\u2763-\u2767\u{1F493}-\u{1F49F}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

const DEFAULT_PREVIEW_LENGTH = 200;

/**
 * Centralized client preview: strip emojis, truncate, single-line safe.
 * Use for: latest report preview, at-a-glance report, messages snippets, reports list, notifications.
 */
export function renderClientPreview(
  text: string,
  maxLength: number = DEFAULT_PREVIEW_LENGTH
): string {
  const stripped = stripEmojisFromPreview(text)
    // Strip automated system message boilerplate from client-facing previews
    .replace(/,?\s*here is your tip link:?\s*/gi, '. ')
    .replace(/,?\s*your payment link[^:]*is ready:?\s*/gi, '. ')
    .replace(/,?\s*your tip link:?\s*/gi, '. ')
    // Strip URLs (http/https/localhost) from client-facing previews
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Clean up leading/trailing punctuation artifacts
    .replace(/^[.,;:\s]+/, '')
    .replace(/[.,;:\s]+$/, '');
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength).trim() + "…";
}
