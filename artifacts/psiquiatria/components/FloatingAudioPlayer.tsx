import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type AudioSpeed, useAudio } from "@/contexts/AudioContext";
import { useColors } from "@/hooks/useColors";

const SPEEDS: AudioSpeed[] = [0.5, 1, 1.5, 2, 2.5, 3];

export default function FloatingAudioPlayer() {
  const { isPlaying, isPaused, currentText, speed, setSpeed, pause, resume, stop, back, isLoading } =
    useAudio();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [showSpeeds, setShowSpeeds] = useState(false);

  const visible = isPlaying || isPaused || isLoading;
  if (!visible) return null;

  const TAB_BAR = 60;
  const bottomOffset = TAB_BAR + (Platform.OS === "web" ? 34 : insets.bottom);

  return (
    <View
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          backgroundColor: colors.primary,
          borderRadius: colors.radius ?? 16,
          marginHorizontal: 12,
        },
      ]}
    >
      {showSpeeds && (
        <View
          style={[
            styles.speedPanel,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {SPEEDS.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  setSpeed(s);
                  setShowSpeeds(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.speedBtn,
                  {
                    backgroundColor:
                      speed === s ? colors.primary : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.speedText,
                    { color: speed === s ? colors.primaryForeground : colors.text },
                  ]}
                >
                  {s}x
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.row}>
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
        ) : (
          <Feather name="volume-2" size={16} color="#fff" style={{ marginRight: 8 }} />
        )}

        <Text style={styles.label} numberOfLines={1}>
          {isLoading ? "Gerando áudio..." : (currentText?.substring(0, 40) + (currentText && currentText.length > 40 ? "..." : ""))}
        </Text>

        <View style={styles.controls}>
          <Pressable
            onPress={() => {
              back();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.iconBtn}
          >
            <Feather name="rotate-ccw" size={18} color="#fff" />
          </Pressable>

          <Pressable
            onPress={() => {
              if (isPlaying) pause();
              else resume();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={styles.iconBtn}
          >
            <Feather name={isPlaying ? "pause" : "play"} size={20} color="#fff" />
          </Pressable>

          <Pressable
            onPress={() => {
              setShowSpeeds((v) => !v);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.iconBtn}
          >
            <Text style={styles.speedChip}>{speed}x</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              stop();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.iconBtn}
          >
            <Feather name="x" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    zIndex: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  speedChip: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  speedPanel: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  speedBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 6,
  },
  speedText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
