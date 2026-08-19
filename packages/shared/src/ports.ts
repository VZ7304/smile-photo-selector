export type ProjectRevision = {
  projectId: string;
  manifestRevision: string;
};

export type OriginalFileMetadata = {
  originalFileId: string;
  fileName: string;
  mimeType: string;
  size: number | null;
  md5Checksum: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
};

export interface DatabaseRepository {
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}

export interface StorageProvider {
  putImmutable(key: string, body: ArrayBuffer | ReadableStream<Uint8Array>, contentType: string): Promise<void>;
  get(key: string): Promise<Response | null>;
  deletePrefix(prefix: string): Promise<void>;
}

export interface OriginalFileProvider {
  listImages(folderId: string, cursor?: string): Promise<{ items: OriginalFileMetadata[]; nextCursor: string | null }>;
  getMetadata(originalFileId: string): Promise<OriginalFileMetadata>;
  buildAdminDirectDownloadRequest(originalFileId: string, accessToken: string): Request;
}

export interface ThumbnailProvider {
  getThumbnailRef(file: OriginalFileMetadata, width: number): Promise<string | null>;
  getPreviewRef(file: OriginalFileMetadata, width: number): Promise<string | null>;
}

export type VectorRecord = {
  id: string;
  values: readonly number[];
  metadata: { projectId: string; manifestRevision: string; imageKey: string };
};

export interface VectorStore {
  upsert(records: readonly VectorRecord[]): Promise<void>;
  query(input: {
    projectId: string;
    manifestRevision: string;
    vector: readonly number[];
    topK: number;
  }): Promise<Array<{ imageKey: string; score: number }>>;
  deleteRevision(revision: ProjectRevision): Promise<void>;
}

export interface NotificationProvider {
  notifyOrderSubmitted(input: { orderId: string; projectId: string; customerId: string }): Promise<void>;
}

export interface JobQueue {
  enqueue(input: { jobId: string; projectId: string | null; type: string }): Promise<void>;
}

export interface AuthSessionStore {
  create(input: { userId: string; tokenHash: string; expiresAt: string }): Promise<void>;
  revokeByUser(userId: string): Promise<void>;
  resolve(tokenHash: string): Promise<{ userId: string; expiresAt: string } | null>;
}
