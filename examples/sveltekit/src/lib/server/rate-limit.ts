import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";

export interface RateLimitContext {
  readonly platform?: App.Platform;
}

export type RateLimitResult =
  | {
      readonly allowed: true;
      readonly count: number;
      readonly limit: number;
      readonly resetAt: Date;
    }
  | {
      readonly allowed: false;
      readonly count: number;
      readonly limit: number;
      readonly resetAt: Date;
    };

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type D1PreparedStatement = {
  bind(...values: readonly unknown[]): D1PreparedStatement;
  first<TRow = unknown>(): Promise<TRow | null>;
  run(): Promise<unknown>;
};

type RateLimitRow = {
  readonly count: number;
  readonly window_start: number;
};

type MemoryCounter = {
  windowStart: number;
  count: number;
};

const WINDOW_SECONDS = 10 * 60;
const LIMIT = 5;
const memoryCounters = new Map<string, MemoryCounter>();

export async function checkAgentPlanRateLimit(input: {
  readonly ip: string;
  readonly context?: RateLimitContext;
}): Promise<RateLimitResult> {
  if (dev) {
    return {
      allowed: true,
      count: 0,
      limit: LIMIT,
      resetAt: new Date(),
    };
  }

  const windowStart = currentWindowStart();
  const key = await hashRateLimitKey(input.ip);
  const d1 = input.context?.platform?.env?.GRUNTEND_DB;

  const count = d1
    ? await incrementD1Counter(d1, key, windowStart)
    : incrementMemoryCounter(key, windowStart);

  return {
    allowed: count <= LIMIT,
    count,
    limit: LIMIT,
    resetAt: new Date((windowStart + WINDOW_SECONDS) * 1000),
  };
}

export function readClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function incrementD1Counter(
  db: D1Database,
  key: string,
  windowStart: number,
): Promise<number> {
  await ensureRateLimitTable(db);

  const existing = await db
    .prepare("SELECT count, window_start FROM agent_rate_limits WHERE key = ?")
    .bind(key)
    .first<RateLimitRow>();

  const count =
    existing?.window_start === windowStart ? existing.count + 1 : 1;

  await db
    .prepare(
      `INSERT INTO agent_rate_limits (key, window_start, count, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         window_start = excluded.window_start,
         count = excluded.count,
         updated_at = excluded.updated_at`,
    )
    .bind(key, windowStart, count, new Date().toISOString())
    .run();

  return count;
}

async function ensureRateLimitTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS agent_rate_limits (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
}

function incrementMemoryCounter(key: string, windowStart: number): number {
  const current = memoryCounters.get(key);

  if (!current || current.windowStart !== windowStart) {
    memoryCounters.set(key, { windowStart, count: 1 });
    return 1;
  }

  current.count = current.count + 1;
  return current.count;
}

function currentWindowStart(): number {
  const now = Math.floor(Date.now() / 1000);
  return now - (now % WINDOW_SECONDS);
}

async function hashRateLimitKey(ip: string): Promise<string> {
  const secret =
    env.GRUNTEND_RATE_LIMIT_SECRET || env.OPENAI_API_KEY || "local";
  const bytes = new TextEncoder().encode(`agent-plan:${secret}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `agent-plan:${hex}`;
}
