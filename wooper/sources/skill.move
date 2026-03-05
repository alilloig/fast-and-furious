/// Module: skill
/// Individual skill listings with create/delist lifecycle.
module wooper::skill;

// === Imports ===
use std::string::String;
use wooper::marketplace::{MarketplaceConfig, ListingsRegistry};

// === Errors ===
const ENotSeller: u64 = 200;
const EInvalidPrice: u64 = 201;
const EWrongVersion: u64 = 202;
const EAlreadyDelisted: u64 = 203;
const EAlreadyFinalized: u64 = 204;
const ENotFinalized: u64 = 205;
const EFileNamesRequired: u64 = 206;
const EMaxFilesExceeded: u64 = 207;
const EEndEpochNotExtended: u64 = 208;

// === Constants ===
const MAX_FILES: u64 = 10;

// === Structs ===

/// Shared object — a single skill listing.
/// Immutable after creation (no update functions). Seller delists to remove.
public struct SkillListing has key {
    id: UID,
    seller: address,
    title: String,
    description: String,
    price: u64,
    category: String,
    tags: vector<String>,
    walrus_blob_id: String,
    walrus_quilt_id: Option<String>,
    file_names: vector<String>,
    seal_key_id: vector<u8>,
    walrus_blob_object_id: String,
    storage_end_epoch: u64,
    created_at_epoch: u64,
    is_active: bool,
    is_finalized: bool,
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

public struct StorageExtended has copy, drop {
    listing_id: ID,
    new_end_epoch: u64,
}

// === Public Functions ===

/// Create a new skill listing (step 1 of 2). SkillListing is shared but inactive.
/// Walrus/Seal fields are empty — the seller must call `finalize` after encrypting
/// and uploading content. This solves the chicken-and-egg problem: the listing ID
/// (needed for the Seal key identity) is only known after this transaction executes.
#[allow(lint(self_transfer))]
public fun create(
    config: &MarketplaceConfig,
    title: String,
    description: String,
    price: u64,
    category: String,
    tags: vector<String>,
    ctx: &mut TxContext,
) {
    assert!(config.version() == 1, EWrongVersion);
    assert!(price > 0, EInvalidPrice);

    let listing = SkillListing {
        id: object::new(ctx),
        seller: ctx.sender(),
        title,
        description,
        price,
        category,
        tags,
        walrus_blob_id: b"".to_string(),
        walrus_quilt_id: option::none(),
        file_names: vector[],
        seal_key_id: vector[],
        walrus_blob_object_id: b"".to_string(),
        storage_end_epoch: 0,
        created_at_epoch: ctx.epoch(),
        is_active: false,
        is_finalized: false,
    };

    let listing_id = object::id(&listing);

    transfer::transfer(SellerCap {
        id: object::new(ctx),
        skill_listing_id: listing_id,
    }, ctx.sender());

    transfer::share_object(listing);
}

/// Finalize a skill listing (step 2 of 2). Populates Walrus/Seal data,
/// activates the listing, and registers it in the ListingsRegistry.
/// Called after the seller has encrypted content with Seal and uploaded to Walrus.
public fun finalize(
    seller_cap: &SellerCap,
    listing: &mut SkillListing,
    registry: &mut ListingsRegistry,
    walrus_blob_id: String,
    walrus_quilt_id: Option<String>,
    file_names: vector<String>,
    seal_key_id: vector<u8>,
    walrus_blob_object_id: String,
    storage_end_epoch: u64,
) {
    assert!(seller_cap.skill_listing_id == object::id(listing), ENotSeller);
    assert!(!listing.is_finalized, EAlreadyFinalized);
    assert!(!file_names.is_empty(), EFileNamesRequired);
    assert!(file_names.length() <= MAX_FILES, EMaxFilesExceeded);

    listing.walrus_blob_id = walrus_blob_id;
    listing.walrus_quilt_id = walrus_quilt_id;
    listing.file_names = file_names;
    listing.seal_key_id = seal_key_id;
    listing.walrus_blob_object_id = walrus_blob_object_id;
    listing.storage_end_epoch = storage_end_epoch;
    listing.is_finalized = true;
    listing.is_active = true;

    let listing_id = object::id(listing);

    wooper::marketplace::register_listing(registry, listing_id, listing.tags);

    sui::event::emit(SkillListed {
        listing_id,
        seller: listing.seller,
        title: listing.title,
        price: listing.price,
        category: listing.category,
        walrus_blob_id: listing.walrus_blob_id,
    });
}

/// Delist a skill. Requires SellerCap. Sets is_active = false.
/// Removes the listing from the ListingsRegistry.
public fun delist(
    listing: &mut SkillListing,
    seller_cap: &SellerCap,
    registry: &mut ListingsRegistry,
) {
    assert!(seller_cap.skill_listing_id == object::id(listing), ENotSeller);
    assert!(listing.is_finalized, ENotFinalized);
    assert!(listing.is_active, EAlreadyDelisted);

    listing.is_active = false;

    wooper::marketplace::unregister_listing(registry, object::id(listing));

    sui::event::emit(SkillDelisted {
        listing_id: object::id(listing),
        seller: listing.seller,
    });
}

/// Update storage expiry after a Walrus blob extension.
/// Seller-only (requires SellerCap). Monotonic increase to prevent griefing.
public fun update_storage_end_epoch(
    seller_cap: &SellerCap,
    listing: &mut SkillListing,
    new_end_epoch: u64,
) {
    assert!(seller_cap.skill_listing_id == object::id(listing), ENotSeller);
    assert!(listing.is_finalized, ENotFinalized);
    assert!(new_end_epoch > listing.storage_end_epoch, EEndEpochNotExtended);

    listing.storage_end_epoch = new_end_epoch;

    sui::event::emit(StorageExtended {
        listing_id: object::id(listing),
        new_end_epoch,
    });
}

// === View Functions ===
public fun seller(listing: &SkillListing): address { listing.seller }
public fun price(listing: &SkillListing): u64 { listing.price }
public fun is_active(listing: &SkillListing): bool { listing.is_active }
public fun is_finalized(listing: &SkillListing): bool { listing.is_finalized }
public fun seal_key_id(listing: &SkillListing): vector<u8> { listing.seal_key_id }
public fun title(listing: &SkillListing): String { listing.title }
public fun file_names(listing: &SkillListing): vector<String> { listing.file_names }
public fun skill_listing_id(cap: &SellerCap): ID { cap.skill_listing_id }
public fun walrus_blob_object_id(listing: &SkillListing): String { listing.walrus_blob_object_id }
public fun storage_end_epoch(listing: &SkillListing): u64 { listing.storage_end_epoch }

// === Test-Only Functions ===

#[test_only]
public fun create_for_testing(
    seller: address,
    title: String,
    price: u64,
    category: String,
    ctx: &mut TxContext,
): SkillListing {
    SkillListing {
        id: object::new(ctx),
        seller,
        title,
        description: b"test description".to_string(),
        price,
        category,
        tags: vector[b"test".to_string()],
        walrus_blob_id: b"blob123".to_string(),
        walrus_quilt_id: option::none(),
        file_names: vector[b"test_file.txt".to_string()],
        seal_key_id: vector[0u8, 1, 2, 3],
        walrus_blob_object_id: b"0xblobobj123".to_string(),
        storage_end_epoch: 100,
        created_at_epoch: 0,
        is_active: true,
        is_finalized: true,
    }
}

#[test_only]
public fun create_seller_cap_for_testing(
    skill_listing_id: ID,
    ctx: &mut TxContext,
): SellerCap {
    SellerCap {
        id: object::new(ctx),
        skill_listing_id,
    }
}

