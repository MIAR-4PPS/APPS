import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

// Raiz absoluta do projeto (workspace pnpm). Calculada a partir do cwd do api-server.
const PROJECT_ROOT = path.resolve(process.cwd(), "..", "..");
const ALLOWED_ROOT = path.join(PROJECT_ROOT, "artifacts", "psiquiatria");
const BACKUPS_ROOT = path.join(process.cwd(), "data", "miar-backups");

const BLOCKED_DIR_NAMES = new Set([
  "node_modules",
  ".expo",
  "dist",
  "build",
  ".git",
  "ios",
  "android",
]);

async function resolveSafePath(
  input: string,
): Promise<{ ok: true; abs: string } | { ok: false; error: string }> {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "Caminho vazio." };
  }
  const cleaned = input.trim().replace(/^\/+/, "");
  const candidate = path.isAbsolute(input)
    ? path.resolve(input)
    : path.resolve(ALLOWED_ROOT, cleaned);

  const rel = path.relative(ALLOWED_ROOT, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: `Fora do escopo permitido (artifacts/psiquiatria/): ${input}` };
  }
  const parts = candidate.split(path.sep);
  for (const p of parts) {
    if (BLOCKED_DIR_NAMES.has(p)) {
      return { ok: false, error: `Diretório bloqueado: ${p}` };
    }
  }
  // Bloqueia segredos comuns
  const base = path.basename(candidate);
  if (/^\.env($|\.)/.test(base) || /\.pem$|\.key$/.test(base)) {
    return { ok: false, error: `Arquivo sensível bloqueado: ${base}` };
  }
  // Anti-symlink: realpath do alvo (se existir) E do diretório pai precisam estar dentro
  try {
    const realParent = await fs.realpath(path.dirname(candidate)).catch(() => path.dirname(candidate));
    const relParent = path.relative(ALLOWED_ROOT, realParent);
    if (relParent.startsWith("..") || path.isAbsolute(relParent)) {
      return { ok: false, error: "Caminho aponta pra fora via link simbólico (pai)." };
    }
    const lst = await fs.lstat(candidate).catch(() => null);
    if (lst && lst.isSymbolicLink()) {
      return { ok: false, error: "Symlinks não são permitidos." };
    }
    if (lst) {
      const realSelf = await fs.realpath(candidate);
      const relSelf = path.relative(ALLOWED_ROOT, realSelf);
      if (relSelf.startsWith("..") || path.isAbsolute(relSelf)) {
        return { ok: false, error: "Caminho aponta pra fora via link simbólico." };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao validar caminho" };
  }
  return { ok: true, abs: candidate };
}

function relPretty(abs: string): string {
  return path.relative(PROJECT_ROOT, abs);
}

export async function readFile(input: { path: string }): Promise<
  { ok: true; content: string; path: string } | { ok: false; error: string }
> {
  const r = await resolveSafePath(input.path);
  if (!r.ok) return r;
  try {
    const stat = await fs.stat(r.abs);
    if (stat.isDirectory()) return { ok: false, error: "Caminho é uma pasta, não arquivo." };
    if (stat.size > 500_000) {
      return { ok: false, error: "Arquivo muito grande (>500KB). Não consigo ler inteiro." };
    }
    const content = await fs.readFile(r.abs, "utf8");
    return { ok: true, content, path: relPretty(r.abs) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao ler arquivo" };
  }
}

export async function listFiles(input: { path?: string }): Promise<
  | { ok: true; entries: Array<{ name: string; type: "file" | "dir" }>; path: string }
  | { ok: false; error: string }
> {
  const target = input.path ?? ".";
  const r = await resolveSafePath(target);
  if (!r.ok) return r;
  try {
    const stat = await fs.stat(r.abs);
    if (!stat.isDirectory()) return { ok: false, error: "Caminho não é pasta." };
    const entries = await fs.readdir(r.abs, { withFileTypes: true });
    const visible = entries
      .filter((e) => !e.name.startsWith(".") && !BLOCKED_DIR_NAMES.has(e.name))
      .map((e) => ({
        name: e.name,
        type: e.isDirectory() ? ("dir" as const) : ("file" as const),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return { ok: true, entries: visible, path: relPretty(r.abs) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao listar" };
  }
}

async function backupFile(
  absPath: string,
): Promise<{ ok: true; existed: boolean; backupPath?: string } | { ok: false; error: string }> {
  const exists = await fs
    .stat(absPath)
    .then(() => true)
    .catch(() => false);
  if (!exists) return { ok: true, existed: false };
  try {
    const rel = path.relative(ALLOWED_ROOT, absPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-") + "-" + process.hrtime.bigint();
    const backupPath = path.join(BACKUPS_ROOT, stamp, rel);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(absPath, backupPath);
    return { ok: true, existed: true, backupPath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro no backup" };
  }
}

export async function writeFile(input: { path: string; content: string }): Promise<
  { ok: true; path: string; bytes: number; created: boolean } | { ok: false; error: string }
> {
  const r = await resolveSafePath(input.path);
  if (!r.ok) return r;
  if (typeof input.content !== "string") {
    return { ok: false, error: "content deve ser string" };
  }
  if (input.content.length > 200_000) {
    return { ok: false, error: "Conteúdo muito grande (>200KB). Quebre em arquivos menores." };
  }
  // Backup obrigatório: se falhar, NÃO escreve.
  const back = await backupFile(r.abs);
  if (!back.ok) {
    return { ok: false, error: `Backup falhou, abortando escrita: ${back.error}` };
  }
  try {
    await fs.mkdir(path.dirname(r.abs), { recursive: true });
    await fs.writeFile(r.abs, input.content, "utf8");
    return {
      ok: true,
      path: relPretty(r.abs),
      bytes: Buffer.byteLength(input.content, "utf8"),
      created: !back.existed,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao escrever" };
  }
}

// Whitelist de comandos. Validamos por padrão estrutural, não por substring.
function buildShellCommand(input: {
  kind: "install_package" | "expo_install" | "typecheck";
  packageName?: string;
}): { ok: true; cmd: string; args: string[]; cwd: string } | { ok: false; error: string } {
  if (input.kind === "typecheck") {
    return {
      ok: true,
      cmd: "pnpm",
      args: ["--filter", "@workspace/psiquiatria", "run", "typecheck"],
      cwd: PROJECT_ROOT,
    };
  }
  const pkg = (input.packageName ?? "").trim();
  if (!/^[@a-z0-9][a-z0-9._\-/]*$/i.test(pkg)) {
    return { ok: false, error: `Nome de pacote inválido: ${pkg}` };
  }
  if (input.kind === "install_package") {
    return {
      ok: true,
      cmd: "pnpm",
      args: ["add", pkg],
      cwd: path.join(PROJECT_ROOT, "artifacts", "psiquiatria"),
    };
  }
  if (input.kind === "expo_install") {
    return {
      ok: true,
      cmd: "pnpm",
      args: ["exec", "expo", "install", pkg],
      cwd: path.join(PROJECT_ROOT, "artifacts", "psiquiatria"),
    };
  }
  return { ok: false, error: `Tipo de comando desconhecido: ${String(input.kind)}` };
}

function runShell(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignora */
      }
    }, timeoutMs);
    child.stdout.on("data", (b) => {
      stdout += b.toString();
      if (stdout.length > 50_000) stdout = stdout.slice(-50_000);
    });
    child.stderr.on("data", (b) => {
      stderr += b.toString();
      if (stderr.length > 50_000) stderr = stderr.slice(-50_000);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr + e.message, timedOut });
    });
  });
}

export async function installPackage(input: {
  packageName: string;
  isExpoPackage?: boolean;
}): Promise<
  { ok: true; output: string } | { ok: false; error: string }
> {
  const built = buildShellCommand({
    kind: input.isExpoPackage ? "expo_install" : "install_package",
    packageName: input.packageName,
  });
  if (!built.ok) return built;
  const r = await runShell(built.cmd, built.args, built.cwd, 120_000);
  if (r.timedOut) return { ok: false, error: "Instalação demorou demais (>2min)." };
  const tail = (r.stdout + "\n" + r.stderr).split("\n").slice(-15).join("\n");
  if (r.code !== 0) {
    return { ok: false, error: `Instalação falhou (exit ${r.code}):\n${tail}` };
  }
  return { ok: true, output: tail };
}

export async function typecheck(): Promise<
  { ok: true; clean: boolean; errors: string; exitCode: number | null } | { ok: false; error: string }
> {
  const built = buildShellCommand({ kind: "typecheck" });
  if (!built.ok) return built;
  const r = await runShell(built.cmd, built.args, built.cwd, 90_000);
  if (r.timedOut) return { ok: false, error: "Typecheck demorou demais." };
  const combined = r.stdout + "\n" + r.stderr;
  const errorLines = combined
    .split("\n")
    .filter((l) => /error TS/.test(l))
    .filter((l) => !/sign-in\.tsx|sign-up\.tsx/.test(l)); // ignora erros pré-existentes do Clerk
  // clean = exit 0 E nenhum "error TS" não-ignorado
  const clean = r.code === 0 && errorLines.length === 0;
  let errors = errorLines.slice(0, 30).join("\n");
  if (!clean && errorLines.length === 0 && r.code !== 0) {
    // typecheck falhou por outro motivo (ex: erro de config) — devolve tail do stderr
    errors = "Typecheck quebrou (exit " + r.code + "):\n" + combined.split("\n").slice(-20).join("\n");
  }
  return { ok: true, clean, errors, exitCode: r.code };
}
