/**
 * @jest-environment node
 */

jest.mock('expo-sqlite/localStorage/install', () => {});
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
    from: jest.fn(),
  })),
}));

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { supabase } from '../../../lib/supabase/client';

describe('supabase client', () => {
  it('is defined and has auth and from methods', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.auth.getSession).toBe('function');
    expect(typeof supabase.from).toBe('function');
  });
});
