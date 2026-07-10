type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type D1PreparedStatement = {
  bind(...values: readonly unknown[]): D1PreparedStatement;
  all<TRow = unknown>(): Promise<{ readonly results?: readonly TRow[] }>;
  first<TRow = unknown>(): Promise<TRow | null>;
  run(): Promise<unknown>;
};

declare global {
  namespace App {
    interface Platform {
      readonly env?: {
        readonly GRUNTEND_DB?: D1Database;
      };
    }
  }
}

export {};
