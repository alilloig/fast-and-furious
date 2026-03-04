"use client";

import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";

export default function PurchasesPage() {
  const account = useCurrentAccount();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">My Purchases</h1>

      {!account ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-muted-foreground">
              Connect your wallet to view your purchases.
            </p>
            <ConnectButton />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Coming in Phase 4"
          description="Purchase and decryption flows will be available after contracts are deployed to testnet."
        />
      )}
    </div>
  );
}
