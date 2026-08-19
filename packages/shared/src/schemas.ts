import { z } from 'zod';

export const roleSchema = z.enum(['ADMIN', 'CUSTOMER']);
export const selectionTypeSchema = z.enum(['LARGE', 'SMALL']);

export const draftSelectionSchema = z.object({
  large: z.array(z.string().min(1)).max(1),
  small: z.array(z.string().min(1)),
  version: z.number().int().nonnegative(),
});

export const healthResponseSchema = z.object({
  service: z.string(),
  version: z.string(),
  status: z.enum(['ok', 'degraded']),
  d1: z.enum(['ok', 'error']),
  environment: z.string(),
  timestamp: z.iso.datetime(),
});
