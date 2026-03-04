/// Module: package_listing
/// Bundled skill packages with discount pricing.
module fast_and_furious::package_listing;

// === Imports ===
use std::string::String;
use fast_and_furious::marketplace::{MarketplaceConfig, ListingsRegistry};

// === Errors ===
const ENotSeller: u64 = 300;
const EInvalidDiscount: u64 = 301;
const EEmptySkillList: u64 = 302;
const EWrongVersion: u64 = 303;
const EAlreadyDelisted: u64 = 304;
const EInvalidPrice: u64 = 305;

// === Constants ===
const MAX_DISCOUNT_BPS: u64 = 5_000; // max 50% discount

// === Structs ===

/// Shared object — a bundle of skills sold at a discount.
/// Price is set at creation time (frontend computes: sum(skill_prices) * (10_000 - discount_bps) / 10_000).
public struct PackageListing has key {
    id: UID,
    seller: address,
    title: String,
    description: String,
    skill_ids: vector<ID>,
    price: u64,
    discount_bps: u64,
    tags: vector<String>,
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
    price: u64,
    discount_bps: u64,
}

public struct PackageDelisted has copy, drop {
    package_id: ID,
    seller: address,
}

// === Public Functions ===

/// Create a package listing. Price is pre-computed by the caller.
/// Registers the package in the ListingsRegistry.
#[allow(lint(self_transfer))]
public fun create(
    config: &MarketplaceConfig,
    registry: &mut ListingsRegistry,
    title: String,
    description: String,
    skill_ids: vector<ID>,
    price: u64,
    discount_bps: u64,
    tags: vector<String>,
    ctx: &mut TxContext,
) {
    assert!(config.version() == 1, EWrongVersion);
    assert!(skill_ids.length() > 0, EEmptySkillList);
    assert!(discount_bps <= MAX_DISCOUNT_BPS, EInvalidDiscount);
    assert!(price > 0, EInvalidPrice);

    let listing = PackageListing {
        id: object::new(ctx),
        seller: ctx.sender(),
        title,
        description,
        skill_ids,
        price,
        discount_bps,
        tags,
        created_at_epoch: ctx.epoch(),
        is_active: true,
    };

    let package_id = object::id(&listing);

    fast_and_furious::marketplace::register_listing(registry, package_id, listing.tags);

    sui::event::emit(PackageListed {
        package_id,
        seller: listing.seller,
        title: listing.title,
        skill_ids: listing.skill_ids,
        price: listing.price,
        discount_bps: listing.discount_bps,
    });

    transfer::transfer(PackageSellerCap {
        id: object::new(ctx),
        package_listing_id: package_id,
    }, ctx.sender());

    transfer::share_object(listing);
}

/// Delist a package. Requires PackageSellerCap. Sets is_active = false.
/// Removes the package from the ListingsRegistry.
public fun delist(
    listing: &mut PackageListing,
    seller_cap: &PackageSellerCap,
    registry: &mut ListingsRegistry,
) {
    assert!(seller_cap.package_listing_id == object::id(listing), ENotSeller);
    assert!(listing.is_active, EAlreadyDelisted);

    listing.is_active = false;

    fast_and_furious::marketplace::unregister_listing(registry, object::id(listing));

    sui::event::emit(PackageDelisted {
        package_id: object::id(listing),
        seller: listing.seller,
    });
}

// === View Functions ===
public fun seller(listing: &PackageListing): address { listing.seller }
public fun title(listing: &PackageListing): String { listing.title }
public fun skill_ids(listing: &PackageListing): vector<ID> { listing.skill_ids }
public fun price(listing: &PackageListing): u64 { listing.price }
public fun discount_bps(listing: &PackageListing): u64 { listing.discount_bps }
public fun is_active(listing: &PackageListing): bool { listing.is_active }
public fun package_listing_id(cap: &PackageSellerCap): ID { cap.package_listing_id }

// === Test-Only Functions ===

#[test_only]
public fun create_for_testing(
    seller: address,
    title: String,
    skill_ids: vector<ID>,
    price: u64,
    discount_bps: u64,
    ctx: &mut TxContext,
): PackageListing {
    PackageListing {
        id: object::new(ctx),
        seller,
        title,
        description: b"test package".to_string(),
        skill_ids,
        price,
        discount_bps,
        tags: vector[b"bundle".to_string()],
        created_at_epoch: 0,
        is_active: true,
    }
}

#[test_only]
public fun create_seller_cap_for_testing(
    package_listing_id: ID,
    ctx: &mut TxContext,
): PackageSellerCap {
    PackageSellerCap {
        id: object::new(ctx),
        package_listing_id,
    }
}

