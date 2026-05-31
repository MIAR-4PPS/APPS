import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { ONBOARDING_SEEN_KEY } from "@/lib/onboarding";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const colors = useColors();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
      .then((v) => setOnboardingSeen(v === "1"))
      .catch(() => setOnboardingSeen(true)); // em caso de erro, não trava
  }, []);

  if (!isLoaded || onboardingSeen === null) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isSignedIn) return <Redirect href="/(tabs)" />;
  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  return <Redirect href="/(auth)/sign-in" />;
}
