/// Module: marketplace
/// Platform configuration, admin controls, and the central listings registry.
module fast_and_furious::marketplace;

// === Imports ===
use std::string::String;
use sui::dynamic_field;

// === Errors ===
#[allow(unused_const)]
const ENotAuthorized: u64 = 100;
const EInvalidFeeBps: u64 = 101;
#[allow(unused_const)]
const EWrongVersion: u64 = 102;
const EListingAlreadyRegistered: u64 = 103;
const EListingNotRegistered: u64 = 104;

// === Constants ===
const MAX_FEE_BPS: u64 = 10_000; // 100%
const VERSION: u64 = 1;

// === Structs ===

/// Shared object — global marketplace configuration.
/// Created once in `init` and shared.
public struct MarketplaceConfig has key {
    id: UID,
    version: u64,
    fee_bps: u64,
    fee_recipient: address,
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

/// Shared object — central index of all listings.
/// Uses dynamic fields: key = listing ID, value = vector<String> (tags).
/// Frontend enumerates via `ListDynamicFields` gRPC to discover all listings.
public struct ListingsRegistry has key {
    id: UID,
    listing_count: u64,
}

// === Init ===
fun init(ctx: &mut TxContext) {
    transfer::share_object(MarketplaceConfig {
        id: object::new(ctx),
        version: VERSION,
        fee_bps: 250,
        fee_recipient: ctx.sender(),
    });

    transfer::transfer(AdminCap {
        id: object::new(ctx),
    }, ctx.sender());

    transfer::share_object(PackageVersion {
        id: object::new(ctx),
        version: VERSION,
    });

    transfer::share_object(ListingsRegistry {
        id: object::new(ctx),
        listing_count: 0,
    });
}

// === Admin Functions ===

/// Update the platform fee. Requires AdminCap.
public fun update_fee(config: &mut MarketplaceConfig, _: &AdminCap, new_fee_bps: u64) {
    assert!(new_fee_bps <= MAX_FEE_BPS, EInvalidFeeBps);
    config.fee_bps = new_fee_bps;
}

/// Update the fee recipient address.
public fun update_fee_recipient(
    config: &mut MarketplaceConfig,
    _: &AdminCap,
    new_recipient: address,
) {
    config.fee_recipient = new_recipient;
}

// === Registry Functions ===

/// Register a listing in the registry. Called by skill::create and package_listing::create.
public(package) fun register_listing(
    registry: &mut ListingsRegistry,
    listing_id: ID,
    tags: vector<String>,
) {
    assert!(!dynamic_field::exists_(&registry.id, listing_id), EListingAlreadyRegistered);
    dynamic_field::add(&mut registry.id, listing_id, tags);
    registry.listing_count = registry.listing_count + 1;
}

/// Unregister a listing from the registry. Called by skill::delist and package_listing::delist.
public(package) fun unregister_listing(
    registry: &mut ListingsRegistry,
    listing_id: ID,
) {
    assert!(dynamic_field::exists_(&registry.id, listing_id), EListingNotRegistered);
    dynamic_field::remove<ID, vector<String>>(&mut registry.id, listing_id);
    registry.listing_count = registry.listing_count - 1;
}

// === View Functions ===
public fun fee_bps(config: &MarketplaceConfig): u64 { config.fee_bps }
public fun fee_recipient(config: &MarketplaceConfig): address { config.fee_recipient }
public fun version(config: &MarketplaceConfig): u64 { config.version }
public fun listing_count(registry: &ListingsRegistry): u64 { registry.listing_count }
public fun pkg_version(pv: &PackageVersion): u64 { pv.version }

// === Test-Only Functions ===

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun create_config_for_testing(
    fee_bps: u64,
    fee_recipient: address,
    ctx: &mut TxContext,
): MarketplaceConfig {
    MarketplaceConfig {
        id: object::new(ctx),
        version: VERSION,
        fee_bps,
        fee_recipient,
    }
}

#[test_only]
public fun create_admin_cap_for_testing(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}

#[test_only]
public fun create_package_version_for_testing(ctx: &mut TxContext): PackageVersion {
    PackageVersion { id: object::new(ctx), version: VERSION }
}

#[test_only]
public fun create_package_version_with_version_for_testing(
    version: u64,
    ctx: &mut TxContext,
): PackageVersion {
    PackageVersion { id: object::new(ctx), version }
}

#[test_only]
public fun create_registry_for_testing(ctx: &mut TxContext): ListingsRegistry {
    ListingsRegistry { id: object::new(ctx), listing_count: 0 }
}

