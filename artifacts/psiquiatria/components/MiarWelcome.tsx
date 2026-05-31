import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useChatState } from "@/contexts/ChatStateContext";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
} from "@/lib/biometric";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { detectLang, getStrings, speechLanguage, type Lang } from "@/lib/i18n";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AppRenderer, type MiarApp } from "./AppRenderer";
import { HoldMicButton } from "./HoldMicButton";
import { usePencil } from "@/contexts/PencilContext";

type SpeedOption = 0.5 | 1 | 1.5 | 2 | 2.5 | 3;
const SPEED_OPTIONS: SpeedOption[] = [0.5, 1, 1.5, 2, 2.5, 3];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mascot = require("../assets/images/mascot.png");
const mascotBuilder = require("../assets/images/mascot-builder.png");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logo = require("../assets/images/miar-logo.png");

// Paleta verde (cor padrão) + rosa
const GREEN_DARK = "#0F766E";
const GREEN = "#10B981";
const GREEN_BRIGHT = "#34D399";
const GREEN_LIGHT = "#A8EFD0";
const GREEN_PALE = "#D4F8E8";
const PINK = "#EC4899";
const PINK_LIGHT = "#F9A8D4";
const PINK_PALE = "#FFE0EC";

// Resolve a base URL da API (web usa proxy relativo; nativo precisa do domínio dev/prod)
function apiUrl(path: string): string {
  if (Platform.OS === "web") return path;
  const domain =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_DOMAIN ||
    process.env.EXPO_PUBLIC_REPLIT_DEV_DOMAIN;
  if (domain) {
    const base = domain.startsWith("http") ? domain : `https://${domain}`;
    return `${base.replace(/\/$/, "")}${path}`;
  }
  return path;
}

async function pickFemaleVoice(langPrefix: string): Promise<string | undefined> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const matching = voices.filter((v) =>
      v.language?.toLowerCase().startsWith(langPrefix),
    );
    const byName = matching.find((v) =>
      /female|feminin|francisca|luciana|joana|helena|fernanda|camila|maria|samantha|paulina|microsoft.*maria|google.*portugu|google.*spanish|google.*english/i.test(
        `${v.name ?? ""} ${v.identifier ?? ""}`,
      ),
    );
    if (byName) return byName.identifier;
    return matching[0]?.identifier;
  } catch {
    return undefined;
  }
}

async function speak(
  text: string,
  opts: { lang?: Lang; rate?: number; onError?: () => void } = {},
) {
  try {
    Speech.stop();
    const lang = opts.lang ?? "pt";
    const langTag = speechLanguage(lang);
    const voice = await pickFemaleVoice(lang === "en" ? "en" : lang === "es" ? "es" : "pt");
    Speech.speak(text, {
      language: langTag,
      pitch: 1.55,
      rate: Math.min(3, Math.max(0.5, opts.rate ?? 1)),
      voice,
      onError: () => opts.onError?.(),
    });
  } catch {
    opts.onError?.();
  }
}

function Sparkle({
  color,
  top,
  left,
  size = 14,
  rotate = "0deg",
}: {
  color: string;
  top: number;
  left: number;
  size?: number;
  rotate?: string;
}) {
  return (
    <View
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: size * 0.3,
        opacity: 0.85,
        transform: [{ rotate }],
      }}
    />
  );
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string }[];
};

function IntroBalloon({
  progress,
  x,
  color,
  delay,
  screenH,
}: {
  progress: SharedValue<number>;
  x: number;
  color: string;
  delay: number;
  screenH: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, progress.value - delay));
    const startY = screenH + 80;
    const endY = -120;
    const y = startY + (endY - startY) * p;
    const sway = Math.sin(p * Math.PI * 2) * 12;
    return {
      transform: [{ translateY: y }, { translateX: sway }],
      opacity: p > 0 ? 1 : 0,
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: x - 18 }, style]}>
      <View
        style={{
          width: 36,
          height: 44,
          borderRadius: 22,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.5,
          shadowRadius: 6,
        }}
      />
      <View
        style={{
          width: 1,
          height: 22,
          backgroundColor: "rgba(255,255,255,0.7)",
          alignSelf: "center",
        }}
      />
    </Animated.View>
  );
}

function IntroStreamer({
  progress,
  x,
  rotation,
  color,
  screenH,
}: {
  progress: SharedValue<number>;
  x: number;
  rotation: number;
  color: string;
  screenH: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, progress.value));
    const startY = -120;
    const endY = screenH * 0.7;
    const y = startY + (endY - startY) * p;
    return {
      transform: [{ translateY: y }, { rotate: `${rotation}deg` }],
      opacity: p > 0 ? 0.85 : 0,
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: x - 3, top: 0 }, style]}
    >
      <View style={{ width: 6, height: 90, backgroundColor: color, borderRadius: 3 }} />
    </Animated.View>
  );
}

export function MiarWelcome() {
  const { width: W, height: H } = useWindowDimensions();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<MiarApp[]>([]);
  const [openApp, setOpenApp] = useState<MiarApp | null>(null);
  const [showAppsList, setShowAppsList] = useState(false);
  const [announce, setAnnounce] = useState<string | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const greetedRef = useRef(false);
  // Intro: logo aparece sozinha primeiro, depois revela a cena
  const [showIntro, setShowIntro] = useState(true);
  const [lang, setLang] = useState<Lang>(() => detectLang());
  // Carrega o idioma salvo (se houver) e sobrescreve a detecção automática.
  useEffect(() => {
    AsyncStorage.getItem("miar:lang")
      .then((saved) => {
        if (saved === "pt" || saved === "en" || saved === "es") {
          setLang(saved);
        }
      })
      .catch(() => {
        /* silencioso */
      });
  }, []);
  const changeLang = useCallback((next: Lang) => {
    setLang(next);
    AsyncStorage.setItem("miar:lang", next).catch(() => {
      /* silencioso */
    });
  }, []);
  const STRINGS = useMemo(() => getStrings(lang), [lang]);
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const { pendingCapture, consumePending } = usePencil();
  const introOpacity = useSharedValue(1);
  const introLogoScale = useSharedValue(0.6);
  const introHalo = useSharedValue(0);
  const introMascotRot = useSharedValue(0);
  const introMascotY = useSharedValue(-H * 0.6);
  const introBalloons = useSharedValue(0);
  const introStreamers = useSharedValue(0);
  const openAppTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchTokenRef = useRef(0);

  // Clerk: pega o token JWT pra mandar como Bearer em toda chamada /api/miar/*.
  // Web ignora (mesma origem usa cookie de sessão), nativo sempre precisa.
  const { getToken, isSignedIn, signOut } = useAuth();

  // Estado da digital (disponível no aparelho + ativada pelo usuário)
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  useEffect(() => {
    (async () => {
      const [avail, on] = await Promise.all([
        isBiometricAvailable(),
        isBiometricEnabled(),
      ]);
      setBioAvailable(avail);
      setBioOn(on);
    })();
  }, []);
  const toggleBio = useCallback(async () => {
    const next = !bioOn;
    await setBiometricEnabled(next);
    setBioOn(next);
    if (Platform.OS !== "web") {
      Alert.alert(
        next ? "Digital ativada" : "Digital desativada",
        next
          ? "A MIAR APPS vai pedir sua digital ao abrir. Você continua logada, é só pra travar quem mexe no celular."
          : "Pronto, sem digital. Você entra direto sempre que abrir. O login continua salvo — só vai pedir senha de novo se você sair pelo botão Sair.",
      );
    }
  }, [bioOn]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      // limpa estado local pra próximo login não ver msgs do anterior
      setMessages([]);
      setApps([]);
      hydratedRef.current = false;
    } catch {
      /* silencioso */
    }
  }, [signOut]);
  const authedFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      try {
        const token = await getToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
      } catch {
        /* sem token → o servidor responde 401 e o caller trata */
      }
      return fetch(url, { ...init, headers });
    },
    [getToken],
  );

  const refetchApps = useCallback(async (): Promise<MiarApp[]> => {
    const token = ++refetchTokenRef.current;
    try {
      const res = await authedFetch(apiUrl("/api/miar/apps"));
      if (!res.ok) return [];
      const data = (await res.json()) as { apps: MiarApp[] };
      // Ignora respostas antigas que chegaram fora de ordem
      if (token === refetchTokenRef.current) {
        setApps(data.apps);
      }
      return data.apps;
    } catch {
      return [];
    }
  }, [authedFetch]);

  // Memória infinita por login: hidrata o chat com o histórico salvo no servidor.
  // Só roda 1x quando assina; se o usuário já mandou msgs (estado local não vazio),
  // mescla o histórico no INÍCIO em vez de sobrescrever — evita race com sends otimistas.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!isSignedIn || hydratedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch(apiUrl("/api/miar/conversation"));
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages: { role: "user" | "assistant"; content: string; ts?: number }[];
        };
        if (cancelled) return;
        hydratedRef.current = true;
        const hydrated: ChatMessage[] = data.messages.map((m, i) => ({
          id: `hist-${m.ts ?? i}-${i}`,
          role: m.role,
          content: m.content,
        }));
        setMessages((current) => {
          // Se não há nada local (caso comum), substitui pelo histórico.
          if (current.length === 0) return hydrated;
          // Se já há msgs locais (race com send rápido), prepend histórico
          // mantendo as locais — duplicatas serão evitadas porque novas msgs
          // têm prefixo "u-"/"a-" e histórico tem "hist-".
          return [...hydrated, ...current];
        });
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, isSignedIn]);

  useEffect(() => {
    refetchApps();
    return () => {
      if (openAppTimerRef.current) clearTimeout(openAppTimerRef.current);
    };
  }, [refetchApps]);

  const deleteAppById = useCallback(
    async (id: string) => {
      try {
        await authedFetch(apiUrl(`/api/miar/apps/${id}`), { method: "DELETE" });
        await refetchApps();
      } catch {
        /* silencioso */
      }
    },
    [authedFetch, refetchApps],
  );

  // Flutuação contínua
  const floatY = useSharedValue(0);
  const swayX = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    swayX.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(-5, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    // Intro do logo: cresce + halo pulsa, depois fade out revelando a cena
    introLogoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    // Mascote: cai do alto girando e pousa do lado do logo
    introMascotRot.value = withTiming(720, { duration: 1400, easing: Easing.out(Easing.cubic) });
    introMascotY.value = withTiming(0, { duration: 1400, easing: Easing.out(Easing.cubic) });
    // Balões sobem
    introBalloons.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) });
    // Serpentinas caem
    introStreamers.value = withTiming(1, { duration: 1500, easing: Easing.in(Easing.quad) });
    introHalo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    const hideIntroTimer = setTimeout(() => {
      introOpacity.value = withTiming(0, { duration: 500 }, (done) => {
        if (done) {
          // setShowIntro precisa rodar no JS thread
        }
      });
      setTimeout(() => setShowIntro(false), 520);
    }, 1800);

    // Saudação falada uma vez. Mostra também a frase do lápis logo depois.
    if (!greetedRef.current) {
      greetedRef.current = true;
      const t1 = setTimeout(
        () =>
          speak(STRINGS.greeting, {
            lang,
            rate: speed,
            onError: () =>
              setVoiceError(
                "Não consegui tocar o áudio agora. O texto continua na tela.",
              ),
          }),
        2400,
      );
      const t2 = setTimeout(
        () =>
          speak(STRINGS.pencilHint, {
            lang,
            rate: speed,
            onError: () => {
              /* silencioso */
            },
          }),
        18000,
      );
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(hideIntroTimer);
        Speech.stop();
      };
    }
    return () => {
      clearTimeout(hideIntroTimer);
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    floatY,
    swayX,
    introHalo,
    introLogoScale,
    introOpacity,
    introMascotRot,
    introMascotY,
    introBalloons,
    introStreamers,
  ]);

  const introAnim = useAnimatedStyle(() => ({ opacity: introOpacity.value }));
  const introLogoAnim = useAnimatedStyle(() => ({
    transform: [{ scale: introLogoScale.value }],
  }));
  const introHaloAnim = useAnimatedStyle(() => ({
    opacity: introHalo.value * 0.7,
    transform: [{ scale: 0.85 + introHalo.value * 0.35 }],
  }));
  const introMascotAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: introMascotY.value },
      { rotate: `${introMascotRot.value}deg` },
    ],
  }));

  const mascotAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { translateX: swayX.value }],
  }));
  const bubbleAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value * 0.6 },
      { translateX: swayX.value * 0.6 },
    ],
  }));

  const hasMessages = messages.length > 0;
  const mascotSize = hasMessages
    ? Math.min(W * 0.45, 200)
    : Math.min(W * 1.4, H * 0.75);

  // Avisa o layout pra esconder as abas (e o lápis) durante a conversa.
  const { setChatStarted } = useChatState();
  useEffect(() => {
    setChatStarted(hasMessages);
  }, [hasMessages, setChatStarted]);

  // Tela principal limpa: sem painel de apresentação por padrão.
  // (Mantido o estado pra não quebrar referências, mas começa OFF.)
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const dismissHelpPanel = useCallback(() => {
    setShowHelpPanel(false);
  }, []);

  async function pickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled) {
        setAttachments((prev) => [...prev, ...res.assets]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        `Não consegui abrir seus arquivos. Se o app pediu permissão e você negou, vá em Configurações do telefone, encontre o MIAR APPS e libere o acesso a Arquivos/Fotos. (${msg})`,
      );
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const sendPayload = useCallback(
    async (rawText: string, filesToSend: DocumentPicker.DocumentPickerAsset[]) => {
      const text = rawText.trim();
      if ((!text && filesToSend.length === 0) || sending) return;
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        files: filesToSend.map((a) => ({ name: a.name })),
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("message", text);
        for (const file of filesToSend) {
          if (Platform.OS === "web") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const webFile = (file as any).file as File | undefined;
            if (webFile) {
              form.append("files", webFile, file.name);
            } else {
              const blob = await fetch(file.uri).then((r) => r.blob());
              form.append("files", blob, file.name);
            }
          } else {
            const rnFile = {
              uri: file.uri,
              name: file.name,
              type: file.mimeType ?? "application/octet-stream",
            } as unknown as Blob;
            form.append("files", rnFile, file.name);
          }
        }
        const res = await authedFetch(apiUrl("/api/miar/chat"), {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          reply: string;
          createdAppIds?: string[];
          didEditCode?: boolean;
        };
        const reply = data.reply || "Hmm, fiquei sem palavras.";
        const botMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
        };
        setMessages((prev) => [...prev, botMsg]);
        speak(reply, { lang, rate: speed });
        if (data.didEditCode) {
          const announcement = "Pronto! Vou reiniciar agora pra você ver. 💚";
          setAnnounce(announcement);
          setTimeout(() => speak(announcement, { lang, rate: speed }), 250);
          if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
          announceTimerRef.current = setTimeout(() => setAnnounce(null), 6000);
        }
        if (data.createdAppIds && data.createdAppIds.length > 0) {
          const fresh = await refetchApps();
          const newest = fresh.find((a) => a.id === data.createdAppIds![0]);
          if (newest) {
            if (openAppTimerRef.current) clearTimeout(openAppTimerRef.current);
            openAppTimerRef.current = setTimeout(() => setOpenApp(newest), 800);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Não consegui falar com a Miar agora. ${msg}`);
      } finally {
        setSending(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    },
    [authedFetch, lang, refetchApps, sending, speed],
  );

  const handleSend = useCallback(async () => {
    const text = input;
    const files = attachments;
    if ((!text.trim() && files.length === 0) || sending) return;
    setInput("");
    setAttachments([]);
    await sendPayload(text, files);
  }, [attachments, input, sendPayload, sending]);

  const sendSuggestion = useCallback(
    (prompt: string) => {
      sendPayload(prompt, []);
    },
    [sendPayload],
  );

  const listenPresentation = useCallback(() => {
    setVoiceError(null);
    speak(STRINGS.greeting, {
      lang,
      rate: speed,
      onError: () =>
        setVoiceError(
          "Não consegui tocar o áudio agora. O texto continua na tela.",
        ),
    });
  }, [STRINGS.greeting, lang, speed]);

  // Quando o usuário envia uma marcação do lápis (de qualquer aba), recebemos a
  // imagem capturada via PencilContext e mandamos no chat automaticamente.
  useEffect(() => {
    if (!pendingCapture) return;
    const p = consumePending();
    if (!p) return;
    const asset = {
      uri: p.uri,
      name: `marcacao-${p.ts}.png`,
      mimeType: "image/png",
      size: 0,
    } as unknown as DocumentPicker.DocumentPickerAsset;
    sendPayload(STRINGS.pencilDefaultText, [asset]);
  }, [pendingCapture, consumePending, STRINGS.pencilDefaultText, sendPayload]);

  const onMicRecorded = useCallback(
    (uri: string, durationSec: number) => {
      const asset = {
        uri,
        name: `audio-${Date.now()}.m4a`,
        mimeType: "audio/m4a",
        size: 0,
      } as unknown as DocumentPicker.DocumentPickerAsset;
      const text = input.trim() || `Áudio gravado (${durationSec}s).`;
      setInput("");
      sendPayload(text, [asset]);
    },
    [input, sendPayload],
  );

  const onMicDenied = useCallback(() => {
    setError(STRINGS.micDenied);
  }, [STRINGS.micDenied]);

  const canSend =
    !sending && (input.trim().length > 0 || attachments.length > 0);

  if (openApp) {
    return <AppRenderer app={openApp} onClose={() => setOpenApp(null)} />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { minHeight: H }]}>
        <LinearGradient
          colors={[GREEN_PALE, GREEN_LIGHT, PINK_PALE]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {!hasMessages && (
          <Animated.View
            exiting={FadeOut.duration(450)}
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
          >
            <Sparkle color={GREEN_BRIGHT} top={H * 0.12} left={W * 0.08} size={16} rotate="20deg" />
            <Sparkle color={PINK} top={H * 0.18} left={W * 0.88} size={14} rotate="-15deg" />
            <Sparkle color={GREEN} top={H * 0.32} left={W * 0.93} size={10} rotate="40deg" />
            <Sparkle color={PINK_LIGHT} top={H * 0.45} left={W * 0.04} size={12} rotate="-30deg" />
            <Sparkle color={GREEN_BRIGHT} top={H * 0.58} left={W * 0.92} size={14} rotate="15deg" />
          </Animated.View>
        )}

        {/* Logo */}
        <View style={[styles.logoSlot, { top: Math.max(18, H * 0.025) }]}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandTagline}>MIAR APPS</Text>
        </View>

        {/* Botão Meus Apps (só aparece quando há apps criados) */}
        {apps.length > 0 && (
          <Pressable
            onPress={() => setShowAppsList(true)}
            style={[styles.appsButton, { top: Math.max(18, H * 0.025) }]}
          >
            <Ionicons name="apps" size={18} color="#fff" />
            <Text style={styles.appsButtonText}>
              Meus Apps ({apps.length})
            </Text>
          </Pressable>
        )}

        {/* Botão Sair (logout) — canto direito, abaixo do botão Apps */}
        {isSignedIn && (
          <Pressable
            onPress={handleLogout}
            style={[
              styles.logoutButton,
              { top: Math.max(18, H * 0.025) + (apps.length > 0 ? 44 : 0) },
            ]}
            hitSlop={8}
            accessibilityLabel="Sair da conta"
          >
            <Ionicons name="log-out-outline" size={14} color="#fff" />
            <Text style={styles.logoutButtonText}>Sair</Text>
          </Pressable>
        )}

        {/* Toggle de digital — abaixo do Sair, à direita */}
        {bioAvailable && isSignedIn && (
          <Pressable
            onPress={toggleBio}
            style={[
              styles.bioToggle,
              {
                top:
                  Math.max(18, H * 0.025) +
                  (apps.length > 0 ? 44 : 0) +
                  36,
                backgroundColor: bioOn
                  ? "rgba(236, 72, 153, 0.85)"
                  : "rgba(15, 118, 110, 0.85)",
              },
            ]}
            hitSlop={8}
            accessibilityLabel={
              bioOn ? "Desativar digital" : "Ativar digital ao abrir"
            }
          >
            <Ionicons name="finger-print" size={12} color="#fff" />
            <Text style={styles.logoutButtonText}>
              {bioOn ? "Digital ON" : "Digital"}
            </Text>
          </Pressable>
        )}

        {/* Modal lista de apps */}
        {showAppsList && (
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowAppsList(false)}
          >
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Meus Apps 💚</Text>
                <Pressable
                  onPress={() => setShowAppsList(false)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color={GREEN_DARK} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: H * 0.6 }} contentContainerStyle={{ gap: 8 }}>
                {apps.map((a) => (
                  <View key={a.id} style={styles.appCard}>
                    <Pressable
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
                      onPress={() => {
                        setShowAppsList(false);
                        setOpenApp(a);
                      }}
                    >
                      <Text style={{ fontSize: 26 }}>{a.emoji ?? "📱"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.appCardTitle}>{a.name}</Text>
                        {!!a.description && (
                          <Text style={styles.appCardDesc} numberOfLines={2}>
                            {a.description}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteAppById(a.id)}
                      hitSlop={8}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={PINK} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        )}

        {/* MODO WELCOME: balão + Miar gigante */}
        {!hasMessages && (
          <>
            <Animated.View
              exiting={FadeOut.duration(350)}
              style={[
                styles.bubbleSlot,
                { top: H * 0.22, right: W * 0.03, maxWidth: W * 0.58 },
                bubbleAnim,
              ]}
            >
              <View style={styles.bubble}>
                <Text style={styles.bubbleHi}>Oi! 💚</Text>
                <Text style={styles.bubbleText}>
                  Eu sou a <Text style={styles.bubbleBrand}>MIAR APPS</Text>!
                </Text>
                <Text style={styles.bubbleText}>Tô aqui pra facilitar sua vida.</Text>
                <Text style={styles.bubbleQuestion}>O que vamos construir hoje?</Text>
              </View>
              <View style={styles.bubbleTailOuter} />
              <View style={styles.bubbleTailInner} />
            </Animated.View>

            <Animated.View
              exiting={SlideOutDown.duration(500)}
              style={[styles.mascotSlotBig, { bottom: H * 0.22 }, mascotAnim]}
            >
              <Image
                source={mascot}
                style={{ width: mascotSize, height: mascotSize }}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Painel da central inteligente: texto + ouvir + velocidade + sugestões */}
            <Animated.View
              exiting={FadeOut.duration(300)}
              style={[styles.centralPanel, { bottom: 90 + 24 }]}
            >
              <ScrollView
                style={{ maxHeight: showHelpPanel ? H * 0.36 : H * 0.24 }}
                contentContainerStyle={{ paddingBottom: 4 }}
                showsVerticalScrollIndicator={false}
              >
                {showHelpPanel && (
                  <View style={styles.helpCard}>
                    <Pressable
                      onPress={dismissHelpPanel}
                      hitSlop={10}
                      style={styles.helpClose}
                      accessibilityLabel="Fechar apresentação"
                    >
                      <Ionicons name="close" size={16} color={GREEN_DARK} />
                    </Pressable>
                    <Text style={styles.centralGreeting}>{STRINGS.greeting}</Text>
                    <Text style={styles.centralHelp}>{STRINGS.helpHint}</Text>
                  </View>
                )}
                {voiceError && (
                  <Text style={styles.voiceErrorText}>{voiceError}</Text>
                )}

                <View style={styles.listenRow}>
                  {showHelpPanel && (
                    <Pressable
                      onPress={listenPresentation}
                      style={({ pressed }) => [
                        styles.listenBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Ionicons name="volume-high" size={16} color="#fff" />
                      <Text style={styles.listenBtnText}>
                        {STRINGS.listenPresentation}
                      </Text>
                    </Pressable>
                  )}
                  <View style={styles.speedWrap}>
                    <Text style={styles.speedLabel}>Idioma</Text>
                    <View style={styles.speedRow}>
                      {(
                        [
                          { code: "pt" as Lang, label: "PT" },
                          { code: "en" as Lang, label: "EN" },
                          { code: "es" as Lang, label: "ES" },
                        ]
                      ).map((l) => (
                        <Pressable
                          key={l.code}
                          onPress={() => changeLang(l.code)}
                          style={[
                            styles.speedChip,
                            lang === l.code && styles.speedChipActive,
                          ]}
                          accessibilityLabel={`Idioma ${l.label}`}
                        >
                          <Text
                            style={[
                              styles.speedChipText,
                              lang === l.code && styles.speedChipTextActive,
                            ]}
                          >
                            {l.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.speedWrap}>
                    <Text style={styles.speedLabel}>{STRINGS.speedLabel}</Text>
                    <View style={styles.speedRow}>
                      {SPEED_OPTIONS.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => setSpeed(s)}
                          style={[
                            styles.speedChip,
                            speed === s && styles.speedChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.speedChipText,
                              speed === s && styles.speedChipTextActive,
                            ]}
                          >
                            {s}x
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.suggestionsWrap}>
                  {STRINGS.suggestions.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => sendSuggestion(s.prompt)}
                      style={({ pressed }) => [
                        styles.suggestionChip,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.suggestionChipText}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          </>
        )}

        {/* MODO CHAT: Miar pequena no canto + lista de mensagens */}
        {hasMessages && (
          <>
            <Animated.View
              entering={FadeIn.duration(450).delay(200)}
              style={[
                styles.mascotSlotSmall,
                { top: H * 0.025, right: 8 },
                mascotAnim,
              ]}
              pointerEvents="none"
            >
              <Image
                source={mascot}
                style={{ width: mascotSize, height: mascotSize }}
                resizeMode="contain"
              />
            </Animated.View>

            <Animated.View
              entering={SlideInUp.duration(450).delay(150)}
              style={[
                styles.chatArea,
                {
                  top: Math.max(180, H * 0.22),
                  bottom: 120,
                },
              ]}
            >
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.chatContent}
                onContentSizeChange={() =>
                  scrollRef.current?.scrollToEnd({ animated: true })
                }
              >
                {messages.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      styles.msgRow,
                      m.role === "user" ? styles.msgRowUser : styles.msgRowBot,
                    ]}
                  >
                    {m.role === "assistant" && (
                      <Image
                        source={mascot}
                        style={styles.msgAvatar}
                        resizeMode="contain"
                      />
                    )}
                    <View
                      style={[
                        styles.msgBubble,
                        m.role === "user" ? styles.msgUser : styles.msgBot,
                      ]}
                    >
                      {!!m.files?.length && (
                        <View style={{ gap: 4, marginBottom: m.content ? 6 : 0 }}>
                          {m.files.map((f, i) => (
                            <View
                              key={`${f.name}-${i}`}
                              style={styles.msgFileRow}
                            >
                              <Ionicons
                                name="document-attach"
                                size={14}
                                color={m.role === "user" ? "#fff" : GREEN_DARK}
                              />
                              <Text
                                style={[
                                  styles.msgFileText,
                                  {
                                    color: m.role === "user" ? "#fff" : GREEN_DARK,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {f.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {!!m.content && (
                        <Text
                          style={[
                            styles.msgText,
                            { color: m.role === "user" ? "#fff" : GREEN_DARK },
                          ]}
                        >
                          {m.content}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
                {sending && (
                  <View style={[styles.msgRow, styles.msgRowBot]}>
                    <View style={[styles.msgBubble, styles.msgBot, styles.msgTyping]}>
                      <ActivityIndicator size="small" color={GREEN_DARK} />
                      <Text style={styles.msgTypingText}>Miar tá pensando...</Text>
                    </View>
                  </View>
                )}
                {error && (
                  <View style={[styles.msgRow, styles.msgRowBot]}>
                    <View style={[styles.msgBubble, styles.msgError]}>
                      <Text style={styles.msgErrorText}>{error}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </>
        )}

        {/* Input dock */}
        <View style={styles.inputDock}>
          {attachments.length > 0 && (
            <View style={styles.chipsRow}>
              {attachments.map((file, i) => (
                <View key={`${file.name}-${i}`} style={styles.chip}>
                  <Ionicons name="document-outline" size={14} color={GREEN_DARK} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Pressable onPress={() => removeAttachment(i)} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={GREEN_DARK} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.inputRow}>
            <Pressable
              onPress={pickFile}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
              accessibilityLabel="Anexar arquivo"
            >
              <Ionicons name="attach-outline" size={24} color="#fff" />
            </Pressable>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={STRINGS.inputPlaceholder}
              placeholderTextColor="rgba(15,118,110,0.55)"
              style={styles.input}
              multiline
              maxLength={4000}
              editable={!sending}
              onKeyPress={(e) => {
                // No web: Enter envia, Shift+Enter quebra linha
                if (Platform.OS !== "web") return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ev = e.nativeEvent as any;
                if (ev.key === "Enter" && !ev.shiftKey) {
                  e.preventDefault?.();
                  handleSend();
                }
              }}
              // No iOS/Android, o teclado tem botão "enviar" — também dispara o send
              returnKeyType="send"
              onSubmitEditing={() => {
                if (Platform.OS !== "web") handleSend();
              }}
              blurOnSubmit={false}
            />

            {input.trim().length === 0 && attachments.length === 0 ? (
              <HoldMicButton
                onRecorded={onMicRecorded}
                onDenied={onMicDenied}
                disabled={sending}
                hint={STRINGS.micHoldHint}
                recordingLabel={STRINGS.micRecording}
              />
            ) : (
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                style={({ pressed }) => [
                  styles.sendButton,
                  !canSend && { backgroundColor: "#9CA3AF" },
                  pressed && canSend && { opacity: 0.85 },
                ]}
                accessibilityLabel="Enviar mensagem"
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* O lápis flutuante e o overlay agora ficam em app/_layout (todas as abas) */}

        {showIntro && (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.introOverlay, introAnim]}
          >
            <LinearGradient
              colors={[GREEN_DARK, GREEN, GREEN_BRIGHT]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {/* Balões subindo */}
            {[
              { x: W * 0.1, color: PINK, delay: 0 },
              { x: W * 0.28, color: GREEN_BRIGHT, delay: 0.15 },
              { x: W * 0.5, color: PINK_LIGHT, delay: 0.05 },
              { x: W * 0.72, color: GREEN_BRIGHT, delay: 0.2 },
              { x: W * 0.88, color: PINK, delay: 0.1 },
            ].map((b, i) => (
              <IntroBalloon
                key={`bal-${i}`}
                progress={introBalloons}
                x={b.x}
                color={b.color}
                delay={b.delay}
                screenH={H}
              />
            ))}
            {/* Serpentinas caindo */}
            {[
              { x: W * 0.18, rot: -25, color: PINK },
              { x: W * 0.4, rot: 15, color: GREEN_BRIGHT },
              { x: W * 0.62, rot: -10, color: PINK_LIGHT },
              { x: W * 0.82, rot: 30, color: GREEN_BRIGHT },
            ].map((s, i) => (
              <IntroStreamer
                key={`str-${i}`}
                progress={introStreamers}
                x={s.x}
                rotation={s.rot}
                color={s.color}
                screenH={H}
              />
            ))}
            <View style={styles.introCenter}>
              <Animated.View style={[styles.introHalo, introHaloAnim]} />
              <Animated.View style={introLogoAnim}>
                <Image source={logo} style={styles.introLogo} resizeMode="contain" />
              </Animated.View>
              <Text style={styles.introBrand}>MIAR APPS</Text>
              {/* Mascote cai girando e pousa */}
              <Animated.View style={[styles.introMascot, introMascotAnim]}>
                <Image source={mascot} style={styles.introMascotImg} resizeMode="contain" />
              </Animated.View>
            </View>
          </Animated.View>
        )}

        {announce && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={styles.announceBackdrop}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setAnnounce(null)}
              accessibilityLabel="Fechar aviso"
            />
            <Animated.View
              entering={SlideInUp.duration(450)}
              style={styles.announceSpotlight}
              pointerEvents="box-none"
            >
              <Animated.View style={[styles.announceMascotWrap, mascotAnim]}>
                {/* Quando ela acabou de mexer no código ("implantação"),
                    aparece com a roupa de construtor — capacete + colete. */}
                <Image source={mascotBuilder} style={styles.announceMascotBig} resizeMode="contain" />
              </Animated.View>
              <View style={styles.announceBubbleBig}>
                <Text style={styles.announceTitleBig}>Miar</Text>
                <Text style={styles.announceTextBig}>{announce}</Text>
                <Text style={styles.announceHint}>(toque em qualquer lugar pra fechar)</Text>
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  announceOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 120,
    alignItems: "center",
    zIndex: 200,
  },
  announceCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    maxWidth: 380,
    shadowColor: "#0F766E",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 2,
    borderColor: "#34D399",
    gap: 10,
  },
  announceMascot: { width: 72, height: 72 },
  announceBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,118,110,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 300,
  },
  announceSpotlight: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 18,
  },
  announceMascotWrap: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#34D399",
    shadowOpacity: 0.8,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  announceMascotBig: { width: 200, height: 200 },
  announceBubbleBig: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderWidth: 3,
    borderColor: "#34D399",
    alignItems: "center",
    shadowColor: "#0F766E",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  announceTitleBig: {
    color: "#0F766E",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  announceTextBig: {
    color: "#134E4A",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  announceBubble: { flex: 1, minWidth: 0 },
  announceTitle: {
    color: "#0F766E",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 2,
  },
  announceText: { color: "#134E4A", fontSize: 14, lineHeight: 19 },
  announceHint: { color: "#94A3B8", fontSize: 11, marginTop: 4 },
  logoSlot: {
    position: "absolute",
    left: 14,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    paddingRight: 12,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
  },
  logo: { width: 40, height: 40 },
  brandTagline: {
    fontSize: 13,
    fontWeight: "800",
    color: GREEN_DARK,
    letterSpacing: 1.2,
  },
  bubbleSlot: { position: "absolute", zIndex: 20 },
  bubble: {
    backgroundColor: GREEN_BRIGHT,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 3,
    borderColor: GREEN,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  bubbleHi: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: "#fff", fontWeight: "600" },
  bubbleBrand: { fontWeight: "900", color: PINK_PALE, letterSpacing: 0.5 },
  bubbleQuestion: {
    fontSize: 14,
    fontWeight: "800",
    color: PINK_PALE,
    marginTop: 6,
  },
  bubbleTailOuter: {
    position: "absolute",
    bottom: 6,
    left: -18,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 20,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: GREEN,
  },
  bubbleTailInner: {
    position: "absolute",
    bottom: 9,
    left: -12,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 14,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: GREEN_BRIGHT,
  },
  mascotSlotBig: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  mascotSlotSmall: {
    position: "absolute",
    zIndex: 5,
    opacity: 0.95,
  },
  chatArea: { position: "absolute", left: 8, right: 8, zIndex: 15 },
  chatContent: { gap: 8, paddingBottom: 16, paddingTop: 8 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  msgAvatar: {
    width: 32,
    height: 32,
    marginBottom: 2,
  },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowBot: { justifyContent: "flex-start" },
  msgBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  msgUser: {
    backgroundColor: GREEN,
    borderBottomRightRadius: 4,
  },
  msgBot: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
  },
  msgText: { fontSize: 15, lineHeight: 21, fontWeight: "500" },
  msgFileRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  msgFileText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  msgTyping: { flexDirection: "row", alignItems: "center", gap: 8 },
  msgTypingText: { fontSize: 13, color: GREEN_DARK, fontWeight: "600" },
  msgError: { backgroundColor: PINK_PALE, borderWidth: 2, borderColor: PINK },
  msgErrorText: { fontSize: 13, color: PINK, fontWeight: "600" },
  inputDock: { position: "absolute", bottom: 12, left: 10, right: 10, zIndex: 30 },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: 180,
  },
  chipText: { fontSize: 12, color: GREEN_DARK, fontWeight: "600", flexShrink: 1 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#fff",
    borderRadius: 28,
    borderWidth: 3,
    borderColor: GREEN_BRIGHT,
    paddingVertical: 5,
    paddingHorizontal: 5,
    gap: 6,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
    color: GREEN_DARK,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
  appsButton: {
    position: "absolute",
    right: 14,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GREEN_DARK,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
  },
  appsButtonText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  logoutButton: {
    position: "absolute",
    right: 14,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 118, 110, 0.85)",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PINK_LIGHT,
  },
  logoutButtonText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  bioToggle: {
    position: "absolute",
    right: 14,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FFE0EC",
  },
  helpCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    position: "relative",
  },
  helpClose: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PINK_PALE,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,118,110,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 3,
    borderColor: GREEN_BRIGHT,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: GREEN_DARK },
  appCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_PALE,
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
    gap: 8,
  },
  appCardTitle: { fontSize: 15, fontWeight: "800", color: GREEN_DARK },
  appCardDesc: { fontSize: 12, color: GREEN_DARK, opacity: 0.7, marginTop: 2 },
  introOverlay: {
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  introCenter: { alignItems: "center", justifyContent: "center" },
  introHalo: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(255,255,255,0.35)",
    shadowColor: "#fff",
    shadowOpacity: 0.6,
    shadowRadius: 40,
  },
  introLogo: { width: 180, height: 180 },
  introMascot: {
    position: "absolute",
    top: -120,
    right: -40,
    width: 90,
    height: 90,
  },
  introMascotImg: { width: 90, height: 90 },
  introBrand: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 4,
  },
  centralPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 22,
    padding: 14,
    borderWidth: 2,
    borderColor: "#34D399",
    shadowColor: "#0F766E",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 18,
  },
  centralGreeting: {
    fontSize: 13,
    lineHeight: 19,
    color: "#0F766E",
    fontWeight: "600",
  },
  centralHelp: {
    fontSize: 12,
    color: "#0F766E",
    opacity: 0.75,
    marginTop: 6,
    fontStyle: "italic",
  },
  voiceErrorText: {
    fontSize: 12,
    color: "#EC4899",
    marginTop: 6,
    fontWeight: "700",
  },
  listenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10,
    flexWrap: "wrap",
  },
  listenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0F766E",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  listenBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  speedWrap: { flexShrink: 1 },
  speedLabel: {
    fontSize: 10,
    color: "#0F766E",
    fontWeight: "700",
    opacity: 0.7,
    marginBottom: 3,
  },
  speedRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  speedChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: "#D4F8E8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#34D399",
  },
  speedChipActive: {
    backgroundColor: "#0F766E",
    borderColor: "#0F766E",
  },
  speedChipText: { fontSize: 11, color: "#0F766E", fontWeight: "800" },
  speedChipTextActive: { color: "#fff" },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  suggestionChip: {
    backgroundColor: "#FFE0EC",
    borderWidth: 1.5,
    borderColor: "#F9A8D4",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  suggestionChipText: {
    fontSize: 12,
    color: "#831843",
    fontWeight: "700",
  },
  pencilFab: {
    position: "absolute",
    right: 16,
    bottom: 90,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EC4899",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F9A8D4",
    shadowColor: "#EC4899",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 40,
  },
});
