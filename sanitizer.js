// Vaani AI Pro — Output Sanitizer
// Strips emojis, markdown, and stage directions before TTS + chat render.
// Used by:
//   - Chat bubble render path (index.html, applied before setState of bot message)
//   - speechSynthesis utterance path (before new SpeechSynthesisUtterance)
//   - Server-side response (netlify/functions/chat.js) for defence in depth
//
// Exposes VaaniSanitizer.sanitize(text) in browser and CommonJS module for Node.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.VaaniSanitizer = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Emoji / pictograph unicode ranges
  // U+1F300–U+1FAFF (misc symbols & pictographs, supplemental, extended-A)
  // U+2600–U+27BF (dingbats, misc symbols)
  // U+1F000–U+1F9FF (mahjong through supplemental symbols/pictographs)
  // U+FE0F  variation selector-16
  // U+200D  zero-width joiner
  const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

  // Stage directions: *smiles*, (laughs), [pause] — short bracketed phrases
  const STAGE_STAR_RE = /\*[^*\n]{1,40}\*/g;
  const STAGE_PAREN_RE = /\([a-zA-Z][a-zA-Z ,'-]{0,40}\)/g;
  const STAGE_BRACKET_RE = /\[[a-zA-Z][a-zA-Z ,'-]{0,40}\]/g;

  // Markdown formatting
  const MD_BOLD_STAR = /\*\*([^*\n]+)\*\*/g;
  const MD_BOLD_UNDER = /__([^_\n]+)__/g;
  const MD_ITAL_STAR = /(^|[\s(])\*([^*\n]+)\*/g;
  const MD_ITAL_UNDER = /(^|[\s(])_([^_\n]+)_/g;
  const MD_STRIKE = /~~([^~\n]+)~~/g;
  const MD_CODE_INLINE = /`([^`\n]+)`/g;
  const MD_CODE_BLOCK = /```[\s\S]*?```/g;
  const MD_HEADING = /^\s{0,3}#{1,6}\s+/gm;
  const MD_BULLET = /^\s{0,3}[-*+>]\s+/gm;
  const MD_BLOCKQUOTE = /^\s{0,3}>\s?/gm;
  const MD_LINK = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;

  function sanitize(text) {
    if (text == null) return '';
    let out = String(text);

    // 1. Strip emojis and zero-width joiners FIRST so they can't interfere
    //    with markdown/stage-direction pattern matching below.
    out = out.replace(EMOJI_RE, '');

    // 2. Code blocks and inline code -> drop fences, keep content.
    out = out.replace(MD_CODE_BLOCK, function (m) {
      return m.replace(/```[a-zA-Z0-9]*\n?/g, '').replace(/```/g, '');
    });
    out = out.replace(MD_CODE_INLINE, '$1');

    // 3. Markdown bold / underscore-bold (handle double-markers BEFORE single-*).
    out = out.replace(MD_BOLD_STAR, '$1');
    out = out.replace(MD_BOLD_UNDER, '$1');

    // 4. Stage directions: *smiles*, (laughs), [pause].
    out = out.replace(STAGE_STAR_RE, '');
    out = out.replace(STAGE_PAREN_RE, '');
    out = out.replace(STAGE_BRACKET_RE, '');

    // 5. Italic / strike markers (after bold so nothing nests oddly).
    out = out.replace(MD_ITAL_STAR, '$1$2');
    out = out.replace(MD_ITAL_UNDER, '$1$2');
    out = out.replace(MD_STRIKE, '$1');

    // 6. Markdown links -> keep label only.
    out = out.replace(MD_LINK, '$1');

    // 7. Headings, bullets, blockquote markers at line start.
    out = out.replace(MD_HEADING, '');
    out = out.replace(MD_BULLET, '');
    out = out.replace(MD_BLOCKQUOTE, '');

    // 8. Any stray asterisks, underscores, backticks left over.
    out = out.replace(/[*_`~]+/g, '');

    // 9. Collapse whitespace.
    out = out.replace(/[ \t]+/g, ' ');
    out = out.replace(/\n{3,}/g, '\n\n');
    out = out.replace(/ *\n */g, '\n');

    return out.trim();
  }

  // Version token for stamping
  const VERSION = '1.0.0';

  return { sanitize: sanitize, VERSION: VERSION };
});
