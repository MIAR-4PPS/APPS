import { useSSO, useSignUp } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mascot = require("../../assets/images/mascot.png");

export default function SignUp() {
  // Clerk Expo SDK types drift entre versões; runtime ainda expõe a API clássica.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signUp, setActive, isLoaded } = useSignUp() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { startSSOFlow } = useSSO() as any;

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      Alert.alert(
        "Login Google",
        e?.errors?.[0]?.message ||
          e?.message ||
          "Não consegui entrar com o Google agora. Use seu email e senha por enquanto.",
      );
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, setActive]);

  const handleSignUp = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signUp.create({ firstName: name, emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: any) {
      Alert.alert("Erro", err.errors?.[0]?.message || "Falha ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      Alert.alert("Erro", err.errors?.[0]?.message || "Código inválido.");
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
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>

          <View style={styles.header}>
            <Image source={mascot} style={styles.logo} contentFit="contain" />
            <Text style={styles.title}>MIAR APPS</Text>
            <Text style={styles.subtitle}>Criar conta</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {step === "form" ? (
              <>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Cadastro</Text>

                {/* CTA principal: Google (1 clique, sem confirmação de email) */}
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
                      <Text style={styles.googleBtnText}>Cadastrar com Google</Text>
                    </>
                  )}
                </Pressable>

                <Text style={[styles.orText, { color: colors.mutedForeground }]}>
                  ou com email
                </Text>

                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Feather name="user" size={16} color={colors.mutedForeground} style={{ marginRight: 10 }} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Seu nome"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>

                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Feather name="mail" size={16} color={colors.mutedForeground} style={{ marginRight: 10 }} />
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

                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Feather name="lock" size={16} color={colors.mutedForeground} style={{ marginRight: 10 }} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Senha (mín. 8 caracteres)"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showPass}
                    style={[styles.input, { color: colors.text, flex: 1 }]}
                  />
                  <Pressable onPress={() => setShowPass((v) => !v)}>
                    <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>

                <Pressable
                  onPress={handleSignUp}
                  disabled={loading || !name || !email || !password}
                  style={[
                    styles.btn,
                    { backgroundColor: colors.primary, opacity: loading || !name || !email || !password ? 0.6 : 1 },
                  ]}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Criar conta</Text>}
                </Pressable>

                <Pressable onPress={() => router.back()} style={styles.link}>
                  <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
                    Ja tem conta?{" "}
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Entrar</Text>
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Verificar e-mail</Text>
                <Text style={[styles.verifyHint, { color: colors.mutedForeground }]}>
                  Enviamos um codigo para {email}
                </Text>

                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Feather name="hash" size={16} color={colors.mutedForeground} style={{ marginRight: 10 }} />
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="Codigo de verificacao"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>

                <Pressable
                  onPress={handleVerify}
                  disabled={loading || !code}
                  style={[styles.btn, { backgroundColor: colors.primary, opacity: loading || !code ? 0.6 : 1 }]}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verificar</Text>}
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
  backBtn: {
    position: "absolute",
    top: 60,
    left: 24,
    padding: 8,
    zIndex: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
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
    marginBottom: 20,
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
  verifyHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
    lineHeight: 20,
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
    marginBottom: 8,
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
  orText: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginVertical: 10,
  },
});
