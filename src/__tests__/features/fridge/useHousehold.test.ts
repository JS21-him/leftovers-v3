/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { useHousehold } from '../../../features/fridge/useHousehold';
import { supabase } from '../../../lib/supabase/client';

const mockFrom = supabase.from as jest.Mock;

function makeChain(returnVal: unknown) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'eq', 'single', 'insert', 'update'];
  methods.forEach((m) => { chain[m] = jest.fn(() => chain); });
  chain['single'] = jest.fn(() => Promise.resolve(returnVal));
  chain['update'] = jest.fn(() => Promise.resolve({ error: null }));
  return chain;
}

describe('useHousehold', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns householdId when profile already has one', async () => {
    mockFrom.mockReturnValue(makeChain({ data: { household_id: 'hh-123' }, error: null }));
    const result = await useHousehold('user-1');
    expect(result.householdId).toBe('hh-123');
    expect(result.error).toBeNull();
  });

  it('returns error when profile fetch fails', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }));
    const result = await useHousehold('user-1');
    expect(result.householdId).toBeNull();
    expect(result.error).toBe('DB error');
  });
});
