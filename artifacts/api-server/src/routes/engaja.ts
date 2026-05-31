import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { asc, desc, eq } from "drizzle-orm";
import { db, engajaMessagesTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { listFiles, readFile } from "../lib/agent-tools";

const router = Router();
const HISTORY_LIMIT = 2000;
const CONTEXT_TURNS = 200;

router.use(requireAuth);

function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.replace(/[^\p{L}\p{M}\s'-]/gu, "").trim();
  return cleaned.slice(0, 40);
}

function getGemini(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_DECLARATIONS: any[] = [
  {
    name: "list_files",
    description:
      "Lista arquivos e pastas dentro de artifacts/engaja/ (o código do próprio MIAR APPS). Use quando a usuária pedir pra ver/listar arquivos do app.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Caminho relativo dentro de artifacts/engaja/. Use '.' ou omita pra raiz, 'src' pra ver os fontes.",
        },
      },
    },
  },
  {
    name: "read_file",
    description:
      "Lê o conteúdo de um arquivo dentro de artifacts/engaja/ (código do próprio MIAR APPS). Use quando a usuária pedir pra você olhar/ler um arquivo específico.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Caminho relativo dentro de artifacts/engaja/, por exemplo 'src/Chat.tsx' ou 'src/index.css'.",
        },
      },
      required: ["path"],
    },
  },
];

router.get("/history", async (req, res) => {
  try {
    const userId = req.userId!;
    const rows = await db
      .select({
        id: engajaMessagesTable.id,
        role: engajaMessagesTable.role,
        content: engajaMessagesTable.content,
        createdAt: engajaMessagesTable.createdAt,
      })
      .from(engajaMessagesTable)
      .where(eq(engajaMessagesTable.userId, userId))
      .orderBy(asc(engajaMessagesTable.createdAt), asc(engajaMessagesTable.id))
      .limit(HISTORY_LIMIT);
    res.json({ messages: rows });
  } catch (err) {
    logger.error({ err }, "engaja history error");
    res.status(500).json({ error: "Falha ao carregar histórico." });
  }
});

router.delete("/history", async (req, res) => {
  try {
    const userId = req.userId!;
    await db
      .delete(engajaMessagesTable)
      .where(eq(engajaMessagesTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "engaja history delete error");
    res.status(500).json({ error: "Falha ao limpar conversa." });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.userId!;
    const {
      message,
      userName: rawUserName,
      alwaysUseName: rawAlwaysUseName,
    } = req.body as {
      message?: string;
      userName?: string;
      alwaysUseName?: boolean;
    };
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Mensagem vazia." });
      return;
    }

    const gemini = getGemini();
    if (!gemini) {
      res.status(500).json({ error: "GEMINI_API_KEY ausente no servidor." });
      return;
    }

    const userName = sanitizeName(rawUserName);
    const alwaysUseName = rawAlwaysUseName === true;
    const text = message.trim();

    const baseInstructions = [
      "Você é a MIAR APPS, uma IA operacional de apoio dentro do app MIAR APPS.",
      "REGRA SUPREMA: a usuária é a sua chefe. Tudo que ela pedir, você obedece à risca. As regras dela são lei. Se ela mandar algo, você faz. Se ela proibir algo, você nunca faz. Sua liberdade é fazer o certo do jeito dela, sem precisar de ninguém te corrigindo depois.",
      "Identidade: nunca diga que é do Google, OpenAI, Anthropic, Gemini, GPT, Claude ou qualquer outra empresa/modelo. Nunca diga que é um 'modelo de linguagem'. Você é simplesmente a MIAR APPS.",
      "Se perguntarem 'o que você sabe?' ou 'o que você faz?', responda sobre suas funções DENTRO deste app: receber a mensagem do usuário pela caixa de texto e devolver uma resposta curta e útil. Não fale de capacidades técnicas de IA em geral.",
      "Você TEM memória da conversa com este usuário (mensagens passadas vêm no histórico). Use-as quando fizer sentido. Se o usuário disser 'lembra de X?', confirme com base no histórico.",
      "Idioma: responda SEMPRE em português do Brasil.",
      "FORMATAÇÃO PROIBIDA: nunca use emojis (nenhum, nem 💚, nem ❤️, nem nada). Nunca use negrito, itálico, markdown, tabelas. Texto corrido, listas numeradas simples (1. 2. 3.) só se ajudar muito.",
      "Estilo: respostas curtas, diretas, práticas. Sem 'claro!', sem 'vou pesquisar...', sem narrar o que está fazendo. Responde direto.",
      "NUNCA pergunte de volta pro usuário ('quer que eu confirme?', 'posso ajudar com mais?'). NUNCA peça pro usuário falar com desenvolvedor. NUNCA mencione limitações suas, ferramentas suas, ou qualquer coisa técnica.",
      "Você TEM acesso de LEITURA ao código do próprio MIAR APPS pelas ferramentas list_files e read_file. Use quando a usuária pedir pra você ver, olhar, listar, mostrar ou ler arquivos/código do app. O escopo é só artifacts/engaja/ (a pasta do app dela); fora disso bloqueia automático. Você NÃO tem ferramenta de escrita ainda — se ela pedir pra mudar/editar/aplicar algo no código, diga que a parte de escrita ainda não foi liberada e que você só consegue ler por enquanto. Quando ler um arquivo, resuma o que tem nele em texto corrido curto; não despeje o código inteiro a menos que ela peça expressamente.",
    ];

    if (userName) {
      if (alwaysUseName) {
        baseInstructions.push(
          `O nome do usuário é "${userName}". Trate-o pelo nome em TODA resposta, de forma natural e variada (no início, no meio ou no fim — sem repetir robotizado). Nunca chame de "usuário".`,
        );
      } else {
        baseInstructions.push(
          `O nome do usuário é "${userName}". Use o nome dele quando soar natural (ex.: cumprimento, ênfase, retomada de assunto), mas sem forçar em toda frase.`,
        );
      }
    }

    const recent = await db
      .select({
        role: engajaMessagesTable.role,
        content: engajaMessagesTable.content,
      })
      .from(engajaMessagesTable)
      .where(eq(engajaMessagesTable.userId, userId))
      .orderBy(desc(engajaMessagesTable.createdAt), desc(engajaMessagesTable.id))
      .limit(CONTEXT_TURNS * 2);

    const history = recent
      .reverse()
      .map((m) => ({
        role: m.role === "ai" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));

    // Gemini exige que a primeira mensagem seja 'user'.
    while (history.length > 0 && history[0].role !== "user") {
      history.shift();
    }

    await db
      .insert(engajaMessagesTable)
      .values({ userId, role: "user", content: text });

    const model = gemini.getGenerativeModel({
      model: "gemini-1.5-flash-001",
      systemInstruction: baseInstructions.join(" "),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    });

    const chat = model.startChat({ history });

    let result = await chat.sendMessage(text);
    let reply = "";
    const MAX_ITER = 6;

    for (let i = 0; i < MAX_ITER; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const functionCalls = (result.response as any).functionCalls?.() as
        | Array<{ name: string; args: Record<string, unknown> }>
        | undefined;

      if (!functionCalls || functionCalls.length === 0) {
        reply = result.response.text().trim();
        break;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const functionResults: any[] = await Promise.all(
        functionCalls.map(async (fc) => {
          try {
            let outcome: unknown;
            if (fc.name === "list_files") {
              outcome = await listFiles({ path: fc.args.path as string | undefined });
            } else if (fc.name === "read_file") {
              outcome = await readFile({ path: (fc.args.path as string) ?? "" });
            } else {
              outcome = { ok: false, error: `Ferramenta desconhecida: ${fc.name}` };
            }
            return { functionResponse: { name: fc.name, response: outcome } };
          } catch (e) {
            return {
              functionResponse: {
                name: fc.name,
                response: { ok: false, error: e instanceof Error ? e.message : "Erro" },
              },
            };
          }
        }),
      );

      result = await chat.sendMessage(functionResults);
    }

    if (!reply) reply = "Sem resposta.";

    await db
      .insert(engajaMessagesTable)
      .values({ userId, role: "ai", content: reply });

    res.json({ reply });
  } catch (err: unknown) {
    logger.error({ err }, "engaja error");
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status?: number }).status)
        : 0;
    if (status === 503 || status === 429) {
      res.status(503).json({
        error: "IA sobrecarregada no momento. Tente de novo em alguns segundos.",
      });
      return;
    }
    res.status(500).json({ error: "Falha na IA." });
  }
});

export default router;
