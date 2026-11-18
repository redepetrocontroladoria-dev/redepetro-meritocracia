"use client";

import { usePathname } from "next/navigation";

const HIDDEN_NAV_PATHS = ["/login", "/setup"];

type AppShellProps = {
  nav: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ nav, children }: AppShellProps) {
  const pathname = usePathname();
  const hideNav = HIDDEN_NAV_PATHS.includes(pathname);

  return (
    <>
      {!hideNav ? nav : null}
      {children}
    </>
  );
}
