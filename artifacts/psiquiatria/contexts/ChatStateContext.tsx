import React, { createContext, useContext, useMemo, useState } from "react";

type ChatStateValue = {
  chatStarted: boolean;
  setChatStarted: (v: boolean) => void;
};

const ChatStateContext = createContext<ChatStateValue | null>(null);

export function ChatStateProvider({ children }: { children: React.ReactNode }) {
  const [chatStarted, setChatStarted] = useState(false);
  const value = useMemo(
    () => ({ chatStarted, setChatStarted }),
    [chatStarted],
  );
  return (
    <ChatStateContext.Provider value={value}>
      {children}
    </ChatStateContext.Provider>
  );
}

export function useChatState() {
  const ctx = useContext(ChatStateContext);
  if (!ctx) {
    // Fora do provider (segurança): devolve um estado neutro.
    return { chatStarted: false, setChatStarted: () => {} };
  }
  return ctx;
}
