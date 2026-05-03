/**
 * @jest-environment node
 */
/// <reference types="jest" />
import { useAuthStore } from '../../store/auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(null);
    useAuthStore.getState().setLoading(true);
  });

  it('has null session and isLoading=true initially after reset', () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('setSession updates session and user', () => {
    const mockSession = {
      user: { id: 'user-1', email: 'a@b.com' },
      access_token: 'tok',
      refresh_token: 'ref',
    } as any;

    useAuthStore.getState().setSession(mockSession);

    const state = useAuthStore.getState();
    expect(state.session).toEqual(mockSession);
    expect(state.user?.id).toBe('user-1');
  });

  it('setSession(null) clears session and user', () => {
    useAuthStore.getState().setSession(null);
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
  });

  it('setLoading(false) updates isLoading', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
