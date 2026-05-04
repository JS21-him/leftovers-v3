import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { useAuthStore } from '@/src/store/auth';
import { logger } from '@/src/lib/logger';
import type { Household, Profile } from '@/src/types/database';

export async function fetchHouseholdByUserId(userId: string): Promise<Household> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single();
  if (profileError) throw new Error(profileError.message);
  if (!profile?.household_id) throw new Error('No household found');

  const { data: household, error: hhError } = await supabase
    .from('households')
    .select('*')
    .eq('id', profile.household_id)
    .single();
  if (hhError || !household) throw new Error(hhError?.message ?? 'Household not found');
  return household;
}

export async function fetchHouseholdMembers(householdId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function joinHousehold(params: { inviteCode: string; userId: string }): Promise<string> {
  const { data: targetId, error: rpcError } = await supabase.rpc('get_household_id_by_code', {
    code: params.inviteCode.trim(),
  });
  if (rpcError) throw new Error(rpcError.message);
  if (!targetId) throw new Error('Invite code not found');

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', params.userId)
    .single();
  if (profile?.household_id === targetId) throw new Error('Already in this household');

  const { error } = await supabase
    .from('profiles')
    .update({ household_id: targetId })
    .eq('id', params.userId);
  if (error) throw new Error(error.message);
  return targetId as string;
}

export async function leaveHousehold(userId: string): Promise<string> {
  const { data: household, error: hhError } = await supabase
    .from('households')
    .insert({ name: 'My Kitchen', created_by: userId })
    .select('id')
    .single();
  if (hhError || !household) throw new Error(hhError?.message ?? 'Failed to create household');

  const { error } = await supabase
    .from('profiles')
    .update({ household_id: household.id })
    .eq('id', userId);
  if (error) throw new Error(error.message);
  return household.id as string;
}

export function useHouseholdQuery(userId: string | null) {
  return useQuery({
    queryKey: ['household', userId],
    queryFn: () => fetchHouseholdByUserId(userId!),
    enabled: !!userId,
  });
}

export function useHouseholdMembers(householdId: string | null) {
  return useQuery({
    queryKey: ['household_members', householdId],
    queryFn: () => fetchHouseholdMembers(householdId!),
    enabled: !!householdId,
  });
}

export function useJoinHousehold(userId: string | null) {
  const queryClient = useQueryClient();
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  return useMutation({
    mutationFn: (inviteCode: string) => {
      if (!userId) throw new Error('Not authenticated');
      return joinHousehold({ inviteCode, userId });
    },
    onSuccess: (newHouseholdId) => {
      setHouseholdId(newHouseholdId);
      queryClient.clear();
    },
    onError: (err) => logger.error('joinHousehold failed', err),
  });
}

export function useLeaveHousehold(userId: string | null) {
  const queryClient = useQueryClient();
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not authenticated');
      return leaveHousehold(userId);
    },
    onSuccess: (newHouseholdId) => {
      setHouseholdId(newHouseholdId);
      queryClient.clear();
    },
    onError: (err) => logger.error('leaveHousehold failed', err),
  });
}

export async function updateDietaryRestrictions(
  householdId: string,
  restrictions: string[]
): Promise<Household> {
  const { data, error } = await supabase
    .from('households')
    .update({ dietary_restrictions: restrictions })
    .eq('id', householdId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to update dietary preferences');
  return data;
}

export function useUpdateDietaryRestrictions(
  householdId: string | null,
  userId: string | null
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (restrictions: string[]) => {
      if (!householdId) throw new Error('No household');
      return updateDietaryRestrictions(householdId, restrictions);
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['household', userId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['household'] });
      }
    },
    onError: (err) => logger.error('updateDietaryRestrictions failed', err),
  });
}
