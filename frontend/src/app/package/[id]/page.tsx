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
import { usePackageDetail } from "@/hooks/use-package-detail";
import { useSkillListings } from "@/hooks/use-skill-listings";
import { useSellerVault } from "@/hooks/use-seller-vault";
import { usePurchasePackage } from "@/hooks/use-purchase-package";
import { usePurchaseReceipts } from "@/hooks/use-purchase-receipts";
import { truncateAddress, formatSui } from "@/lib/utils";

export default function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const account = useCurrentAccount();
  const { data: pkg, isLoading } = usePackageDetail(id);
  const { data: includedSkills } = useSkillListings(pkg?.skillIds ?? []);
  const { data: vaultId, isLoading: vaultLoading } = useSellerVault(pkg?.seller);
  const purchaseMutation = usePurchasePackage();
  const { data: receipts } = usePurchaseReceipts();
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const alreadyPurchased = pkg != null && (receipts?.some((r) =>
    pkg.skillIds.every((sid) => r.skillIds.includes(sid))
  ) ?? false);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 text-center">
        <h1 className="text-2xl font-bold">Package not found</h1>
        <Button asChild variant="ghost" className="mt-4">
          <Link href="/explore">Back to Explore</Link>
        </Button>
      </div>
    );
  }

  const discountPercent = (pkg.discountBps / 100).toFixed(0);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/explore">Back</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-2xl">{pkg.title}</CardTitle>
            <Badge>Bundle</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">{pkg.description}</p>

          <div className="flex items-center gap-3">
            <PriceDisplay price={pkg.price} className="text-xl font-bold" />
            {pkg.discountBps > 0 && (
              <Badge variant="secondary">{discountPercent}% off</Badge>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 font-semibold">
              Included Skills ({pkg.skillIds.length})
            </h3>
            <div className="space-y-2">
              {includedSkills?.map((skill) => (
                <Link
                  key={skill.id}
                  href={`/skill/${skill.id}`}
                  className="block rounded-lg border p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{skill.title}</span>
                    <PriceDisplay price={skill.price} className="text-sm text-muted-foreground" />
                  </div>
                </Link>
              )) ??
                pkg.skillIds.map((skillId) => (
                  <div key={skillId} className="rounded-lg border p-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      {truncateAddress(skillId, 8)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">Seller</div>
              <div className="font-mono text-sm">{truncateAddress(pkg.seller, 8)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Listed Epoch</div>
              <div className="text-sm">{pkg.createdAtEpoch}</div>
            </div>
          </div>

          <Separator />

          {alreadyPurchased || purchaseSuccess ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">
                  {purchaseSuccess ? "Purchase successful!" : "You own this bundle"}
                </span>
              </div>
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
                    { packageId: id, vaultId, price: pkg!.price },
                    { onSuccess: () => setPurchaseSuccess(true) },
                  )
                }
              >
                {purchaseMutation.isPending
                  ? "Purchasing..."
                  : `Purchase Bundle for ${formatSui(pkg!.price)}`}
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
