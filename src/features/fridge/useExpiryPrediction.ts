import { useState, useEffect, useRef } from 'react';
import { lookupExpiry, daysFromNow } from '@/src/lib/expiryLookup';
import { supabase } from '@/src/lib/supabase/client';

export interface ExpiryPrediction {
  expiryDate: string | null;
  explanation: string | null;
  isLoading: boolean;
  source: 'lookup' | 'ai' | null;
}

export async function fetchExpiryPrediction(
  name: string
): Promise<{ expiryDate: string; explanation: string }> {
  const { data, error } = await supabase.functions.invoke('predict-expiry', {
    body: { name },
  });
  if (error) throw error;
  if (!data?.expiryDate || !data?.explanation) {
    throw new Error('Invalid response from predict-expiry');
  }
  return { expiryDate: data.expiryDate as string, explanation: data.explanation as string };
}

export function useExpiryPrediction(name: string): ExpiryPrediction {
  const [state, setState] = useState<ExpiryPrediction>({
    expiryDate: null,
    explanation: null,
    isLoading: false,
    source: null,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = name.trim();
    if (!trimmed) {
      setState({ expiryDate: null, explanation: null, isLoading: false, source: null });
      return () => {
        cancelRef.current = true;
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }

    debounceRef.current = setTimeout(async () => {
      const lookup = lookupExpiry(trimmed);
      if (lookup) {
        if (!cancelRef.current) {
          setState({
            expiryDate: daysFromNow(lookup.days),
            explanation: lookup.explanation,
            isLoading: false,
            source: 'lookup',
          });
        }
        return;
      }

      if (!cancelRef.current) {
        setState({ expiryDate: null, explanation: null, isLoading: true, source: null });
      }
      try {
        const result = await fetchExpiryPrediction(trimmed);
        if (!cancelRef.current) {
          setState({
            expiryDate: result.expiryDate,
            explanation: result.explanation,
            isLoading: false,
            source: 'ai',
          });
        }
      } catch (err) {
        if (!cancelRef.current) {
          setState({ expiryDate: null, explanation: null, isLoading: false, source: null });
        }
        console.error('useExpiryPrediction: AI fallback failed', err);
      }
    }, 500);

    return () => {
      cancelRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name]);

  return state;
}
