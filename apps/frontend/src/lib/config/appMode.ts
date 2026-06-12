export type AppMode = "online" | "offline";

const normalizedMode = import.meta.env.VITE_APP_MODE?.trim().toLowerCase();

export const appMode: AppMode =
  normalizedMode === "online" ? "online" : "offline";

export const isOnlineMode = appMode === "online";
export const isOfflineMode = appMode === "offline";

export const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
export const isGoogleAuthEnabled = isOnlineMode && googleClientId.length > 0;

export function requireOnlineMode(featureName: string) {
  if (!isOnlineMode) {
    throw new Error(`${featureName} is available only in online mode.`);
  }
}
