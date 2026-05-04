import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { logger } from '@/src/lib/logger';
import type { Staple } from '@/src/types/database';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isCheckedThisWeek(lastCheckedAt: string | null): boolean {
  if (!lastCheckedAt) return false;
  return Date.now() - new Date(lastCheckedAt).getTime() < SEVEN_DAYS_MS;
}

interface AddStapleParams {
  householdId: string;
  name: string;
  quantity: string;
}

export async function fetchStaples(householdId: string): Promise<Staple[]> {
  const { data, error } = await supabase
    .from('staples')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addStaple(params: AddStapleParams): Promise<Staple> {
  const { data, error } = await supabase
    .from('staples')
    .insert({
      household_id: params.householdId,
      name: params.name.trim(),
      default_quantity: params.quantity.trim(),
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to add staple');
  return data;
}

export async function toggleStaple(params: { id: string; currentlyChecked: boolean }): Promise<void> {
  const { data, error } = await supabase
    .from('staples')
    .update({ last_checked_at: params.currentlyChecked ? null : new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Staple not found');
}

export async function deleteStaple(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('staples')
    .delete()
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Staple not found');
}

export function useStaples(householdId: string | null) {
  return useQuery({
    queryKey: ['staples', householdId],
    queryFn: () => fetchStaples(householdId!),
    enabled: !!householdId,
  });
}

export function useAddStaple(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; quantity: string }) => {
      if (!householdId) throw new Error('No household');
      return addStaple({ householdId, name: params.name, quantity: params.quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staples', householdId] });
    },
    onError: (err) => logger.error('addStaple failed', err),
  });
}

export function useToggleStaple(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleStaple,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staples', householdId] });
    },
    onError: (err) => logger.error('toggleStaple failed', err),
  });
}

export function useDeleteStaple(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStaple,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staples', householdId] });
    },
    onError: (err) => logger.error('deleteStaple failed', err),
  });
}
