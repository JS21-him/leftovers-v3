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
  isCheckedThisWeek,
  fetchStaples,
  addStaple,
  toggleStaple,
  deleteStaple,
} from '../../../features/shopping/useStaples';
import { supabase } from '../../../lib/supabase/client';

const mockFrom = supabase.from as jest.Mock;

describe('isCheckedThisWeek', () => {
  it('returns false for null', () => {
    expect(isCheckedThisWeek(null)).toBe(false);
  });

  it('returns true for timestamp within last 7 days', () => {
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCheckedThisWeek(recent)).toBe(true);
  });

  it('returns false for timestamp older than 7 days', () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCheckedThisWeek(old)).toBe(false);
  });

  it('returns false for timestamp exactly 7 days ago', () => {
    const boundary = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCheckedThisWeek(boundary)).toBe(false);
  });
});

describe('fetchStaples', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns staples ordered by name', async () => {
    const staples = [
      { id: 's-1', household_id: 'hh-1', name: 'Bread', default_quantity: '1', reorder_when_low: true, created_at: '', last_checked_at: null },
      { id: 's-2', household_id: 'hh-1', name: 'Milk', default_quantity: '2', reorder_when_low: true, created_at: '', last_checked_at: null },
    ];
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: staples, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchStaples('hh-1');
    expect(result).toHaveLength(2);
    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('throws on DB error', async () => {
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchStaples('hh-1')).rejects.toThrow('DB error');
  });
});

describe('addStaple', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts row with correct fields and returns it', async () => {
    const newStaple = { id: 's-1', household_id: 'hh-1', name: 'Eggs', default_quantity: '12', reorder_when_low: true, created_at: '', last_checked_at: null };
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: newStaple, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await addStaple({ householdId: 'hh-1', name: 'Eggs', quantity: '12' });
    expect(result.name).toBe('Eggs');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Eggs', default_quantity: '12', household_id: 'hh-1' })
    );
  });

  it('throws on DB error', async () => {
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(addStaple({ householdId: 'hh-1', name: 'Eggs', quantity: '12' })).rejects.toThrow('Insert failed');
  });
});

describe('toggleStaple', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets last_checked_at = null when currentlyChecked is true', async () => {
    const chain = { update: jest.fn(), eq: jest.fn() };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await toggleStaple({ id: 's-1', currentlyChecked: true });
    expect(chain.update).toHaveBeenCalledWith({ last_checked_at: null });
    expect(chain.eq).toHaveBeenCalledWith('id', 's-1');
  });

  it('sets last_checked_at to an ISO string when currentlyChecked is false', async () => {
    const chain = { update: jest.fn(), eq: jest.fn() };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await toggleStaple({ id: 's-1', currentlyChecked: false });
    const updateArg = chain.update.mock.calls[0][0];
    expect(typeof updateArg.last_checked_at).toBe('string');
    expect(updateArg.last_checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws on DB error', async () => {
    const chain = { update: jest.fn(), eq: jest.fn() };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: { message: 'Update failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(toggleStaple({ id: 's-1', currentlyChecked: false })).rejects.toThrow('Update failed');
  });
});

describe('deleteStaple', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes by id', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await deleteStaple('s-1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 's-1');
  });

  it('throws on DB error', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: { message: 'Delete failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(deleteStaple('s-1')).rejects.toThrow('Delete failed');
  });
});
