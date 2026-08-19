import { describe, expect, it } from 'vitest';
import { getSmallLimit, validateSelection } from './business-rules';

describe('selection business rules', () => {
  it('studentCount 0 means unlimited SMALL', () => {
    expect(getSmallLimit(0)).toBeNull();
  });

  it('SMALL limit is studentCount * 2', () => {
    expect(getSmallLimit(45)).toBe(90);
  });

  it('LARGE is optional and SMALL can be below quota', () => {
    expect(validateSelection(45, { large: [], small: ['a', 'b'] })).toEqual([]);
  });

  it('same image cannot be LARGE and SMALL', () => {
    expect(validateSelection(45, { large: ['a'], small: ['a'] })).toContain('SAME_IMAGE_DUAL_TYPE');
  });

  it('empty submit is invalid', () => {
    expect(validateSelection(45, { large: [], small: [] })).toContain('EMPTY_SELECTION');
  });
});
