declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string, options?: { readonly create?: boolean });
    run(sql: string, ...params: unknown[]): unknown;
    query<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(sql: string): Statement<TRow, TParams>;
    transaction<TArgs extends readonly unknown[]>(fn: (...args: TArgs) => void): (...args: TArgs) => void;
  }

  export interface Statement<TRow, TParams extends readonly unknown[]> {
    all(...params: TParams): TRow[];
    get(...params: TParams): TRow | null;
    run(...params: TParams): unknown;
  }
}

declare global {
  namespace App {}
}

export {};
