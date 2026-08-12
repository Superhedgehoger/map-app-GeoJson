import DOMPurify from 'dompurify';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/;

export function sanitizeHtml(value: unknown): string {
  return DOMPurify.sanitize(String(value ?? ''), {
    ALLOWED_TAGS: ['b', 'br', 'code', 'em', 'i', 'small', 'span', 'strong'],
    ALLOWED_ATTR: ['class']
  });
}

export function sanitizeUrl(
  value: unknown,
  base = globalThis.location?.href ?? 'https://localhost/'
): string | null {
  try {
    const url = new URL(String(value ?? ''), base);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function neutralizeSpreadsheetFormula(value: unknown): string | number | boolean | null {
  if (typeof value !== 'string') {
    return typeof value === 'number' || typeof value === 'boolean' || value === null
      ? value
      : String(value);
  }
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}
