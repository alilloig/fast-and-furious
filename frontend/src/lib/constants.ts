export const MARKETPLACE_PACKAGE_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_PACKAGE_ID ?? "0x0";

export const MARKETPLACE_CONFIG_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_CONFIG_ID ?? "0x0";

export const PACKAGE_VERSION_ID =
  process.env.NEXT_PUBLIC_PACKAGE_VERSION_ID ?? "0x0";

export const LISTINGS_REGISTRY_ID =
  process.env.NEXT_PUBLIC_LISTINGS_REGISTRY_ID ?? "0x0";

export const SUI_NETWORK =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as "testnet" | "mainnet") ?? "testnet";

/** True when contracts have been deployed (IDs are not placeholder 0x0). */
export const IS_DEPLOYED = MARKETPLACE_PACKAGE_ID !== "0x0";

export const MIST_PER_SUI = 1_000_000_000n;

export const SEAL_SERVER_CONFIGS = [
  {
    objectId:
      "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    weight: 1,
  },
  {
    objectId:
      "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
    weight: 1,
  },
];

export const SEAL_THRESHOLD = 2;

export const PLAYBOOK_TYPE = `${MARKETPLACE_PACKAGE_ID}::skill::SkillListing`;
export const PURCHASE_RECEIPT_TYPE = `${MARKETPLACE_PACKAGE_ID}::purchase::PurchaseReceipt`;
export const SELLER_VAULT_TYPE = `${MARKETPLACE_PACKAGE_ID}::purchase::SellerVault`;
export const SELLER_CAP_TYPE = `${MARKETPLACE_PACKAGE_ID}::skill::SellerCap`;

// --- Walrus Storage Estimation ---
export const WALRUS_ENCODING_FACTOR = 5;
export const WALRUS_METADATA_OVERHEAD_BYTES = 64 * 1024 * 1024; // ~64 MiB
export const SEAL_ENCRYPTION_OVERHEAD_PER_FILE = 200; // bytes
export const WALRUS_FROST_PER_MIB_PER_EPOCH = 100_000n; // 0.0001 WAL
export const WALRUS_WRITE_FEE_FROST = 20_000n;
export const FROST_PER_WAL = 1_000_000_000n;
export const WALRUS_DEFAULT_EPOCHS = 5;
export const WALRUS_MIN_EPOCHS = 1;
export const WALRUS_MAX_EPOCHS = 53; // from `walrus info`: max 53 epochs ahead

export const MAX_FILES_PER_LISTING = 10;
export const MAX_TOTAL_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const ALLOWED_FILE_EXTENSIONS = [".md", ".yml", ".yaml", ".toml"];

export const ALLOWED_MIME_TYPES = [
  "text/markdown",
  "text/yaml",
  "application/x-yaml",
  "application/toml",
];

export const FILE_ACCEPT_STRING = [
  ...ALLOWED_FILE_EXTENSIONS,
  ...ALLOWED_MIME_TYPES,
].join(",");
