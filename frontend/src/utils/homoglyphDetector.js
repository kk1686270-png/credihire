/**
 * Unicode Homoglyph & Fake Character Detector (Client-side)
 * Detects Cyrillic, Greek, lookalikes, and Punycode deception in domains and URLs.
 */

// Mapping of common lookalikes to Latin characters
export const HOMOGLYPH_CHARS = {
  // Cyrillic
  '\u0430': 'a',
  '\u0441': 'c',
  '\u0435': 'e',
  '\u043e': 'o',
  '\u0440': 'p',
  '\u0445': 'x',
  '\u0443': 'y',
  '\u0456': 'i',
  '\u0458': 'j',
  '\u0455': 's',
  '\u0410': 'A',
  '\u0412': 'B',
  '\u0421': 'C',
  '\u0415': 'E',
  '\u041d': 'H',
  '\u0406': 'I',
  '\u041e': 'O',
  '\u0420': 'P',
  '\u0422': 'T',
  '\u0425': 'X',
  // Greek
  '\u03b1': 'a',
  '\u03b5': 'e',
  '\u03b9': 'i',
  '\u03ba': 'k',
  '\u03bd': 'v',
  '\u03bf': 'o',
  '\u03c1': 'p',
  '\u03c4': 't',
  '\u03c5': 'u',
  '\u03c7': 'x',
};

export const POPULAR_TARGETS = [
  'tcs.com',
  'infosys.com',
  'wipro.com',
  'google.com',
  'microsoft.com',
  'amazon.com',
  'tata.com',
  'accenture.com',
  'linkedin.com',
  'naukri.com'
];

/**
 * Detects visual homoglyphs and calculates canonical Latin equivalent
 * @param {string} domainOrUrl 
 * @returns {object} Analysis result
 */
export function detectHomoglyphs(domainOrUrl) {
  if (!domainOrUrl || typeof domainOrUrl !== 'string') {
    return { isHomoglyph: false, detectedCount: 0, normalized: '', spoofedTarget: null };
  }

  let clean = domainOrUrl.trim().toLowerCase();
  if (clean.includes('://')) {
    try {
      clean = new URL(clean).hostname;
    } catch {
      clean = clean.split('://')[1].split('/')[0];
    }
  } else {
    clean = clean.split('/')[0].split('?')[0];
  }

  const isPunycode = clean.startsWith('xn--') || clean.includes('.xn--');
  const foundGlyphs = [];
  let normalized = '';

  for (const ch of clean) {
    if (HOMOGLYPH_CHARS[ch]) {
      foundGlyphs.push({
        char: ch,
        codepoint: `U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
        replaces: HOMOGLYPH_CHARS[ch]
      });
      normalized += HOMOGLYPH_CHARS[ch];
    } else {
      normalized += ch;
    }
  }

  const isHomoglyph = foundGlyphs.length > 0 || isPunycode;
  let spoofedTarget = null;

  if (isHomoglyph) {
    for (const target of POPULAR_TARGETS) {
      const core = target.split('.')[0];
      if (normalized === target || normalized.startsWith(`${core}.`) || normalized.startsWith(`${core}-`)) {
        spoofedTarget = target;
        break;
      }
    }
  }

  return {
    raw: clean,
    isPunycode,
    isHomoglyph,
    detectedCount: foundGlyphs.length,
    detectedGlyphs: foundGlyphs,
    normalizedDomain: normalized,
    spoofedTarget,
    warning: isHomoglyph
      ? (spoofedTarget
          ? `Visual Deception Alert: Domain uses lookalike characters to spoof ${spoofedTarget.toUpperCase()}!`
          : `Homoglyph Warning: Domain contains ${foundGlyphs.length} non-Latin lookalike character(s).`)
      : null
  };
}
