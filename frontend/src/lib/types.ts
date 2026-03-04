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
  sealKeyId: string;
  createdAtEpoch: number;
  isActive: boolean;
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
