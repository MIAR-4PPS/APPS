import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const KEY_ENABLED = "miar_biometric_lock";

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHw = await LocalAuthentication.hasHardwareAsync();
    if (!hasHw) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(KEY_ENABLED);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  try {
    if (on) await SecureStore.setItemAsync(KEY_ENABLED, "1");
    else await SecureStore.deleteItemAsync(KEY_ENABLED);
  } catch {
    /* silencioso */
  }
}

export async function promptBiometric(
  reason = "Desbloqueie a MIAR APPS",
): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancelar",
      disableDeviceFallback: false,
    });
    return r.success === true;
  } catch {
    return false;
  }
}
