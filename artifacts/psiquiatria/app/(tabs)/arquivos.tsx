import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FloatingAudioPlayer from "@/components/FloatingAudioPlayer";
import { useColors } from "@/hooks/useColors";

export default function ArquivosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Text style={[styles.heading, { color: colors.text }]}>Arquivos</Text>
      </View>

      <View style={styles.center}>
        <Feather name="folder" size={44} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Nada por aqui ainda
        </Text>
        <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
          Os arquivos e mini-apps que você criar com a Miar aparecem aqui.
        </Text>
      </View>

      <FloatingAudioPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
