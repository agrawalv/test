import fs from "fs/promises";
import path from "path";
import { todayIso } from "./date";

const CACHE_DIR = path.join(process.cwd(), ".cache");

type Envelope<T> = { data: T; fetchedAt: number };

const memory = new Map<string, Envelope<unknown>>();

function ttlMsFor(date: string): number {
  const today = todayIso();
  if (date === today) {
    const min = Number(process.env.CACHE_TTL_TODAY_MIN ?? 15);
    return min * 60 * 1000;
  }
  if (date < today) {
    const h = Number(process.env.CACHE_TTL_PAST_HOURS ?? 24);
    return h * 60 * 60 * 1000;
  }
  const h = Number(process.env.CACHE_TTL_FUTURE_HOURS ?? 1);
  return h * 60 * 60 * 1000;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function diskPath(key: string): string {
  const safe = key.replace(/[^a-z0-9_.-]/gi, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export type CacheResult<T> = {
  data: T;
  fetchedAt: number;
  stale: boolean;
};

export async function readCache<T>(key: string, date: string): Promise<CacheResult<T> | null> {
  const ttl = ttlMsFor(date);
  const now = Date.now();

  const inMem = memory.get(key) as Envelope<T> | undefined;
  if (inMem) {
    return { data: inMem.data, fetchedAt: inMem.fetchedAt, stale: now - inMem.fetchedAt > ttl };
  }

  try {
    const raw = await fs.readFile(diskPath(key), "utf8");
    const parsed = JSON.parse(raw) as Envelope<T>;
    memory.set(key, parsed);
    return { data: parsed.data, fetchedAt: parsed.fetchedAt, stale: now - parsed.fetchedAt > ttl };
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<number> {
  const env: Envelope<T> = { data, fetchedAt: Date.now() };
  memory.set(key, env);
  try {
    await ensureDir();
    await fs.writeFile(diskPath(key), JSON.stringify(env), "utf8");
  } catch {
    // disk cache is best-effort
  }
  return env.fetchedAt;
}
