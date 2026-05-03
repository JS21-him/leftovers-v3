import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  householdId: string | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setHouseholdId: (id: string | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  householdId: null,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user ?? null, householdId: null }),
  setHouseholdId: (householdId) => set({ householdId }),
  setLoading: (isLoading) => set({ isLoading }),
}));
