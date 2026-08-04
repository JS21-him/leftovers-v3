import { useState, useCallback } from 'react';
import { Linking } from 'react-native';
import { supabase } from '@/src/lib/supabase/client';

export type InstacartOrderError = 'not_configured' | 'empty_list' | 'instacart_error';

async function extractTypedError(error: unknown): Promise<InstacartOrderError | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!context?.json) return null;
  try {
    const body = (await context.json()) as { error?: string };
    if (body?.error === 'not_configured' || body?.error === 'empty_list') {
      return body.error;
    }
  } catch {
    // unparseable body — fall back to generic error
  }
  return null;
}

export async function requestInstacartList(): Promise<string> {
  let data: { url?: string } | null;
  let error: unknown;
  try {
    ({ data, error } = await supabase.functions.invoke('create-instacart-list', { body: {} }));
  } catch {
    throw new Error('instacart_error');
  }

  if (error) {
    const typed = await extractTypedError(error);
    throw new Error(typed ?? 'instacart_error');
  }

  if (!data?.url) throw new Error('instacart_error');
  return data.url;
}

export interface InstacartOrderState {
  orderViaInstacart: () => Promise<void>;
  isLoading: boolean;
  error: InstacartOrderError | null;
}

export function useInstacartOrder(): InstacartOrderState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<InstacartOrderError | null>(null);

  const orderViaInstacart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = await requestInstacartList();
      await Linking.openURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'instacart_error';
      setError(message === 'not_configured' || message === 'empty_list' ? message : 'instacart_error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { orderViaInstacart, isLoading, error };
}
