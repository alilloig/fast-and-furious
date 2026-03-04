/// Module: package_listing
/// Bundled skill packages with discount pricing (Phase 2 implementation).
#[allow(unused_const, unused_field)]
module fast_and_furious::package_listing;

// === Imports ===
use std::string::String;
use fast_and_furious::marketplace::{MarketplaceConfig, ListingsRegistry};

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
    skill_ids: vector<ID>,
    discount_bps: u64,
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

// === Public Functions (Phase 2 stubs) ===

/// Create a package listing (stub — Phase 2).
public fun create(
    _config: &MarketplaceConfig,
    _registry: &mut ListingsRegistry,
    _title: String,
    _description: String,
    _skill_ids: vector<ID>,
    _discount_bps: u64,
    _ctx: &mut TxContext,
) {
    abort 0
}

/// Delist a package (stub — Phase 2).
public fun delist(
    _seller_cap: &PackageSellerCap,
    _listing: &mut PackageListing,
    _registry: &mut ListingsRegistry,
) {
    abort 0
}

// === View Functions ===
public fun skill_ids(listing: &PackageListing): vector<ID> { listing.skill_ids }
public fun discount_bps(listing: &PackageListing): u64 { listing.discount_bps }
public fun is_active(listing: &PackageListing): bool { listing.is_active }
