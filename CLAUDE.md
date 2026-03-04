# Fast & Furious — AI Skills Marketplace on Sui

> A decentralized marketplace for buying and selling AI skills/agents on Sui, with Seal-encrypted content stored on Walrus.

---

## 1. Project Vision & Scope

### What We're Building

A three-layer decentralized marketplace where:

- **Sellers** upload encrypted AI skill files (prompts, agents, tool configs) to Walrus, list them on-chain with metadata and pricing, and earn SUI from sales.
- **Buyers** discover skills via a searchable frontend, purchase on-chain, and decrypt content client-side using Seal.
- **The platform** takes a configurable fee (basis points) on each sale, enforced by Move smart contracts.

### Core Principles

- **Immutable listings** — Create + Delete only. No edits. Sellers delist and re-list to "update."
- **Client-side decryption** — The backend never sees plaintext skill content. Seal key servers + MoveVM enforce access.
- **SUI-only payments** — No custom tokens. Platform fee in basis points for flexibility.
- **gRPC-only** — All Sui RPC via `SuiGrpcClient`. No JSON-RPC. No GraphQL.

### Non-Goals

- Token launchpad or custom fungible tokens
- On-chain reviews/ratings (off-chain in PostgreSQL for v1)
- Automatic on-chain renewal (seller manually signs renewal PTBs)
- IPFS or Arweave integration (Walrus only)
- Mobile-native apps (responsive web only)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                      │
│  Next.js 14+ · Tailwind CSS · @mysten/dapp-kit-react       │
│  @mysten/seal (client-side encrypt/decrypt)                 │
│  TanStack Query · SuiGrpcClient                            │
├─────────────────────────────────────────────────────────────┤
│                     BACKEND (Node.js)                       │
│  Express/Fastify · TypeScript · PostgreSQL                  │
│  Event Indexer (gRPC SubscribeCheckpoints)                  │
│  Walrus Upload Proxy · Renewal Monitor                     │
├─────────────────────────────────────────────────────────────┤
│                     ON-CHAIN (Sui Move)                     │
│  marketplace · skill · package_listing                      │
│  purchase · seal_policy                                     │
│  Seal Key Servers (testnet/mainnet)                         │
│  Walrus Blob Storage                                        │
└─────────────────────────────────────────────────────────────┘
```

**Data flow summary:**

1. Seller encrypts skill files client-side with Seal → uploads ciphertext to Walrus via backend proxy → creates SkillListing on-chain
2. Buyer browses skills (PostgreSQL full-text search) → purchases on-chain (SUI payment split: seller vault + platform fee) → receives PurchaseReceipt NFT
3. Buyer builds PTB calling `seal_approve` with their PurchaseReceipt → Seal key servers dry-run to verify access → buyer decrypts locally

---

## 3. Technology Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Smart contracts | Sui Move | Edition 2024 |
| Encryption | Seal (`@mysten/seal`) | Testnet key servers |
| Storage | Walrus | Single file → blob, multi-file → quilt |
| Frontend | Next.js | 14+ (App Router) |
| Styling | Tailwind CSS | 3.x |
| Wallet integration | `@mysten/dapp-kit-react` | Latest |
| Sui client | `SuiGrpcClient` from `@mysten/sui/grpc` | gRPC only |
| Transaction building | `@mysten/sui/transactions` | `Transaction` class |
| State management | TanStack Query | `@tanstack/react-query` |
| Backend runtime | Node.js + TypeScript | 20 LTS+ |
| Backend framework | Express or Fastify | TBD in Phase 3 |
| Database | PostgreSQL | 15+ with full-text search |
| BCS parsing | `@mysten/sui/bcs` | For gRPC object content |

### Key Server Configuration (Testnet)

```typescript
const SEAL_SERVER_CONFIGS = [
  {
    objectId: "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    weight: 1,
  },
  {
    objectId: "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
    weight: 1,
  },
];
const SEAL_THRESHOLD = 2;
```

---

## 4. Move Module Design

Package name: `fast_and_furious`
Package address: `0x0` (publish-time)

### 4.1 `marketplace.move` — Platform Configuration

```move
module fast_and_furious::marketplace;

// === Errors ===
const ENotAuthorized: u64 = 100;
const EInvalidFeeBps: u64 = 101;
const EWrongVersion: u64 = 102;

// === Constants ===
const MAX_FEE_BPS: u64 = 10_000; // 100%
const VERSION: u64 = 1;

// === Structs ===

/// Shared object — global marketplace configuration.
/// Created once in `init` and shared.
public struct MarketplaceConfig has key {
    id: UID,
    version: u64,
    fee_bps: u64,              // platform fee in basis points (e.g., 250 = 2.5%)
    fee_recipient: address,     // where platform fees go
}

/// Owned by the deployer. Required to modify MarketplaceConfig.
public struct AdminCap has key, store {
    id: UID,
}

/// Shared singleton for package version gating (used by seal_policy).
public struct PackageVersion has key {
    id: UID,
    version: u64,
}

// === Init ===
fun init(ctx: &mut TxContext) {
    // Creates MarketplaceConfig (shared), AdminCap (transfer to sender),
    // and PackageVersion (shared).
}

// === Admin Functions ===
/// Update the platform fee. Requires AdminCap.
public fun update_fee(_: &AdminCap, config: &mut MarketplaceConfig, new_fee_bps: u64);

/// Update the fee recipient address.
public fun update_fee_recipient(_: &AdminCap, config: &mut MarketplaceConfig, new_recipient: address);

// === View Functions ===
public fun fee_bps(config: &MarketplaceConfig): u64;
public fun fee_recipient(config: &MarketplaceConfig): address;
public fun version(config: &MarketplaceConfig): u64;
```

### 4.2 `skill.move` — Individual Skill Listings

```move
module fast_and_furious::skill;

// === Errors ===
const ENotSeller: u64 = 200;
const EInvalidPrice: u64 = 201;
const EWrongVersion: u64 = 202;

// === Structs ===

/// Shared object — a single skill listing.
/// Immutable after creation (no update functions). Seller delists to remove.
public struct SkillListing has key {
    id: UID,
    seller: address,
    title: String,
    description: String,
    price: u64,                 // in MIST
    category: String,
    tags: vector<String>,
    walrus_blob_id: String,     // Walrus blob ID (ciphertext)
    walrus_quilt_id: Option<String>, // if multi-file, the quilt ID
    seal_key_id: vector<u8>,    // the Seal identity used for encryption (without pkg prefix)
    created_at_epoch: u64,
    is_active: bool,
}

/// Owned by the seller who created the listing. Proves seller identity for delist.
public struct SellerCap has key, store {
    id: UID,
    skill_listing_id: ID,
}

// === Events ===

public struct SkillListed has copy, drop {
    listing_id: ID,
    seller: address,
    title: String,
    price: u64,
    category: String,
    walrus_blob_id: String,
}

public struct SkillDelisted has copy, drop {
    listing_id: ID,
    seller: address,
}

// === Public Functions ===

/// Create a new skill listing. Returns SellerCap to the caller.
/// SkillListing is shared. SellerCap is transferred to sender.
public fun create(
    config: &MarketplaceConfig,
    title: String,
    description: String,
    price: u64,
    category: String,
    tags: vector<String>,
    walrus_blob_id: String,
    walrus_quilt_id: Option<String>,
    seal_key_id: vector<u8>,
    ctx: &mut TxContext,
);

/// Delist a skill. Requires SellerCap. Sets is_active = false.
/// The SkillListing object remains on-chain (purchases remain valid for
/// already-purchased buyers to decrypt).
public fun delist(
    seller_cap: &SellerCap,
    listing: &mut SkillListing,
);

// === View Functions ===
public fun seller(listing: &SkillListing): address;
public fun price(listing: &SkillListing): u64;
public fun is_active(listing: &SkillListing): bool;
public fun seal_key_id(listing: &SkillListing): vector<u8>;
```

### 4.3 `package_listing.move` — Bundled Skill Packages

```move
module fast_and_furious::package_listing;

// === Errors ===
const ENotSeller: u64 = 300;
const EInvalidDiscount: u64 = 301;
const EEmptySkillList: u64 = 302;
const EWrongVersion: u64 = 303;

// === Constants ===
const MAX_DISCOUNT_BPS: u64 = 5_000; // max 50% discount

// === Structs ===

/// Shared object — a bundle of skills sold at a discount.
public struct PackageListing has key {
    id: UID,
    seller: address,
    title: String,
    description: String,
    skill_ids: vector<ID>,       // references to SkillListing IDs in this package
    discount_bps: u64,           // discount off sum of individual prices (basis points)
    created_at_epoch: u64,
    is_active: bool,
}

/// Owned by the seller. Proves identity for delist.
public struct PackageSellerCap has key, store {
    id: UID,
    package_listing_id: ID,
}

// === Events ===

public struct PackageListed has copy, drop {
    package_id: ID,
    seller: address,
    title: String,
    skill_ids: vector<ID>,
    discount_bps: u64,
}

public struct PackageDelisted has copy, drop {
    package_id: ID,
    seller: address,
}

// === Public Functions ===

/// Create a package listing. Computes price from sum of skill prices minus discount.
public fun create(
    config: &MarketplaceConfig,
    title: String,
    description: String,
    skill_ids: vector<ID>,
    discount_bps: u64,
    ctx: &mut TxContext,
);

/// Delist a package. Sets is_active = false.
public fun delist(
    seller_cap: &PackageSellerCap,
    listing: &mut PackageListing,
);

// === View Functions ===
public fun skill_ids(listing: &PackageListing): vector<ID>;
public fun discount_bps(listing: &PackageListing): u64;
public fun is_active(listing: &PackageListing): bool;
```

### 4.4 `purchase.move` — Purchases & Revenue

```move
module fast_and_furious::purchase;

// === Errors ===
const EListingNotActive: u64 = 400;
const EInsufficientPayment: u64 = 401;
const ENotVaultOwner: u64 = 402;
const EInsufficientVaultBalance: u64 = 403;
const EWrongVersion: u64 = 404;

// === Structs ===

/// Owned NFT — proof of purchase. Holder can decrypt the skill content via Seal.
/// Has `key` only (no `store`) — cannot be placed in Kiosk or other objects.
/// Can be transferred via `transfer::transfer`.
public struct PurchaseReceipt has key {
    id: UID,
    buyer: address,
    skill_ids: vector<ID>,      // which skills this receipt grants access to
    seller: address,
    amount_paid: u64,
    purchased_at_epoch: u64,
}

/// Shared object — accumulates seller revenue from sales.
/// One per seller, created on first sale.
public struct SellerVault has key {
    id: UID,
    seller: address,
    balance: Balance<SUI>,
}

// === Events ===

public struct SkillPurchased has copy, drop {
    receipt_id: ID,
    buyer: address,
    skill_ids: vector<ID>,
    seller: address,
    total_paid: u64,
    platform_fee: u64,
    seller_revenue: u64,
}

public struct VaultWithdrawal has copy, drop {
    vault_id: ID,
    seller: address,
    amount: u64,
}

// === Public Functions ===

/// Purchase a single skill. Splits payment: platform fee → fee_recipient, rest → SellerVault.
/// Mints a PurchaseReceipt NFT and transfers to buyer.
public fun purchase_skill(
    config: &MarketplaceConfig,
    listing: &SkillListing,
    vault: &mut SellerVault,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
);

/// Purchase a package (bundle). Computes discounted price, splits payment.
/// Mints a PurchaseReceipt with all skill_ids from the package.
public fun purchase_package(
    config: &MarketplaceConfig,
    package: &PackageListing,
    skills: &vector<SkillListing>,  // to compute total price for discount
    vault: &mut SellerVault,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
);

/// Seller withdraws from their vault.
public fun withdraw(
    vault: &mut SellerVault,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI>;

/// Create a SellerVault (called once per seller, on first listing creation).
public fun create_vault(ctx: &mut TxContext);

// === View Functions ===
public fun receipt_skill_ids(receipt: &PurchaseReceipt): vector<ID>;
public fun vault_balance(vault: &SellerVault): u64;
```

### 4.5 `seal_policy.move` — Seal Access Control

This is the critical module that Seal key servers call via `dry_run_transaction_block` to decide whether to release decryption keys.

```move
module fast_and_furious::seal_policy;

// === Errors ===
const ENoAccess: u64 = 500;
const EWrongVersion: u64 = 501;
const EInvalidKeyId: u64 = 502;

// === Functions ===

/// Seal key servers call this via dry_run_transaction_block.
///
/// Access control logic:
/// 1. MoveVM enforces that only the PurchaseReceipt owner can include it in the PTB
///    (owned object enforcement — no explicit sender check needed).
/// 2. Verify that `id` starts with a SkillListing ID that appears in
///    `receipt.skill_ids` (namespace prefix check).
/// 3. Verify PackageVersion matches (upgrade protection).
///
/// Parameters:
/// - id: The Seal key identity (without package ID prefix).
///        Format: [skill_listing_id_bytes (32)] ++ [random_nonce (5)]
/// - pkg_version: Shared PackageVersion object for version gating.
/// - receipt: The buyer's PurchaseReceipt (owned object — MoveVM enforces ownership).
///
/// Aborts if access is denied.
entry fun seal_approve(
    id: vector<u8>,
    pkg_version: &PackageVersion,
    receipt: &PurchaseReceipt,
) {
    // 1. Version check
    assert!(pkg_version.version == VERSION, EWrongVersion);

    // 2. Extract the skill listing ID prefix from `id` (first 32 bytes)
    assert!(id.length() >= 32, EInvalidKeyId);
    let mut prefix = vector::empty<u8>();
    let mut i = 0;
    while (i < 32) {
        prefix.push_back(id[i]);
        i = i + 1;
    };
    let requested_skill_id = object::id_from_bytes(prefix);

    // 3. Check that the receipt covers this skill
    let skill_ids = receipt.skill_ids;
    let mut found = false;
    let mut j = 0;
    while (j < skill_ids.length()) {
        if (skill_ids[j] == requested_skill_id) {
            found = true;
            break
        };
        j = j + 1;
    };
    assert!(found, ENoAccess);
}
```

### 4.6 Events Summary

Events are co-located with their respective modules (not a separate module):

| Module | Event | Emitted When |
|--------|-------|--------------|
| `skill` | `SkillListed` | New skill listing created |
| `skill` | `SkillDelisted` | Skill listing deactivated |
| `package_listing` | `PackageListed` | New package created |
| `package_listing` | `PackageDelisted` | Package deactivated |
| `purchase` | `SkillPurchased` | Skill or package purchased |
| `purchase` | `VaultWithdrawal` | Seller withdraws from vault |

### Error Code Ranges

| Module | Range | Prefix |
|--------|-------|--------|
| `marketplace` | 100–199 | `E...` |
| `skill` | 200–299 | `E...` |
| `package_listing` | 300–399 | `E...` |
| `purchase` | 400–499 | `E...` |
| `seal_policy` | 500–599 | `E...` |

---

## 5. Seal Integration

### 5.1 Encryption Flow (Seller Uploads)

```
Seller (browser)                    Backend Proxy                 Walrus
      │                                  │                          │
      │  1. Select files                 │                          │
      │  2. Generate nonce (5 bytes)     │                          │
      │  3. Compute Seal identity:       │                          │
      │     id = toHex([listing_id_bytes │                          │
      │           ++ nonce])             │                          │
      │  4. sealClient.encrypt({        │                          │
      │       threshold: 2,              │                          │
      │       packageId,                 │                          │
      │       id,                        │                          │
      │       data: plaintext            │                          │
      │     })                           │                          │
      │  → encryptedBytes               │                          │
      │                                  │                          │
      │  5. POST /api/upload             │                          │
      │     { encryptedBytes,            │                          │
      │       metadata }                 │                          │
      │──────────────────────────────────►│                          │
      │                                  │  6. Store on Walrus      │
      │                                  │──────────────────────────►│
      │                                  │  ◄── blobId              │
      │  ◄── { blobId }                 │                          │
      │                                  │                          │
      │  7. Create SkillListing on-chain │                          │
      │     (includes walrus_blob_id,    │                          │
      │      seal_key_id)                │                          │
```

### 5.2 Decryption Flow (Buyer Downloads)

```
Buyer (browser)                   Seal Key Servers            Sui Full Node
      │                                  │                          │
      │  1. Fetch encrypted blob from    │                          │
      │     Walrus (via backend proxy)   │                          │
      │                                  │                          │
      │  2. Create SessionKey:           │                          │
      │     SessionKey.create({          │                          │
      │       address, packageId,        │                          │
      │       ttlMin: 10,                │                          │
      │       suiClient                  │                          │
      │     })                           │                          │
      │  3. Sign personal message        │                          │
      │     (wallet popup — once per     │                          │
      │      session per package)        │                          │
      │                                  │                          │
      │  4. Parse encrypted blob:        │                          │
      │     EncryptedObject.parse(blob)  │                          │
      │     → extract id                 │                          │
      │                                  │                          │
      │  5. Build PTB:                   │                          │
      │     tx.moveCall({                │                          │
      │       target: seal_approve,      │                          │
      │       args: [id, pkg_version,    │                          │
      │              receipt]            │                          │
      │     })                           │                          │
      │     txBytes = tx.build({         │                          │
      │       onlyTransactionKind: true  │                          │
      │     })                           │                          │
      │                                  │                          │
      │  6. sealClient.decrypt({         │                          │
      │       data: encryptedBytes,      │                          │
      │       sessionKey,                │                          │
      │       txBytes                    │                          │
      │     })                           │                          │
      │─────────────────────────────────►│                          │
      │                                  │  7. dry_run seal_approve │
      │                                  │──────────────────────────►│
      │                                  │  ◄── success/abort       │
      │  ◄── decryption key shares       │                          │
      │                                  │                          │
      │  8. Local decryption             │                          │
      │     → plaintext skill files      │                          │
```

### 5.3 Key Identity Format

```
Full Seal key identity = [package_id (32 bytes)] ++ [id parameter]
id parameter            = [skill_listing_id (32 bytes)] ++ [random_nonce (5 bytes)]
```

- `package_id` is prepended automatically by Seal — NOT passed to `seal_approve`.
- `seal_approve` receives only `[skill_listing_id ++ nonce]`.
- The prefix check in `seal_approve` extracts the first 32 bytes as the skill listing ID.

### 5.4 SessionKey Management

```typescript
import { SessionKey } from '@mysten/seal';
import { set, get } from 'idb-keyval';

// Create (once per session)
const sessionKey = await SessionKey.create({
  address: suiAddress,
  packageId: MARKETPLACE_PACKAGE_ID,
  ttlMin: 10,
  suiClient,
});
const message = sessionKey.getPersonalMessage();
const { signature } = await signPersonalMessage({ message });
await sessionKey.setPersonalMessageSignature(signature);

// Persist to IndexedDB
set('sealSessionKey', sessionKey.export());

// Restore
const imported = await get('sealSessionKey');
const restored = await SessionKey.import(imported, suiClient);
```

---

## 6. Backend API Contracts

### 6.1 REST Endpoints

#### Skill Discovery

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/skills` | List skills (paginated, filterable) |
| `GET` | `/api/skills/:id` | Get skill details |
| `GET` | `/api/skills/search?q=` | Full-text search |
| `GET` | `/api/packages` | List packages (paginated) |
| `GET` | `/api/packages/:id` | Get package details |
| `GET` | `/api/sellers/:address` | Seller profile + listings |
| `GET` | `/api/categories` | List categories with counts |

#### Walrus Proxy

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload encrypted bytes to Walrus, return blobId |
| `GET` | `/api/download/:blobId` | Fetch encrypted blob from Walrus |

#### Seller Dashboard

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sellers/:address/sales` | Sales history |
| `GET` | `/api/sellers/:address/revenue` | Revenue summary |
| `GET` | `/api/sellers/:address/renewals` | Upcoming renewals |

#### Health & Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Service health |
| `GET` | `/api/stats` | Marketplace statistics |

### 6.2 PostgreSQL Schema

```sql
-- Indexed from on-chain events

CREATE TABLE skills (
    id TEXT PRIMARY KEY,                -- on-chain SkillListing object ID
    seller TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price BIGINT NOT NULL,              -- in MIST
    category TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    walrus_blob_id TEXT NOT NULL,
    walrus_quilt_id TEXT,
    seal_key_id BYTEA NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at_epoch BIGINT NOT NULL,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    -- Full-text search
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', description), 'B') ||
        setweight(to_tsvector('english', category), 'C')
    ) STORED
);

CREATE INDEX idx_skills_search ON skills USING GIN (search_vector);
CREATE INDEX idx_skills_category ON skills (category) WHERE is_active = TRUE;
CREATE INDEX idx_skills_seller ON skills (seller);
CREATE INDEX idx_skills_price ON skills (price) WHERE is_active = TRUE;

CREATE TABLE packages (
    id TEXT PRIMARY KEY,                -- on-chain PackageListing object ID
    seller TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    skill_ids TEXT[] NOT NULL,
    discount_bps INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at_epoch BIGINT NOT NULL,
    indexed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_packages_seller ON packages (seller);

CREATE TABLE purchases (
    id TEXT PRIMARY KEY,                -- on-chain PurchaseReceipt object ID
    buyer TEXT NOT NULL,
    skill_ids TEXT[] NOT NULL,
    seller TEXT NOT NULL,
    amount_paid BIGINT NOT NULL,
    platform_fee BIGINT NOT NULL,
    seller_revenue BIGINT NOT NULL,
    purchased_at_epoch BIGINT NOT NULL,
    indexed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchases_buyer ON purchases (buyer);
CREATE INDEX idx_purchases_seller ON purchases (seller);

CREATE TABLE seller_vaults (
    id TEXT PRIMARY KEY,                -- on-chain SellerVault object ID
    seller TEXT NOT NULL UNIQUE,
    balance BIGINT DEFAULT 0,
    indexed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE renewal_alerts (
    id SERIAL PRIMARY KEY,
    skill_id TEXT NOT NULL REFERENCES skills(id),
    seller TEXT NOT NULL,
    walrus_blob_id TEXT NOT NULL,
    expiry_epoch BIGINT NOT NULL,
    alert_level TEXT NOT NULL,          -- 'warning_2_epoch', 'warning_1_epoch', 'expired'
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 Event Indexer

Uses gRPC `SubscriptionService.SubscribeCheckpoints` to stream checkpoint data in real-time.

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});

// Stream checkpoints and filter for marketplace events
// Pattern: SubscribeCheckpoints → extract transactions → filter by event type
// Event types to index:
//   {packageId}::skill::SkillListed
//   {packageId}::skill::SkillDelisted
//   {packageId}::package_listing::PackageListed
//   {packageId}::package_listing::PackageDelisted
//   {packageId}::purchase::SkillPurchased
//   {packageId}::purchase::VaultWithdrawal
```

**Backfill strategy:** On indexer restart, use `LedgerService.GetCheckpoint` to read from `last_processed_checkpoint` to current, then switch to streaming.

### 6.4 Renewal Monitor

A cron job (runs every epoch, ~24h) that:

1. Queries skills with Walrus blob expiry approaching within 2 epochs
2. Creates `renewal_alerts` entries with `alert_level = 'warning_2_epoch'`
3. At 1 epoch remaining: updates to `alert_level = 'warning_1_epoch'`
4. Sends notification to seller (webhook, email, or in-app)

**Note:** Actual renewal requires the seller to sign a PTB that:
1. Withdraws SUI from their SellerVault
2. Calls Walrus storage extension (off-chain via Walrus CLI/API)

The backend facilitates but does not execute — the seller must approve the transaction.

---

## 7. Frontend Routes & Components

### 7.1 Page Structure (Next.js App Router)

```
app/
├── layout.tsx              # DAppKitProvider + QueryClientProvider + nav
├── page.tsx                # Landing / featured skills
├── explore/
│   └── page.tsx            # Browse & search skills (filterable grid)
├── skill/
│   └── [id]/
│       └── page.tsx        # Skill detail + purchase button
├── package/
│   └── [id]/
│       └── page.tsx        # Package detail + purchase button
├── seller/
│   ├── dashboard/
│   │   └── page.tsx        # Seller dashboard (my listings, revenue, renewals)
│   └── [address]/
│       └── page.tsx        # Public seller profile
├── purchases/
│   └── page.tsx            # My purchases + decrypt button
└── api/                    # Next.js API routes (proxy to backend or direct)
```

### 7.2 Wallet Integration Setup

```typescript
// app/providers.tsx
import { createDAppKit, DAppKitProvider } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet'],
  defaultNetwork: 'testnet',
  createClient(network) {
    return new SuiGrpcClient({
      network,
      baseUrl: network === 'mainnet'
        ? 'https://fullnode.mainnet.sui.io:443'
        : 'https://fullnode.testnet.sui.io:443',
    });
  },
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
```

### 7.3 Key Frontend Hooks

| Hook | Source | Purpose |
|------|--------|---------|
| `useCurrentAccount()` | `@mysten/dapp-kit-react` | Connected wallet address |
| `useCurrentClient()` | `@mysten/dapp-kit-react` | `SuiGrpcClient` instance |
| `useDAppKit()` | `@mysten/dapp-kit-react` | Sign and execute transactions |
| `ConnectButton` | `@mysten/dapp-kit-react` | Wallet connect UI |
| `useQuery` | `@tanstack/react-query` | Cache & fetch backend data |
| `useMutation` | `@tanstack/react-query` | Execute purchase/delist actions |

### 7.4 Purchase Flow (Frontend)

```typescript
import { useDAppKit } from '@mysten/dapp-kit-react';
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';

const dAppKit = useDAppKit();

async function purchaseSkill(listingId: string, vaultId: string, price: bigint) {
  const tx = new Transaction();
  const payment = coinWithBalance({ balance: price });
  tx.moveCall({
    target: `${PACKAGE_ID}::purchase::purchase_skill`,
    arguments: [
      tx.object(MARKETPLACE_CONFIG_ID),
      tx.object(listingId),
      tx.object(vaultId),
      payment,
    ],
  });
  const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
  if (result.$kind === 'FailedTransaction') {
    throw new Error('Purchase failed');
  }
  return result;
}
```

### 7.5 Decrypt Flow (Frontend)

```typescript
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';

async function decryptSkill(
  encryptedBlob: Uint8Array,
  receiptId: string,
  sealClient: SealClient,
  sessionKey: SessionKey,
  suiClient: SuiGrpcClient,
) {
  const parsed = EncryptedObject.parse(encryptedBlob);

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_policy::seal_approve`,
    arguments: [
      tx.pure.vector('u8', fromHex(parsed.id)),
      tx.object(PACKAGE_VERSION_ID),
      tx.object(receiptId),
    ],
  });
  const txBytes = await tx.build({
    client: suiClient,
    onlyTransactionKind: true,
  });

  const decryptedBytes = await sealClient.decrypt({
    data: encryptedBlob,
    sessionKey,
    txBytes,
  });

  return decryptedBytes;
}
```

---

## 8. Data Lifecycle Flows

### 8.1 Create Skill

1. Seller connects wallet
2. Fills listing form (title, description, price, category, tags)
3. Uploads skill file(s) → browser encrypts with Seal → POST to backend → stored on Walrus
4. Browser builds PTB: `skill::create(...)` with Walrus blob ID and Seal key ID
5. Seller signs and executes → SkillListing (shared) + SellerCap (owned) created
6. Indexer picks up `SkillListed` event → inserts into PostgreSQL

### 8.2 Browse & Search

1. Buyer visits `/explore`
2. Frontend calls `GET /api/skills?category=&q=&sort=&page=`
3. Backend runs PostgreSQL full-text search
4. Returns paginated results with metadata

### 8.3 Purchase

1. Buyer views `/skill/[id]` → sees price, description, seller
2. Clicks "Purchase" → browser builds PTB: `purchase::purchase_skill(...)`
3. Buyer signs → payment split on-chain (seller vault + platform fee)
4. PurchaseReceipt NFT transferred to buyer
5. Indexer picks up `SkillPurchased` event → inserts into PostgreSQL
6. Frontend redirects to `/purchases`

### 8.4 Decrypt

1. Buyer visits `/purchases` → sees list of owned PurchaseReceipts
2. Clicks "Download" on a skill
3. Frontend fetches encrypted blob from Walrus (via backend proxy)
4. Creates/restores SessionKey (wallet popup if new session)
5. Builds PTB with `seal_approve` → calls `sealClient.decrypt()`
6. Seal key servers dry-run the PTB → verify PurchaseReceipt ownership
7. Decrypted plaintext delivered to browser → file download

### 8.5 Renew Storage

1. Renewal monitor detects approaching Walrus expiry
2. Backend creates alert, notifies seller
3. Seller visits dashboard → sees renewal warning
4. Seller clicks "Renew" → browser builds PTB:
   - `purchase::withdraw(vault, renewal_cost)` — get SUI from vault
   - Walrus storage extension call (off-chain step)
5. Seller signs and executes

### 8.6 Delist

1. Seller visits dashboard → clicks "Delist" on a listing
2. Browser builds PTB: `skill::delist(seller_cap, listing)`
3. Seller signs → `is_active` set to false
4. Indexer picks up `SkillDelisted` event → updates PostgreSQL
5. Listing no longer appears in search results
6. **Existing PurchaseReceipts remain valid** — buyers can still decrypt

---

## 9. Security Model

### 9.1 Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|-----------|
| **Fake PurchaseReceipt** | MoveVM owned-object enforcement: only the actual owner can include it in a PTB. `seal_approve` receives it as a reference — dry-run verifies sender owns it. |
| **Key reuse across skills** | Each skill gets a unique Seal key identity (listing ID + nonce). Prefix check in `seal_approve` ensures the receipt covers the specific skill. |
| **Package upgrade changes access policy** | `PackageVersion` singleton with version check in `seal_approve`. If the package upgrades without updating `PackageVersion`, old ciphertexts remain accessible under the old policy. |
| **Price manipulation during purchase** | Price is read from the shared `SkillListing` object on-chain. The Move function verifies `coin.value() >= listing.price`. No off-chain price parameter. |
| **Platform fee bypass** | Fee split is computed in the Move `purchase_skill` function from `MarketplaceConfig.fee_bps`. Cannot be bypassed by the caller. |
| **Seller impersonation on delist** | `delist` requires `SellerCap` (owned object). Only the seller who created the listing holds the cap. |
| **Replay attacks on Seal decryption** | SessionKey has a TTL. Key servers validate the session timestamp. |
| **Content redistribution after decryption** | Out of scope for v1. This is a fundamental DRM limitation. Buyers receive plaintext after decryption. |

### 9.2 Edge Cases

| Scenario | Handling |
|----------|---------|
| Walrus blob expires before renewal | Listing becomes inaccessible. PurchaseReceipts remain valid on-chain but decryption fails (no blob to fetch). Seller must re-upload and create a new listing. |
| Seller has no vault when buyer purchases | The first `skill::create` call should also create a `SellerVault` if one doesn't exist, or `purchase_skill` creates it lazily. |
| Buyer purchases delisted skill | `purchase_skill` checks `listing.is_active == true`. Aborts if inactive. |
| Package lists a skill that was delisted | The package itself must be active. Individual skill access within the package is independent — buyers can still decrypt previously purchased skills. Package purchase aborts if any referenced skill is inactive. |
| Multiple purchases of the same skill | Each purchase creates a new PurchaseReceipt. Multiple receipts for the same skill are valid — no deduplication needed. |

---

## 10. Implementation Plan (8 Phases)

### Phase 1: Move Contracts — Core

**Modules:** `marketplace.move`, `skill.move`

**Deliverables:**
- MarketplaceConfig shared object with init, admin functions
- SkillListing shared object with create/delist
- SellerCap ownership pattern
- All events for these modules
- Unit tests with `#[test]` attribute

**Acceptance Criteria:**
- `sui move build` succeeds with no warnings
- `sui move test` passes all tests
- MarketplaceConfig created and shared in `init`
- AdminCap transferred to deployer
- SkillListed/SkillDelisted events emitted correctly
- `/move-code-quality` reports no issues

### Phase 2: Move Contracts — Purchases & Seal

**Modules:** `purchase.move`, `seal_policy.move`, `package_listing.move`

**Deliverables:**
- PurchaseReceipt NFT minting on purchase
- SellerVault with payment splitting (fee + seller)
- seal_approve entry function
- PackageListing with bundle discount
- Integration tests across modules

**Acceptance Criteria:**
- Purchase flow works end-to-end in tests
- Payment split matches fee_bps configuration
- seal_approve correctly validates receipt → skill mapping
- seal_approve aborts on invalid access
- Package discount computed correctly
- `/move-code-quality` reports no issues

### Phase 3: Backend — Foundation

**Deliverables:**
- Node.js TypeScript project setup (Express or Fastify)
- PostgreSQL schema migration scripts
- REST endpoint stubs for all routes in section 6.1
- Health check endpoint
- Environment configuration

**Acceptance Criteria:**
- `npm run build` succeeds
- Database migrations run cleanly
- Health endpoint returns 200
- TypeScript strict mode, no `any` types

### Phase 4: Backend — Event Indexer

**Deliverables:**
- gRPC SubscribeCheckpoints streaming client
- Event parsing for all 6 event types
- PostgreSQL upsert logic for each event
- Backfill from last-processed checkpoint on restart
- Cursor persistence (last checkpoint in DB)

**Acceptance Criteria:**
- Indexer connects to testnet gRPC and streams
- Events correctly parsed and stored
- Restart resumes from last checkpoint
- No duplicate entries on re-processing

### Phase 5: Backend — Walrus Proxy & Search

**Deliverables:**
- POST /api/upload → Walrus blob store
- GET /api/download/:blobId → Walrus blob fetch
- Full-text search on /api/skills/search
- Category filtering and pagination
- Seller dashboard endpoints

**Acceptance Criteria:**
- Upload returns valid Walrus blob ID
- Download returns correct encrypted bytes
- Search returns relevant results
- Pagination works with page tokens

### Phase 6: Frontend — Core Pages

**Deliverables:**
- Next.js project with Tailwind CSS setup
- DAppKitProvider with SuiGrpcClient
- Landing page with featured skills
- Browse/search page with filters
- Skill detail page
- Wallet connect flow

**Acceptance Criteria:**
- `npm run build` succeeds
- Wallet connection works with Sui wallets
- Skill browsing and search functional
- Responsive design on mobile

### Phase 7: Frontend — Purchase & Decrypt

**Deliverables:**
- Purchase flow (build PTB, sign, execute)
- My purchases page (list owned PurchaseReceipts)
- Seal SessionKey management
- Decrypt flow (fetch blob, build seal_approve PTB, decrypt)
- File download after decryption

**Acceptance Criteria:**
- End-to-end purchase works on testnet
- PurchaseReceipt appears in "My Purchases"
- Decryption returns correct plaintext
- SessionKey persisted in IndexedDB

### Phase 8: Frontend — Seller Dashboard & Polish

**Deliverables:**
- Seller dashboard (my listings, revenue, renewals)
- Create listing flow (upload + encrypt + on-chain)
- Delist flow
- Package creation flow
- Renewal alerts
- Error handling and loading states

**Acceptance Criteria:**
- Seller can create, view, and delist listings
- Revenue displayed correctly
- Renewal warnings shown
- Package creation with discount
- Production-ready error handling

---

## 11. Testing & Observability

### Move Testing

```bash
sui move test                    # run all tests
sui move test --filter <name>    # run specific test
sui move test --coverage         # with coverage report
```

**Testing patterns:**
- Create `test_utils.move` with shared test addresses, setup helpers
- Every struct gets `#[test_only] create_for_testing` / `destroy_for_testing`
- Use `sui::test_utils::destroy` for cleanup
- Use `assert_eq!` over `assert!(a == b)`
- Test error paths with `#[test, expected_failure(abort_code = N)]`

### Backend Testing

- Unit tests: Jest or Vitest
- Integration tests: Against local PostgreSQL (testcontainers)
- E2E tests: Against Sui testnet with test wallets

### Frontend Testing

- Component tests: React Testing Library
- E2E tests: Playwright or Cypress against local dev environment

### Observability

| Signal | Tool | Notes |
|--------|------|-------|
| Backend logs | Structured JSON (pino) | Include checkpoint number, event type |
| Indexer lag | Custom metric | `current_checkpoint - last_indexed_checkpoint` |
| API latency | Express/Fastify middleware | p50, p95, p99 per endpoint |
| Error rate | Sentry or equivalent | Frontend + backend |
| Walrus blob health | Renewal monitor | Expiry tracking per listing |

---

## 12. Open Questions & Dependencies

| # | Question | Impact | Status |
|---|----------|--------|--------|
| 1 | Walrus quilt API availability — is there a JS SDK for quilts? | Multi-file upload flow | Research needed |
| 2 | Walrus storage pricing on mainnet — affects renewal cost estimation | Renewal monitor logic | TBD at mainnet launch |
| 3 | Seal key server object IDs for mainnet | Production deployment | Obtain from Mysten |
| 4 | Should `PurchaseReceipt` have `store` ability for Kiosk integration? | Resale market possibility | Decided: `key` only for v1 |
| 5 | Rate limiting strategy for the Walrus proxy endpoint | Abuse prevention | Design in Phase 5 |
| 6 | Package purchase — should it verify all skills are active, or allow partial? | UX decision | Decided: all must be active |
| 7 | SellerVault — one per seller globally, or one per listing? | Gas cost vs complexity | Decided: one per seller |

---

## 13. Coding Conventions

### Move (2024 Edition)

- **Module syntax:** `module fast_and_furious::name;` (no curly braces)
- **Method syntax:** `id.delete()` over `object::delete(id)`, `ctx.sender()` over `tx_context::sender(ctx)`
- **String literals:** `b"text".to_string()` instead of `string::utf8(b"text")`
- **Error constants:** `EPascalCase` (e.g., `ENotAuthorized`)
- **Regular constants:** `ALL_CAPS` (e.g., `MAX_FEE_BPS`)
- **Capabilities:** Suffix with `Cap` (e.g., `AdminCap`, `SellerCap`)
- **Events:** Past tense (e.g., `SkillListed`, `SkillPurchased`)
- **Getters:** Named after field, no `get_` prefix
- **Test functions:** No `test_` prefix (redundant with `#[test]`)
- **Test attributes:** Single line: `#[test, expected_failure(abort_code = 0)]`
- **Assertions:** `assert_eq!(a, b)` over `assert!(a == b)`
- **Mutable variables:** Explicit `let mut` for any variable that will be mutated
- **Test addresses:** Valid hex only (A-F, not arbitrary letters)
- **Expected failure:** Numeric abort codes, not `module::constant` references

### TypeScript (Backend & Frontend)

- Strict mode (`"strict": true` in tsconfig)
- No `any` types — use proper interfaces
- gRPC only — import `SuiGrpcClient` from `@mysten/sui/grpc`
- Never import from `@mysten/sui.js` (deprecated) or use JSON-RPC client
- Use `@mysten/dapp-kit-react` (not `@mysten/dapp-kit`)
- BCS parsing for gRPC object content via `@mysten/sui/bcs`

### Git & Project

- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
- Move package at `/move/fast_and_furious/`
- Backend at `/backend/`
- Frontend at `/frontend/`
- Shared types at `/shared/types/`

### Move.toml

```toml
[package]
name = "fast_and_furious"
edition = "2024"

[dependencies]
# DO NOT add explicit Sui dependency — auto-added for testnet/mainnet

[addresses]
fast_and_furious = "0x0"
```

---

## Quick Reference: Key Object IDs (Testnet)

These will be populated after deployment:

```
MARKETPLACE_PACKAGE_ID  = "0x..."
MARKETPLACE_CONFIG_ID   = "0x..."
PACKAGE_VERSION_ID      = "0x..."
ADMIN_CAP_ID            = "0x..."
```

### Seal Key Servers (Testnet)

```
SERVER_1 = "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75"
SERVER_2 = "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
THRESHOLD = 2
```
