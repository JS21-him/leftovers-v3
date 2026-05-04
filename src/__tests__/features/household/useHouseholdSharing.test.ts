/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));
jest.mock('../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  joinHousehold,
  leaveHousehold,
  fetchHouseholdMembers,
  fetchHouseholdByUserId,
  updateDietaryRestrictions,
} from '../../../features/household/useHouseholdSharing';
import { supabase } from '../../../lib/supabase/client';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

describe('joinHousehold', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates profile when valid invite code is provided', async () => {
    mockRpc.mockResolvedValue({ data: 'hh-target', error: null });

    const profileChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    profileChain.select.mockReturnValue(profileChain);
    profileChain.eq.mockReturnValue(profileChain);
    profileChain.single.mockResolvedValue({ data: { household_id: 'hh-old' }, error: null });

    const updateChain = { update: jest.fn(), eq: jest.fn() };
    updateChain.update.mockReturnValue(updateChain);
    updateChain.eq.mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(updateChain);

    const result = await joinHousehold({ inviteCode: 'abc12345', userId: 'user-1' });
    expect(result).toBe('hh-target');
    expect(mockRpc).toHaveBeenCalledWith('get_household_id_by_code', { code: 'abc12345' });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws when invite code is not found', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(joinHousehold({ inviteCode: 'bad-code', userId: 'user-1' }))
      .rejects.toThrow('Invite code not found');
  });

  it('throws when user is already in that household', async () => {
    mockRpc.mockResolvedValue({ data: 'hh-123', error: null });

    const profileChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    profileChain.select.mockReturnValue(profileChain);
    profileChain.eq.mockReturnValue(profileChain);
    profileChain.single.mockResolvedValue({ data: { household_id: 'hh-123' }, error: null });

    mockFrom.mockReturnValue(profileChain);

    await expect(joinHousehold({ inviteCode: 'abc12345', userId: 'user-1' }))
      .rejects.toThrow('Already in this household');
  });
});

describe('leaveHousehold', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates new household and updates profile, returns new household id', async () => {
    const insertChain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    insertChain.insert.mockReturnValue(insertChain);
    insertChain.select.mockReturnValue(insertChain);
    insertChain.single.mockResolvedValue({ data: { id: 'hh-new' }, error: null });

    const updateChain = { update: jest.fn(), eq: jest.fn() };
    updateChain.update.mockReturnValue(updateChain);
    updateChain.eq.mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(updateChain);

    const result = await leaveHousehold('user-1');
    expect(result).toBe('hh-new');
    expect(insertChain.insert).toHaveBeenCalledWith({ name: 'My Kitchen', created_by: 'user-1' });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws when household insert fails', async () => {
    const insertChain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    insertChain.insert.mockReturnValue(insertChain);
    insertChain.select.mockReturnValue(insertChain);
    insertChain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

    mockFrom.mockReturnValue(insertChain);

    await expect(leaveHousehold('user-1')).rejects.toThrow('Insert failed');
  });
});

describe('fetchHouseholdMembers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all profiles in the household', async () => {
    const members = [
      { id: 'u-1', display_name: 'Alice', household_id: 'hh-1', created_at: '' },
      { id: 'u-2', display_name: 'Bob', household_id: 'hh-1', created_at: '' },
    ];
    const chain = { select: jest.fn(), eq: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ data: members, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchHouseholdMembers('hh-1');
    expect(result).toHaveLength(2);
    expect(result[0].display_name).toBe('Alice');
    expect(chain.eq).toHaveBeenCalledWith('household_id', 'hh-1');
  });

  it('throws on error', async () => {
    const chain = { select: jest.fn(), eq: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchHouseholdMembers('hh-1')).rejects.toThrow('DB error');
  });
});

describe('fetchHouseholdByUserId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns household data for the user', async () => {
    const profileChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    profileChain.select.mockReturnValue(profileChain);
    profileChain.eq.mockReturnValue(profileChain);
    profileChain.single.mockResolvedValue({ data: { household_id: 'hh-1' }, error: null });

    const householdChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    householdChain.select.mockReturnValue(householdChain);
    householdChain.eq.mockReturnValue(householdChain);
    householdChain.single.mockResolvedValue({
      data: { id: 'hh-1', name: "Alice's Kitchen", invite_code: 'abc12345', created_by: 'u-1', created_at: '' },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(householdChain);

    const result = await fetchHouseholdByUserId('user-1');
    expect(result.id).toBe('hh-1');
    expect(result.invite_code).toBe('abc12345');
  });

  it('throws when profile has no household', async () => {
    const profileChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    profileChain.select.mockReturnValue(profileChain);
    profileChain.eq.mockReturnValue(profileChain);
    profileChain.single.mockResolvedValue({ data: { household_id: null }, error: null });
    mockFrom.mockReturnValue(profileChain);

    await expect(fetchHouseholdByUserId('user-1')).rejects.toThrow('No household found');
  });
});

describe('updateDietaryRestrictions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates and returns household with new restrictions', async () => {
    const updatedHousehold = {
      id: 'hh-1',
      name: 'My Kitchen',
      invite_code: 'abc123',
      created_by: 'u-1',
      created_at: '',
      dietary_restrictions: ['vegetarian', 'gluten-free'],
    };
    const chain = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    chain.update.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: updatedHousehold, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await updateDietaryRestrictions('hh-1', ['vegetarian', 'gluten-free']);
    expect(result.dietary_restrictions).toEqual(['vegetarian', 'gluten-free']);
    expect(chain.update).toHaveBeenCalledWith({ dietary_restrictions: ['vegetarian', 'gluten-free'] });
    expect(chain.eq).toHaveBeenCalledWith('id', 'hh-1');
  });

  it('updates with empty array to clear all restrictions', async () => {
    const updatedHousehold = {
      id: 'hh-1',
      name: 'My Kitchen',
      invite_code: 'abc123',
      created_by: 'u-1',
      created_at: '',
      dietary_restrictions: [],
    };
    const chain = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    chain.update.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: updatedHousehold, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await updateDietaryRestrictions('hh-1', []);
    expect(result.dietary_restrictions).toEqual([]);
  });

  it('throws on DB error', async () => {
    const chain = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    chain.update.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: null, error: { message: 'Update failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(updateDietaryRestrictions('hh-1', ['vegan'])).rejects.toThrow('Update failed');
  });
});
