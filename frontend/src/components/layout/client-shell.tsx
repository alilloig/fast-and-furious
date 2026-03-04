"use client";

import { useMemo } from "react";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDAppKit } from "@/lib/dapp-kit";
import { Header } from "./header";
import { Footer } from "./footer";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function ClientShell({ children }: { children: React.ReactNode }) {
  const dAppKit = useMemo(() => getDAppKit(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <TooltipProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </TooltipProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
