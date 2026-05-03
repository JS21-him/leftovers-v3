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
  fetchShoppingItems,
  addShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  clearBoughtItems,
} from '../../../features/shopping/useShoppingItems';
import { supabase } from '../../../lib/supabase/client';

const mockFrom = supabase.from as jest.Mock;

describe('fetchShoppingItems', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns items ordered by is_bought then created_at', async () => {
    const items = [
      { id: '1', name: 'Milk', quantity: '1', is_bought: false, is_staple: false, household_id: 'hh-1', added_by: 'u-1', created_at: '2026-05-01' },
      { id: '2', name: 'Eggs', quantity: '12', is_bought: true, is_staple: false, household_id: 'hh-1', added_by: 'u-1', created_at: '2026-05-01' },
    ];
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    // second .order() call resolves
    let callCount = 0;
    chain.order.mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.resolve({ data: items, error: null });
      return chain;
    });
    mockFrom.mockReturnValue(chain);

    const result = await fetchShoppingItems('hh-1');
    expect(result).toHaveLength(2);
  });

  it('throws on error', async () => {
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    let callCount = 0;
    chain.order.mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.resolve({ data: null, error: { message: 'DB error' } });
      return chain;
    });
    mockFrom.mockReturnValue(chain);

    await expect(fetchShoppingItems('hh-1')).rejects.toThrow('DB error');
  });
});

describe('addShoppingItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts and returns the new item', async () => {
    const newItem = { id: '3', name: 'Butter', quantity: '1', is_bought: false, is_staple: false, household_id: 'hh-1', added_by: 'u-1', created_at: '' };
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: newItem, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await addShoppingItem({ householdId: 'hh-1', addedBy: 'u-1', name: 'Butter', quantity: '1' });
    expect(result.name).toBe('Butter');
  });

  it('throws on error', async () => {
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(
      addShoppingItem({ householdId: 'hh-1', addedBy: 'u-1', name: 'Butter', quantity: '1' })
    ).rejects.toThrow('Insert failed');
  });
});

describe('toggleShoppingItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates is_bought to the new value', async () => {
    const chain = { update: jest.fn(), eq: jest.fn() };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await expect(toggleShoppingItem('item-1', true)).resolves.toBeUndefined();
    expect(chain.update).toHaveBeenCalledWith({ is_bought: true });
    expect(chain.eq).toHaveBeenCalledWith('id', 'item-1');
  });

  it('throws on error', async () => {
    const chain = { update: jest.fn(), eq: jest.fn() };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: { message: 'Update failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(toggleShoppingItem('item-1', true)).rejects.toThrow('Update failed');
  });
});

describe('deleteShoppingItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes item by id', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await expect(deleteShoppingItem('item-1')).resolves.toBeUndefined();
    expect(chain.eq).toHaveBeenCalledWith('id', 'item-1');
  });

  it('throws on error', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: { message: 'Delete failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(deleteShoppingItem('item-1')).rejects.toThrow('Delete failed');
  });
});

describe('clearBoughtItems', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes all bought items for a household', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    // two .eq() calls chained — second one resolves
    let callCount = 0;
    chain.eq.mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.resolve({ error: null });
      return chain;
    });
    mockFrom.mockReturnValue(chain);

    await expect(clearBoughtItems('hh-1')).resolves.toBeUndefined();
  });

  it('throws on error', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    let callCount = 0;
    chain.eq.mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.resolve({ error: { message: 'Clear failed' } });
      return chain;
    });
    mockFrom.mockReturnValue(chain);

    await expect(clearBoughtItems('hh-1')).rejects.toThrow('Clear failed');
  });
});
