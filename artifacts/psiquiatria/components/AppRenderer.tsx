import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const GREEN_DARK = "#0F766E";
const GREEN = "#10B981";
const GREEN_BRIGHT = "#34D399";
const GREEN_PALE = "#D4F8E8";
const PINK = "#EC4899";

export type AppSpec =
  | { type: "todo"; config: { title: string; initialItems?: string[] } }
  | {
      type: "counter";
      config: { title: string; label?: string; start?: number; step?: number };
    }
  | { type: "notes"; config: { title: string; placeholder?: string } }
  | {
      type: "info";
      config: {
        title: string;
        sections: Array<{ heading?: string; body: string }>;
      };
    };

export type MiarApp = {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  spec: AppSpec;
  createdAt: number;
};

function useAppState<T>(appId: string, key: string, initial: T) {
  const storageKey = `miar-app-${appId}-${key}`;
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            setValue(JSON.parse(raw) as T);
          } catch {
            /* ignora */
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, [storageKey]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        AsyncStorage.setItem(storageKey, JSON.stringify(v)).catch(() => {});
        return v;
      });
    },
    [storageKey],
  );

  return [value, update, loaded] as const;
}

type TodoItem = { id: string; text: string; done: boolean };

function TodoRenderer({ app }: { app: MiarApp & { spec: { type: "todo" } } }) {
  const initial: TodoItem[] = (app.spec.config.initialItems ?? []).map(
    (text, i) => ({
      id: `init-${i}`,
      text,
      done: false,
    }),
  );
  const [items, setItems, loaded] = useAppState<TodoItem[]>(
    app.id,
    "items",
    initial,
  );
  const [draft, setDraft] = useState("");

  if (!loaded) return <ActivityIndicator color={GREEN_DARK} />;

  const remaining = items.filter((i) => !i.done).length;

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.counter}>
        {remaining} {remaining === 1 ? "pendente" : "pendentes"} de {items.length}
      </Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Adicionar item..."
          placeholderTextColor="rgba(15,118,110,0.5)"
          onSubmitEditing={() => {
            const t = draft.trim();
            if (!t) return;
            setItems((prev) => [
              ...prev,
              { id: `t-${Date.now()}`, text: t, done: false },
            ]);
            setDraft("");
          }}
        />
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            const t = draft.trim();
            if (!t) return;
            setItems((prev) => [
              ...prev,
              { id: `t-${Date.now()}`, text: t, done: false },
            ]);
            setDraft("");
          }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
        {items.map((item) => (
          <View key={item.id} style={styles.todoRow}>
            <Pressable
              onPress={() =>
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id ? { ...i, done: !i.done } : i,
                  ),
                )
              }
              style={[styles.checkbox, item.done && styles.checkboxDone]}
            >
              {item.done && <Ionicons name="checkmark" size={16} color="#fff" />}
            </Pressable>
            <Text
              style={[
                styles.todoText,
                item.done && {
                  textDecorationLine: "line-through",
                  color: "rgba(15,118,110,0.5)",
                },
              ]}
            >
              {item.text}
            </Text>
            <Pressable
              onPress={() =>
                setItems((prev) => prev.filter((i) => i.id !== item.id))
              }
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={18} color={PINK} />
            </Pressable>
          </View>
        ))}
        {items.length === 0 && (
          <Text style={styles.empty}>Lista vazia. Adicione o primeiro item ✨</Text>
        )}
      </ScrollView>
    </View>
  );
}

function CounterRenderer({
  app,
}: {
  app: MiarApp & { spec: { type: "counter" } };
}) {
  const start = app.spec.config.start ?? 0;
  const step = app.spec.config.step ?? 1;
  const [count, setCount, loaded] = useAppState<number>(app.id, "count", start);

  if (!loaded) return <ActivityIndicator color={GREEN_DARK} />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
      {!!app.spec.config.label && (
        <Text style={styles.counterLabel}>{app.spec.config.label}</Text>
      )}
      <Text style={styles.counterBig}>{count}</Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <Pressable
          style={[styles.counterBtn, { backgroundColor: PINK }]}
          onPress={() => setCount((c) => c - step)}
        >
          <Ionicons name="remove" size={28} color="#fff" />
        </Pressable>
        <Pressable
          style={[styles.counterBtn, { backgroundColor: GREEN_DARK }]}
          onPress={() => setCount((c) => c + step)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>
      <Pressable onPress={() => setCount(start)}>
        <Text style={{ color: GREEN_DARK, fontWeight: "600", fontSize: 13 }}>
          Zerar
        </Text>
      </Pressable>
    </View>
  );
}

function NotesRenderer({
  app,
}: {
  app: MiarApp & { spec: { type: "notes" } };
}) {
  const [text, setText, loaded] = useAppState<string>(app.id, "text", "");
  if (!loaded) return <ActivityIndicator color={GREEN_DARK} />;
  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={app.spec.config.placeholder ?? "Escreva aqui..."}
        placeholderTextColor="rgba(15,118,110,0.45)"
        style={styles.notesArea}
        textAlignVertical="top"
      />
      <Text style={styles.notesCount}>{text.length} caracteres</Text>
    </View>
  );
}

function InfoRenderer({
  app,
}: {
  app: MiarApp & { spec: { type: "info" } };
}) {
  return (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>
      {app.spec.config.sections.map((s, i) => (
        <View key={i} style={styles.infoSection}>
          {!!s.heading && <Text style={styles.infoHeading}>{s.heading}</Text>}
          <Text style={styles.infoBody}>{s.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export function AppRenderer({
  app,
  onClose,
}: {
  app: MiarApp;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.shell}>
      <View style={[styles.shellHeader, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={16}
          accessibilityLabel="Voltar para o chat da Miar"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
          <Text style={styles.backTxt}>Voltar</Text>
        </Pressable>
        <Text style={styles.shellTitle} numberOfLines={1}>
          {app.emoji ? `${app.emoji} ` : ""}
          {app.name}
        </Text>
        <View style={{ width: 84 }} />
      </View>
      <View style={styles.shellBody}>
        {app.spec.type === "todo" && (
          <TodoRenderer app={app as MiarApp & { spec: { type: "todo" } }} />
        )}
        {app.spec.type === "counter" && (
          <CounterRenderer app={app as MiarApp & { spec: { type: "counter" } }} />
        )}
        {app.spec.type === "notes" && (
          <NotesRenderer app={app as MiarApp & { spec: { type: "notes" } }} />
        )}
        {app.spec.type === "info" && (
          <InfoRenderer app={app as MiarApp & { spec: { type: "info" } }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: GREEN_PALE },
  shellHeader: {
    backgroundColor: GREEN_DARK,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    width: 84,
    paddingVertical: 6,
    paddingRight: 8,
    gap: 2,
  },
  backTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  shellTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
  },
  shellBody: { flex: 1, padding: 14 },
  counter: { color: GREEN_DARK, fontWeight: "700", marginBottom: 8 },
  addRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  addInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: GREEN_DARK,
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: GREEN,
    width: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: GREEN_BRIGHT,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GREEN_DARK,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxDone: { backgroundColor: GREEN_DARK },
  todoText: { flex: 1, color: GREEN_DARK, fontWeight: "600", fontSize: 15 },
  empty: {
    textAlign: "center",
    color: GREEN_DARK,
    opacity: 0.6,
    fontStyle: "italic",
    marginTop: 24,
  },
  counterLabel: { fontSize: 18, color: GREEN_DARK, fontWeight: "700" },
  counterBig: {
    fontSize: 88,
    fontWeight: "900",
    color: GREEN_DARK,
    letterSpacing: -2,
  },
  counterBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  notesArea: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    color: GREEN_DARK,
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
    minHeight: 240,
  },
  notesCount: {
    textAlign: "right",
    color: GREEN_DARK,
    opacity: 0.6,
    marginTop: 6,
    fontSize: 12,
  },
  infoSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: GREEN_BRIGHT,
  },
  infoHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: GREEN_DARK,
    marginBottom: 6,
  },
  infoBody: { fontSize: 14, color: GREEN_DARK, lineHeight: 20 },
});
