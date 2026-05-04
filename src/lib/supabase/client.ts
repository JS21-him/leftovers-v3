import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

const CHUNK_SIZE = 1800;

async function secureSetItem(key: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}_chunks`, String(chunks));
  await Promise.all(
    Array.from({ length: chunks }, (_, i) =>
      SecureStore.setItemAsync(`${key}_${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
    )
  );
}

async function secureGetItem(key: string): Promise<string | null> {
  const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
  if (!chunkCount) return SecureStore.getItemAsync(key);
  const chunks = await Promise.all(
    Array.from({ length: Number(chunkCount) }, (_, i) =>
      SecureStore.getItemAsync(`${key}_${i}`)
    )
  );
  return chunks.every((c) => c !== null) ? chunks.join('') : null;
}

async function secureRemoveItem(key: string): Promise<void> {
  const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
  if (chunkCount) {
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}_chunks`),
      ...Array.from({ length: Number(chunkCount) }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}_${i}`)
      ),
    ]);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

const storage = {
  getItem: (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return Promise.resolve(localStorage.getItem(key));
    return secureGetItem(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return Promise.resolve(); }
    return secureSetItem(key, value);
  },
  removeItem: (key: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return Promise.resolve(); }
    return secureRemoveItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
