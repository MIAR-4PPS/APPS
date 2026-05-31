import { Platform } from "react-native";

const DEV_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const PROD_DOMAIN = "psycho-archive-assistant--Dr-Pauista.replit.app";

function getApiBase(): string {
  if (DEV_DOMAIN) {
    return `https://${DEV_DOMAIN}`;
  }
  return `https://${PROD_DOMAIN}`;
}

export const API_BASE = getApiBase();

export function apiUrl(path: string): string {
  const base = getApiBase();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
