module fast_and_furious::marketplace;

// === Imports ===
use sui::dynamic_field;

// === Errors ===
const ENotAuthorized: u64 = 100;
const EInvalidFeeBps: u64 = 101;
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

/// Shared object — central index of all listings.
/// Uses dynamic fields: key = listing ID, value = vector<String> (tags).
/// Frontend enumerates via `ListDynamicFields` gRPC to discover all listings.
public struct ListingsRegistry has key {
    id: UID,
    listing_count: u64,
}

// === Init ===
fun init(ctx: &mut TxContext) {
    // Creates MarketplaceConfig (shared), AdminCap (transfer to sender),
    // PackageVersion (shared), and ListingsRegistry (shared).
}

// === Admin Functions ===
/// Update the platform fee. Requires AdminCap.
public fun update_fee(_: &AdminCap, config: &mut MarketplaceConfig, new_fee_bps: u64);

/// Update the fee recipient address.
public fun update_fee_recipient(_: &AdminCap, config: &mut MarketplaceConfig, new_recipient: address);

// === Registry Functions ===
/// Register a listing in the registry. Called by skill::create and package_listing::create.
/// Adds a dynamic field: key = listing_id, value = tags.
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
/// Removes the dynamic field for this listing.
public(package) fun unregister_listing(
    registry: &mut ListingsRegistry,
    listing_id: ID,
) {
    assert!(dynamic_field::exists_(&registry.id, listing_id), EListingNotRegistered);
    dynamic_field::remove<ID, vector<String>>(&mut registry.id, listing_id);
    registry.listing_count = registry.listing_count - 1;
}

// === View Functions ===
public fun fee_bps(config: &MarketplaceConfig): u64;
public fun fee_recipient(config: &MarketplaceConfig): address;
public fun version(config: &MarketplaceConfig): u64;
public fun listing_count(registry: &ListingsRegistry): u64;