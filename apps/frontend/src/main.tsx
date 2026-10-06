import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {RouterProvider} from "react-router";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {GoogleOAuthProvider} from "@react-oauth/google";

import {router} from "@/lib/config/router.tsx";
import {googleClientId, isGoogleAuthEnabled, isOnlineMode,} from "@/lib/config/config.ts";
import "@wda/ui-styles/tokens.css";
import "@/styles/system/base.css";
import {ThemeProvider} from "./lib/ctx/ThemeContext";
import {AuthProvider} from "./lib/ctx/AuthContext";
import {UiPreferencesProvider} from "./lib/ctx/UiPreferencesContext";
import DownloaderProvider from "@/components/Downloader.tsx";
import NotificationsProvider from "@/components/Notifications.tsx";

const queryClient = new QueryClient();

if (isOnlineMode && !isGoogleAuthEnabled) {
  console.warn(
    "Online mode is enabled, but VITE_GOOGLE_CLIENT_ID is empty. Google sign-in will be disabled.",
  );
}

const app = (
  <NotificationsProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UiPreferencesProvider>
          <AuthProvider>
            <DownloaderProvider>
              <RouterProvider router={router}/>
            </DownloaderProvider>
          </AuthProvider>
        </UiPreferencesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </NotificationsProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isGoogleAuthEnabled ? (
      <GoogleOAuthProvider clientId={googleClientId} locale="en">
        {app}
      </GoogleOAuthProvider>
    ) : (
      app
    )}
  </StrictMode>,
);
