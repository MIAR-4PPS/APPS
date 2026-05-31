import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FloatingAudioPlayer from "@/components/FloatingAudioPlayer";
import { type AudioSpeed, useAudio } from "@/contexts/AudioContext";
import { useColors } from "@/hooks/useColors";

const SPEEDS: AudioSpeed[] = [0.5, 1, 1.5, 2, 2.5, 3];

export default function ConfiguracoesScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { speed, setSpeed } = useAudio();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSignOut = () => {
    Alert.alert("Sair", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.text }]}>Configuracoes</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 150 : insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Feather name="user" size={28} color="#fff" />
          </View>
          <View>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user?.firstName || "Doutor(a)"}
            </Text>
            <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>
              {user?.emailAddresses?.[0]?.emailAddress || ""}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>VOZ E AUDIO</Text>

        <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>Velocidade de leitura</Text>
          <Text style={[styles.settingHint, { color: colors.mutedForeground }]}>
            Define a velocidade da voz feminina ao ler mensagens
          </Text>
          <View style={styles.speedRow}>
            {SPEEDS.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  setSpeed(s);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.speedChip,
                  {
                    backgroundColor: speed === s ? colors.primary : colors.secondary,
                    borderColor: speed === s ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.speedText,
                    { color: speed === s ? "#fff" : colors.text },
                  ]}
                >
                  {s}x
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>INFORMACOES</Text>

        <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Feather name="shield" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>Dados armazenados localmente</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="cpu" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>IA com GPT-5 da OpenAI</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="mic" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>Voz feminina com TTS em PT-BR</Text>
          </View>
        </View>

        <Pressable
          onPress={handleSignOut}
          style={[styles.signOutBtn, { backgroundColor: colors.destructive }]}
        >
          <Feather name="log-out" size={18} color="#fff" />
          <Text style={styles.signOutText}>Sair da conta</Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>MIAR APPS v1.0</Text>
      </ScrollView>

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
  content: {
    paddingHorizontal: 16,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  userEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 14,
  },
  speedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  speedChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  speedText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  signOutText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  version: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
});
