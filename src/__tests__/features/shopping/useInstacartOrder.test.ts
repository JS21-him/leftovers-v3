/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

import { requestInstacartList } from '../../../features/shopping/useInstacartOrder';
import { supabase } from '../../../lib/supabase/client';

const mockInvoke = (supabase.functions as unknown as { invoke: jest.Mock }).invoke;

describe('requestInstacartList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the url on success', async () => {
    mockInvoke.mockResolvedValue({ data: { url: 'https://instacart.com/list/abc' }, error: null });

    const url = await requestInstacartList();
    expect(url).toBe('https://instacart.com/list/abc');
    expect(mockInvoke).toHaveBeenCalledWith('create-instacart-list', { body: {} });
  });

  it('throws not_configured when the edge function response body says so', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: 'not_configured' }) },
      },
    });

    await expect(requestInstacartList()).rejects.toThrow('not_configured');
  });

  it('throws empty_list when the edge function response body says so', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: 'empty_list' }) },
      },
    });

    await expect(requestInstacartList()).rejects.toThrow('empty_list');
  });

  it('throws instacart_error when the error has no parseable context', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Network error' } });

    await expect(requestInstacartList()).rejects.toThrow('instacart_error');
  });

  it('throws instacart_error when context.json() rejects', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'boom', context: { json: async () => { throw new Error('bad body'); } } },
    });

    await expect(requestInstacartList()).rejects.toThrow('instacart_error');
  });

  it('throws instacart_error when invoke rejects outright', async () => {
    mockInvoke.mockRejectedValue(new Error('network down'));

    await expect(requestInstacartList()).rejects.toThrow('instacart_error');
  });

  it('throws instacart_error when response has no url and no error', async () => {
    mockInvoke.mockResolvedValue({ data: { unexpected: 'shape' }, error: null });

    await expect(requestInstacartList()).rejects.toThrow('instacart_error');
  });
});
