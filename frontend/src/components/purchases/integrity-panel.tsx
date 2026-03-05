"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
} from "lucide-react";
import type { IntegrityVerification } from "@/lib/types";

interface IntegrityPanelProps {
  verification: IntegrityVerification | null;
}

function truncateHash(hash: string, len = 8): string {
  if (hash.length <= len * 2 + 3) return hash;
  return `${hash.slice(0, len)}...${hash.slice(-len)}`;
}

export function IntegrityPanel({ verification }: IntegrityPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!verification || verification.status === "idle") return null;

  if (verification.status === "verifying") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Verifying content integrity...</span>
      </div>
    );
  }

  if (
    verification.status === "verified" &&
    verification.error === "Integrity data not available for this listing"
  ) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4" />
        <span>Integrity data not available for this listing</span>
      </div>
    );
  }

  const isVerified = verification.status === "verified";
  const Icon = isVerified ? ShieldCheck : ShieldAlert;
  const colorClass = isVerified ? "text-green-600" : "text-destructive";
  const ToggleIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 text-sm font-medium ${colorClass}`}
      >
        <Icon className="h-4 w-4" />
        <span>{isVerified ? "Content Verified" : "Verification Failed"}</span>
        <ToggleIcon className="h-3 w-3" />
      </button>

      {!isVerified && verification.error && (
        <p className="text-sm text-destructive">{verification.error}</p>
      )}

      {expanded && (
        <div className="ml-6 space-y-1 rounded border p-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span>{verification.rootHashMatch ? "\u2713" : "\u2717"}</span>
            <span className="text-muted-foreground">Root Hash Match:</span>
            <span>
              {verification.rootHashMatch
                ? `Yes (${truncateHash(verification.onChainRootHash ?? "")})`
                : `No`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>{verification.blobIdMatch ? "\u2713" : "\u2717"}</span>
            <span className="text-muted-foreground">Blob ID Match:</span>
            <span>
              {verification.blobIdMatch
                ? `Yes (${truncateHash(verification.onChainBlobId ?? "")})`
                : `No`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>{verification.receiptBlobIdMatch ? "\u2713" : "\u2717"}</span>
            <span className="text-muted-foreground">Receipt Snapshot:</span>
            <span>
              {verification.receiptBlobIdMatch ? "Unchanged" : "Changed"}
            </span>
          </div>
          {verification.verifiedAt && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Verified:</span>
              <span>{verification.verifiedAt.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
