export interface SkillListing {
  id: string;
  seller: string;
  title: string;
  description: string;
  price: bigint;
  category: string;
  tags: string[];
  walrusBlobId: string;
  walrusQuiltId: string | null;
  fileNames: string[];
  sealKeyId: string;
  walrusBlobObjectId: string;
  storageEndEpoch: number;
  rootHash: string;
  encodingNonce: number;
  createdAtEpoch: number;
  isActive: boolean;
  isFinalized: boolean;
}

export interface PackageListing {
  id: string;
  seller: string;
  title: string;
  description: string;
  skillIds: string[];
  discountBps: number;
  price: bigint;
  createdAtEpoch: number;
  isActive: boolean;
}

export interface MarketplaceConfig {
  id: string;
  version: number;
  feeBps: number;
  feeRecipient: string;
}

export interface RegistryEntry {
  listingId: string;
  tags: string[];
}

export interface PurchaseReceipt {
  id: string;
  buyer: string;
  skillIds: string[];
  seller: string;
  amountPaid: bigint;
  purchasedAtEpoch: number;
  walrusBlobId: string;
}

export interface SellerCap {
  id: string;
  skillListingId: string;
}

export interface PackageSellerCap {
  id: string;
  packageListingId: string;
}

export interface SellerVaultInfo {
  id: string;
  seller: string;
  balance: bigint;
}

export interface WalrusStorageEstimate {
  encodedSizeMiB: number;
  epochs: number;
  storageFrost: bigint;
  writeFrost: bigint;
  totalFrost: bigint;
}

export interface WalrusExtensionEstimate {
  encodedSizeMiB: number;
  epochs: number;
  storageFrost: bigint;
}

export interface IntegrityVerification {
  status: 'idle' | 'verifying' | 'verified' | 'failed';
  rootHashMatch: boolean | null;
  blobIdMatch: boolean | null;
  receiptBlobIdMatch: boolean | null;
  derivedRootHash: string | null;
  derivedBlobId: string | null;
  onChainRootHash: string | null;
  onChainBlobId: string | null;
  receiptBlobId: string | null;
  verifiedAt: Date | null;
  error: string | null;
  errorType: 'inconsistent' | 'not_certified' | 'transient' | 'unknown' | null;
}
