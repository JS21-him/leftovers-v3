/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { useAuth } from '../../../features/auth/useAuth';
import { supabase } from '../../../lib/supabase/client';

const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockResetPassword = supabase.auth.resetPasswordForEmail as jest.Mock;

describe('useAuth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('signIn returns null on success', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const { signIn } = useAuth();
    const result = await signIn('a@b.com', 'pass123');
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass123' });
    expect(result).toBeNull();
  });

  it('signIn returns error message on failure', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const { signIn } = useAuth();
    const result = await signIn('a@b.com', 'wrong');
    expect(result).toBe('Invalid login credentials');
  });

  it('signUp calls supabase with display_name in data', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const { signUp } = useAuth();
    await signUp('a@b.com', 'pass123', 'Jesse');
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pass123',
      options: { data: { display_name: 'Jesse' } },
    });
  });

  it('signUp returns null on success', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const { signUp } = useAuth();
    const result = await signUp('a@b.com', 'pass123', 'Jesse');
    expect(result).toBeNull();
  });

  it('signOut calls supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    const { signOut } = useAuth();
    await signOut();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('resetPassword returns null on success', async () => {
    mockResetPassword.mockResolvedValue({ error: null });
    const { resetPassword } = useAuth();
    const result = await resetPassword('a@b.com');
    expect(mockResetPassword).toHaveBeenCalledWith('a@b.com');
    expect(result).toBeNull();
  });

  it('resetPassword returns error message on failure', async () => {
    mockResetPassword.mockResolvedValue({ error: { message: 'User not found' } });
    const { resetPassword } = useAuth();
    const result = await resetPassword('notreal@b.com');
    expect(result).toBe('User not found');
  });
});
