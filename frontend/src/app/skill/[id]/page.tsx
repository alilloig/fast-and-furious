"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceDisplay } from "@/components/skills/price-display";
import { useSkillDetail } from "@/hooks/use-skill-detail";
import { useSellerVault } from "@/hooks/use-seller-vault";
import { usePurchaseSkill } from "@/hooks/use-purchase-skill";
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
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

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
              <div className="text-sm text-muted-foreground">Walrus Blob</div>
              <div className="truncate font-mono text-sm">{skill.walrusBlobId}</div>
            </div>
          </div>

          <Separator />

          {purchaseSuccess ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-600">
                Purchase successful!
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/purchases">View My Purchases</Link>
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
