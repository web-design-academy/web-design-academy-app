import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";

import { router } from "@/lib/config/router.tsx";
import {
  googleClientId,
  isGoogleAuthEnabled,
  isOnlineMode,
} from "@/lib/config/appMode";
import "@/styles/tailwind.css";
import "@/styles/system/tokens.css";
import "@/styles/system/base.css";
import { ThemeProvider } from "./lib/ctx/ThemeContext";
import { AuthProvider } from "./lib/ctx/AuthContext";

const queryClient = new QueryClient();

if (isOnlineMode && !isGoogleAuthEnabled) {
  console.warn(
    "Online mode is enabled, but VITE_GOOGLE_CLIENT_ID is empty. Google sign-in will be disabled.",
  );
}

const app = (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
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
