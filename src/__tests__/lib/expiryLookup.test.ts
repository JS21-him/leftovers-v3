/**
 * @jest-environment node
 */
/// <reference types="jest" />

import { lookupExpiry, daysFromNow } from '../../lib/expiryLookup';

function expectedDate(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

describe('lookupExpiry', () => {
  it('returns entry for milk (7 days)', () => {
    const result = lookupExpiry('milk');
    expect(result).not.toBeNull();
    expect(result!.days).toBe(7);
    expect(result!.explanation.length).toBeGreaterThan(0);
  });

  it('returns entry for chicken breast (2 days)', () => {
    const result = lookupExpiry('chicken breast');
    expect(result).not.toBeNull();
    expect(result!.days).toBe(2);
  });

  it('returns entry for eggs (21 days)', () => {
    expect(lookupExpiry('eggs')!.days).toBe(21);
  });

  it('normalises uppercase input', () => {
    expect(lookupExpiry('Milk')).not.toBeNull();
    expect(lookupExpiry('EGGS')).not.toBeNull();
    expect(lookupExpiry('Chicken Breast')).not.toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(lookupExpiry('  milk  ')).not.toBeNull();
  });

  it('returns null for empty string', () => {
    expect(lookupExpiry('')).toBeNull();
  });

  it('returns null for unknown items', () => {
    expect(lookupExpiry('homemade kimchi')).toBeNull();
    expect(lookupExpiry('unicorn meat')).toBeNull();
  });

  it('returns entry for greek yogurt (10 days)', () => {
    expect(lookupExpiry('greek yogurt')!.days).toBe(10);
  });

  it('returns entry for cooked chicken (4 days)', () => {
    expect(lookupExpiry('cooked chicken')!.days).toBe(4);
  });

  it('returns entry for hummus (7 days)', () => {
    expect(lookupExpiry('hummus')!.days).toBe(7);
  });

  it('returns entry for strawberries (5 days)', () => {
    expect(lookupExpiry('strawberries')!.days).toBe(5);
  });

  it('all spot-checked entries have a non-empty explanation', () => {
    const items = ['milk', 'chicken breast', 'eggs', 'bread', 'salmon', 'avocado', 'tofu'];
    for (const item of items) {
      expect(lookupExpiry(item)!.explanation.length).toBeGreaterThan(0);
    }
  });
});

describe('daysFromNow', () => {
  it('returns a YYYY-MM-DD string N days from today', () => {
    expect(daysFromNow(7)).toBe(expectedDate(7));
    expect(daysFromNow(2)).toBe(expectedDate(2));
    expect(daysFromNow(30)).toBe(expectedDate(30));
  });
});
