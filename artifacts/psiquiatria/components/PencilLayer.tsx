import React, { useMemo, useRef } from "react";
import {
  PanResponder,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { usePencil } from "@/contexts/PencilContext";

export function PencilLayer() {
  const {
    pencilOpen,
    strokes,
    setStrokes,
    annotations,
    setAnnotations,
    tool,
    color,
  } = usePencil();
  const currentRef = useRef<string>("");

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => pencilOpen,
        onMoveShouldSetPanResponder: () => pencilOpen,
        onPanResponderGrant: (evt) => {
          if (!pencilOpen) return;
          const { locationX, locationY } = evt.nativeEvent;
          if (tool === "eraser") {
            setStrokes([]);
            setAnnotations([]);
            return;
          }
          if (tool === "text") {
            setAnnotations((prev) => [
              ...prev,
              {
                id: `t-${Date.now()}`,
                x: Math.max(8, locationX - 40),
                y: Math.max(8, locationY - 14),
                text: "",
                color,
              },
            ]);
            return;
          }
          currentRef.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
          setStrokes((prev) => [...prev, { color, d: currentRef.current }]);
        },
        onPanResponderMove: (evt) => {
          if (!pencilOpen || tool !== "draw") return;
          const { locationX, locationY } = evt.nativeEvent;
          currentRef.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
          setStrokes((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            const next = prev.slice(0, -1);
            next.push({ color: last.color, d: currentRef.current });
            return next;
          });
        },
        onPanResponderRelease: () => {
          currentRef.current = "";
        },
        onPanResponderTerminate: () => {
          currentRef.current = "";
        },
      }),
    [pencilOpen, tool, color, setStrokes, setAnnotations],
  );

  return (
    <View
      pointerEvents={pencilOpen ? "box-none" : "none"}
      style={StyleSheet.absoluteFill}
    >
      <View
        {...panResponder.panHandlers}
        style={StyleSheet.absoluteFill}
        pointerEvents={pencilOpen ? "auto" : "none"}
      >
        <Svg style={StyleSheet.absoluteFill}>
          {strokes.map((s, i) => (
            <Path
              key={i}
              d={s.d}
              stroke={s.color}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>

      {annotations.map((a) => (
        <TextInput
          key={a.id}
          value={a.text}
          onChangeText={(t) =>
            setAnnotations((prev) =>
              prev.map((p) => (p.id === a.id ? { ...p, text: t } : p)),
            )
          }
          editable={pencilOpen}
          placeholder="texto..."
          placeholderTextColor="rgba(15,118,110,0.55)"
          multiline
          style={[
            styles.annotation,
            {
              top: a.y,
              left: a.x,
              borderColor: a.color,
              color: a.color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  annotation: {
    position: "absolute",
    minWidth: 90,
    maxWidth: 240,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 14,
    fontWeight: "700",
  },
});
