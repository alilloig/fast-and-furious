import {
  WALRUS_ENCODING_FACTOR,
  WALRUS_METADATA_OVERHEAD_BYTES,
  SEAL_ENCRYPTION_OVERHEAD_PER_FILE,
  WALRUS_FROST_PER_MIB_PER_EPOCH,
  WALRUS_WRITE_FEE_FROST,
} from "./constants";
import type { WalrusStorageEstimate } from "./types";

/**
 * Estimate Walrus storage cost for a set of files.
 *
 * Whether 1 file (blob) or N files (quilt), the metadata overhead is paid once
 * because a quilt is stored as a single blob containing all patches.
 */
export function estimateWalrusCost(
  files: File[],
  epochs: number,
): WalrusStorageEstimate | null {
  if (files.length === 0) return null;

  const totalRawBytes = files.reduce((sum, f) => sum + f.size, 0);
  const encryptedBytes =
    totalRawBytes + files.length * SEAL_ENCRYPTION_OVERHEAD_PER_FILE;
  const encodedBytes =
    encryptedBytes * WALRUS_ENCODING_FACTOR + WALRUS_METADATA_OVERHEAD_BYTES;
  const encodedSizeMiB = Math.ceil(encodedBytes / (1024 * 1024));

  const storageFrost =
    BigInt(encodedSizeMiB) * WALRUS_FROST_PER_MIB_PER_EPOCH * BigInt(epochs);
  const totalFrost = storageFrost + WALRUS_WRITE_FEE_FROST;

  return {
    encodedSizeMiB,
    epochs,
    storageFrost,
    writeFrost: WALRUS_WRITE_FEE_FROST,
    totalFrost,
  };
}
