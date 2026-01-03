import { createBrowserRouter } from "react-router";

import Root from "@/components/RootLayout";
import Dashboard from "@/screens/Dashboard";
import Lesson from "@/screens/Lesson";
import AdminPage from "@/screens/AdminPage";
import Login from "@/screens/Login";

export const router = createBrowserRouter([
  {
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "/lessons/:slug", Component: Lesson },
      { path: "/admin", Component: AdminPage },
      { path: "/login", Component: Login },
    ],
  },
]);
