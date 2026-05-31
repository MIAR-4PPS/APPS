import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ONBOARDING_SEEN_KEY } from "@/lib/onboarding";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mascot = require("../assets/images/mascot.png");

const PRESENTATION_TEXT =
  "Olá. Eu sou a MIAR APPS. Fui criada para facilitar sua vida, organizar suas informações e conectar você às soluções certas no momento certo. Para começar, entre ou cadastre-se.";

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const logoOpacity = React.useRef(new Animated.Value(0)).current;
  const logoScale = React.useRef(new Animated.Value(0.7)).current;
  const textOpacity = React.useRef(new Animated.Value(0)).current;
  const btnOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(btnOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale, textOpacity, btnOpacity]);

  const handleStart = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    } catch {
      // não bloqueia o fluxo se o storage falhar
    }
    router.replace("/(auth)/sign-in");
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#0A5F73", "#0D7E97", "#2CC4B2"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Animated.View
          style={[
            styles.logoWrap,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Image source={mascot} style={styles.logo} contentFit="contain" />
          <Text style={styles.title}>MIAR APPS</Text>
        </Animated.View>

        <Animated.View style={{ opacity: textOpacity, marginTop: 24 }}>
          <Text style={styles.presentation}>{PRESENTATION_TEXT}</Text>
        </Animated.View>

        <Animated.View
          style={{ opacity: btnOpacity, width: "100%", marginTop: 28 }}
        >
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaText}>Começar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: { alignItems: "center" },
  logo: { width: 160, height: 160 },
  title: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    marginTop: 12,
    letterSpacing: 1,
  },
  presentation: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    textAlign: "center",
  },
  cta: {
    backgroundColor: "#EC4899",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
});
