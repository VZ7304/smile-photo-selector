import { z } from 'zod';

export const roleSchema = z.enum(['ADMIN', 'CUSTOMER']);
export const selectionTypeSchema = z.enum(['LARGE', 'SMALL']);

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(128),
});

export const createInitialAdminSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/),
  displayName: z.string().trim().min(1).max(100),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  password: z.string().min(10).max(128),
});

export const createCustomerSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/),
  displayName: z.string().trim().min(1).max(100),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
});

export const assignProjectSchema = z.object({
  projectId: z.string().uuid().nullable(),
});

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
