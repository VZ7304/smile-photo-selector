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

export const createProjectSchema = z.object({
  projectName: z.string().trim().min(1).max(120),
  folderUrl: z.string().trim().min(10).max(1000),
  studentCount: z.number().int().min(1).max(500),
  selectionDeadline: z.union([z.iso.datetime(), z.literal('')]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const driveImageMetadataSchema = z.object({
  originalFileId: z.string().min(5).max(300),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().startsWith('image/').max(120),
  size: z.number().int().nonnegative().nullable(),
  md5Checksum: z.string().max(128).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdTime: z.union([z.iso.datetime(), z.null()]),
  modifiedTime: z.union([z.iso.datetime(), z.null()]),
});

export const importImageBatchSchema = z.object({
  batchStart: z.number().int().nonnegative(),
  items: z.array(driveImageMetadataSchema).max(100),
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
