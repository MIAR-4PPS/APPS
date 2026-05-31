import { useSSO, useSignIn } from "@clerk/expo";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as AuthSession from "expo-auth-session";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  isBiometricAvailable,
  isBiometricEnabled,
  promptBiometric,
} from "@/lib/biometric";
import { useColors } from "@/hooks/useColors";

// Necessário pro fluxo OAuth fechar o WebBrowser na volta
WebBrowser.maybeCompleteAuthSession();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mascot = require("../../assets/images/mascot.png");

export default function SignIn() {
  // Clerk Expo SDK types drift entre versões; runtime ainda expõe a API clássica.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signIn, setActive, isLoaded } = useSignIn() as any;
  // useSSO é o hook canônico do @clerk/expo (substitui useOAuth, que tem bug
  // do "Cannot read property 'toString' of null" em algumas versões).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { startSSOFlow } = useSSO() as any;

  // Pré-aquece o navegador no Android pra reduzir o tempo até a tela do Google.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const [avail, enabled] = await Promise.all([
        isBiometricAvailable(),
        isBiometricEnabled(),
      ]);
      setBiometricAvailable(avail && enabled);
    })();
  }, []);

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const result = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri({ scheme: "psiquiatria" }),
      });
      const createdSessionId = result?.createdSessionId ?? null;
      const ssoSetActive = result?.setActive ?? setActive;
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
      // createdSessionId null = usuário cancelou ou precisa completar cadastro.
    } catch (err) {
      const msg =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.errors?.[0]?.message ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.message ||
        "Não consegui entrar com o Google agora. Use seu email e senha por enquanto.";
      Alert.alert("Login Google", String(msg));
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, setActive]);

  const handleBiometric = useCallback(async () => {
    const ok = await promptBiometric("Entrar na MIAR APPS 💚");
    if (ok) {
      // Se a sessão Clerk ainda está em cache, o AuthGate já estaria fora dessa tela.
      // Como estamos AQUI, significa que não tem sessão. Avisa o usuário.
      Alert.alert(
        "Quase lá",
        "Faça login com o Google uma vez. Depois disso, a digital funciona pra reabrir o app mais rápido.",
      );
    }
  }, []);

  const handleSignIn = async () => {
    if (!isLoaded || !email || !password) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result?.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        Alert.alert(
          "Erro",
          "Não consegui completar o login. Tente entrar com o Google.",
        );
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      Alert.alert(
        "Erro",
        e?.errors?.[0]?.message ||
          e?.message ||
          "Falha ao entrar. Verifique seus dados ou use o Google.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#0A5F73", "#0D7E97", "#2CC4B2"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image source={mascot} style={styles.logo} contentFit="contain" />
            <Text style={styles.title}>MIAR APPS</Text>
            <Text style={styles.subtitle}>Sua assistente pessoal 💚</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Entrar
            </Text>

            {/* CTA principal: Google */}
            <Pressable
              onPress={handleGoogle}
              disabled={googleLoading}
              style={[styles.googleBtn, { opacity: googleLoading ? 0.7 : 1 }]}
            >
              {googleLoading ? (
                <ActivityIndicator color="#3C4043" />
              ) : (
                <>
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Continuar com Google</Text>
                </>
              )}
            </Pressable>

            {/* Digital (se disponível) */}
            {biometricAvailable && (
              <Pressable
                onPress={handleBiometric}
                style={[
                  styles.bioBtn,
                  { borderColor: colors.primary },
                ]}
              >
                <Ionicons
                  name="finger-print"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.bioBtnText, { color: colors.primary }]}>
                  Entrar com digital
                </Text>
              </Pressable>
            )}

            {/* Toggle pra mostrar login com email */}
            <Pressable
              onPress={() => setShowEmailForm((v) => !v)}
              style={styles.toggleEmail}
            >
              <Text
                style={[
                  styles.toggleEmailText,
                  { color: colors.mutedForeground },
                ]}
              >
                {showEmailForm ? "Ocultar" : "ou entrar com email e senha"}
              </Text>
            </Pressable>

            {showEmailForm && (
              <>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Feather
                    name="mail"
                    size={16}
                    color={colors.mutedForeground}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="E-mail"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Feather
                    name="lock"
                    size={16}
                    color={colors.mutedForeground}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Senha"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showPass}
                    style={[styles.input, { color: colors.text, flex: 1 }]}
                  />
                  <Pressable onPress={() => setShowPass((v) => !v)}>
                    <Feather
                      name={showPass ? "eye-off" : "eye"}
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={handleSignIn}
                  disabled={loading || !email || !password}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: colors.primary,
                      opacity: loading || !email || !password ? 0.6 : 1,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Entrar</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(auth)/sign-up")}
                  style={styles.link}
                >
                  <Text
                    style={[
                      styles.linkText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Não tem conta?{" "}
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      Criar conta
                    </Text>
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#DADCE0",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 10,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    color: "#4285F4",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  googleBtnText: {
    color: "#3C4043",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  bioBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 4,
  },
  bioBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  toggleEmail: {
    alignItems: "center",
    paddingVertical: 14,
  },
  toggleEmailText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  link: {
    alignItems: "center",
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
