import '@testing-library/jest-native/extend-expect';

declare global {
  var __ExpoImportMetaRegistry: Map<any, any>;
  function structuredClone(obj: any): any;
}

(global as any).__DEV__ = true;

// Mock Expo's __ExpoImportMetaRegistry to avoid "import outside scope" errors
Object.defineProperty(global, '__ExpoImportMetaRegistry', {
  value: new Map(),
  writable: true,
});

// Mock structuredClone to avoid Expo trying to load it
if (typeof (global as any).structuredClone === 'undefined') {
  (global as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}
