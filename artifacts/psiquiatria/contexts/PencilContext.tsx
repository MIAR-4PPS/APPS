import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";

export type Stroke = { color: string; d: string };
export type Annotation = { id: string; x: number; y: number; text: string; color: string };
export type Tool = "draw" | "text" | "eraser";

type PendingCapture = { uri: string; ts: number } | null;

type Ctx = {
  pencilOpen: boolean;
  openPencil: () => void;
  closePencil: () => void;
  captureViewRef: React.MutableRefObject<View | null>;
  strokes: Stroke[];
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  clearAll: () => void;
  pendingCapture: PendingCapture;
  setPendingCapture: (p: PendingCapture) => void;
  consumePending: () => PendingCapture;
};

const PencilCtx = createContext<Ctx | null>(null);

export function PencilProvider({ children }: { children: React.ReactNode }) {
  const captureViewRef = useRef<View | null>(null);
  const [pencilOpen, setPencilOpen] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState<string>("#10B981");
  const [pendingCapture, setPendingCaptureState] = useState<PendingCapture>(null);

  const openPencil = useCallback(() => setPencilOpen(true), []);
  const closePencil = useCallback(() => {
    setPencilOpen(false);
    setStrokes([]);
    setAnnotations([]);
  }, []);
  const clearAll = useCallback(() => {
    setStrokes([]);
    setAnnotations([]);
  }, []);
  const setPendingCapture = useCallback((p: PendingCapture) => {
    setPendingCaptureState(p);
  }, []);
  const consumePending = useCallback(() => {
    let v: PendingCapture = null;
    setPendingCaptureState((curr) => {
      v = curr;
      return null;
    });
    return v;
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      pencilOpen,
      openPencil,
      closePencil,
      captureViewRef,
      strokes,
      setStrokes,
      annotations,
      setAnnotations,
      tool,
      setTool,
      color,
      setColor,
      clearAll,
      pendingCapture,
      setPendingCapture,
      consumePending,
    }),
    [
      pencilOpen,
      openPencil,
      closePencil,
      strokes,
      annotations,
      tool,
      color,
      clearAll,
      pendingCapture,
      setPendingCapture,
      consumePending,
    ],
  );

  return <PencilCtx.Provider value={value}>{children}</PencilCtx.Provider>;
}

export function usePencil() {
  const ctx = useContext(PencilCtx);
  if (!ctx) throw new Error("usePencil deve ser usado dentro de PencilProvider");
  return ctx;
}
