"use client";

import { use, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceDisplay } from "@/components/skills/price-display";
import { WalrusScanLink } from "@/components/walrus-scan-link";
import { StorageStatusBadge } from "@/components/storage-status-badge";
import { DecryptButton } from "@/components/purchases/decrypt-button";
import { useSkillDetail } from "@/hooks/use-skill-detail";
import { useSellerVault } from "@/hooks/use-seller-vault";
import { usePurchaseSkill } from "@/hooks/use-purchase-skill";
import { usePurchaseReceipts } from "@/hooks/use-purchase-receipts";
import { useWalrusEpoch } from "@/hooks/use-current-epoch";
import { truncateAddress, formatSui } from "@/lib/utils";

export default function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const account = useCurrentAccount();
  const { data: skill, isLoading } = useSkillDetail(id);
  const { data: vaultId, isLoading: vaultLoading } = useSellerVault(skill?.seller);
  const purchaseMutation = usePurchaseSkill();
  const { data: receipts } = usePurchaseReceipts();
  const { data: epochInfo } = useWalrusEpoch();
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const owningReceipt = receipts?.find((r) => r.skillIds.includes(id));
  const alreadyPurchased = !!owningReceipt;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 text-center">
        <h1 className="text-2xl font-bold">Skill not found</h1>
        <Button asChild variant="ghost" className="mt-4">
          <Link href="/explore">Back to Explore</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/explore">Back</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-2xl">{skill.title}</CardTitle>
            <Badge variant="secondary">{skill.category}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">{skill.description}</p>

          <div className="flex flex-wrap gap-2">
            {skill.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          {skill.fileNames.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="mb-2 text-sm font-medium">
                  Files Included ({skill.fileNames.length})
                </div>
                <div className="space-y-1">
                  {skill.fileNames.map((name) => (
                    <div
                      key={name}
                      className="rounded border px-3 py-1.5 font-mono text-sm"
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">Price</div>
              <PriceDisplay price={skill.price} className="text-xl font-bold" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Seller</div>
              <div className="font-mono text-sm">{truncateAddress(skill.seller, 8)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Listed Epoch</div>
              <div className="text-sm">{skill.createdAtEpoch}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Storage ID</div>
              <div className="truncate font-mono text-sm">{skill.walrusBlobId}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Storage Status</div>
              <div className="mt-1">
                <StorageStatusBadge
                  storageEndEpoch={skill.storageEndEpoch}
                  epochInfo={epochInfo}
                />
              </div>
            </div>
          </div>

          <Separator />

          {alreadyPurchased || purchaseSuccess ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">
                  {purchaseSuccess ? "Purchase successful!" : "You own this skill"}
                </span>
              </div>
              {owningReceipt && (
                <DecryptButton
                  receiptId={owningReceipt.id}
                  receipt={owningReceipt}
                  skill={skill!}
                  walrusBlobId={skill!.walrusBlobId}
                  walrusQuiltId={skill!.walrusQuiltId}
                  fileNames={skill!.fileNames}
                  skillTitle={skill!.title}
                />
              )}
              <Button asChild variant="ghost" size="sm" className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground">
                <Link href="/purchases">Go to My Purchases →</Link>
              </Button>
            </div>
          ) : !account ? (
            <ConnectButton />
          ) : vaultLoading ? (
            <Button size="lg" disabled>
              Loading...
            </Button>
          ) : !vaultId ? (
            <Button size="lg" disabled>
              Seller vault not set up
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                size="lg"
                disabled={purchaseMutation.isPending}
                onClick={() =>
                  purchaseMutation.mutate(
                    { listingId: id, vaultId, price: skill!.price },
                    { onSuccess: () => setPurchaseSuccess(true) },
                  )
                }
              >
                {purchaseMutation.isPending
                  ? "Purchasing..."
                  : `Purchase for ${formatSui(skill!.price)}`}
              </Button>
              {purchaseMutation.isError && (
                <p className="text-sm text-destructive">
                  {purchaseMutation.error instanceof Error
                    ? purchaseMutation.error.message
                    : "Purchase failed"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
