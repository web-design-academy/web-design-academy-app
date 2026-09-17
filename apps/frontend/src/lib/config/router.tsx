import { createBrowserRouter } from "react-router";

import Root from "@/components/RootLayout";
import Dashboard from "@/screens/Dashboard";
import Lesson from "@/screens/Lesson";
import Admin from "@/screens/Admin.tsx";
import { isOnlineMode } from "@/lib/config/config.ts";
import EditDashboard from "@/screens/EditDashboard.tsx";
import Profile from "@/screens/Profile.tsx";

export const router = createBrowserRouter(
  [
    {
      Component: Root,
      children: [
        { index: true, Component: Dashboard },
        { path: "/lessons/:slug", Component: Lesson },
        { path: "/edit", Component: EditDashboard},
        ...(isOnlineMode ? [
          { path: "/profile", Component: Profile },
          { path: "/admin", Component: Admin },
        ] : []),
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
