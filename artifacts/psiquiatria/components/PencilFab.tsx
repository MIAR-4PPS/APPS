import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePencil } from "@/contexts/PencilContext";
import { useChatState } from "@/contexts/ChatStateContext";

export function PencilFab() {
  const { pencilOpen, openPencil } = usePencil();
  const { chatStarted } = useChatState();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Abre o lápis SEM trocar de aba — a usuária marca o que está vendo agora.
  // A navegação pra aba IA só acontece DEPOIS do envio (em PencilToolbar).
  if (pencilOpen) return null;
  // No chat da Miar (aba ia ou index) a lápis não aparece: o chat já tem
  // botão de anexo e o input no rodapé. O lápis serve pras outras abas.
  if (pathname?.includes("/ia") || pathname === "/" || pathname === "/(tabs)") {
    return null;
  }
  // Quando a conversa já começou, escondemos o lápis em TODAS as abas
  // pra ela ver só a Miar e o chat.
  if (chatStarted) return null;

  return (
    <Pressable
      onPress={openPencil}
      style={[styles.fab, { bottom: 70 + insets.bottom + 16 }]}
      hitSlop={8}
      accessibilityLabel="Abrir modo lápis"
    >
      <Ionicons name="pencil" size={20} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
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
    zIndex: 60,
  },
});
