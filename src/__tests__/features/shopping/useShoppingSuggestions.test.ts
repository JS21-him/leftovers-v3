/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

import { fetchShoppingSuggestions } from '../../../features/shopping/useShoppingSuggestions';
import { supabase } from '../../../lib/supabase/client';

const mockInvoke = (supabase.functions as unknown as { invoke: jest.Mock }).invoke;

describe('fetchShoppingSuggestions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns suggestions array on success', async () => {
    const suggestions = [
      { name: 'Milk', reason: 'Expires tomorrow.' },
      { name: 'Eggs', reason: 'Weekly staple not bought yet.' },
    ];
    mockInvoke.mockResolvedValue({ data: { suggestions }, error: null });

    const result = await fetchShoppingSuggestions();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Milk');
    expect(result[1].reason).toBe('Weekly staple not bought yet.');
    expect(mockInvoke).toHaveBeenCalledWith('suggest-shopping', { body: {} });
  });

  it('returns empty array when suggestions is empty', async () => {
    mockInvoke.mockResolvedValue({ data: { suggestions: [] }, error: null });

    const result = await fetchShoppingSuggestions();
    expect(result).toHaveLength(0);
  });

  it('throws when supabase returns an error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Network error') });

    await expect(fetchShoppingSuggestions()).rejects.toThrow('Network error');
  });

  it('throws when response has no suggestions array', async () => {
    mockInvoke.mockResolvedValue({ data: { unexpected: 'format' }, error: null });

    await expect(fetchShoppingSuggestions()).rejects.toThrow('Invalid response from suggest-shopping');
  });

  it('throws when data is null and error is null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(fetchShoppingSuggestions()).rejects.toThrow('Invalid response from suggest-shopping');
  });
});
