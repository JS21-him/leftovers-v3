/**
 * @jest-environment node
 */
/// <reference types="jest" />

import { logger } from '../../lib/logger';

describe('logger', () => {
  it('exports info, warn, error methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('does not throw when called with message only', () => {
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });

  it('does not throw when called with message and data', () => {
    expect(() => logger.info('test', { key: 'value' })).not.toThrow();
    expect(() => logger.error('test', new Error('boom'))).not.toThrow();
  });
});
