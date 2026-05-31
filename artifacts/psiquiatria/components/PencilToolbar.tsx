import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { usePencil } from "@/contexts/PencilContext";

const COLORS = [
  { color: "#EF4444", label: "Vermelho — remover" },
  { color: "#10B981", label: "Verde — adicionar" },
  { color: "#3B82F6", label: "Azul — anotar" },
];

export function PencilToolbar() {
  const {
    pencilOpen,
    closePencil,
    captureViewRef,
    tool,
    setTool,
    color,
    setColor,
    clearAll,
    setPendingCapture,
  } = usePencil();
  const insets = useSafeAreaInsets();

  const handleSend = useCallback(async () => {
    try {
      const node = captureViewRef.current;
      if (!node) {
        closePencil();
        return;
      }
      const uri = await captureRef(node, {
        format: "png",
        quality: 0.85,
        result: "tmpfile",
      });
      setPendingCapture({ uri, ts: Date.now() });
      // Depois de capturar, vai pra aba IA pra usuária ver a Miar respondendo.
      try {
        router.push("/(tabs)/ia");
      } catch {
        /* silencioso */
      }
    } catch {
      // silencioso — fecha mesmo assim
    } finally {
      closePencil();
    }
  }, [captureViewRef, closePencil, setPendingCapture]);

  if (!pencilOpen) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {/* X grande de fechar, sozinho no canto superior direito */}
      <Pressable
        onPress={closePencil}
        style={[styles.closeBig, { top: Math.max(14, insets.top + 6) }]}
        hitSlop={12}
        accessibilityLabel="Fechar lápis sem enviar"
      >
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>

      <View style={[styles.topBar, { top: Math.max(60, insets.top + 56) }]} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          {COLORS.map((c) => (
            <Pressable
              key={c.color}
              onPress={() => {
                setColor(c.color);
                if (tool === "eraser") setTool("draw");
              }}
              style={[
                styles.colorDot,
                { backgroundColor: c.color },
                color === c.color && tool !== "eraser" && styles.colorDotActive,
              ]}
              accessibilityLabel={c.label}
            />
          ))}
          <View style={styles.sep} />
          <Pressable
            onPress={() => setTool(tool === "draw" ? "draw" : "draw")}
            style={[styles.toolBtn, tool === "draw" && styles.toolBtnActive]}
            accessibilityLabel="Desenhar"
          >
            <Ionicons name="brush" size={16} color="#0F766E" />
          </Pressable>
          <Pressable
            onPress={() => setTool("text")}
            style={[styles.toolBtn, tool === "text" && styles.toolBtnActive]}
            accessibilityLabel="Adicionar texto"
          >
            <Text style={styles.toolText}>T</Text>
          </Pressable>
          <Pressable
            onPress={() => setTool("eraser")}
            style={[styles.toolBtn, tool === "eraser" && styles.toolBtnActive]}
            accessibilityLabel="Borracha"
          >
            <Ionicons name="trash-outline" size={16} color="#0F766E" />
          </Pressable>
          <View style={styles.sep} />
          <Pressable
            onPress={clearAll}
            style={styles.toolBtn}
            accessibilityLabel="Limpar tudo"
          >
            <Ionicons name="refresh" size={16} color="#0F766E" />
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {tool === "text"
            ? "Toque na tela onde quer adicionar texto"
            : tool === "eraser"
            ? "Toque para apagar tudo"
            : "Vermelho remove, verde adiciona, azul anota"}
        </Text>
      </View>

      <View
        style={[styles.sendWrap, { bottom: Math.max(28, insets.bottom + 24) }]}
        pointerEvents="box-none"
      >
        <Pressable onPress={handleSend} style={styles.sendBtn}>
          <Ionicons name="send" size={18} color="#fff" />
          <Text style={styles.sendBtnText}>Enviar pra Miar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
    gap: 6,
  },
  closeBig: {
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
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 70,
  },
  topBarInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#34D399",
    shadowColor: "#0F766E",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  sep: { width: 1, height: 18, backgroundColor: "rgba(15,118,110,0.15)", marginHorizontal: 2 },
  hint: {
    fontSize: 11,
    color: "#0F766E",
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    fontWeight: "700",
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(15,118,110,0.2)",
  },
  colorDotActive: {
    borderColor: "#0F766E",
    borderWidth: 3,
  },
  toolBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#D4F8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnActive: {
    backgroundColor: "#A8EFD0",
    borderWidth: 2,
    borderColor: "#10B981",
  },
  toolText: { fontSize: 16, fontWeight: "900", color: "#0F766E" },
  sendWrap: {
    position: "absolute",
    right: 18,
    zIndex: 65,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F766E",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#34D399",
    shadowColor: "#0F766E",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
