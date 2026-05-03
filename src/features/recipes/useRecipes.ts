import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { logger } from '@/src/lib/logger';
import type { SavedRecipe } from '@/src/types/database';

export interface SuggestedRecipe {
  title: string;
  ingredients: string[];
  instructions: string;
}

interface SaveRecipeParams {
  householdId: string;
  title: string;
  ingredients: string[];
  instructions: string;
}

export async function fetchSavedRecipes(householdId: string): Promise<SavedRecipe[]> {
  const { data, error } = await supabase
    .from('saved_recipes')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveRecipe(params: SaveRecipeParams): Promise<SavedRecipe> {
  const { data, error } = await supabase
    .from('saved_recipes')
    .insert({
      household_id: params.householdId,
      title: params.title,
      ingredients: params.ingredients,
      instructions: params.instructions,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_recipes')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function suggestRecipes(): Promise<SuggestedRecipe[]> {
  const { data, error } = await supabase.functions.invoke('suggest-recipes');

  // data?.error has the real message from our function even on non-2xx responses
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  return data.recipes as SuggestedRecipe[];
}

export function useSavedRecipes(householdId: string | null) {
  return useQuery({
    queryKey: ['saved_recipes', householdId],
    queryFn: () => fetchSavedRecipes(householdId!),
    enabled: !!householdId,
  });
}

export function useSaveRecipe(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved_recipes', householdId] });
    },
    onError: (err) => {
      logger.error('saveRecipe failed', err);
    },
  });
}

export function useDeleteRecipe(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved_recipes', householdId] });
    },
    onError: (err) => {
      logger.error('deleteRecipe failed', err);
    },
  });
}

export function useSuggestRecipes() {
  return useMutation({
    mutationFn: suggestRecipes,
    onError: (err) => {
      logger.error('suggestRecipes failed', err);
    },
  });
}
