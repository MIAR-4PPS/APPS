import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BiometricGate } from "@/components/BiometricGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/contexts/AppContext";
import { AudioProvider } from "@/contexts/AudioContext";
import { PencilProvider, usePencil } from "@/contexts/PencilContext";
import { PencilFab } from "@/components/PencilFab";
import { PencilLayer } from "@/components/PencilLayer";
import { PencilToolbar } from "@/components/PencilToolbar";
import { ChatStateProvider } from "@/contexts/ChatStateContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
  async clearToken(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  if (!isLoaded) return null;
  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

function PencilHost({ children }: { children: React.ReactNode }) {
  const { captureViewRef } = usePencil();
  const { isSignedIn } = useAuth();
  // Builder/lápis só fazem sentido quando logada — fora dali (telas de
  // login/cadastro) eles poluem a UI e confundem a usuária.
  return (
    <View style={{ flex: 1 }}>
      <View ref={captureViewRef} collapsable={false} style={{ flex: 1 }}>
        {children}
        {isSignedIn ? <PencilLayer /> : null}
      </View>
      {isSignedIn ? (
        <>
          <PencilToolbar />
          <PencilFab />
        </>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  // @clerk/expo não renderiza no web (depende de chunks nativos do RN).
  // Web é só preview — mostra um stub e direciona o uso pro celular.
  if (Platform.OS === "web") {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            backgroundColor: "#0A5F73",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 20,
              fontFamily: "Inter_700Bold",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            MIAR APPS roda no celular 💚
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 14,
              fontFamily: "Inter_400Regular",
              textAlign: "center",
              maxWidth: 360,
            }}
          >
            Abra o Expo Go no Android ou iOS e escaneie o QR Code aqui do Replit
            pra entrar com sua conta e conversar com a Miar.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <AuthGate>
                  <BiometricGate>
                    <AppProvider>
                      <AudioProvider>
                        <ChatStateProvider>
                          <PencilProvider>
                            <PencilHost>
                              <RootLayoutNav />
                            </PencilHost>
                          </PencilProvider>
                        </ChatStateProvider>
                      </AudioProvider>
                    </AppProvider>
                  </BiometricGate>
                </AuthGate>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
