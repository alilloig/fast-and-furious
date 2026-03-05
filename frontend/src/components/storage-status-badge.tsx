"use client";

import { Badge } from "@/components/ui/badge";
import type { WalrusEpochInfo } from "@/hooks/use-current-epoch";
import { walrusEpochToDate, formatEpochDate } from "@/lib/walrus-epoch";

interface StorageStatusBadgeProps {
  storageEndEpoch: number;
  epochInfo: WalrusEpochInfo | undefined;
}

type StorageStatus = "healthy" | "expiring" | "expired" | "unknown";

function getStatus(endEpoch: number, epochInfo: WalrusEpochInfo | undefined): StorageStatus {
  if (endEpoch === 0) return "unknown";
  if (epochInfo === undefined) return "unknown";
  const remaining = endEpoch - epochInfo.epoch;
  if (remaining <= 0) return "expired";
  if (remaining <= 5) return "expiring";
  return "healthy";
}

const statusConfig: Record<StorageStatus, { label: string; className: string }> = {
  healthy: {
    label: "Storage Active",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  expiring: {
    label: "Expiring Soon",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  expired: {
    label: "Expired",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  unknown: {
    label: "Storage Unknown",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

export function StorageStatusBadge({ storageEndEpoch, epochInfo }: StorageStatusBadgeProps) {
  const status = getStatus(storageEndEpoch, epochInfo);
  const config = statusConfig[status];

  const expiryLabel =
    status !== "unknown" && status !== "expired" && epochInfo && storageEndEpoch > 0
      ? formatEpochDate(
          walrusEpochToDate(storageEndEpoch, epochInfo.firstEpochStartMs, epochInfo.epochDurationMs),
        )
      : null;

  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}{expiryLabel ? ` — ${expiryLabel}` : ""}
    </Badge>
  );
}
