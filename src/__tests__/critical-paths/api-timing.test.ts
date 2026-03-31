import { describe, it, expect, vi } from 'vitest';
import { withTiming } from '@/lib/api-timing';

describe('API timing utility', () => {
  it('returns handler result', async () => {
    const result = await withTiming(() => Promise.resolve(42), 'test');
    expect(result).toBe(42);
  });

  it('does not warn for fast responses', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await withTiming(() => Promise.resolve('ok'), 'fast-test', 5000);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns for slow responses above threshold', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await withTiming(
      () => new Promise((resolve) => setTimeout(() => resolve('ok'), 50)),
      'slow-test',
      10 // very low threshold
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[SLOW API] slow-test'));
    warnSpy.mockRestore();
  });

  it('propagates errors from handler', async () => {
    await expect(
      withTiming(() => Promise.reject(new Error('fail')), 'error-test')
    ).rejects.toThrow('fail');
  });
});
