import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router = Router();

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "missing",
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

router.post("/chat", async (req, res) => {
  try {
    const { message, systemPrompt, history } = req.body as {
      message: string;
      systemPrompt?: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          systemPrompt ||
          "Voce e uma assistente de psiquiatria em portugues brasileiro. Seja clara, objetiva e profissional.",
      },
      ...(history || []),
      { role: "user", content: message },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-5.1",
      messages,
      max_completion_tokens: 800,
    });

    const reply = completion.choices[0]?.message?.content || "Sem resposta.";
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "AI chat error");
    res.status(500).json({ error: "AI request failed" });
  }
});

router.post("/tts", async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const truncated = text.slice(0, 1000);

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice: "nova", format: "mp3" },
      messages: [
        {
          role: "user",
          content: truncated,
        },
      ],
    } as any);

    const audioData = (completion.choices[0]?.message as any)?.audio?.data;
    if (!audioData) {
      res.status(500).json({ error: "No audio data returned" });
      return;
    }

    res.json({ audio: audioData });
  } catch (err) {
    logger.error({ err }, "TTS error");
    res.status(500).json({ error: "TTS request failed" });
  }
});

router.post("/stt", async (req, res) => {
  try {
    const { audioUri } = req.body as { audioUri: string };
    if (!audioUri) {
      res.status(400).json({ error: "audioUri is required" });
      return;
    }

    const fetchRes = await fetch(audioUri);
    const arrayBuf = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const audioFile = new File([buffer], "recording.m4a", { type: "audio/m4a" });

    const transcription = await getOpenAI().audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file: audioFile,
      language: "pt",
    });

    res.json({ transcript: transcription.text });
  } catch (err) {
    logger.error({ err }, "STT error");
    res.status(500).json({ error: "STT request failed" });
  }
});

export default router;
