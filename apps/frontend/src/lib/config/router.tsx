import { createBrowserRouter } from "react-router";

import Root from "@/components/RootLayout";
import Dashboard from "@/screens/Dashboard";
import Lesson from "@/screens/Lesson";
import AdminPage from "@/screens/AdminPage";
import { isOnlineMode } from "@/lib/config/appMode";

// The app is served both under a sub-path (dexter.fit.vutbr.cz/wda, baked in as
// import.meta.env.BASE_URL) and at the root of its own domain. Assets and the API
// keep the build-time prefix (nginx routes it), only the router basename must
// follow the host it is actually loaded from.
const VANITY_HOSTS = new Set([
  "webdesignacademy.org",
  "www.webdesignacademy.org",
]);
const basename =
  typeof window !== "undefined" && VANITY_HOSTS.has(window.location.hostname)
    ? "/"
    : import.meta.env.BASE_URL;

export const router = createBrowserRouter(
  [
    {
      Component: Root,
      children: [
        { index: true, Component: Dashboard },
        { path: "/lessons/:slug", Component: Lesson },
        ...(isOnlineMode ? [{ path: "/admin", Component: AdminPage }] : []),
      ],
    },
  ],
  { basename },
);
