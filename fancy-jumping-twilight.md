# Plan: Phase 1 — Move Contracts (marketplace + skill)

## Context

Phase 1 of the Fast & Furious implementation plan (from CLAUDE.md section 10). The Move package has 5 stub files at `/move/*.move` with struct definitions and function signatures but no implementations, no `Move.toml`, and no standard directory structure. We need to restructure, implement `marketplace.move` and `skill.move` fully, make the other 3 stubs compilable, add `test_utils.move`, and write comprehensive tests.

## Step 1: Restructure to standard Sui Move layout

Move from flat `move/*.move` to the proper package layout:

```
move/fast_and_furious/
  Move.toml
  sources/
    marketplace.move
    skill.move
    purchase.move          (compilable stub)
    package_listing.move   (compilable stub)
    seal_policy.move       (compilable stub)
    test_utils.move        (new)
```

**Actions:**
- `mkdir -p move/fast_and_furious/sources`
- Move all 5 `.move` files from `move/` to `move/fast_and_furious/sources/`
- Create `move/fast_and_furious/Move.toml`

**Move.toml** — try without explicit Sui dependency first (per CLAUDE.md convention); add it if build fails:

```toml
[package]
name = "fast_and_furious"
edition = "2024"

[dependencies]

[addresses]
fast_and_furious = "0x0"
```

## Step 2: Implement `marketplace.move`

**File:** `move/fast_and_furious/sources/marketplace.move`

The stub already has all structs, error constants, and `register_listing`/`unregister_listing` fully implemented. Need to fill in:

### `init(ctx)`
- Create & share `MarketplaceConfig` (fee_bps=250, fee_recipient=ctx.sender(), version=VERSION)
- Transfer `AdminCap` to ctx.sender()
- Create & share `PackageVersion` (version=VERSION)
- Create & share `ListingsRegistry` (listing_count=0)

### `update_fee(_: &AdminCap, config, new_fee_bps)`
- `assert!(new_fee_bps <= MAX_FEE_BPS, EInvalidFeeBps)`
- `config.fee_bps = new_fee_bps`

### `update_fee_recipient(_: &AdminCap, config, new_recipient)`
- `config.fee_recipient = new_recipient`

### View functions
- `fee_bps(config) -> config.fee_bps`
- `fee_recipient(config) -> config.fee_recipient`
- `version(config) -> config.version`
- `listing_count(registry) -> registry.listing_count`
- **Add new:** `pkg_version(pv: &PackageVersion) -> pv.version` (needed by `seal_policy.move`)

### Test-only functions
- `init_for_testing(ctx)` — delegates to `init(ctx)`
- `create_config_for_testing(fee_bps, fee_recipient, ctx) -> MarketplaceConfig`
- `destroy_config_for_testing(config)` — destructure and delete id
- `create_admin_cap_for_testing(ctx) -> AdminCap`
- `destroy_admin_cap_for_testing(cap)`
- `create_package_version_for_testing(ctx) -> PackageVersion`
- `destroy_package_version_for_testing(pv)`
- `create_registry_for_testing(ctx) -> ListingsRegistry`
- `destroy_registry_for_testing(registry)`

## Step 3: Implement `skill.move`

**File:** `move/fast_and_furious/sources/skill.move`

### Imports to add
```move
use std::string::String;
use fast_and_furious::marketplace::{MarketplaceConfig, ListingsRegistry};
```

### New error constant
- `EAlreadyDelisted: u64 = 203` — prevents double-delist

### `create(config, registry, title, description, price, category, tags, walrus_blob_id, walrus_quilt_id, seal_key_id, ctx)`
1. Version check: `assert!(config.version() == 1, EWrongVersion)`
2. Validate: `assert!(price > 0, EInvalidPrice)`
3. Create `SkillListing` struct (seller=ctx.sender(), created_at_epoch=ctx.epoch(), is_active=true)
4. Get listing_id via `object::id(&listing)`
5. Register in ListingsRegistry: `marketplace::register_listing(registry, listing_id, listing.tags)` (copies tags from listing — String has copy)
6. Emit `SkillListed` event (fields copied from listing before share)
7. Create & transfer `SellerCap` to ctx.sender()
8. Share the listing

### `delist(seller_cap, listing, registry)`
1. Validate cap matches: `assert!(seller_cap.skill_listing_id == object::id(listing), ENotSeller)`
2. Validate still active: `assert!(listing.is_active, EAlreadyDelisted)`
3. Set `listing.is_active = false`
4. `marketplace::unregister_listing(registry, object::id(listing))`
5. Emit `SkillDelisted` event

### View functions
- `seller(listing) -> listing.seller`
- `price(listing) -> listing.price`
- `is_active(listing) -> listing.is_active`
- `seal_key_id(listing) -> listing.seal_key_id`

### Test-only functions
- `create_for_testing(seller, title, price, category, ctx) -> SkillListing`
- `destroy_for_testing(listing)` — destructure and delete id
- `destroy_seller_cap_for_testing(cap)`

## Step 4: Make other 3 stubs compilable

These modules are Phase 2 scope but must compile. Add imports and `abort 0` bodies for unimplemented functions. View functions get real implementations (trivial).

### `purchase.move`
- Add imports: `sui::sui::SUI`, `sui::coin::Coin`, `sui::balance::Balance`, marketplace types, skill/package_listing types
- Stub functions: `purchase_skill`, `purchase_package`, `withdraw`, `create_vault` → body: `abort 0`
- Implement view functions: `receipt_skill_ids`, `vault_balance`

### `package_listing.move`
- Add imports: `std::string::String`, marketplace types
- Stub functions: `create`, `delist` → body: `abort 0`
- Implement view functions: `skill_ids`, `discount_bps`, `is_active`

### `seal_policy.move`
- Add imports: `fast_and_furious::marketplace::PackageVersion`, `fast_and_furious::purchase::PurchaseReceipt`
- Add local constant: `VERSION: u64 = 1`
- Fix field access to use view functions: `pkg_version.pkg_version()`, `receipt.receipt_skill_ids()`
- Logic is already implemented

## Step 5: Create `test_utils.move`

**File:** `move/fast_and_furious/sources/test_utils.move`

```move
#[test_only]
module fast_and_furious::test_utils;

use sui::test_scenario::{Self as ts, Scenario};

const ADMIN: address = @0xAD;
const USER1: address = @0x01;
const USER2: address = @0x02;

public fun admin(): address { ADMIN }
public fun user1(): address { USER1 }
public fun user2(): address { USER2 }

public fun begin(): Scenario { ts::begin(ADMIN) }
```

## Step 6: Tests

### marketplace.move tests (7 tests)
1. `creates_all_objects_on_init` — verify MarketplaceConfig (fee_bps=250), AdminCap, PackageVersion, ListingsRegistry all created
2. `admin_can_update_fee` — update fee to 500, verify
3. `update_fee_rejects_excessive_fee` — fee=10_001 aborts with 101
4. `update_fee_allows_max_fee` — fee=10_000 succeeds
5. `admin_can_update_fee_recipient` — update to user1, verify
6. `register_and_unregister_listing` — register fake ID, count=1, unregister, count=0
7. `register_duplicate_listing_fails` — same ID twice aborts with 103
8. `unregister_nonexistent_listing_fails` — non-existent ID aborts with 104

### skill.move tests (5 tests)
1. `create_produces_listing_and_seller_cap` — verify SkillListing shared, SellerCap transferred, registry count=1
2. `create_with_zero_price_fails` — price=0 aborts with 201
3. `delist_deactivates_and_unregisters` — is_active=false, registry count=0
4. `delist_with_wrong_seller_cap_fails` — fake SellerCap with wrong ID aborts with 200
5. `delist_already_delisted_fails` — double delist aborts with 203

**Total: 13 tests**

## Verification

```bash
cd move/fast_and_furious
sui move build                 # must succeed with no warnings
sui move test                  # all 13 tests pass
sui move test --coverage       # check coverage
```

Then run `/move-code-quality` to check against Move Book Code Quality Checklist.
