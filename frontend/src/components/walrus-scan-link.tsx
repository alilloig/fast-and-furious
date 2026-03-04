import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/utils";

const WALRUS_SCAN_BASE = "https://walruscan.com/testnet/blob";

export function WalrusScanLink({ blobId }: { blobId: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="truncate font-mono text-sm">{truncateAddress(blobId, 8)}</span>
      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" asChild>
        <a
          href={`${WALRUS_SCAN_BASE}/${blobId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on WalrusScan"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    </div>
  );
}
