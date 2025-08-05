import { createBrowserRouter } from "react-router";
import Root from "../layouts/Root";
import Dashboard from "../screens/Dashboard";
import Lesson from "../screens/Lesson";

export const router = createBrowserRouter([
  {
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "/lessons/:slug", Component: Lesson },
    ],
  },
]);
