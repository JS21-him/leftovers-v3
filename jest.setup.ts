import '@testing-library/jest-native/extend-expect';

declare global {
  var __ExpoImportMetaRegistry: Map<any, any>;
  function structuredClone(obj: any): any;
}

(global as any).__DEV__ = true;

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock localStorage for web Platform path in supabase client
if (typeof (global as any).localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}

// Mock Expo's __ExpoImportMetaRegistry to avoid "import outside scope" errors
Object.defineProperty(global, '__ExpoImportMetaRegistry', {
  value: new Map(),
  writable: true,
});

// Mock structuredClone to avoid Expo trying to load it
if (typeof (global as any).structuredClone === 'undefined') {
  (global as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}
