import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { logger } from '@/src/lib/logger';
import type { FridgeItem } from '@/src/types/database';

interface AddItemParams {
  householdId: string;
  addedBy: string;
  name: string;
  quantity: string;
  expiryDate: string | null;
}

export async function fetchFridgeItems(householdId: string): Promise<FridgeItem[]> {
  const { data, error } = await supabase
    .from('fridge_items')
    .select('*')
    .eq('household_id', householdId)
    .order('expiry_date', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addFridgeItem(params: AddItemParams): Promise<FridgeItem> {
  const { data, error } = await supabase
    .from('fridge_items')
    .insert({
      household_id: params.householdId,
      added_by: params.addedBy,
      name: params.name.trim(),
      quantity: params.quantity.trim(),
      expiry_date: params.expiryDate,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFridgeItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('fridge_items')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export function useFridgeItems(householdId: string | null) {
  return useQuery({
    queryKey: ['fridge_items', householdId],
    queryFn: () => fetchFridgeItems(householdId!),
    enabled: !!householdId,
  });
}

export function useAddFridgeItem(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addFridgeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
    },
    onError: (err) => {
      logger.error('addFridgeItem failed', err);
    },
  });
}

export function useDeleteFridgeItem(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFridgeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
    },
    onError: (err) => {
      logger.error('deleteFridgeItem failed', err);
    },
  });
}
