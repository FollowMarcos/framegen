// Converts an emoji string into a Twemoji-compatible asset URL.
//
// Konva's canvas text renderer doesn't reliably emit color emoji glyphs
// across platforms (Windows ships them in DirectWrite but the canvas
// path falls back to monochrome; Linux ships nothing). To keep emoji
// stickers looking identical everywhere we render them as Twemoji
// vectors instead of system fonts.
//
// Twitter open-sourced the Twemoji asset set; we use the actively-
// maintained jdecked fork pinned to a known-good version. SVG files
// scale losslessly to any size the user drags the sticker to.

const TWEMOJI_VERSION = "15.1.0";
const TWEMOJI_BASE = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg`;

// Turns an emoji string into the dash-joined hex codepoint string that
// Twemoji uses as its filename — e.g. "💯" → "1f4af", "❤️" → "2764"
// (with the variation selector stripped), "🏳️‍🌈" → "1f3f3-200d-1f308".
//
// The FE0F variation selector is dropped in line with Twemoji's own
// build pipeline; keeping it would 404 on most single-emoji files
// because the SVG names omit it.
export function emojiToTwemojiCodepoint(emoji: string): string {
  const parts: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    // Drop FE0F (Variation Selector-16) so single-emoji codepoints
    // resolve to the filename Twemoji actually ships.
    if (cp === 0xfe0f) continue;
    parts.push(cp.toString(16));
  }
  return parts.join("-");
}

export function emojiSvgUrl(emoji: string): string {
  return `${TWEMOJI_BASE}/${emojiToTwemojiCodepoint(emoji)}.svg`;
}
