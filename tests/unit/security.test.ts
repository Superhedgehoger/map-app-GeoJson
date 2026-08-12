import { describe, expect, it } from 'vitest';
import { neutralizeSpreadsheetFormula, sanitizeUrl } from '../../src/security';

describe('untrusted input helpers', () => {
  it('rejects active URL protocols', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('https://example.com/a')).toBe('https://example.com/a');
  });

  it('neutralizes spreadsheet formulas', () => {
    expect(neutralizeSpreadsheetFormula('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(neutralizeSpreadsheetFormula('ordinary')).toBe('ordinary');
  });
});
