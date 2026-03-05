import { fromBase64 } from "@mysten/sui/utils";
import type {
  PlaybookListing,
  MarketplaceConfig,
  PurchaseReceipt,
  SellerCap,
  SellerVaultInfo,
} from "./types";

/**
 * Decode a base64-encoded vector<u8> from gRPC JSON into a hex string.
 * Sui gRPC JSON serializes vector<u8> as base64, not hex or array.
 */
function parseVectorU8AsHex(value: unknown): string {
  if (!value || typeof value !== "string" || value.length === 0) return "";
  try {
    const bytes = fromBase64(value);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

/**
 * Parse a gRPC JSON object into a PlaybookListing.
 * The `json` field from Sui gRPC uses Move field names (snake_case).
 * On-chain type is still `SkillListing` — this parser bridges the naming gap.
 */
export function parsePlaybookListing(
  objectId: string,
  json: Record<string, unknown>,
): PlaybookListing {
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
    fileNames: (json.file_names as string[]) ?? [],
    sealKeyId: json.seal_key_id as string,
    walrusBlobObjectId: (json.walrus_blob_object_id as string) ?? "",
    storageEndEpoch: Number(json.storage_end_epoch ?? 0),
    createdAtEpoch: Number(json.created_at_epoch as string),
    isActive: json.is_active as boolean,
    isFinalized: json.is_finalized as boolean,
    rootHash: parseVectorU8AsHex(json.root_hash),
    encodingNonce: Number((json.encoding_nonce as string) ?? "0"),
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
    playbookIds: json.skill_ids as string[],
    seller: json.seller as string,
    amountPaid: BigInt(json.amount_paid as string),
    purchasedAtEpoch: Number(json.purchased_at_epoch as string),
    walrusBlobId: (json.walrus_blob_id as string) ?? "",
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

export function parseSellerCap(
  objectId: string,
  json: Record<string, unknown>,
): SellerCap {
  return {
    id: objectId,
    playbookListingId: json.skill_listing_id as string,
  };
}

export function parseSellerVaultInfo(
  objectId: string,
  json: Record<string, unknown>,
): SellerVaultInfo {
  return {
    id: objectId,
    seller: json.seller as string,
    balance: BigInt((json.balance as string) ?? "0"),
  };
}
