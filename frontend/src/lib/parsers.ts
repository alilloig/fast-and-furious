import type {
  SkillListing,
  PackageListing,
  MarketplaceConfig,
  PurchaseReceipt,
} from "./types";

/**
 * Parse a gRPC JSON object into a SkillListing.
 * The `json` field from Sui gRPC uses Move field names (snake_case).
 */
export function parseSkillListing(
  objectId: string,
  json: Record<string, unknown>,
): SkillListing {
  return {
    id: objectId,
    seller: json.seller as string,
    title: json.title as string,
    description: json.description as string,
    price: BigInt(json.price as string),
    category: json.category as string,
    tags: json.tags as string[],
    walrusBlobId: json.walrus_blob_id as string,
    walrusQuiltId: parseOptionString(json.walrus_quilt_id),
    sealKeyId: json.seal_key_id as string,
    createdAtEpoch: Number(json.created_at_epoch as string),
    isActive: json.is_active as boolean,
  };
}

/**
 * Parse a gRPC JSON object into a PackageListing.
 */
export function parsePackageListing(
  objectId: string,
  json: Record<string, unknown>,
): PackageListing {
  return {
    id: objectId,
    seller: json.seller as string,
    title: json.title as string,
    description: json.description as string,
    skillIds: json.skill_ids as string[],
    discountBps: Number(json.discount_bps as string),
    price: BigInt(json.price as string),
    createdAtEpoch: Number(json.created_at_epoch as string),
    isActive: json.is_active as boolean,
  };
}

/**
 * Parse a gRPC JSON object into a MarketplaceConfig.
 */
export function parseMarketplaceConfig(
  objectId: string,
  json: Record<string, unknown>,
): MarketplaceConfig {
  return {
    id: objectId,
    version: Number(json.version as string),
    feeBps: Number(json.fee_bps as string),
    feeRecipient: json.fee_recipient as string,
  };
}

/**
 * Parse a gRPC JSON object into a PurchaseReceipt.
 */
export function parsePurchaseReceipt(
  objectId: string,
  json: Record<string, unknown>,
): PurchaseReceipt {
  return {
    id: objectId,
    buyer: json.buyer as string,
    skillIds: json.skill_ids as string[],
    seller: json.seller as string,
    amountPaid: BigInt(json.amount_paid as string),
    purchasedAtEpoch: Number(json.purchased_at_epoch as string),
  };
}

/**
 * Parse a Move Option<String> from gRPC JSON.
 * gRPC JSON encodes Option as null or the inner value.
 */
function parseOptionString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return value as string;
}
