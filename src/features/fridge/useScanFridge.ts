import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { useAuthStore } from '@/src/store/auth';
import { logger } from '@/src/lib/logger';
import type { FridgeItem } from '@/src/types/database';

interface ScanParams {
  image: string;
  householdId: string;
  userId: string;
}

export async function scanReceipt(params: ScanParams): Promise<FridgeItem[]> {
  const { data, error } = await supabase.functions.invoke('scan-receipt', { body: params });
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  return data?.items ?? [];
}

export async function scanItems(params: ScanParams): Promise<FridgeItem[]> {
  const { data, error } = await supabase.functions.invoke('scan-items', { body: params });
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  return data?.items ?? [];
}

export function useScanReceipt(householdId: string | null) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (image: string) => {
      if (!householdId || !user) throw new Error('Not authenticated');
      return scanReceipt({ image, householdId, userId: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
    },
    onError: (err) => logger.error('scanReceipt failed', err),
  });
}

export function useScanItems(householdId: string | null) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (image: string) => {
      if (!householdId || !user) throw new Error('Not authenticated');
      return scanItems({ image, householdId, userId: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
    },
    onError: (err) => logger.error('scanItems failed', err),
  });
}
