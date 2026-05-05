/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

import { fetchExpiryPrediction } from '../../../features/fridge/useExpiryPrediction';
import { supabase } from '../../../lib/supabase/client';

const mockInvoke = (supabase.functions as unknown as { invoke: jest.Mock }).invoke;

describe('fetchExpiryPrediction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns expiryDate and explanation on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { expiryDate: '2026-05-07', explanation: 'Salmon keeps 1–2 days.' },
      error: null,
    });

    const result = await fetchExpiryPrediction('wild salmon');
    expect(result.expiryDate).toBe('2026-05-07');
    expect(result.explanation).toBe('Salmon keeps 1–2 days.');
    expect(mockInvoke).toHaveBeenCalledWith('predict-expiry', { body: { name: 'wild salmon' } });
  });

  it('throws when supabase returns an error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Network error'),
    });

    await expect(fetchExpiryPrediction('something')).rejects.toThrow('Network error');
  });

  it('throws when response is missing expiryDate', async () => {
    mockInvoke.mockResolvedValue({
      data: { explanation: 'Some text' },
      error: null,
    });

    await expect(fetchExpiryPrediction('something')).rejects.toThrow('Invalid response from predict-expiry');
  });

  it('throws when response is missing explanation', async () => {
    mockInvoke.mockResolvedValue({
      data: { expiryDate: '2026-05-07' },
      error: null,
    });

    await expect(fetchExpiryPrediction('something')).rejects.toThrow('Invalid response from predict-expiry');
  });

  it('throws when data is null and error is null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(fetchExpiryPrediction('something')).rejects.toThrow('Invalid response from predict-expiry');
  });
});
