import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase/client';

export interface Suggestion {
  name: string;
  reason: string;
}

export interface ShoppingSuggestionsState {
  suggestions: Suggestion[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export async function fetchShoppingSuggestions(): Promise<Suggestion[]> {
  const { data, error } = await supabase.functions.invoke('suggest-shopping', {
    body: {},
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.suggestions)) {
    throw new Error('Invalid response from suggest-shopping');
  }
  return data.suggestions as Suggestion[];
}

export function useShoppingSuggestions(householdId: string | null): ShoppingSuggestionsState {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasGeneratedRef = useRef(false);
  const lastHouseholdIdRef = useRef<string | null>(null);
  const cancelRef = useRef(false);

  const generate = useCallback(async () => {
    if (!householdId) return;
    cancelRef.current = false;
    setIsLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await fetchShoppingSuggestions();
      if (!cancelRef.current) setSuggestions(result);
    } catch {
      if (!cancelRef.current) setError("Couldn't load suggestions. Tap to retry.");
    } finally {
      if (!cancelRef.current) setIsLoading(false);
      hasGeneratedRef.current = true;
    }
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    if (householdId !== lastHouseholdIdRef.current) {
      hasGeneratedRef.current = false;
      lastHouseholdIdRef.current = householdId;
    }
    if (hasGeneratedRef.current) return;
    generate();
    return () => { cancelRef.current = true; };
  }, [householdId, generate]);

  const refresh = useCallback(() => {
    cancelRef.current = true;
    hasGeneratedRef.current = false;
    generate();
  }, [generate]);

  return { suggestions, isLoading, error, refresh };
}
