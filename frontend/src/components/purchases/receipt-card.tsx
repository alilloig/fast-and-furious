"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/skills/price-display";
import { DecryptButton } from "./decrypt-button";
import type { PurchaseReceipt, PlaybookListing } from "@/lib/types";
import { truncateAddress } from "@/lib/utils";
import { WalrusScanLink } from "@/components/walrus-scan-link";
import { useSuiEpoch } from "@/hooks/use-current-epoch";
import { suiEpochToApproxDate, formatEpochDate } from "@/lib/walrus-epoch";

interface ReceiptCardProps {
  receipt: PurchaseReceipt;
  skills: PlaybookListing[];
}

export function ReceiptCard({ receipt, skills }: ReceiptCardProps) {
  const { data: suiEpoch } = useSuiEpoch();
  const playbookMap = new Map(skills.map((s) => [s.id, s]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {receipt.playbookIds.length === 1 ? "Playbook Purchase" : "Bundle Purchase"}
          </CardTitle>
          <Badge variant="secondary">
            {suiEpoch
              ? formatEpochDate(
                  suiEpochToApproxDate(
                    receipt.purchasedAtEpoch,
                    suiEpoch.epoch,
                    suiEpoch.epochStartMs,
                    suiEpoch.epochDurationMs,
                  ),
                )
              : `Epoch ${receipt.purchasedAtEpoch}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {receipt.playbookIds.map((playbookId) => {
            const playbook = playbookMap.get(playbookId);
            return (
              <div
                key={playbookId}
                className="relative flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  {playbook ? (
                    <div className="space-y-1">
                      <Link
                        href={`/playbook/${playbookId}`}
                        className="font-medium hover:underline after:absolute after:inset-0"
                      >
                        {playbook.title}
                      </Link>
                      <div className="relative z-10">
                        <WalrusScanLink blobId={playbook.walrusBlobId} />
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono text-sm text-muted-foreground">
                      {truncateAddress(playbookId, 8)}
                    </span>
                  )}
                </div>
                {playbook && (
                  <div className="relative z-10">
                    <DecryptButton
                      receiptId={receipt.id}
                      receipt={receipt}
                      skill={playbook}
                      walrusBlobId={playbook.walrusBlobId}
                      walrusQuiltId={playbook.walrusQuiltId}
                      fileNames={playbook.fileNames}
                      skillTitle={playbook.title}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Paid: <PriceDisplay price={receipt.amountPaid} className="inline font-medium" />
          </span>
          <span>Seller: {truncateAddress(receipt.seller, 6)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
