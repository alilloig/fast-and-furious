"use client";

import dynamic from "next/dynamic";

const ClientShell = dynamic(
  () =>
    import("@/components/layout/client-shell").then((mod) => mod.ClientShell),
  { ssr: false },
);

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
