/**
 * Emoji stripping for client previews. Ensures hearts and random emojis are removed.
 */
import { describe, it, expect } from 'vitest';
import {
  stripEmojisFromPreview,
  renderClientPreview,
} from '@/lib/strip-emojis';

describe('stripEmojisFromPreview', () => {
  it('removes hearts and common emoji symbols', () => {
    const input = 'Hello ♥ ❤️ ❣ 💕 💖 world';
    const out = stripEmojisFromPreview(input);
    expect(out).toBe('Hello world');
    expect(out).not.toMatch(/[♥❤❣💕💖]/);
  });

  it('removes random emojis (faces, symbols, etc.)', () => {
    const input = 'Report 😀 🎉 ✅ 🐕 🌟 👍';
    const out = stripEmojisFromPreview(input);
    expect(out).toBe('Report');
    expect(out).not.toMatch(/\p{Emoji}/u);
  });

  it('output has no emojis for mixed hearts and random emojis', () => {
    const input = 'Great visit ❤️ 😊 today! 🐶♥';
    const out = stripEmojisFromPreview(input);
    expect(out).toBe('Great visit today!');
    // No emoji or symbol in output
    const emojiOrHeart = /[\u2665\u2763-\u2767\u{1F493}-\u{1F49F}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{1F600}-\u{1F64F}]/u;
    expect(out).not.toMatch(emojiOrHeart);
  });

  it('normalizes whitespace and trims', () => {
    expect(stripEmojisFromPreview('  a   b  ')).toBe('a b');
  });

  it('returns empty string for non-string input', () => {
    expect(stripEmojisFromPreview(null as unknown as string)).toBe('');
    expect(stripEmojisFromPreview(undefined as unknown as string)).toBe('');
  });
});

describe('renderClientPreview', () => {
  it('strips emojis and truncates when over maxLength', () => {
    const long = 'A'.repeat(250) + ' ❤️';
    const out = renderClientPreview(long, 120);
    expect(out.length).toBeLessThanOrEqual(121);
    expect(out).not.toMatch(/❤/);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns stripped text when under maxLength', () => {
    const input = 'Short message 😀';
    expect(renderClientPreview(input)).toBe('Short message');
  });
});
