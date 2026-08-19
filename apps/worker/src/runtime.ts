export interface D1ResultLike<T = unknown> {
  success: boolean;
  results?: T[];
  meta?: unknown;
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = unknown>(columnName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1ResultLike<T>>;
  run<T = unknown>(): Promise<D1ResultLike<T>>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<D1ResultLike<T>[]>;
}

export type WorkerBindings = {
  DB: D1DatabaseLike;
  APP_ENV: string;
  APP_VERSION: string;
  CORS_ORIGIN: string;
};
