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

import {
  fetchSavedRecipes,
  saveRecipe,
  deleteRecipe,
  suggestRecipes,
} from '../../../features/recipes/useRecipes';
import { supabase } from '../../../lib/supabase/client';

const mockFrom = supabase.from as jest.Mock;
const mockInvoke = supabase.functions.invoke as jest.Mock;

describe('fetchSavedRecipes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns saved recipes for household', async () => {
    const recipes = [
      { id: '1', household_id: 'hh-1', title: 'Pasta', ingredients: ['pasta', 'sauce'], instructions: '1. Boil', created_at: '' },
    ];
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: recipes, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchSavedRecipes('hh-1');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Pasta');
  });

  it('throws on error', async () => {
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchSavedRecipes('hh-1')).rejects.toThrow('DB error');
  });
});

describe('saveRecipe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts and returns the new recipe', async () => {
    const newRecipe = { id: '2', household_id: 'hh-1', title: 'Omelette', ingredients: ['eggs', 'butter'], instructions: '1. Whisk eggs', created_at: '' };
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: newRecipe, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await saveRecipe({ householdId: 'hh-1', title: 'Omelette', ingredients: ['eggs', 'butter'], instructions: '1. Whisk eggs' });
    expect(result.title).toBe('Omelette');
  });

  it('throws on error', async () => {
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(
      saveRecipe({ householdId: 'hh-1', title: 'Omelette', ingredients: [], instructions: '' })
    ).rejects.toThrow('Insert failed');
  });
});

describe('deleteRecipe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes recipe by id', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await expect(deleteRecipe('recipe-1')).resolves.toBeUndefined();
    expect(chain.eq).toHaveBeenCalledWith('id', 'recipe-1');
  });

  it('throws on error', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: { message: 'Delete failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(deleteRecipe('recipe-1')).rejects.toThrow('Delete failed');
  });
});

describe('suggestRecipes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns suggested recipes from edge function', async () => {
    const suggestions = [
      { title: 'Pasta', ingredients: ['pasta'], instructions: '1. Cook' },
    ];
    mockInvoke.mockResolvedValue({ data: { recipes: suggestions }, error: null });

    const result = await suggestRecipes();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Pasta');
    expect(mockInvoke).toHaveBeenCalledWith('suggest-recipes');
  });

  it('throws when edge function returns an error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Function error' } });

    await expect(suggestRecipes()).rejects.toThrow('Function error');
  });

  it('throws when data contains an error field', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'Your fridge is empty!' }, error: null });

    await expect(suggestRecipes()).rejects.toThrow('Your fridge is empty!');
  });
});
