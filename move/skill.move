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
/// Registers the listing in the ListingsRegistry with its tags.
public fun create(
    config: &MarketplaceConfig,
    registry: &mut ListingsRegistry,
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
/// Removes the listing from the ListingsRegistry.
/// The SkillListing object remains on-chain (purchases remain valid for
/// already-purchased buyers to decrypt).
public fun delist(
    seller_cap: &SellerCap,
    listing: &mut SkillListing,
    registry: &mut ListingsRegistry,
);

// === View Functions ===
public fun seller(listing: &SkillListing): address;
public fun price(listing: &SkillListing): u64;
public fun is_active(listing: &SkillListing): bool;
public fun seal_key_id(listing: &SkillListing): vector<u8>;