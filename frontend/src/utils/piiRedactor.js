/**
 * Zero-Knowledge Personally Identifiable Information (PII) Redactor (Client-side)
 * Automatically detects and masks Indian Aadhaar numbers, PAN cards, bank accounts,
 * and government IDs before sending data to external APIs or storage.
 */

// Aadhaar: 12 digits, starts with 2-9, optional spaces or dashes
const AADHAAR_REGEX = /\b[2-9]\d{3}[\s\-]??\d{4}[\s\-]??\d{4}\b/g;

// Indian PAN Card: 5 uppercase letters, 4 digits, 1 uppercase letter
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

// Bank Account: 9-18 digits preceded by account context
const BANK_AC_REGEX = /(?:\b(?:a\/c|account|acct|acc\.?|a\/c\s+no\.?|bank\s+acc)[\s:#\-]*)(?<ac>\d{9,18})\b/gi;

// Indian Passport: 1 uppercase letter followed by 7 digits
const PASSPORT_REGEX = /\b[A-Z][0-9]{7}\b/g;

/**
 * Scans text and counts sensitive PII items without modifying text
 * @param {string} text 
 * @returns {object} Scan summary
 */
export function scanPii(text) {
  if (!text || typeof text !== 'string') {
    return { hasPii: false, count: 0, types: [] };
  }

  const aadhaarMatches = (text.match(AADHAAR_REGEX) || []).filter(raw => {
    const digits = raw.replace(/[\s\-]/g, '');
    return new Set(digits).size > 1;
  });

  const panMatches = text.match(PAN_REGEX) || [];
  const passportMatches = text.match(PASSPORT_REGEX) || [];

  let bankMatchesCount = 0;
  const bankRegexCopy = new RegExp(BANK_AC_REGEX.source, 'gi');
  while (bankRegexCopy.exec(text) !== null) {
    bankMatchesCount++;
  }

  const types = [];
  if (aadhaarMatches.length > 0) types.push('Aadhaar');
  if (panMatches.length > 0) types.push('PAN');
  if (bankMatchesCount > 0) types.push('Bank Account');
  if (passportMatches.length > 0) types.push('Passport');

  const total = aadhaarMatches.length + panMatches.length + bankMatchesCount + passportMatches.length;

  return {
    hasPii: total > 0,
    count: total,
    types,
    details: {
      aadhaar: aadhaarMatches.length,
      pan: panMatches.length,
      bank: bankMatchesCount,
      passport: passportMatches.length
    }
  };
}

/**
 * Redacts sensitive personal information from candidate text
 * @param {string} text 
 * @returns {object} { redactedText, redactionsCount, detectedTypes }
 */
export function redactPii(text) {
  if (!text || typeof text !== 'string') {
    return { redactedText: text || '', redactionsCount: 0, detectedTypes: [] };
  }

  let redacted = text;
  const detectedTypes = [];
  let totalRedactions = 0;

  // 1. Redact Bank Accounts first (to avoid misclassifying A/C numbers as Aadhaar)
  redacted = redacted.replace(BANK_AC_REGEX, (match, p1) => {
    if (!detectedTypes.includes('Bank Account')) detectedTypes.push('Bank Account');
    totalRedactions++;
    return match.replace(p1, `[BANK_AC_MASKED_XXXX_${p1.slice(-4)}]`);
  });

  // 2. Redact Aadhaar
  redacted = redacted.replace(AADHAAR_REGEX, (raw) => {
    const digits = raw.replace(/[\s\-]/g, '');
    if (new Set(digits).size <= 1) return raw; // Skip repeated digits like 0000 0000 0000
    if (!detectedTypes.includes('Aadhaar')) detectedTypes.push('Aadhaar');
    totalRedactions++;
    return `[AADHAAR_MASKED_XXXX_${digits.slice(-4)}]`;
  });

  // 3. Redact PAN Card
  redacted = redacted.replace(PAN_REGEX, (raw) => {
    if (!detectedTypes.includes('PAN')) detectedTypes.push('PAN');
    totalRedactions++;
    return `[PAN_MASKED_${raw.slice(0, 2)}XX${raw.slice(-2)}]`;
  });

  // Redact Passport
  redacted = redacted.replace(PASSPORT_REGEX, (raw) => {
    if (!detectedTypes.includes('Passport')) detectedTypes.push('Passport');
    totalRedactions++;
    return `[PASSPORT_MASKED_${raw[0]}XXXXXX]`;
  });

  return {
    redactedText: redacted,
    redactionsCount: totalRedactions,
    detectedTypes
  };
}
