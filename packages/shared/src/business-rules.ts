export type SelectionType = 'LARGE' | 'SMALL';

export type SelectionState = {
  large: readonly string[];
  small: readonly string[];
};

export function getSmallLimit(studentCount: number): number | null {
  if (!Number.isInteger(studentCount) || studentCount < 0) {
    throw new Error('studentCount must be a non-negative integer');
  }
  return studentCount === 0 ? null : studentCount * 2;
}

export function validateSelection(studentCount: number, selection: SelectionState): string[] {
  const errors: string[] = [];
  const smallLimit = getSmallLimit(studentCount);
  const large = new Set(selection.large);
  const small = new Set(selection.small);

  if (large.size > 1 || selection.large.length > 1) errors.push('LARGE_MAX_1');
  if (smallLimit !== null && selection.small.length > smallLimit) errors.push('SMALL_OVER_LIMIT');
  if (selection.large.length + selection.small.length === 0) errors.push('EMPTY_SELECTION');
  if (selection.large.length !== large.size || selection.small.length !== small.size) errors.push('DUPLICATE_SELECTION');
  if ([...large].some((key) => small.has(key))) errors.push('SAME_IMAGE_DUAL_TYPE');

  return errors;
}
