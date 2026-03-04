"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/skills/price-display";
import { DecryptButton } from "./decrypt-button";
import type { PurchaseReceipt, SkillListing } from "@/lib/types";
import { truncateAddress } from "@/lib/utils";
import { WalrusScanLink } from "@/components/walrus-scan-link";

interface ReceiptCardProps {
  receipt: PurchaseReceipt;
  skills: SkillListing[];
}

export function ReceiptCard({ receipt, skills }: ReceiptCardProps) {
  // Map skill IDs to resolved skill data
  const skillMap = new Map(skills.map((s) => [s.id, s]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {receipt.skillIds.length === 1 ? "Skill Purchase" : "Bundle Purchase"}
          </CardTitle>
          <Badge variant="secondary">Epoch {receipt.purchasedAtEpoch}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {receipt.skillIds.map((skillId) => {
            const skill = skillMap.get(skillId);
            return (
              <div
                key={skillId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  {skill ? (
                    <div className="space-y-1">
                      <Link
                        href={`/skill/${skillId}`}
                        className="font-medium hover:underline"
                      >
                        {skill.title}
                      </Link>
                      <WalrusScanLink blobId={skill.walrusBlobId} />
                    </div>
                  ) : (
                    <span className="font-mono text-sm text-muted-foreground">
                      {truncateAddress(skillId, 8)}
                    </span>
                  )}
                </div>
                {skill && (
                  <DecryptButton
                    receiptId={receipt.id}
                    walrusBlobId={skill.walrusBlobId}
                    skillTitle={skill.title}
                  />
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
