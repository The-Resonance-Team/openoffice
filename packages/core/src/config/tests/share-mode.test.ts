import { describe, expect, test } from 'bun:test';
import { shareMode } from '../schema';

describe('shareMode', () => {
  test('defaults to disabled', () => {
    expect(shareMode({})).toBe('disabled');
  });

  test('share:auto enables auto', () => {
    expect(shareMode({ share: 'auto' })).toBe('auto');
  });

  test('legacy autoshare:true maps to auto when share is unset', () => {
    expect(shareMode({ autoshare: true })).toBe('auto');
  });

  test('explicit share wins over legacy autoshare', () => {
    expect(shareMode({ share: 'disabled', autoshare: true })).toBe('disabled');
  });
});
