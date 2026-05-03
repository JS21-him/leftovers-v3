import { supabase } from '@/src/lib/supabase/client';
import { logger } from '@/src/lib/logger';

interface HouseholdResult {
  householdId: string | null;
  error: string | null;
}

export async function useHousehold(userId: string): Promise<HouseholdResult> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (profileError) return { householdId: null, error: profileError.message };
    if (profile?.household_id) return { householdId: profile.household_id, error: null };

    // No household — create one (handles legacy test accounts)
    const { data: household, error: hhError } = await supabase
      .from('households')
      .insert({ name: "My Kitchen", created_by: userId })
      .select('id')
      .single();

    if (hhError || !household) {
      return { householdId: null, error: hhError?.message ?? 'Failed to create household' };
    }

    await supabase
      .from('profiles')
      .update({ household_id: household.id })
      .eq('id', userId);

    logger.info('Created personal household', { householdId: household.id });
    return { householdId: household.id, error: null };
  } catch (err) {
    logger.error('useHousehold failed', err);
    return { householdId: null, error: 'An unexpected error occurred' };
  }
}
