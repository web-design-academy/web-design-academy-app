import { createBrowserRouter } from "react-router";

import Root from "@/components/RootLayout";
import Dashboard from "@/screens/Dashboard";
import Lesson from "@/screens/Lesson";
import AdminPage from "@/screens/AdminPage";
import { isOnlineMode } from "@/lib/config/appMode";

export const router = createBrowserRouter([
  {
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "/lessons/:slug", Component: Lesson },
      ...(isOnlineMode ? [{ path: "/admin", Component: AdminPage }] : []),
    ],
  },
]);
