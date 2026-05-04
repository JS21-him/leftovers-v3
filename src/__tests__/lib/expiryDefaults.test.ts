/**
 * @jest-environment node
 */
/// <reference types="jest" />

import { getExpiryDate } from '../../lib/expiryDefaults';

describe('getExpiryDate', () => {
  function expectedDate(daysFromNow: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split('T')[0];
  }

  it('produce → +5 days', () => {
    expect(getExpiryDate('produce')).toBe(expectedDate(5));
  });

  it('dairy → +7 days', () => {
    expect(getExpiryDate('dairy')).toBe(expectedDate(7));
  });

  it('meat → +3 days', () => {
    expect(getExpiryDate('meat')).toBe(expectedDate(3));
  });

  it('frozen → +90 days', () => {
    expect(getExpiryDate('frozen')).toBe(expectedDate(90));
  });

  it('beverages → +14 days', () => {
    expect(getExpiryDate('beverages')).toBe(expectedDate(14));
  });

  it('pantry → +180 days', () => {
    expect(getExpiryDate('pantry')).toBe(expectedDate(180));
  });

  it('other → +7 days', () => {
    expect(getExpiryDate('other')).toBe(expectedDate(7));
  });

  it('unknown category falls back to +7 days', () => {
    expect(getExpiryDate('mystery')).toBe(expectedDate(7));
  });
});
