import { Outlet } from "react-router";

export default function Root() {
  return (
    <>
      <header>App</header>
      <Outlet />
      <footer>2025</footer>
    </>
  );
}
