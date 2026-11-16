import postgres from "postgres";
import { BookingError } from "./domain";
type Param = string | number | null;
export type BookingQuery = (
  sql: string,
  params?: Param[],
) => Promise<Record<string, unknown>[]>;
export type BookingDatabase = {
  query: BookingQuery;
  transaction: <T>(fn: (query: BookingQuery) => Promise<T>) => Promise<T>;
};
let database: BookingDatabase | undefined, ready: Promise<void> | undefined;
export function bookingStorageConfigured() {
  return Boolean(
    process.env.DATABASE_URL ||
    (!process.env.VERCEL && process.env.BOOKING_LOCAL_SQLITE),
  );
}
let initializing: Promise<BookingDatabase> | undefined;
export function bookingDatabase(): Promise<BookingDatabase> {
  if (!initializing)
    initializing = initializeBookingDatabase().catch((error) => {
      initializing = undefined;
      throw error;
    });
  return initializing;
}
async function initializeBookingDatabase(): Promise<BookingDatabase> {
  if (database) {
    await ready;
    return database;
  }
  if (process.env.DATABASE_URL) {
    const sql = postgres(process.env.DATABASE_URL, {
      max: 2,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    database = {
      query: async (text, params = []) =>
        Array.from(await sql.unsafe(text, params)),
      transaction: async (fn) => {
        const result = await sql.begin(async (tx) =>
          fn(async (text, params = []) =>
            Array.from(await tx.unsafe(text, params)),
          ),
        );
        return result as Awaited<ReturnType<typeof fn>>;
      },
    };
  } else if (!process.env.VERCEL && process.env.BOOKING_LOCAL_SQLITE) {
    // Local integration tests/development only. Vercel always requires durable shared Postgres.
    const { DatabaseSync } = await import("node:sqlite");
    const local = new DatabaseSync(process.env.BOOKING_LOCAL_SQLITE);
    local.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    let tail: Promise<unknown> = Promise.resolve();
    const raw: BookingQuery = async (text, params = []) => {
      const statement = local.prepare(
        text.replace(/\$\d+/g, "?").replace(/ FOR UPDATE/g, ""),
      );
      return /^(SELECT|.*RETURNING)/is.test(text)
        ? (statement.all(...params) as Record<string, unknown>[])
        : (statement.run(...params), []);
    };
    const exclusive = <T>(fn: () => Promise<T>) => {
      const next = tail.then(fn, fn);
      tail = next.catch(() => undefined);
      return next;
    };
    database = {
      query: (text, params) => exclusive(() => raw(text, params)),
      transaction: (fn) =>
        exclusive(async () => {
          local.exec("BEGIN IMMEDIATE");
          try {
            const result = await fn(raw);
            local.exec("COMMIT");
            return result;
          } catch (e) {
            local.exec("ROLLBACK");
            throw e;
          }
        }),
    };
  } else
    throw new BookingError(
      "Online bookings are not set up yet. Please contact the business.",
      503,
    );
  const db = database;
  ready = (async () => {
    for (const sql of [
      "CREATE TABLE IF NOT EXISTS adventure_booking_sites (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, data TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS adventure_customer_bookings (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, site_id TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE, input_hash TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, has_invoice INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, data TEXT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS adventure_booking_queue_idx ON adventure_customer_bookings (site_id, created_at)",
      "CREATE INDEX IF NOT EXISTS adventure_booking_receipt_idx ON adventure_customer_bookings (has_invoice, updated_at, id)",
      "CREATE TABLE IF NOT EXISTS adventure_booking_payments (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, input_hash TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS adventure_booking_throttle (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at BIGINT NOT NULL)",
    ])
      await db.query(sql);
  })();
  try {
    await ready;
  } catch (e) {
    database = undefined;
    ready = undefined;
    throw e;
  }
  return db;
}
