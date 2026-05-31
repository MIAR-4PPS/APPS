import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  isBiometricAvailable,
  isBiometricEnabled,
  promptBiometric,
} from "@/lib/biometric";

type Props = { children: React.ReactNode };

export function BiometricGate({ children }: Props) {
  const { isSignedIn } = useAuth();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const lastBgRef = useRef<number>(Date.now());

  const evaluate = useCallback(async () => {
    if (Platform.OS === "web") {
      setLocked(false);
      setChecking(false);
      return;
    }
    if (!isSignedIn) {
      setLocked(false);
      setChecking(false);
      return;
    }
    const [available, enabled] = await Promise.all([
      isBiometricAvailable(),
      isBiometricEnabled(),
    ]);
    if (available && enabled) {
      setLocked(true);
    } else {
      setLocked(false);
    }
    setChecking(false);
  }, [isSignedIn]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  // Re-trava quando o app volta do background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        lastBgRef.current = Date.now();
      }
      if (state === "active") {
        const awayMs = Date.now() - lastBgRef.current;
        // Só re-pede digital se a usuária ficou mais de 1 minuto fora.
        // Antes era 5s — qualquer notificação ou troca de app rebloqueava.
        if (awayMs > 60000) evaluate();
      }
    });
    return () => sub.remove();
  }, [evaluate]);

  const unlock = useCallback(async () => {
    const ok = await promptBiometric("Desbloqueie a MIAR APPS 💚");
    if (ok) setLocked(false);
  }, []);

  // Tenta destravar automaticamente assim que entra na tela
  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  if (checking) return null;

  if (locked) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={["#0A5F73", "#0D7E97", "#2CC4B2"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <Ionicons name="finger-print" size={56} color="#fff" />
          </View>
          <Text style={styles.title}>MIAR APPS bloqueado</Text>
          <Text style={styles.subtitle}>
            Use sua digital ou senha do celular pra entrar
          </Text>
          <Pressable onPress={unlock} style={styles.btn}>
            <Ionicons name="finger-print" size={18} color="#0A5F73" />
            <Text style={styles.btnText}>Desbloquear</Text>
          </Pressable>
          <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  iconWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 28,
    maxWidth: 280,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
  },
  btnText: {
    color: "#0A5F73",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
