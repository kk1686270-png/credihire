/**
 * Validation and sanitization utilities for CrediHire
 */

export const MAX_INPUT_CHARS = 12_000;
export const MIN_INPUT_CHARS = 10;
export const MAX_URL_CHARS = 2_048;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

export function validateUploadFile(file) {
  const name = typeof file?.name === 'string' ? file.name : '';
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (!SUPPORTED_UPLOAD_EXTENSIONS.includes(extension)) {
    return { isValid: false, error: 'Only PDF, PNG, JPG, and JPEG files are supported.' };
  }
  if (typeof file?.size !== 'number' || file.size === 0) {
    return { isValid: false, error: 'Please choose a non-empty file.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { isValid: false, error: 'This file exceeds the 10 MiB upload limit.' };
  }
  return { isValid: true, error: null };
}

export function validateJobOfferInput(text, attachedFile = null) {
  const rawString = typeof text === 'string' ? text : '';
  const trimmed = rawString.trim();

  if (attachedFile) {
    const fileValidation = validateUploadFile(attachedFile);
    return { ...fileValidation, warnings: [], sanitizedText: trimmed };
  }

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: "Please paste a job offer message, or click the file icon to upload a document/screenshot."
    };
  }

  if (trimmed.length < MIN_INPUT_CHARS) {
    return {
      isValid: false,
      error: "Please provide a little more text (at least 10 characters) so patterns can be identified."
    };
  }

  if (trimmed.length > MAX_INPUT_CHARS) {
    return {
      isValid: false,
      error: `Input exceeds maximum limit of ${MAX_INPUT_CHARS} characters (currently ${trimmed.length}).`
    };
  }

  // Check for potential accidental PII paste (Passphrases, 16-digit cards, etc.)
  const piiWarnings = [];
  const creditCardRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b/;
  const otpPasswordRegex = /\b(?:my otp is|password is|pin is)\s*[:=]?\s*\w+/i;

  if (creditCardRegex.test(trimmed)) {
    piiWarnings.push("Potential credit or debit card number detected. Do not submit actual card numbers.");
  }
  if (otpPasswordRegex.test(trimmed)) {
    piiWarnings.push("Potential personal password or OTP detected. Please remove credentials before submitting.");
  }

  return {
    isValid: true,
    error: null,
    warnings: piiWarnings,
    sanitizedText: trimmed
  };
}

export function validateUrlInput(rawUrl) {
  const rawString = typeof rawUrl === 'string' ? rawUrl : '';
  const trimmed = rawString.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'Please paste a recruitment website URL to analyze.'
    };
  }

  if (trimmed.length > MAX_URL_CHARS) {
    return {
      isValid: false,
      error: `URL exceeds the maximum limit of ${MAX_URL_CHARS} characters.`
    };
  }

  const colonIdx = trimmed.indexOf(':');
  const slashIdx = trimmed.indexOf('/');
  if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) {
    const scheme = trimmed.slice(0, colonIdx).toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return {
        isValid: false,
        error: 'Only http:// and https:// URLs are supported.'
      };
    }
  }

  // Check for obvious whitespace or control characters
  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      error: 'URL cannot contain spaces.'
    };
  }

  return {
    isValid: true,
    error: null,
    sanitizedUrl: trimmed
  };
}

/**
 * Format timestamp in human readable 12-hour format (e.g. "2:14 PM")
 */
export function getCurrentFormattedTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Determines if an Enter key event on the job offer textarea should trigger submission.
 *
 * Requirements:
 * - Enter without Shift triggers submission.
 * - Shift + Enter inserts a newline normally (does not submit).
 * - IME composition Enter confirms composition text without submitting.
 * - Empty or whitespace-only text does not submit (unless a file is attached).
 * - Does not submit while a request is already loading.
 */
export function shouldSubmitOnEnter(e, { isLoading = false, inputText = '', attachedFile = null } = {}) {
  if (!e || e.key !== 'Enter') return false;
  if (e.shiftKey) return false;
  if (e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229) return false;
  if (isLoading) return false;
  if (!attachedFile && (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0)) return false;
  return true;
}

export const INDICATOR_TITLES = {
  upfront_registration_fee: 'Upfront Registration Fee Demand',
  task_deposit: 'Task Deposit / Recharge Demand',
  withdrawal_fee: 'Withdrawal Block & Clearance Fee',
  unrealistic_earnings: 'Unrealistic Earnings Claim',
  urgency_pressure: 'Urgency & High-Pressure Tactics',
  sensitive_credentials: 'Sensitive Credentials / OTP Solicitation',
  advance_fee: 'Advance Fee / Security Deposit'
};

export function formatWarningTitle(code) {
  if (!code) return 'Warning Sign';
  if (INDICATOR_TITLES[code]) return INDICATOR_TITLES[code];
  if (typeof code === 'string' && code.includes('_')) {
    return code
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return String(code);
}

/**
 * Known disposable, temporary, and mock/test email domains that are disallowed
 */
export const DISPOSABLE_OR_TEST_DOMAINS = [
  'tempmail.com',
  '10minutemail.com',
  'throwawaymail.com',
  'mailinator.com',
  'guerrillamail.com',
  'yopmail.com',
  'fake.com',
  'test.com',
  'example.com',
  'invalid.com',
  'dispostable.com',
  'sharklasers.com',
  'trashmail.com',
  'getairmail.com',
  'mohmal.com',
  'burnermail.io',
  'mytemp.email',
  'temp-mail.org'
];

/**
 * Validates that an email is a real, well-formed email address and not from a disposable/test domain.
 */
export function validateRealEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }

  const clean = email.trim().toLowerCase();
  if (clean.length === 0) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    return { isValid: false, error: 'Please enter a complete, valid email address (e.g. name@gmail.com).' };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Invalid email address format.' };
  }

  const [localPart, domain] = parts;
  if (localPart.length < 2) {
    return { isValid: false, error: 'Email username must be at least 2 characters.' };
  }

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return { isValid: false, error: 'Email must have a valid top-level domain (e.g. .com, .org, .edu).' };
  }

  if (DISPOSABLE_OR_TEST_DOMAINS.includes(domain)) {
    return {
      isValid: false,
      error: 'Temporary, disposable, or sample test email domains are not allowed. Please use your real personal or work email.'
    };
  }

  const dummyLocalParts = ['test', 'fake', 'dummy', 'asdf', 'sample'];
  if (dummyLocalParts.includes(localPart)) {
    return {
      isValid: false,
      error: 'Sample or dummy test emails are not allowed. Please use your real email address.'
    };
  }

  return {
    isValid: true,
    error: null,
    normalizedEmail: clean,
    domain
  };
}

/**
 * Validates a Google account email (must be a valid real email and a recognized Google domain).
 */
export function validateGoogleAccountEmail(email) {
  const baseResult = validateRealEmail(email);
  if (!baseResult.isValid) return baseResult;

  const validGoogleDomains = ['gmail.com', 'googlemail.com', 'google.com'];
  const domain = baseResult.domain;

  if (!validGoogleDomains.includes(domain)) {
    return {
      isValid: false,
      error: 'Google authentication requires a valid Google account (@gmail.com or @googlemail.com).'
    };
  }

  return {
    isValid: true,
    error: null,
    normalizedEmail: baseResult.normalizedEmail,
    domain
  };
}

/**
 * Validates that a user's full name is a realistic person name.
 */
export function validateRealName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Please enter your full name.' };
  }

  const clean = name.trim();
  if (clean.length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters long.' };
  }

  if (!/^[a-zA-Z\s.'-]+$/.test(clean)) {
    return { isValid: false, error: 'Name can only contain letters, spaces, hyphens, and periods.' };
  }

  const lower = clean.toLowerCase();
  const dummyNames = ['test', 'dummy', 'fake', 'asdf', 'admin', 'user', 'nobody', 'sample'];
  if (dummyNames.includes(lower)) {
    return { isValid: false, error: 'Please enter your real full name.' };
  }

  return {
    isValid: true,
    error: null,
    sanitizedName: clean
  };
}

/**
 * Validates password strength (minimum 6 characters).
 */
export function validateRealPassword(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Please enter a password.' };
  }

  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long.' };
  }

  return {
    isValid: true,
    error: null
  };
}



