import { supabase } from '@/src/lib/supabase/client';
import { logger } from '@/src/lib/logger';

export function useAuth() {
  async function signIn(email: string, password: string): Promise<string | null> {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      return null;
    } catch (err) {
      logger.error('signIn failed', err);
      return 'An unexpected error occurred';
    }
  }

  async function signUp(email: string, password: string, displayName: string): Promise<string | null> {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) return error.message;
      return null;
    } catch (err) {
      logger.error('signUp failed', err);
      return 'An unexpected error occurred';
    }
  }

  async function signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) logger.error('signOut error', error);
    } catch (err) {
      logger.error('signOut failed', err);
    }
  }

  async function resetPassword(email: string): Promise<string | null> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return error.message;
      return null;
    } catch (err) {
      logger.error('resetPassword failed', err);
      return 'An unexpected error occurred';
    }
  }

  return { signIn, signUp, signOut, resetPassword };
}
