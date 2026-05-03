import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { logger } from '@/src/lib/logger';
import type { ShoppingListItem } from '@/src/types/database';

interface AddItemParams {
  householdId: string;
  addedBy: string;
  name: string;
  quantity: string;
}

export async function fetchShoppingItems(householdId: string): Promise<ShoppingListItem[]> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('*')
    .eq('household_id', householdId)
    .order('is_bought', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addShoppingItem(params: AddItemParams): Promise<ShoppingListItem> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .insert({
      household_id: params.householdId,
      added_by: params.addedBy,
      name: params.name.trim(),
      quantity: params.quantity.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function toggleShoppingItem(id: string, isBought: boolean): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_items')
    .update({ is_bought: isBought })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function clearBoughtItems(householdId: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('household_id', householdId)
    .eq('is_bought', true);

  if (error) throw new Error(error.message);
}

export function useShoppingItems(householdId: string | null) {
  return useQuery({
    queryKey: ['shopping_items', householdId],
    queryFn: () => fetchShoppingItems(householdId!),
    enabled: !!householdId,
  });
}

export function useAddShoppingItem(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addShoppingItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_items', householdId] });
    },
    onError: (err) => {
      logger.error('addShoppingItem failed', err);
    },
  });
}

export function useToggleShoppingItem(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isBought }: { id: string; isBought: boolean }) =>
      toggleShoppingItem(id, isBought),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_items', householdId] });
    },
    onError: (err) => {
      logger.error('toggleShoppingItem failed', err);
    },
  });
}

export function useDeleteShoppingItem(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteShoppingItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_items', householdId] });
    },
    onError: (err) => {
      logger.error('deleteShoppingItem failed', err);
    },
  });
}

export function useClearBoughtItems(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearBoughtItems(householdId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_items', householdId] });
    },
    onError: (err) => {
      logger.error('clearBoughtItems failed', err);
    },
  });
}
