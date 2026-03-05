"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PriceDisplay } from "@/components/skills/price-display";
import { WalrusScanLink } from "@/components/walrus-scan-link";
import { StorageStatusBadge } from "@/components/storage-status-badge";
import { ExtendStorageDialog } from "@/components/seller/extend-storage-dialog";
import { ErrorAlert } from "@/components/error-alert";
import { useDelistSkill } from "@/hooks/use-delist-skill";
import { useWalrusEpoch } from "@/hooks/use-current-epoch";
import type { MyListing } from "@/hooks/use-my-listings";

export function MyListingCard({ myListing }: { myListing: MyListing }) {
  const { cap, listing } = myListing;
  const [open, setOpen] = useState(false);
  const delistMutation = useDelistSkill();
  const { data: epochInfo } = useWalrusEpoch();

  return (
    <Card className="relative transition-colors hover:bg-accent/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">
            <Link href={`/skill/${listing.id}`} className="hover:underline after:absolute after:inset-0">
              {listing.title}
            </Link>
          </CardTitle>
          <div className="flex shrink-0 gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {listing.category}
            </Badge>
            <Badge variant={listing.isActive ? "default" : "outline"} className="text-xs">
              {listing.isActive ? "Active" : "Delisted"}
            </Badge>
            {listing.isFinalized && (
              <StorageStatusBadge
                storageEndEpoch={listing.storageEndEpoch}
                epochInfo={epochInfo}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-2">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {listing.description}
        </p>
        <div className="relative z-10">
          <div className="text-xs text-muted-foreground mb-0.5">Walrus Blob</div>
          <WalrusScanLink blobId={listing.walrusBlobId} />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <PriceDisplay price={listing.price} className="font-semibold" />
        <div className="flex gap-2">
        {listing.isActive && listing.isFinalized && listing.walrusBlobObjectId && (
          <ExtendStorageDialog
            listingId={listing.id}
            listingTitle={listing.title}
            sellerCapId={cap.id}
            walrusBlobObjectId={listing.walrusBlobObjectId}
            storageEndEpoch={listing.storageEndEpoch}
          >
            <Button variant="outline" size="sm">
              Extend
            </Button>
          </ExtendStorageDialog>
        )}
        {listing.isActive && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="relative z-10">
                Delist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delist &ldquo;{listing.title}&rdquo;?</DialogTitle>
                <DialogDescription>
                  This will remove the listing from the marketplace. Existing
                  purchases will still have access to the content.
                </DialogDescription>
              </DialogHeader>
              <ErrorAlert error={delistMutation.error instanceof Error ? delistMutation.error : null} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={delistMutation.isPending}
                  onClick={() =>
                    delistMutation.mutate(
                      { listingId: listing.id, sellerCapId: cap.id },
                      { onSuccess: () => setOpen(false) },
                    )
                  }
                >
                  {delistMutation.isPending ? "Delisting..." : "Confirm Delist"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </CardFooter>
    </Card>
  );
}
