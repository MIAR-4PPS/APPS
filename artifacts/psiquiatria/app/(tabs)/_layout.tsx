import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useChatState } from "@/contexts/ChatStateContext";

function NativeTabLayout() {
  const { chatStarted } = useChatState();
  if (chatStarted) {
    // Esconde a barra de abas durante a conversa
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index" hidden />
        <NativeTabs.Trigger name="ia" hidden={false}>
          <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
          <Label>Miar</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="arquivos" hidden />
        <NativeTabs.Trigger name="configuracoes" hidden />
      </NativeTabs>
    );
  }
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index" hidden />
      <NativeTabs.Trigger name="ia">
        <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
        <Label>Miar</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="arquivos">
        <Icon sf={{ default: "folder", selected: "folder.fill" }} />
        <Label>Arquivos</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="configuracoes">
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <Label>Config</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { chatStarted } = useChatState();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: chatStarted
          ? { display: "none" }
          : {
              position: "absolute",
              backgroundColor: isIOS ? "transparent" : colors.background,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              elevation: 0,
              height: isWeb ? 84 : 60,
            },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="ia"
        options={{
          title: "Miar",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="sparkles" tintColor={color} size={22} />
            ) : (
              <Feather name="message-circle" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="arquivos"
        options={{
          title: "Arquivos",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="folder" tintColor={color} size={22} />
            ) : (
              <Feather name="folder" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="configuracoes"
        options={{
          title: "Config",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="gearshape" tintColor={color} size={22} />
            ) : (
              <Feather name="settings" size={20} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
