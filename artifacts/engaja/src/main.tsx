import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Registra o service worker pro app ficar instalável como APK via PWABuilder.
// Só em produção — em dev (vite HMR) atrapalha.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/engaja/sw.js", { scope: "/engaja/" })
      .catch(() => undefined);
  });
}
