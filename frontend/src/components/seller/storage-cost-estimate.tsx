import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatWal } from "@/lib/utils";
import type { WalrusStorageEstimate } from "@/lib/types";

interface StorageCostEstimateProps {
  estimate: WalrusStorageEstimate | null;
}

export function StorageCostEstimate({ estimate }: StorageCostEstimateProps) {
  if (!estimate) return null;

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2 text-sm">
      <div>
        <span className="font-medium">
          Est. storage cost: ~{formatWal(estimate.totalFrost)}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          ({estimate.epochs} epoch{estimate.epochs !== 1 ? "s" : ""}, ~
          {estimate.encodedSizeMiB < 1
            ? `${(estimate.encodedSizeMiB * 1024).toFixed(0)} KiB`
            : `${estimate.encodedSizeMiB.toFixed(2)} MiB`}{" "}
          encoded)
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p>
            This is an approximate cost for storing your encrypted files on
            Walrus. Includes ~5x RedStuff encoding expansion and ~64 KiB
            metadata overhead.
          </p>
          <p className="mt-1">
            WAL is the Walrus storage token — separate from the SUI listing
            price. Actual cost is determined at upload time.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
