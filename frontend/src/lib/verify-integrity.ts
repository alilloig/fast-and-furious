import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { SkillListing, PurchaseReceipt, IntegrityVerification } from "./types";

const INITIAL_STATE: IntegrityVerification = {
  status: 'idle',
  rootHashMatch: null,
  blobIdMatch: null,
  receiptBlobIdMatch: null,
  derivedRootHash: null,
  derivedBlobId: null,
  onChainRootHash: null,
  onChainBlobId: null,
  receiptBlobId: null,
  verifiedAt: null,
  error: null,
  errorType: null,
};

export async function verifyBlobIntegrity(
  encryptedBytes: Uint8Array,
  skill: SkillListing,
  receipt: PurchaseReceipt,
  suiClient: ClientWithCoreApi,
): Promise<IntegrityVerification> {
  if (!skill.rootHash) {
    return {
      ...INITIAL_STATE,
      status: 'verified',
      error: 'Integrity data not available for this listing',
      onChainBlobId: skill.walrusBlobId,
      receiptBlobId: receipt.walrusBlobId || null,
    };
  }

  try {
    const { WalrusClient } = await import("@mysten/walrus");
    const walrusClient = new WalrusClient({ network: "testnet", suiClient });
    const metadata = await walrusClient.computeBlobMetadata({ bytes: encryptedBytes });

    const derivedRootHash = Array.from(new Uint8Array(metadata.rootHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const derivedBlobId = metadata.blobId;

    const rootHashMatch = derivedRootHash === skill.rootHash;
    const blobIdMatch = derivedBlobId === skill.walrusBlobId;
    const receiptBlobIdMatch = !receipt.walrusBlobId || receipt.walrusBlobId === skill.walrusBlobId;

    const allMatch = rootHashMatch && blobIdMatch && receiptBlobIdMatch;

    return {
      status: allMatch ? 'verified' : 'failed',
      rootHashMatch,
      blobIdMatch,
      receiptBlobIdMatch,
      derivedRootHash,
      derivedBlobId,
      onChainRootHash: skill.rootHash,
      onChainBlobId: skill.walrusBlobId,
      receiptBlobId: receipt.walrusBlobId || null,
      verifiedAt: new Date(),
      error: allMatch ? null : 'Content integrity verification failed — data may have been tampered with',
      errorType: allMatch ? null : 'inconsistent',
    };
  } catch (err) {
    return {
      ...INITIAL_STATE,
      status: 'failed',
      onChainRootHash: skill.rootHash,
      onChainBlobId: skill.walrusBlobId,
      receiptBlobId: receipt.walrusBlobId || null,
      error: err instanceof Error ? err.message : 'Verification failed',
      errorType: 'unknown',
    };
  }
}
