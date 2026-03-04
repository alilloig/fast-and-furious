"use client";

import { useState } from "react";
import { EncryptedObject } from "@mysten/seal";
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
  walrusQuiltId: string | null;
  fileNames: string[];
  skillTitle: string;
}

function triggerDownload(data: Uint8Array, filename: string) {
  const blob = new Blob([data as BlobPart]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DecryptButton({
  receiptId,
  walrusBlobId,
  walrusQuiltId,
  fileNames,
  skillTitle,
}: DecryptButtonProps) {
  const isMultiFile = !!walrusQuiltId && fileNames.length > 1;

  if (isMultiFile) {
    return (
      <MultiFileDecrypt
        receiptId={receiptId}
        walrusQuiltId={walrusQuiltId}
        fileNames={fileNames}
      />
    );
  }

  return (
    <SingleFileDecrypt
      receiptId={receiptId}
      walrusBlobId={walrusBlobId}
      fileName={fileNames[0] ?? `${skillTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`}
    />
  );
}

function SingleFileDecrypt({
  receiptId,
  walrusBlobId,
  fileName,
}: {
  receiptId: string;
  walrusBlobId: string;
  fileName: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const { getOrCreateSessionKey } = useSessionKey();
  const account = useCurrentAccount();
  const suiClient = useCurrentClient();

  async function handleDecrypt() {
    setStatus("loading");
    setError(null);

    try {
      const sessionKey = await getOrCreateSessionKey();

      const blobResponse = await fetch(`/api/walrus/download/${walrusBlobId}`);
      if (!blobResponse.ok) {
        throw new Error(`Failed to fetch blob: ${blobResponse.statusText}`);
      }
      const encryptedBytes = new Uint8Array(await blobResponse.arrayBuffer());

      const parsed = EncryptedObject.parse(encryptedBytes);

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

      const sealClient = getSealClient(suiClient);
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      triggerDownload(new Uint8Array(decryptedBytes), fileName);
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

function MultiFileDecrypt({
  receiptId,
  walrusQuiltId,
  fileNames,
}: {
  receiptId: string;
  walrusQuiltId: string;
  fileNames: string[];
}) {
  const [fileStatus, setFileStatus] = useState<
    Record<string, "idle" | "loading" | "done" | "error">
  >({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const { getOrCreateSessionKey } = useSessionKey();
  const account = useCurrentAccount();
  const suiClient = useCurrentClient();

  async function handleDecryptFile(fileName: string) {
    setFileStatus((prev) => ({ ...prev, [fileName]: "loading" }));
    setFileErrors((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });

    try {
      const sessionKey = await getOrCreateSessionKey();

      const blobResponse = await fetch(
        `/api/walrus/download-quilt/${walrusQuiltId}/${encodeURIComponent(fileName)}`,
      );
      if (!blobResponse.ok) {
        throw new Error(`Failed to fetch file: ${blobResponse.statusText}`);
      }
      const encryptedBytes = new Uint8Array(await blobResponse.arrayBuffer());

      const parsed = EncryptedObject.parse(encryptedBytes);

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

      const sealClient = getSealClient(suiClient);
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      triggerDownload(new Uint8Array(decryptedBytes), fileName);
      setFileStatus((prev) => ({ ...prev, [fileName]: "done" }));
    } catch (err) {
      setFileStatus((prev) => ({ ...prev, [fileName]: "error" }));
      setFileErrors((prev) => ({
        ...prev,
        [fileName]: err instanceof Error ? err.message : "Decryption failed",
      }));
    }
  }

  return (
    <div className="space-y-2">
      {fileNames.map((name) => {
        const status = fileStatus[name] ?? "idle";
        return (
          <div key={name} className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDecryptFile(name)}
              disabled={status === "loading"}
            >
              {status === "loading"
                ? "Decrypting..."
                : status === "done"
                  ? "Downloaded"
                  : "Download"}
            </Button>
            <span className="truncate font-mono text-sm">{name}</span>
            {status === "error" && fileErrors[name] && (
              <span className="text-sm text-destructive">
                {fileErrors[name]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
