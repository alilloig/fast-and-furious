"use client";

import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorAlert } from "@/components/error-alert";
import { StorageStatusBadge } from "@/components/storage-status-badge";
import { useExtendStorage } from "@/hooks/use-extend-storage";
import { useWalrusEpoch } from "@/hooks/use-current-epoch";
import { estimateExtensionCost } from "@/lib/walrus-cost";
import { formatWal } from "@/lib/utils";
import { WALRUS_MAX_EPOCHS } from "@/lib/constants";

interface ExtendStorageDialogProps {
  listingId: string;
  listingTitle: string;
  sellerCapId: string;
  walrusBlobObjectId: string;
  storageEndEpoch: number;
  /** Estimated encoded size in MiB (from initial upload cost) */
  encodedSizeMiB?: number;
  children: React.ReactNode;
}

const EPOCH_OPTIONS = [1, 2, 5, 10, 20, 53];

export function ExtendStorageDialog({
  listingId,
  listingTitle,
  sellerCapId,
  walrusBlobObjectId,
  storageEndEpoch,
  encodedSizeMiB = 65,
  children,
}: ExtendStorageDialogProps) {
  const [open, setOpen] = useState(false);
  const [epochs, setEpochs] = useState(5);
  const extendMutation = useExtendStorage();
  const { data: epochInfo } = useWalrusEpoch();

  const isLegacy = !walrusBlobObjectId;
  const isExpired =
    epochInfo !== undefined &&
    storageEndEpoch > 0 &&
    storageEndEpoch <= epochInfo.epoch;

  const estimate = useMemo(
    () => estimateExtensionCost(encodedSizeMiB, epochs),
    [encodedSizeMiB, epochs],
  );

  const validOptions = EPOCH_OPTIONS.filter((n) => n <= WALRUS_MAX_EPOCHS);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend Storage</DialogTitle>
          <DialogDescription>
            Extend Walrus storage for &ldquo;{listingTitle}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current status:</span>
            <StorageStatusBadge
              storageEndEpoch={storageEndEpoch}
              epochInfo={epochInfo}
            />
          </div>

          {storageEndEpoch > 0 && epochInfo !== undefined && storageEndEpoch - epochInfo.epoch > 0 && (
            <div className="text-sm text-muted-foreground">
              {storageEndEpoch - epochInfo.epoch} epoch{storageEndEpoch - epochInfo.epoch !== 1 ? "s" : ""} remaining
            </div>
          )}

          {isLegacy && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Storage extension is not available for this listing (created
              before this feature). The blob object ID is required.
            </div>
          )}

          {isExpired && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              This blob may have been garbage-collected. Extension will fail if
              the data has already been removed from Walrus.
            </div>
          )}

          {!isLegacy && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Extend by</label>
                <Select
                  value={String(epochs)}
                  onValueChange={(v) => setEpochs(Number(v))}
                  disabled={extendMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {validOptions.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} epoch{n !== 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>Estimated cost</span>
                  <span className="font-mono">
                    ~{formatWal(estimate.storageFrost)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Paid in WAL tokens (no write fee for extensions)
                </div>
              </div>
            </>
          )}

          <ErrorAlert
            error={
              extendMutation.error instanceof Error
                ? extendMutation.error
                : null
            }
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={isLegacy || extendMutation.isPending}
            onClick={() =>
              extendMutation.mutate(
                {
                  blobObjectId: walrusBlobObjectId,
                  epochs,
                  sellerCapId,
                  listingId,
                  currentEndEpoch: storageEndEpoch,
                },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {extendMutation.isPending
              ? "Extending..."
              : `Extend ${epochs} epoch${epochs !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
