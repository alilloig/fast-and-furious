"use client";

import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ReceiptCard } from "@/components/purchases/receipt-card";
import { usePurchaseReceipts } from "@/hooks/use-purchase-receipts";
import { usePlaybookListings } from "@/hooks/use-playbook-listings";

export default function PurchasesPage() {
  const account = useCurrentAccount();
  const { data: receipts, isLoading: receiptsLoading } = usePurchaseReceipts();

  const allPlaybookIds = Array.from(
    new Set(receipts?.flatMap((r) => r.playbookIds) ?? []),
  );
  const { data: playbooks } = usePlaybookListings(allPlaybookIds);

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
      ) : receiptsLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !receipts || receipts.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          description="Browse the marketplace to find AI playbooks to purchase."
        />
      ) : (
        <div className="space-y-4">
          {receipts.map((receipt) => (
            <ReceiptCard
              key={receipt.id}
              receipt={receipt}
              skills={playbooks ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
