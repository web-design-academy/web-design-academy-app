const normalizedMode = import.meta.env.VITE_APP_MODE?.trim().toLowerCase();

// ONLINE MODE

/**
 * Base URL for the application.
 * Used to construct URLs for API requests, etc.
 */
export const baseUrl = import.meta.env.BASE_URL?.trim() ?? "";

/**
 * Indicates whether the application is running in online mode.
 */
export const isOnlineMode = normalizedMode === "online";

// GOOGLE AUTH

/**
 * Google client ID for OAuth authentication.
 */
export const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

/**
 * Indicates whether Google OAuth authentication is enabled.
 */
export const isGoogleAuthEnabled = isOnlineMode && googleClientId.length > 0;

/**
 * Ensures that the application is in online mode before allowing access
 * to a specific feature. Throws an error if the application is not
 * in online mode.
 *
 * @param {string} featureName - The name of the feature requiring online mode.
 * @return {void} This function does not return a value. It throws an error if the condition is not met.
 */
export function requireOnlineMode(featureName: string): void {
  if (!isOnlineMode) {
    throw new Error(`${featureName} is available only in online mode.`);
  }
}
