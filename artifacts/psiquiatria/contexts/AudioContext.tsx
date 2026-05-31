import { Audio, PitchCorrectionQuality } from "expo-av";
import { apiUrl } from "@/constants/api";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

export type AudioSpeed = 0.5 | 1 | 1.5 | 2 | 2.5 | 3;

interface AudioContextType {
  isPlaying: boolean;
  isPaused: boolean;
  currentText: string | null;
  speed: AudioSpeed;
  setSpeed: (s: AudioSpeed) => void;
  speak: (text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  back: () => void;
  isLoading: boolean;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [speed, setSpeedState] = useState<AudioSpeed>(1);
  const [isLoading, setIsLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const unloadCurrent = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      try {
        await unloadCurrent();
        setCurrentText(text);
        setIsLoading(true);

        if (Platform.OS !== "web") {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        }

        const res = await fetch(apiUrl("/api/ai/tts"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error("TTS falhou");
        const { audio } = await res.json();

        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mp3;base64,${audio}` },
          { shouldPlay: true, rate: speed, pitchCorrectionQuality: PitchCorrectionQuality.Medium }
        );
        soundRef.current = sound;
        setIsPlaying(true);
        setIsPaused(false);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentText(null);
          }
        });
      } catch (e) {
        setCurrentText(null);
      } finally {
        setIsLoading(false);
      }
    },
    [speed, unloadCurrent]
  );

  const pause = useCallback(async () => {
    await soundRef.current?.pauseAsync();
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const resume = useCallback(async () => {
    await soundRef.current?.playAsync();
    setIsPlaying(true);
    setIsPaused(false);
  }, []);

  const stop = useCallback(async () => {
    await unloadCurrent();
    setCurrentText(null);
  }, [unloadCurrent]);

  const back = useCallback(async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (status.isLoaded && status.positionMillis !== undefined) {
      const newPos = Math.max(0, status.positionMillis - 15000);
      await soundRef.current.setPositionAsync(newPos);
    }
  }, []);

  const setSpeed = useCallback(
    async (s: AudioSpeed) => {
      setSpeedState(s);
      if (soundRef.current) {
        await soundRef.current.setRateAsync(s, true, PitchCorrectionQuality.Medium);
      }
    },
    []
  );

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        isPaused,
        currentText,
        speed,
        setSpeed,
        speak,
        pause,
        resume,
        stop,
        back,
        isLoading,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be inside AudioProvider");
  return ctx;
}
