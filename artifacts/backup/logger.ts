import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const DATA_DIR = path.resolve(process.cwd(), "data");
const APPS_FILE = path.join(DATA_DIR, "miar-apps.json");

export const todoConfigSchema = z.object({
  title: z.string().min(1).max(80),
  initialItems: z.array(z.string().min(1).max(200)).max(20).optional(),
});

export const counterConfigSchema = z.object({
  title: z.string().min(1).max(80),
  label: z.string().min(1).max(60).optional(),
  start: z.number().int().optional(),
  step: z.number().int().min(1).max(100).optional(),
});

export const notesConfigSchema = z.object({
  title: z.string().min(1).max(80),
  placeholder: z.string().max(120).optional(),
});

export const infoConfigSchema = z.object({
  title: z.string().min(1).max(80),
  sections: z
    .array(
      z.object({
        heading: z.string().max(80).optional(),
        body: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(10),
});

export const appSpecSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("todo"), config: todoConfigSchema }),
  z.object({ type: z.literal("counter"), config: counterConfigSchema }),
  z.object({ type: z.literal("notes"), config: notesConfigSchema }),
  z.object({ type: z.literal("info"), config: infoConfigSchema }),
]);

export type AppSpec = z.infer<typeof appSpecSchema>;

export const appRecordSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  emoji: z.string().max(8).optional(),
  description: z.string().max(280).optional(),
  spec: appSpecSchema,
  createdAt: z.number(),
});

export type AppRecord = z.infer<typeof appRecordSchema>;

type UserBucket = { apps: AppRecord[] };
type Store = { users: Record<string, UserBucket> };

let mutex: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutex.then(fn, fn);
  mutex = next.catch(() => undefined);
  return next;
}

async function readStoreRaw(): Promise<Store> {
  try {
    const raw = await fs.readFile(APPS_FILE, "utf8");
    const parsed = JSON.parse(raw);

    // Formato novo: { users: { [userId]: { apps: [] } } }
    if (parsed && typeof parsed.users === "object" && parsed.users) {
      const users: Record<string, UserBucket> = {};
      for (const [uid, bucket] of Object.entries(parsed.users as Record<string, unknown>)) {
        const b = bucket as { apps?: unknown };
        if (Array.isArray(b?.apps)) {
          const valid: AppRecord[] = [];
          for (const a of b.apps) {
            const r = appRecordSchema.safeParse(a);
            if (r.success) valid.push(r.data);
          }
          users[uid] = { apps: valid };
        }
      }
      return { users };
    }

    // Migração: formato antigo { apps: [] } → bucket "_legacy"
    if (parsed && Array.isArray(parsed.apps)) {
      const valid: AppRecord[] = [];
      for (const a of parsed.apps) {
        const r = appRecordSchema.safeParse(a);
        if (r.success) valid.push(r.data);
      }
      return { users: { _legacy: { apps: valid } } };
    }
  } catch {
    /* arquivo ainda não existe */
  }
  return { users: {} };
}

async function writeStoreRaw(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(APPS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function makeId(): string {
  return `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function bucketFor(store: Store, userId: string): UserBucket {
  if (!store.users[userId]) store.users[userId] = { apps: [] };
  return store.users[userId];
}

export async function listApps(userId: string): Promise<AppRecord[]> {
  return withLock(async () => {
    const store = await readStoreRaw();
    return [...(store.users[userId]?.apps ?? [])].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  });
}

export async function getApp(
  userId: string,
  id: string,
): Promise<AppRecord | null> {
  return withLock(async () => {
    const store = await readStoreRaw();
    return store.users[userId]?.apps.find((a) => a.id === id) ?? null;
  });
}

export async function createApp(
  userId: string,
  input: Omit<AppRecord, "id" | "createdAt">,
): Promise<AppRecord> {
  return withLock(async () => {
    const store = await readStoreRaw();
    const bucket = bucketFor(store, userId);
    const record: AppRecord = {
      ...input,
      id: makeId(),
      createdAt: Date.now(),
    };
    bucket.apps.push(record);
    await writeStoreRaw(store);
    return record;
  });
}

export async function deleteApp(userId: string, id: string): Promise<boolean> {
  return withLock(async () => {
    const store = await readStoreRaw();
    const bucket = store.users[userId];
    if (!bucket) return false;
    const before = bucket.apps.length;
    bucket.apps = bucket.apps.filter((a) => a.id !== id);
    if (bucket.apps.length === before) return false;
    await writeStoreRaw(store);
    return true;
  });
}
