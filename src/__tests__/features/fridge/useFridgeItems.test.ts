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

import {
  fetchFridgeItems,
  addFridgeItem,
  deleteFridgeItem,
} from '../../../features/fridge/useFridgeItems';
import { supabase } from '../../../lib/supabase/client';

const mockFrom = supabase.from as jest.Mock;

describe('fetchFridgeItems', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns items sorted by expiry_date', async () => {
    const items = [
      { id: '1', name: 'Milk', quantity: '1', expiry_date: '2026-05-10', household_id: 'hh-1', added_by: 'u-1', barcode: null, category: null, created_at: '' },
      { id: '2', name: 'Eggs', quantity: '12', expiry_date: '2026-05-05', household_id: 'hh-1', added_by: 'u-1', barcode: null, category: null, created_at: '' },
    ];
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: items, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchFridgeItems('hh-1');
    expect(result).toHaveLength(2);
    expect(chain.order).toHaveBeenCalledWith('expiry_date', { ascending: true, nullsFirst: false });
  });

  it('throws on error', async () => {
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchFridgeItems('hh-1')).rejects.toThrow('DB error');
  });
});

describe('addFridgeItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts item and returns it', async () => {
    const newItem = { id: '3', name: 'Butter', quantity: '1', expiry_date: null, household_id: 'hh-1', added_by: 'u-1', barcode: null, category: null, created_at: '' };
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: newItem, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await addFridgeItem({ householdId: 'hh-1', addedBy: 'u-1', name: 'Butter', quantity: '1', expiryDate: null });
    expect(result.name).toBe('Butter');
  });

  it('throws on error', async () => {
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(
      addFridgeItem({ householdId: 'hh-1', addedBy: 'u-1', name: 'Butter', quantity: '1', expiryDate: null })
    ).rejects.toThrow('Insert failed');
  });
});

describe('deleteFridgeItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes item by id', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await expect(deleteFridgeItem('item-1')).resolves.toBeUndefined();
    expect(chain.eq).toHaveBeenCalledWith('id', 'item-1');
  });

  it('throws on error', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: { message: 'Delete failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(deleteFridgeItem('item-1')).rejects.toThrow('Delete failed');
  });
});
