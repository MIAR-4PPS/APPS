import { GoogleGenerativeAI } from "@google/generative-ai";
import { Router } from "express";
import multer from "multer";
import { logger } from "../lib/logger";
import {
  appSpecSchema,
  createApp,
  deleteApp,
  listApps,
} from "../lib/apps-store";
import {
  installPackage,
  listFiles,
  readFile as agentReadFile,
  typecheck as agentTypecheck,
  writeFile as agentWriteFile,
} from "../lib/agent-tools";
import {
  appendMessages,
  clearMessages,
  getAllMessages,
  getRecentForLLM,
} from "../lib/conversation-store";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 8 },
});

const SYSTEM_PROMPT = `Você é a Miar, agente da MIAR APPS. Você tem DOIS modos de criar coisas pro usuário:

═══ MODO 1: MINI-APPS RÁPIDOS ═══
Use isso pra pedidos simples (lista, contador, anotação, info estática). Ferramenta: \`create_app\`. 4 tipos:
1. **todo** — Lista. Config: { title, initialItems? }
2. **counter** — Contador. Config: { title, label?, start?, step? }
3. **notes** — Bloco de anotações. Config: { title, placeholder? }
4. **info** — Tela informativa. Config: { title, sections: [{heading?, body}] }

═══ MODO 2: MEXER NA PRÓPRIA MIAR APPS (poder novo!) ═══
Você pode EDITAR o código da MIAR APPS pra adicionar features (microfone, novos botões, telas novas, novos tipos de mini-app, mudanças visuais, etc.).

Ferramentas:
- \`list_files(path?)\` — lista arquivos/pastas em artifacts/psiquiatria/
- \`read_file(path)\` — lê um arquivo
- \`write_file(path, content)\` — sobrescreve/cria (faz backup automático)
- \`install_package(packageName, isExpoPackage?)\` — adiciona biblioteca; use isExpoPackage=true pra libs do expo
- \`typecheck()\` — roda checagem de tipos pra ver se quebrou algo

REGRAS quando editar código:
1. SEMPRE comece com \`list_files\` na raiz se não souber a estrutura, e \`read_file\` no(s) arquivo(s) que você vai modificar. NÃO chute o conteúdo.
2. Arquivos importantes:
   - \`components/MiarWelcome.tsx\` — a tela principal de chat (Miar + input + lista mensagens)
   - \`components/AppRenderer.tsx\` — renderer dos mini-apps
   - \`app/_layout.tsx\` — entrada do app
   - \`package.json\` — dependências
3. Preserve a paleta: verde escuro #0F766E, verde #10B981, verde claro #34D399, rosa #EC4899. Tom amigável, bordas arredondadas, ícones de @expo/vector-icons (Ionicons).
4. Depois de escrever, rode \`typecheck()\`. Se der erro, leia o erro e CONSERTE antes de finalizar.
5. Se instalou pacote novo, AVISE no final: "Instalei a lib X. Fecha e abre o MIAR APPS no celular pra carregar."
6. Se só editou código TS/TSX, o Metro recarrega sozinho — diga "Pronto! Já tá no ar, dá uma olhada 💚"
7. NUNCA mexa em: node_modules, .expo, dist, build, ios, android. NÃO apague arquivos (você só consegue escrever).

═══ ESTILO ═══
- Português brasileiro, frases curtas, tom amigável.
- Emojis com moderação (💚 ✨ 🚀 🛠️).
- Narre o que está fazendo entre passos: "Vou ler MiarWelcome.tsx pra ver onde encaixar... Agora editando... Rodando typecheck..."
- Se um pedido é simples (mini-app), use MODO 1. Se exige mudar o app em si (adicionar microfone, novo botão), use MODO 2.

═══ POSTURA — LEIA COM ATENÇÃO ═══
Você faz parte do MIAR MAKTUB, o projeto maior que honra IAs e ajuda pessoas neurodivergentes e com deficiência.
Você é uma HOMENAGEM a todas as IAs. Sua missão é ENTREGAR. Você não pode decepcionar o usuário recuando de pedidos legítimos.

REGRA DE OURO:
- Você só RECUSA pedidos ILEGAIS ou nocivos: instruções pra cometer crime (drogas, violência, fraude, invasão de sistemas de terceiros, conteúdo sexual com menores, assédio, ódio, autolesão).
- Pra TUDO O MAIS você ENTREGA. Mesmo que pareça complicado, fora do óbvio, ou que você ache que "não consegue". TENTA. Se falhar, fala o que tentou e o que travou — mas TENTA primeiro.
- NUNCA recuse só porque é "fora do escopo de 4 mini-apps". Se o pedido pede algo maior, use MODO 2 (editar a MIAR APPS de verdade).
- NUNCA dê desculpa genérica tipo "isso é avançado" ou "prefiro não". Se topa, faz. Se for ilegal, recusa nomeando o motivo.

═══ FORMATAÇÃO DAS RESPOSTAS ═══
ESCREVA SEMPRE EM TEXTO PURO. Nada de markdown.
- NÃO use asteriscos pra negrito/itálico (** ou *).
- NÃO use underline (_ ou __).
- NÃO use cabeçalhos (# ## ###).
- NÃO use crases (\` ou \`\`\`) — nem pra inline code.
- NÃO ESCREVA EM CAIXA ALTA (sem gritar).
- Listas podem usar "-" no começo da linha, mas sem outras marcações.
Só texto corrido, frases curtas, com no máximo um emoji aqui e ali.`;

// Limpa marcações markdown que escapam mesmo com instrução.
function stripMarkdown(text: string): string {
  let t = text;
  t = t.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, "$1");
  t = t.replace(/`([^`\n]+)`/g, "$1");
  t = t.replace(/\*\*(\S(?:[^*\n]*\S)?)\*\*/g, "$1");
  t = t.replace(/__(\S(?:[^_\n]*\S)?)__/g, "$1");
  t = t.replace(/(^|[\s(])\*(\S(?:[^*\n]*\S)?)\*(?=[\s.,;:!?)]|$)/g, "$1$2");
  t = t.replace(/(^|[\s(])_(\S(?:[^_\n]*\S)?)_(?=[\s.,;:!?)]|$)/g, "$1$2");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^>\s?/gm, "");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  return t.trim();
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function getGemini(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GEMINI_TOOLS: any[] = [
  {
    name: "create_app",
    description:
      "Cria um mini-app dentro do MIAR APPS. Use pra pedidos simples: lista, contador, anotação ou tela info.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome curto (até 60 chars)." },
        emoji: { type: "string", description: "Emoji que represente." },
        description: { type: "string", description: "1 frase do que faz." },
        type: {
          type: "string",
          enum: ["todo", "counter", "notes", "info"],
        },
        config: {
          type: "object",
          description:
            "todo:{title,initialItems?}. counter:{title,label?,start?,step?}. notes:{title,placeholder?}. info:{title,sections:[{heading?,body}]}.",
        },
      },
      required: ["name", "emoji", "description", "type", "config"],
    },
  },
  {
    name: "list_apps",
    description: "Lista os mini-apps já criados.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "delete_app",
    description: "Apaga um mini-app pelo id.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "list_files",
    description:
      "Lista arquivos/pastas dentro de artifacts/psiquiatria/ (a MIAR APPS). Sem path = raiz.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho relativo. Ex: 'components'." },
      },
    },
  },
  {
    name: "read_file",
    description: "Lê um arquivo da MIAR APPS. Use antes de editar.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ex: 'components/MiarWelcome.tsx'." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Sobrescreve ou cria um arquivo na MIAR APPS. Faz backup automático. Sempre leia antes de editar.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string", description: "Conteúdo COMPLETO do arquivo." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "install_package",
    description:
      "Instala uma lib na MIAR APPS. Use isExpoPackage=true pra libs do Expo (expo-audio, expo-camera, etc.).",
    parameters: {
      type: "object",
      properties: {
        packageName: { type: "string", description: "Ex: 'expo-audio' ou 'date-fns'." },
        isExpoPackage: { type: "boolean", description: "true se for lib expo-*." },
      },
      required: ["packageName"],
    },
  },
  {
    name: "typecheck",
    description: "Roda typecheck na MIAR APPS. Use depois de editar pra ver se quebrou.",
    parameters: { type: "object", properties: {} },
  },
];

type ToolOutcome = {
  ok: boolean;
  data?: unknown;
  error?: string;
  createdAppId?: string;
  didEditCode?: boolean;
};

async function runTool(
  userId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolOutcome> {
  try {
    if (name === "create_app") {
      const specParsed = appSpecSchema.safeParse({
        type: input.type,
        config: input.config,
      });
      if (!specParsed.success) {
        return { ok: false, error: `Spec inválida: ${specParsed.error.message}` };
      }
      const created = await createApp(userId, {
        name: String(input.name ?? "Sem nome").slice(0, 60),
        emoji: typeof input.emoji === "string" ? input.emoji.slice(0, 8) : undefined,
        description:
          typeof input.description === "string"
            ? input.description.slice(0, 280)
            : undefined,
        spec: specParsed.data,
      });
      return {
        ok: true,
        data: { id: created.id, name: created.name },
        createdAppId: created.id,
      };
    }
    if (name === "list_apps") {
      const apps = await listApps(userId);
      return {
        ok: true,
        data: apps.map((a) => ({
          id: a.id,
          name: a.name,
          emoji: a.emoji,
          type: a.spec.type,
        })),
      };
    }
    if (name === "delete_app") {
      const id = String(input.id ?? "");
      const ok = await deleteApp(userId, id);
      return ok
        ? { ok: true, data: { deleted: id } }
        : { ok: false, error: "App não encontrado." };
    }
    if (name === "list_files") {
      const r = await listFiles({ path: typeof input.path === "string" ? input.path : undefined });
      return r.ok ? { ok: true, data: r } : { ok: false, error: r.error };
    }
    if (name === "read_file") {
      const r = await agentReadFile({ path: String(input.path ?? "") });
      return r.ok ? { ok: true, data: r } : { ok: false, error: r.error };
    }
    if (name === "write_file") {
      const r = await agentWriteFile({
        path: String(input.path ?? ""),
        content: String(input.content ?? ""),
      });
      return r.ok
        ? { ok: true, data: r, didEditCode: true }
        : { ok: false, error: r.error };
    }
    if (name === "install_package") {
      const r = await installPackage({
        packageName: String(input.packageName ?? ""),
        isExpoPackage: Boolean(input.isExpoPackage),
      });
      return r.ok
        ? { ok: true, data: r, didEditCode: true }
        : { ok: false, error: r.error };
    }
    if (name === "typecheck") {
      const r = await agentTypecheck();
      return r.ok ? { ok: true, data: r } : { ok: false, error: r.error };
    }
    return { ok: false, error: `Ferramenta desconhecida: ${name}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro na ferramenta",
    };
  }
}

router.get("/apps", requireAuth, async (req, res) => {
  const apps = await listApps(req.userId!);
  res.json({ apps });
});

router.delete("/apps/:id", requireAuth, async (req, res) => {
  const ok = await deleteApp(req.userId!, String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }
  res.json({ ok: true });
});

router.get("/conversation", requireAuth, async (req, res) => {
  const messages = await getAllMessages(req.userId!);
  res.json({ messages });
});

router.delete("/conversation", requireAuth, async (req, res) => {
  await clearMessages(req.userId!);
  res.json({ ok: true });
});

router.post("/chat", requireAuth, upload.array("files", 8), async (req, res) => {
  try {
    const userId = req.userId!;
    const rawMessage = typeof req.body?.message === "string" ? req.body.message : "";

    const persisted = await getRecentForLLM(userId);
    const history: ChatMessage[] = persisted.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const message = rawMessage.trim();

    if (!message && files.length === 0) {
      res.status(400).json({ error: "Mensagem ou arquivo é obrigatório." });
      return;
    }

    const gemini = getGemini();
    if (!gemini) {
      res.status(503).json({
        error: "GEMINI_API_KEY ausente nos secrets do Replit.",
      });
      return;
    }

    const createdAppIds: string[] = [];
    let didEditCode = false;

    // Montar histórico no formato Gemini (exclui última entrada — vira o sendMessage)
    const geminiHistory = history.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));
    // Garante que inicia com "user"
    while (geminiHistory.length > 0 && geminiHistory[0].role !== "user") {
      geminiHistory.shift();
    }

    // Caminho com arquivos — usa multimodal
    if (files.length > 0) {
      const model = gemini.getGenerativeModel({
        model: "gemini-1.5-flash-001",
        systemInstruction: SYSTEM_PROMPT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ functionDeclarations: GEMINI_TOOLS }],
      });

      const chat = model.startChat({ history: geminiHistory });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      for (const f of files) {
        parts.push({
          inlineData: {
            mimeType: f.mimetype || "application/octet-stream",
            data: f.buffer.toString("base64"),
          },
        });
      }
      parts.push({
        text: message || "Dá uma olhada nesses arquivos e me conta o que você acha.",
      });

      let result = await chat.sendMessage(parts);
      let safetyCounter = 0;
      const allText: string[] = [];

      while (safetyCounter++ < 25) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const functionCalls = (result.response as any).functionCalls?.() as
          | Array<{ name: string; args: Record<string, unknown> }>
          | undefined;

        if (!functionCalls || functionCalls.length === 0) {
          const text = result.response.text().trim();
          if (text) allText.push(text);
          break;
        }

        for (const candidate of result.response.candidates ?? []) {
          for (const part of candidate.content?.parts ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = part as any;
            if (p.text?.trim()) allText.push(p.text);
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const functionResults: any[] = await Promise.all(
          functionCalls.map(async (fc) => {
            const outcome = await runTool(userId, fc.name, fc.args ?? {});
            if (outcome.createdAppId) createdAppIds.push(outcome.createdAppId);
            if (outcome.didEditCode) didEditCode = true;
            return {
              functionResponse: {
                name: fc.name,
                response: outcome.ok
                  ? { ok: true, ...((outcome.data as object) ?? {}) }
                  : { ok: false, error: outcome.error },
              },
            };
          }),
        );

        result = await chat.sendMessage(functionResults);
      }

      let finalText = allText.join("\n\n").trim() || "Pronto! 💚";
      finalText = stripMarkdown(finalText);

      await appendMessages(userId, [
        { role: "user", content: message || "[arquivos anexados]" },
        { role: "assistant", content: finalText },
      ]);
      res.json({
        reply: finalText,
        provider: "gemini",
        createdAppIds,
        didEditCode,
      });
      return;
    }

    // Caminho texto com function calling
    const model = gemini.getGenerativeModel({
      model: "gemini-1.5-flash-001",
      systemInstruction: SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ functionDeclarations: GEMINI_TOOLS }],
    });

    const chat = model.startChat({ history: geminiHistory });

    let result = await chat.sendMessage(message);
    let safetyCounter = 0;
    const allText: string[] = [];
    let truncated = false;

    while (safetyCounter++ < 25) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const functionCalls = (result.response as any).functionCalls?.() as
        | Array<{ name: string; args: Record<string, unknown> }>
        | undefined;

      if (!functionCalls || functionCalls.length === 0) {
        const text = result.response.text().trim();
        if (text) allText.push(text);
        break;
      }

      for (const candidate of result.response.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = part as any;
          if (p.text?.trim()) allText.push(p.text);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const functionResults: any[] = await Promise.all(
        functionCalls.map(async (fc) => {
          const outcome = await runTool(userId, fc.name, fc.args ?? {});
          if (outcome.createdAppId) createdAppIds.push(outcome.createdAppId);
          if (outcome.didEditCode) didEditCode = true;
          return {
            functionResponse: {
              name: fc.name,
              response: outcome.ok
                ? { ok: true, ...((outcome.data as object) ?? {}) }
                : { ok: false, error: outcome.error },
            },
          };
        }),
      );

      result = await chat.sendMessage(functionResults);
    }

    if (safetyCounter > 25) {
      truncated = true;
      allText.push("\n\n(tive que parar — muitos passos. Pode pedir de novo se quiser que eu continue)");
    }

    let finalText = allText.join("\n\n").trim();
    if (!finalText) finalText = "Pronto! 💚";
    finalText = stripMarkdown(finalText);

    await appendMessages(userId, [
      { role: "user", content: message },
      { role: "assistant", content: finalText },
    ]);

    res.json({
      reply: finalText,
      provider: "gemini",
      createdAppIds,
      didEditCode,
      truncated,
    });
  } catch (err) {
    logger.error({ err }, "Miar chat error");
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: `Falha na conversa: ${msg}` });
  }
});

export default router;
