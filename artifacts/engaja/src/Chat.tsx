import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useAuth, useClerk, useUser } from "@clerk/react";

type Msg = { id: number | string; role: "user" | "ai"; text: string };

const WELCOME_KEY = "miar.welcomeSeen.v1";
const ALWAYS_NAME_KEY = "miar.alwaysUseName.v1";
const VOICE_AUTO_KEY = "miar.voiceAuto.v1";
const VOICE_RATE_KEY = "miar.voiceRate.v1";
const MASCOT = `${import.meta.env.BASE_URL}mascot.png`;
const VISIBLE_INITIAL = 50;
const VISIBLE_STEP = 50;
const SILENCE_MS = 7000;

// Tipos mínimos pra Web Speech API (não vem no lib.dom).
interface SRResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((ev: { results: ArrayLike<SRResult>; resultIndex: number }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
}
type SRCtor = new () => SRInstance;
function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// Estilo WhatsApp: *palavra* vira negrito. Só um asterisco de cada lado.
function renderBubble(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={`b${key++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

export default function Chat() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const { getToken, isLoaded: authLoaded, isSignedIn } = useAuth();
  const [showWelcome, setShowWelcome] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem(WELCOME_KEY),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_INITIAL);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [alwaysUseName, setAlwaysUseName] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(ALWAYS_NAME_KEY) === "1",
  );
  const [voiceAuto, setVoiceAuto] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(VOICE_AUTO_KEY) === "1",
  );
  const [voiceRate, setVoiceRate] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const raw = localStorage.getItem(VOICE_RATE_KEY);
    const n = raw ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n)) return 1;
    return Math.max(0.5, Math.min(3, n));
  });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(0);
  const recognitionRef = useRef<SRInstance | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const seenFinalsRef = useRef<Set<number>>(new Set());
  const interimRef = useRef("");
  const messageRef = useRef("");
  const sendRef = useRef<((text?: string) => void) | null>(null);
  const lastSpokenIdRef = useRef<string | number | null>(null);
  const voiceRateRef = useRef(voiceRate);
  useEffect(() => {
    voiceRateRef.current = voiceRate;
  }, [voiceRate]);
  useEffect(() => {
    messageRef.current = message;
  }, [message]);
  useEffect(() => {
    interimRef.current = interim;
  }, [interim]);

  const firstName =
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const authedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getToken();
      const headers = new Headers(init.headers || {});
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("Content-Type"))
        headers.set("Content-Type", "application/json");
      return fetch(path, { ...init, headers });
    },
    [getToken],
  );

  // Carrega histórico — só roda DEPOIS que o Clerk confirmou sessão pronta.
  // Sem isso, o fetch sai sem token, server devolve 401, e a tela fica
  // vazia mesmo com mensagens no banco. Refaz se o usuário deslogar+logar.
  const userInteractedRef = useRef(false);
  useEffect(() => {
    if (!authLoaded) return;
    if (!isSignedIn) {
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    (async () => {
      try {
        const res = await authedFetch("/api/engaja/history");
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages: { id: number; role: "user" | "ai"; content: string }[];
        };
        if (cancelled || userInteractedRef.current) return;
        const mapped: Msg[] = data.messages.map((m) => ({
          id: `db-${m.id}`,
          role: m.role,
          text: m.content,
        }));
        // Marca a última msg da IA como "já falada" pra não disparar TTS no boot.
        const lastAi = [...mapped].reverse().find((m) => m.role === "ai");
        if (lastAi) lastSpokenIdRef.current = lastAi.id;
        setMessages(mapped);
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, authLoaded, isSignedIn]);

  function dismissWelcome() {
    localStorage.setItem(WELCOME_KEY, "1");
    setShowWelcome(false);
    setTimeout(() => taRef.current?.focus(), 250);
  }

  const stopSpeaking = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignora */
    }
    setSpeaking(false);
  }, []);

  function clearSilenceTimer() {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  const finishListening = useCallback(() => {
    clearSilenceTimer();
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* ignora */
    }
    const spoken = (transcriptRef.current + " " + interimRef.current)
      .replace(/\s+/g, " ")
      .trim();
    transcriptRef.current = "";
    interimRef.current = "";
    setInterim("");
    setListening(false);
    if (spoken) {
      const combined = (messageRef.current
        ? messageRef.current + " " + spoken
        : spoken
      )
        .replace(/\s+/g, " ")
        .trim();
      setMessage("");
      void sendRef.current?.(combined);
    }
  }, []);

  function cancelListening() {
    clearSilenceTimer();
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.abort();
    } catch {
      /* ignora */
    }
    transcriptRef.current = "";
    setInterim("");
    setListening(false);
  }

  function resetSilenceTimer() {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      finishListening();
    }, SILENCE_MS);
  }

  function startListening() {
    if (loading || listening) return;
    const SR = getSR();
    if (!SR) {
      setError(
        "O seu navegador não tem reconhecimento de voz. Tenta abrir no Chrome do celular.",
      );
      return;
    }
    stopSpeaking();
    try {
      const rec = new SR();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      transcriptRef.current = "";
      seenFinalsRef.current = new Set();
      setInterim("");
      rec.onresult = (ev) => {
        // Cada navegador trata 'continuous' diferente:
        // - Chrome desktop: cada final é um pedaço novo (acumular)
        // - Chrome Android: cada final pode ser cumulativo (substituir)
        // Dedupe por índice + se o novo começa com o anterior, substitui.
        let allInterim = "";
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) {
            if (!seenFinalsRef.current.has(i)) {
              seenFinalsRef.current.add(i);
              const piece = r[0].transcript.replace(/\s+/g, " ").trim();
              if (!piece) continue;
              const current = transcriptRef.current;
              if (
                current &&
                piece.toLowerCase().startsWith(current.toLowerCase())
              ) {
                transcriptRef.current = piece;
              } else {
                transcriptRef.current = (current
                  ? current + " " + piece
                  : piece
                )
                  .replace(/\s+/g, " ")
                  .trim();
              }
            }
          } else {
            allInterim += " " + r[0].transcript;
          }
        }
        const interimClean = allInterim.replace(/\s+/g, " ").trim();
        interimRef.current = interimClean;
        setInterim(interimClean);
        resetSilenceTimer();
      };
      rec.onerror = (ev) => {
        if (ev.error === "no-speech" || ev.error === "aborted") return;
        setError("Não consegui ouvir. Talvez precise permitir o microfone.");
        cancelListening();
      };
      rec.onend = () => {
        // Se ainda estiver no estado listening (parou sozinho), encerra.
        if (recognitionRef.current === rec) {
          finishListening();
        }
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      resetSilenceTimer();
    } catch {
      setError("Não consegui ligar o microfone. Talvez precise dar permissão.");
    }
  }

  function toggleVoiceAuto() {
    setVoiceAuto((v) => {
      const next = !v;
      localStorage.setItem(VOICE_AUTO_KEY, next ? "1" : "0");
      if (!next) stopSpeaking();
      return next;
    });
  }

  function changeRate(r: number) {
    const clamped = Math.max(0.5, Math.min(3, Math.round(r * 10) / 10));
    setVoiceRate(clamped);
    localStorage.setItem(VOICE_RATE_KEY, String(clamped));
  }

  // Cleanup geral ao desmontar (signOut, troca de página).
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignora */
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignora */
      }
    };
  }, []);

  // Pré-carrega vozes (Chrome carrega async).
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
    };
  }, []);

  // Fala automática: quando chega mensagem nova da Miar e o voiceAuto tá on.
  useEffect(() => {
    if (!voiceAuto) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "ai") return;
    if (lastSpokenIdRef.current === last.id) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const clean = last.text.replace(/\*/g, "").trim();
    if (!clean) return;
    lastSpokenIdRef.current = last.id;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "pt-BR";
    u.rate = Math.max(0.5, Math.min(3, voiceRateRef.current));
    const voices = synth.getVoices();
    const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
    const female = ptVoices.find((v) =>
      /female|fem|luciana|francisca|joana|maria|camila|fernanda|paulina|raquel|vit[óo]ria/i.test(
        v.name,
      ),
    );
    const chosen = female || ptVoices[0];
    if (chosen) u.voice = chosen;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    try {
      synth.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, [messages, voiceAuto]);

  function toggleAlwaysName() {
    setAlwaysUseName((v) => {
      const next = !v;
      localStorage.setItem(ALWAYS_NAME_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function clearConversation() {
    if (loading) return;
    const ok = window.confirm(
      "Apagar todo o histórico desta conversa? Não dá pra desfazer.",
    );
    if (!ok) return;
    setMenuOpen(false);
    userInteractedRef.current = true;
    stopSpeaking();
    lastSpokenIdRef.current = null;
    try {
      const res = await authedFetch("/api/engaja/history", { method: "DELETE" });
      if (res.ok) {
        setMessages([]);
        setVisibleCount(VISIBLE_INITIAL);
      } else setError("Não consegui limpar a conversa. Tenta de novo.");
    } catch {
      setError("Sem conexão. Tenta de novo.");
    }
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? message).trim();
    if (!text || loading) return;
    if (listening && overrideText === undefined) finishListening();
    stopSpeaking();
    userInteractedRef.current = true;
    const userMsg: Msg = { id: ++idRef.current, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const res = await authedFetch("/api/engaja", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          userName: firstName,
          alwaysUseName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Erro ao chamar a IA.");
      } else {
        setMessages((m) => [
          ...m,
          { id: ++idRef.current, role: "ai", text: data.reply || "" },
        ]);
      }
    } catch {
      setError("Sem conexão. Verifique sua internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    sendRef.current = (t?: string) => {
      void send(t);
    };
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // No celular (touch), Enter pula linha — só o botão envia.
    // No desktop (mouse/teclado físico), Enter envia e Shift+Enter pula linha.
    const isTouch =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="app">
      {showWelcome && (
        <div className="welcome" role="dialog" aria-modal="true">
          <div className="welcome-card">
            <div className="welcome-blob" />
            <img
              src={MASCOT}
              alt="Miar"
              className="welcome-mascot"
              draggable={false}
            />
            <h1 className="welcome-title">
              Oi{firstName ? `, ${firstName}` : ""}! Eu sou a{" "}
              <span>Miar</span>
            </h1>
            <p className="welcome-sub">
              Sua IA de apoio operacional. Me manda uma pergunta, um pedido ou
              só desabafa — eu respondo curtinho e direto.
            </p>
            <button className="welcome-btn" onClick={dismissWelcome}>
              Começar
            </button>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <div className="avatar">
            <img src={MASCOT} alt="" draggable={false} />
            <span className="dot" />
          </div>
          <div className="brand-text">
            <div className="brand-title">MIAR APPS</div>
            <div className="brand-sub">
              {loading ? "digitando…" : "online"}
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="apps-btn"
            onClick={() => setAppsOpen(true)}
            aria-label="Meus aplicativos"
            title="Meus aplicativos"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor" />
              <rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" />
              <rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" />
              <rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor" />
            </svg>
          </button>

          <div className="user-menu">
          <button
            type="button"
            className="user-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Conta"
          >
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" />
            ) : (
              <span className="user-initial">
                {(firstName[0] || "U").toUpperCase()}
              </span>
            )}
          </button>
          {menuOpen && (
            <>
              <div
                className="menu-backdrop"
                onClick={() => setMenuOpen(false)}
              />
              <div className="menu" role="menu">
                <div className="menu-header">
                  <div className="menu-name">{firstName || "Você"}</div>
                  <div className="menu-email">
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="menu-item menu-toggle"
                  onClick={toggleAlwaysName}
                  role="menuitemcheckbox"
                  aria-checked={alwaysUseName}
                >
                  <span>Me chamar pelo nome sempre</span>
                  <span
                    className={`switch ${alwaysUseName ? "on" : ""}`}
                    aria-hidden="true"
                  >
                    <span className="knob" />
                  </span>
                </button>
                <button
                  type="button"
                  className="menu-item menu-toggle"
                  onClick={toggleVoiceAuto}
                  role="menuitemcheckbox"
                  aria-checked={voiceAuto}
                >
                  <span>Voz alta automática</span>
                  <span
                    className={`switch ${voiceAuto ? "on" : ""}`}
                    aria-hidden="true"
                  >
                    <span className="knob" />
                  </span>
                </button>
                <div className="menu-speed">
                  <div className="menu-speed-label">
                    <span>Velocidade da voz</span>
                    <span className="menu-speed-value">
                      {voiceRate.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={voiceRate}
                    onChange={(e) => changeRate(parseFloat(e.target.value))}
                    className="menu-speed-slider"
                    aria-label="Velocidade da voz da Miar"
                  />
                </div>
                <button
                  type="button"
                  className="menu-item"
                  onClick={clearConversation}
                >
                  Limpar conversa
                </button>
                <button
                  type="button"
                  className="menu-item menu-danger"
                  onClick={() =>
                    signOut({
                      redirectUrl:
                        import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
                    })
                  }
                >
                  Sair
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </header>

      {appsOpen && (
        <div className="apps-overlay" role="dialog" aria-modal="true">
          <div className="apps-sheet">
            <header className="apps-header">
              <div className="apps-title">Meus aplicativos</div>
              <button
                type="button"
                className="apps-close"
                onClick={() => setAppsOpen(false)}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>
            <div className="apps-empty">
              <img src={MASCOT} alt="" className="apps-empty-mascot" draggable={false} />
              <div className="apps-empty-title">Você ainda não tem aplicativos.</div>
              <div className="apps-empty-sub">
                Peça pra Miar criar um. Por exemplo: <em>"Miar, me faz uma calculadora de gorjeta"</em> ou <em>"cria um diário de humor"</em>.
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="chat" ref={scrollRef}>
        {historyLoading && messages.length === 0 && (
          <div className="empty">
            <p className="empty-sub">Carregando sua conversa…</p>
          </div>
        )}

        {!historyLoading && messages.length === 0 && !loading && (
          <div className="empty">
            <p className="empty-title">
              {firstName ? `Pode mandar, ${firstName}.` : "Pode mandar."}
            </p>
            <p className="empty-sub">
              Sua mensagem aparece aqui em cima. A resposta vem logo embaixo.
              Tudo fica salvo na sua conta.
            </p>
          </div>
        )}

        {messages.length > visibleCount && (
          <div className="row row-center">
            <button
              type="button"
              className="load-older"
              onClick={() =>
                setVisibleCount((c) =>
                  Math.min(c + VISIBLE_STEP, messages.length),
                )
              }
            >
              Ver mensagens anteriores
            </button>
          </div>
        )}

        {messages.slice(-visibleCount).map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="row row-user">
              <div className="bubble bubble-user">{renderBubble(m.text)}</div>
            </div>
          ) : (
            <div key={m.id} className="row row-ai">
              <div className="mini-avatar">
                <img src={MASCOT} alt="" draggable={false} />
              </div>
              <div className="bubble bubble-ai">{renderBubble(m.text)}</div>
            </div>
          ),
        )}

        {loading && (
          <div className="row row-ai">
            <div className="mini-avatar">
              <img src={MASCOT} alt="" draggable={false} />
            </div>
            <div className="bubble bubble-ai typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && <div className="toast">{error}</div>}
      </main>

      {speaking && (
        <button
          type="button"
          className="stop-speak"
          onClick={stopSpeaking}
          aria-label="Parar fala da Miar"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
          </svg>
          <span>Parar fala</span>
        </button>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          ref={taRef}
          value={
            listening
              ? [message, transcriptRef.current, interim]
                  .filter(Boolean)
                  .join(" ")
                  .replace(/\s+/g, " ")
              : message
          }
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            listening ? "Ouvindo… fala que eu escrevo" : "Escreva sua mensagem…"
          }
          rows={1}
          disabled={loading || listening}
        />
        {listening ? (
          <>
            <button
              type="button"
              className="mic-cancel"
              onClick={cancelListening}
              aria-label="Cancelar áudio"
              title="Cancelar"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
            <button
              type="button"
              className="mic-stop"
              onClick={finishListening}
              aria-label="Parar de gravar e usar texto"
              title="Parar e usar"
            >
              <span className="mic-pulse" aria-hidden="true" />
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
              </svg>
            </button>
          </>
        ) : message.trim() ? (
          <button
            type="submit"
            className="send"
            aria-label="Enviar"
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M3.4 20.6 21 12 3.4 3.4 3.4 10l12 2-12 2z"
                fill="currentColor"
              />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="mic"
            aria-label="Ditar por voz"
            onClick={startListening}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"
                fill="currentColor"
              />
            </svg>
          </button>
        )}
      </form>
    </div>
  );
}
