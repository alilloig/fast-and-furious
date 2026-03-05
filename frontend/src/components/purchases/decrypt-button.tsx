"use client";

import { useRef, useState } from "react";
import { EncryptedObject } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { Button } from "@/components/ui/button";
import { useSessionKey } from "@/hooks/use-session-key";
import { useCurrentAccount, useCurrentClient } from "@mysten/dapp-kit-react";
import { getSealClient } from "@/lib/seal";
import { MARKETPLACE_PACKAGE_ID, PACKAGE_VERSION_ID } from "@/lib/constants";
import { verifyBlobIntegrity } from "@/lib/verify-integrity";
import { IntegrityPanel } from "./integrity-panel";
import type { SkillListing, PurchaseReceipt, IntegrityVerification } from "@/lib/types";

interface DecryptButtonProps {
  receiptId: string;
  receipt: PurchaseReceipt;
  skill: SkillListing;
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
  receipt,
  skill,
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
        receipt={receipt}
        skill={skill}
        walrusQuiltId={walrusQuiltId}
        fileNames={fileNames}
      />
    );
  }

  return (
    <SingleFileDecrypt
      receiptId={receiptId}
      receipt={receipt}
      skill={skill}
      walrusBlobId={walrusBlobId}
      fileName={fileNames[0] ?? `${skillTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`}
    />
  );
}

function SingleFileDecrypt({
  receiptId,
  receipt,
  skill,
  walrusBlobId,
  fileName,
}: {
  receiptId: string;
  receipt: PurchaseReceipt;
  skill: SkillListing;
  walrusBlobId: string;
  fileName: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<IntegrityVerification | null>(null);
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

      // Verify integrity of downloaded encrypted bytes
      const integrityResult = await verifyBlobIntegrity(encryptedBytes, skill, receipt, suiClient);
      setVerification(integrityResult);

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
    <div className="space-y-2">
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
      <IntegrityPanel verification={verification} />
    </div>
  );
}

function MultiFileDecrypt({
  receiptId,
  receipt,
  skill,
  walrusQuiltId,
  fileNames,
}: {
  receiptId: string;
  receipt: PurchaseReceipt;
  skill: SkillListing;
  walrusQuiltId: string;
  fileNames: string[];
}) {
  const [fileStatus, setFileStatus] = useState<
    Record<string, "idle" | "loading" | "done" | "error">
  >({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [verification, setVerification] = useState<IntegrityVerification | null>(null);
  const verificationPromiseRef = useRef<Promise<IntegrityVerification> | null>(null);
  const { getOrCreateSessionKey } = useSessionKey();
  const account = useCurrentAccount();
  const suiClient = useCurrentClient();

  function getOrStartVerification() {
    if (verificationPromiseRef.current) return verificationPromiseRef.current;

    setVerification({ status: "verifying", rootHashMatch: null, blobIdMatch: null, receiptBlobIdMatch: null, derivedRootHash: null, derivedBlobId: null, onChainRootHash: null, onChainBlobId: null, receiptBlobId: null, verifiedAt: null, error: null, errorType: null });

    const promise = (async () => {
      try {
        const blobResponse = await fetch(`/api/walrus/download/${walrusQuiltId}`);
        if (!blobResponse.ok) {
          throw new Error(`Failed to fetch quilt blob: ${blobResponse.statusText}`);
        }
        const quiltBytes = new Uint8Array(await blobResponse.arrayBuffer());
        const result = await verifyBlobIntegrity(quiltBytes, skill, receipt, suiClient);
        setVerification(result);
        return result;
      } catch (err) {
        const failedResult: IntegrityVerification = {
          status: "failed",
          rootHashMatch: null,
          blobIdMatch: null,
          receiptBlobIdMatch: null,
          derivedRootHash: null,
          derivedBlobId: null,
          onChainRootHash: skill.rootHash || null,
          onChainBlobId: skill.walrusBlobId,
          receiptBlobId: receipt.walrusBlobId || null,
          verifiedAt: null,
          error: err instanceof Error ? err.message : "Verification failed",
          errorType: "unknown",
        };
        setVerification(failedResult);
        return failedResult;
      }
    })();

    verificationPromiseRef.current = promise;
    return promise;
  }

  async function handleDecryptFile(fileName: string) {
    setFileStatus((prev) => ({ ...prev, [fileName]: "loading" }));
    setFileErrors((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });

    try {
      getOrStartVerification(); // fire-and-forget: runs in parallel with decrypt

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
                  : "Decrypt & Download"}
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
      <IntegrityPanel verification={verification} />
    </div>
  );
}
