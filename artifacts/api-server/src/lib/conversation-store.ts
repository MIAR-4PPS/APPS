import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONV_FILE = path.join(DATA_DIR, "miar-conversations.json");

// Memória infinita por login: nunca expira mensagens. Cap só pra contexto do LLM (lookback).
const MAX_HISTORY_FOR_LLM = 40;
// Cap defensivo no armazenamento por usuário (evita arquivo gigante).
// "Memória infinita por login": cap muito alto só como guarda contra disco infinito.
// Na prática, milhões de turnos antes de bater no limite.
const MAX_PERSIST_PER_USER = 1_000_000;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  ts: z.number().optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

type Store = { users: Record<string, ChatMessage[]> };

let mutex: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutex.then(fn, fn);
  mutex = next.catch(() => undefined);
  return next;
}

async function readRaw(): Promise<Store> {
  try {
    const raw = await fs.readFile(CONV_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.users === "object") {
      const users: Record<string, ChatMessage[]> = {};
      for (const [uid, msgs] of Object.entries(parsed.users as Record<string, unknown>)) {
        if (Array.isArray(msgs)) {
          const valid: ChatMessage[] = [];
          for (const m of msgs) {
            const r = chatMessageSchema.safeParse(m);
            if (r.success) valid.push(r.data);
          }
          users[uid] = valid;
        }
      }
      return { users };
    }
  } catch {
    /* arquivo ainda não existe */
  }
  return { users: {} };
}

async function writeRaw(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONV_FILE, JSON.stringify(store), "utf8");
}

export async function getAllMessages(userId: string): Promise<ChatMessage[]> {
  return withLock(async () => {
    const store = await readRaw();
    return store.users[userId] ?? [];
  });
}

export async function getRecentForLLM(userId: string): Promise<ChatMessage[]> {
  const all = await getAllMessages(userId);
  return all.slice(-MAX_HISTORY_FOR_LLM);
}

export async function appendMessages(
  userId: string,
  msgs: ChatMessage[],
): Promise<void> {
  return withLock(async () => {
    const store = await readRaw();
    const list = store.users[userId] ?? [];
    const stamped = msgs.map((m) => ({ ...m, ts: m.ts ?? Date.now() }));
    const next = list.concat(stamped);
    // Trim do mais antigo se passar do cap; o usuário ainda tem "memória" via UI/LLM-lookback,
    // mas evita arquivo crescer sem limite.
    store.users[userId] =
      next.length > MAX_PERSIST_PER_USER
        ? next.slice(next.length - MAX_PERSIST_PER_USER)
        : next;
    await writeRaw(store);
  });
}

export async function clearMessages(userId: string): Promise<void> {
  return withLock(async () => {
    const store = await readRaw();
    delete store.users[userId];
    await writeRaw(store);
  });
}
