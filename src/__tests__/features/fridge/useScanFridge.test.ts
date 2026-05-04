/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));
jest.mock('../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { scanReceipt, scanItems } from '../../../features/fridge/useScanFridge';
import { supabase } from '../../../lib/supabase/client';

const mockInvoke = supabase.functions.invoke as jest.Mock;

const mockItem = {
  id: '1',
  household_id: 'hh-1',
  added_by: 'u-1',
  name: 'Milk',
  quantity: '1',
  expiry_date: '2026-05-10',
  barcode: null,
  category: 'dairy',
  created_at: '',
};

describe('scanReceipt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns items on valid response', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [mockItem] }, error: null });
    const result = await scanReceipt({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Milk');
    expect(mockInvoke).toHaveBeenCalledWith('scan-receipt', {
      body: { image: 'base64data', householdId: 'hh-1', userId: 'u-1' },
    });
  });

  it('returns [] when items array is empty', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [] }, error: null });
    const result = await scanReceipt({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' });
    expect(result).toEqual([]);
  });

  it('throws on network error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    await expect(
      scanReceipt({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' })
    ).rejects.toThrow('Network error');
  });

  it('throws when data contains error field', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'AI service not configured' }, error: null });
    await expect(
      scanReceipt({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' })
    ).rejects.toThrow('AI service not configured');
  });
});

describe('scanItems', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns items on valid response', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [mockItem] }, error: null });
    const result = await scanItems({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Milk');
    expect(mockInvoke).toHaveBeenCalledWith('scan-items', {
      body: { image: 'base64data', householdId: 'hh-1', userId: 'u-1' },
    });
  });

  it('returns [] when items array is empty', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [] }, error: null });
    const result = await scanItems({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' });
    expect(result).toEqual([]);
  });

  it('throws on network error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    await expect(
      scanItems({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' })
    ).rejects.toThrow('Network error');
  });
});
