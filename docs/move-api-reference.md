# Move API Reference

Reference for all Sui Move modules in the `wooper` package. For implementation details, read the source files directly.

---

## Module Overview

| Module | Source | Purpose |
|--------|--------|---------|
| `marketplace` | `wooper/sources/marketplace.move` | Platform config, admin controls, listings registry |
| `skill` | `wooper/sources/skill.move` | Individual skill listings (two-step create/finalize) |
| `package_listing` | `wooper/sources/package_listing.move` | Bundled skill packages with discount pricing |
| `purchase` | `wooper/sources/purchase.move` | Purchase receipts, seller vaults, payment splitting |
| `seal_policy` | `wooper/sources/seal_policy.move` | Seal access control for decryption gating |

---

## marketplace.move

### Structs

**MarketplaceConfig** (shared) — Global platform configuration, created in `init`.
- `version: u64` — Package version (currently 1)
- `fee_bps: u64` — Platform fee in basis points (default 250 = 2.5%)
- `fee_recipient: address` — Where platform fees are sent

**AdminCap** (owned, key + store) — Transferred to deployer in `init`. Required for `update_fee` and `update_fee_recipient`.

**PackageVersion** (shared) — Singleton for version gating in `seal_policy`. Contains `version: u64`.

**ListingsRegistry** (shared) — Central index using dynamic fields (key = listing `ID`, value = `vector<String>` tags).
- `listing_count: u64` — Number of registered listings

### Key Functions

- `init()` — Creates MarketplaceConfig, AdminCap, PackageVersion, ListingsRegistry
- `update_fee(config, admin_cap, new_fee_bps)` — Update platform fee (max 10,000)
- `update_fee_recipient(config, admin_cap, new_recipient)` — Update fee recipient
- `register_listing(registry, listing_id, tags)` — `public(package)`, adds dynamic field
- `unregister_listing(registry, listing_id)` — `public(package)`, removes dynamic field

### View Functions

`fee_bps`, `fee_recipient`, `version`, `listing_count`, `pkg_version`

---

## skill.move

### Structs

**SkillListing** (shared) — Individual skill listing. Immutable after finalization.
- `seller: address`
- `title: String`, `description: String`
- `price: u64` — In MIST, must be > 0
- `category: String`, `tags: vector<String>`
- `walrus_blob_id: String` — Walrus blob ID (ciphertext)
- `walrus_quilt_id: Option<String>` — Quilt ID for multi-file listings
- `file_names: vector<String>` — Names of files in the listing (1-10 files)
- `seal_key_id: vector<u8>` — Seal identity (without package prefix)
- `created_at_epoch: u64`
- `is_active: bool` — False until finalized; set to false on delist
- `is_finalized: bool` — Set to true by `finalize()`

**SellerCap** (owned, key + store) — Proves seller identity. Contains `skill_listing_id: ID`.

### Key Functions — Two-Step Creation

1. **`create(config, title, description, price, category, tags, ctx)`** — Creates SkillListing (shared, inactive, not finalized) + SellerCap (transferred to sender). Walrus/Seal fields are empty — the listing ID is needed for Seal encryption, so content upload happens between steps.

2. **`finalize(seller_cap, listing, registry, walrus_blob_id, walrus_quilt_id, file_names, seal_key_id)`** — Populates Walrus/Seal data, sets `is_active = true` and `is_finalized = true`, registers in ListingsRegistry. Emits `SkillListed`.

3. **`delist(listing, seller_cap, registry)`** — Sets `is_active = false`, unregisters from ListingsRegistry. Emits `SkillDelisted`. Requires listing to be finalized and active.

### View Functions

`seller`, `price`, `is_active`, `is_finalized`, `seal_key_id`, `title`, `file_names`, `skill_listing_id` (on SellerCap)

---

## package_listing.move

### Structs

**PackageListing** (shared) — Bundle of skills sold at a discount.
- `seller: address`
- `title: String`, `description: String`
- `skill_ids: vector<ID>` — References to SkillListing IDs
- `price: u64` — Explicit price (pre-computed by frontend: sum of skill prices minus discount)
- `discount_bps: u64` — Discount in basis points (max 5,000 = 50%)
- `tags: vector<String>` — For registry indexing
- `created_at_epoch: u64`
- `is_active: bool`

**PackageSellerCap** (owned, key + store) — Contains `package_listing_id: ID`.

### Key Functions

- **`create(config, registry, title, description, skill_ids, price, discount_bps, tags, ctx)`** — Creates PackageListing (shared, active), registers in ListingsRegistry. Emits `PackageListed`.
- **`delist(listing, seller_cap, registry)`** — Sets `is_active = false`, unregisters. Emits `PackageDelisted`.

### View Functions

`seller`, `title`, `skill_ids`, `price`, `discount_bps`, `is_active`, `package_listing_id` (on cap)

---

## purchase.move

### Structs

**PurchaseReceipt** (owned, key only — not Kiosk-compatible) — Proof of purchase NFT.
- `buyer: address`
- `skill_ids: vector<ID>` — Skills this receipt grants access to
- `seller: address`
- `amount_paid: u64`
- `purchased_at_epoch: u64`

**SellerVault** (shared) — Accumulates seller revenue. One per seller.
- `seller: address`
- `balance: Balance<SUI>`

### Key Functions

- **`create_vault(ctx)`** — Creates a SellerVault for the caller (shared)
- **`purchase_skill(config, listing, vault, payment, ctx)`** — Splits payment (platform fee + seller revenue), mints PurchaseReceipt. Asserts `EVaultSellerMismatch` if vault.seller != listing.seller. Emits `SkillPurchased`.
- **`purchase_package(config, package, vault, payment, ctx)`** — Same as above but uses PackageListing's explicit price. Emits `SkillPurchased`.
- **`withdraw(vault, amount, ctx) -> Coin<SUI>`** — Seller withdraws from vault. Emits `VaultWithdrawn`.

### View Functions

`skill_ids`, `buyer`, `seller`, `amount_paid` (on receipt), `balance`, `vault_seller` (on vault)

---

## seal_policy.move

### Functions

**`seal_approve(id, pkg_version, receipt)`** — Entry function called by Seal key servers via `dry_run_transaction_block`.

Access control:
1. MoveVM enforces PurchaseReceipt ownership (owned object in PTB)
2. Extracts first 32 bytes of `id` as skill listing ID using `vector::tabulate!`
3. Checks receipt covers that skill using `do_ref!` macro
4. Verifies PackageVersion matches (upgrade protection)

`id` format: `[skill_listing_id (32 bytes)] ++ [random_nonce (5 bytes)]`

---

## Events Summary

| Module | Event | Emitted When |
|--------|-------|-------------|
| `skill` | `SkillListed` | `finalize()` activates a listing |
| `skill` | `SkillDelisted` | `delist()` deactivates a listing |
| `package_listing` | `PackageListed` | Package created |
| `package_listing` | `PackageDelisted` | Package delisted |
| `purchase` | `SkillPurchased` | Skill or package purchased |
| `purchase` | `VaultWithdrawn` | Seller withdraws from vault |

---

## Error Code Ranges

| Module | Range | Codes |
|--------|-------|-------|
| `marketplace` | 100-104 | `ENotAuthorized`(100), `EInvalidFeeBps`(101), `EWrongVersion`(102), `EListingAlreadyRegistered`(103), `EListingNotRegistered`(104) |
| `skill` | 200-207 | `ENotSeller`(200), `EInvalidPrice`(201), `EWrongVersion`(202), `EAlreadyDelisted`(203), `EAlreadyFinalized`(204), `ENotFinalized`(205), `EFileNamesRequired`(206), `EMaxFilesExceeded`(207) |
| `package_listing` | 300-305 | `ENotSeller`(300), `EInvalidDiscount`(301), `EEmptySkillList`(302), `EWrongVersion`(303), `EAlreadyDelisted`(304), `EInvalidPrice`(305) |
| `purchase` | 400-405 | `EListingNotActive`(400), `EInsufficientPayment`(401), `ENotVaultOwner`(402), `EInsufficientVaultBalance`(403), `EWrongVersion`(404), `EVaultSellerMismatch`(405) |
| `seal_policy` | 500-502 | `ENoAccess`(500), `EWrongVersion`(501), `EInvalidKeyId`(502) |

---

## Test Modules

| Test File | Covers |
|-----------|--------|
| `wooper/sources/marketplace_tests.move` | init, admin fee updates, registry ops |
| `wooper/sources/skill_tests.move` | Two-step create/finalize, delist, error paths |
| `wooper/sources/purchase_tests.move` | Payment splitting, vault ops, package purchases |
| `wooper/sources/seal_policy_tests.move` | seal_approve access control |
| `wooper/sources/package_listing_tests.move` | Bundle creation, discount limits, delist |

Shared test helpers in `wooper/sources/test_utils.move` (addresses: `ADMIN=0xAD`, `USER1=0x01`, `USER2=0x02`).
