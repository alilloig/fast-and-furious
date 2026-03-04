"use client";

import { useState } from "react";
import { EncryptedObject, SealClient } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { Button } from "@/components/ui/button";
import { useSessionKey } from "@/hooks/use-session-key";
import { useCurrentAccount, useCurrentClient } from "@mysten/dapp-kit-react";
import { getSealClient } from "@/lib/seal";
import { MARKETPLACE_PACKAGE_ID, PACKAGE_VERSION_ID } from "@/lib/constants";

interface DecryptButtonProps {
  receiptId: string;
  walrusBlobId: string;
  skillTitle: string;
}

export function DecryptButton({
  receiptId,
  walrusBlobId,
  skillTitle,
}: DecryptButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const { getOrCreateSessionKey } = useSessionKey();
  const account = useCurrentAccount();
  const suiClient = useCurrentClient();

  async function handleDecrypt() {
    setStatus("loading");
    setError(null);

    try {
      // 1. Get or create session key (may trigger wallet popup)
      const sessionKey = await getOrCreateSessionKey();

      // 2. Fetch encrypted blob from Walrus via proxy
      const blobResponse = await fetch(`/api/walrus/download/${walrusBlobId}`);
      if (!blobResponse.ok) {
        throw new Error(`Failed to fetch blob: ${blobResponse.statusText}`);
      }
      const encryptedBytes = new Uint8Array(await blobResponse.arrayBuffer());

      // 3. Parse encrypted object to extract the Seal identity
      const parsed = EncryptedObject.parse(encryptedBytes);

      // 4. Build seal_approve PTB
      if (!account) throw new Error("Wallet not connected");
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::seal_policy::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(parsed.id)),
          tx.object(PACKAGE_VERSION_ID),
          tx.object(receiptId),
        ],
      });
      const txBytes = await tx.build({
        client: suiClient,
        onlyTransactionKind: true,
      });

      // 5. Decrypt via Seal key servers
      const sealClient = getSealClient(suiClient);
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      // 6. Trigger file download
      const blob = new Blob([new Uint8Array(decryptedBytes)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${skillTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Decryption failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleDecrypt}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Decrypting..." : "Decrypt & Download"}
      </Button>
      {status === "error" && error && (
        <span className="text-sm text-destructive">{error}</span>
      )}
    </div>
  );
}
