export interface D1PreparedStatementLike {
  first<T = unknown>(columnName?: string): Promise<T | null>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export type WorkerBindings = {
  DB: D1DatabaseLike;
  APP_ENV: string;
  APP_VERSION: string;
  CORS_ORIGIN: string;
};
