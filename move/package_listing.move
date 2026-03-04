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
/// Registers the package in the ListingsRegistry.
public fun create(
    config: &MarketplaceConfig,
    registry: &mut ListingsRegistry,
    title: String,
    description: String,
    skill_ids: vector<ID>,
    discount_bps: u64,
    ctx: &mut TxContext,
);

/// Delist a package. Sets is_active = false.
/// Removes the package from the ListingsRegistry.
public fun delist(
    seller_cap: &PackageSellerCap,
    listing: &mut PackageListing,
    registry: &mut ListingsRegistry,
);

// === View Functions ===
public fun skill_ids(listing: &PackageListing): vector<ID>;
public fun discount_bps(listing: &PackageListing): u64;
public fun is_active(listing: &PackageListing): bool;