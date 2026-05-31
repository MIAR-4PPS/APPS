import { Ionicons } from "@expo/vector-icons";
import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type HoldMicButtonProps = {
  onRecorded: (uri: string, durationSec: number) => void;
  onDenied: () => void;
  disabled?: boolean;
  hint: string;
  recordingLabel: string;
};

export function HoldMicButton({
  onRecorded,
  onDenied,
  disabled,
  hint,
  recordingLabel,
}: HoldMicButtonProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    };
  }, []);

  const pulseAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: recording ? 1 : 0,
  }));

  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(async () => {
    if (!recording) return;
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    let uri = "";
    const dur = Math.floor((Date.now() - startRef.current) / 1000);
    try {
      await recorder.stop();
      uri = recorder.uri ?? "";
    } catch {
      uri = "";
    } finally {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      pulse.value = withTiming(1);
      setRecording(false);
      setElapsed(0);
    }
    if (uri && dur > 0) onRecorded(uri, dur);
  }, [recording, recorder, onRecorded, pulse]);

  const start = useCallback(async () => {
    if (disabled || recording) return;
    try {
      if (Platform.OS !== "web") {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          onDenied();
          return;
        }
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      startRef.current = Date.now();
      setElapsed(0);
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 500, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 250);
      autoStopRef.current = setTimeout(() => {
        stop();
      }, 6000);
    } catch {
      setRecording(false);
    }
  }, [disabled, recording, recorder, onDenied, pulse, stop]);

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(1, "0")}:${String(
    elapsed % 60,
  ).padStart(2, "0")}`;

  return (
    <View>
      {recording && (
        <View style={styles.recordingBadge}>
          <Animated.View style={[styles.pulseDot, pulseAnim]} />
          <Text style={styles.recordingText}>
            {recordingLabel} {mmss}
          </Text>
        </View>
      )}
      <Pressable
        onPressIn={start}
        onPressOut={stop}
        disabled={disabled}
        style={({ pressed }) => [
          styles.micBtn,
          pressed && { opacity: 0.85 },
          recording && styles.micBtnActive,
          disabled && { backgroundColor: "#9CA3AF" },
        ]}
        accessibilityLabel={hint}
      >
        <Ionicons name={recording ? "mic" : "mic-outline"} size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: "#EC4899",
  },
  recordingBadge: {
    position: "absolute",
    bottom: 46,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#EC4899",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EC4899",
  },
  recordingText: {
    fontSize: 12,
    color: "#0F766E",
    fontWeight: "800",
  },
});
