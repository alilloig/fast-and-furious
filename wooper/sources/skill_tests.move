#[test_only]
module wooper::skill_tests;

use sui::test_scenario as ts;
use std::unit_test::assert_eq;
use wooper::marketplace::{Self, MarketplaceConfig, ListingsRegistry};
use wooper::skill::{Self, SkillListing, SellerCap};
use wooper::test_utils;

/// Creates a skill listing via the two-step create+finalize flow.
fun setup_and_create_listing(scenario: &mut ts::Scenario) {
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    // Step 1: create (metadata only — no walrus/seal data)
    let config = scenario.take_shared<MarketplaceConfig>();
    skill::create(
        &config,
        b"Test Skill".to_string(),
        b"A test skill description".to_string(),
        1_000_000_000,
        b"prompts".to_string(),
        vector[b"ai".to_string(), b"gpt".to_string()],
        scenario.ctx(),
    );
    ts::return_shared(config);

    // Step 2: finalize (populate walrus/seal data, activate, register)
    scenario.next_tx(test_utils::user1());
    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    skill::finalize(
        &seller_cap,
        &mut listing,
        &mut registry,
        b"blob_abc123".to_string(),
        option::none(),
        vector[b"skill_file.txt".to_string()],
        vector[0u8, 1, 2, 3, 4],
        b"0xblobobj_abc123".to_string(),
        50,
        vector[0xAA, 0xBB, 0xCC],
        42,
    );

    scenario.return_to_sender(seller_cap);
    ts::return_shared(listing);
    ts::return_shared(registry);
}

#[test]
fun create_produces_listing_and_seller_cap() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let listing = scenario.take_shared<SkillListing>();

    assert_eq!(listing.seller(), test_utils::user1());
    assert_eq!(listing.price(), 1_000_000_000);
    assert_eq!(listing.is_active(), true);
    assert_eq!(listing.title(), b"Test Skill".to_string());

    let registry = scenario.take_shared<ListingsRegistry>();
    assert_eq!(registry.listing_count(), 1);
    ts::return_shared(registry);

    assert_eq!(seller_cap.skill_listing_id(), object::id(&listing));

    scenario.return_to_sender(seller_cap);
    ts::return_shared(listing);
    scenario.end();
}

#[test, expected_failure(abort_code = 201, location = wooper::skill)]
fun create_with_zero_price_fails() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();

    // Aborts here — price = 0
    skill::create(
        &config,
        b"Free Skill".to_string(),
        b"Should fail".to_string(),
        0,
        b"prompts".to_string(),
        vector[b"free".to_string()],
        scenario.ctx(),
    );
    abort 0
}

#[test]
fun delist_deactivates_and_unregisters() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    skill::delist(&mut listing, &seller_cap, &mut registry);

    assert_eq!(listing.is_active(), false);
    assert_eq!(registry.listing_count(), 0);

    scenario.return_to_sender(seller_cap);
    ts::return_shared(listing);
    ts::return_shared(registry);
    scenario.end();
}

#[test, expected_failure(abort_code = 200, location = wooper::skill)]
fun delist_with_wrong_seller_cap_fails() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user2());

    let fake_listing_id = object::id_from_address(@0xDE);
    let fake_cap = skill::create_seller_cap_for_testing(fake_listing_id, scenario.ctx());

    scenario.next_tx(test_utils::user2());

    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    // Aborts here — cap's listing ID doesn't match
    skill::delist(&mut listing, &fake_cap, &mut registry);
    abort 0
}

#[test, expected_failure(abort_code = 203, location = wooper::skill)]
fun delist_already_delisted_fails() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    skill::delist(&mut listing, &seller_cap, &mut registry);
    // Aborts here — already delisted
    skill::delist(&mut listing, &seller_cap, &mut registry);
    abort 0
}

// === Two-step create/finalize tests ===

#[test]
fun create_produces_unfinalized_listing() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    skill::create(
        &config,
        b"Unfinalized Skill".to_string(),
        b"Not yet finalized".to_string(),
        1_000_000_000,
        b"prompts".to_string(),
        vector[b"ai".to_string()],
        scenario.ctx(),
    );
    ts::return_shared(config);

    scenario.next_tx(test_utils::user1());

    let listing = scenario.take_shared<SkillListing>();
    let registry = scenario.take_shared<ListingsRegistry>();

    assert_eq!(listing.is_active(), false);
    assert_eq!(listing.is_finalized(), false);
    assert_eq!(registry.listing_count(), 0);

    ts::return_shared(listing);
    ts::return_shared(registry);
    scenario.end();
}

#[test]
fun finalize_activates_and_registers() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    skill::create(
        &config,
        b"Finalizable Skill".to_string(),
        b"Will be finalized".to_string(),
        1_000_000_000,
        b"prompts".to_string(),
        vector[b"ai".to_string()],
        scenario.ctx(),
    );
    ts::return_shared(config);

    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    skill::finalize(
        &seller_cap,
        &mut listing,
        &mut registry,
        b"blob_finalized".to_string(),
        option::none(),
        vector[b"prompt.md".to_string()],
        vector[0u8, 1, 2, 3, 4],
        b"0xblobobj_finalized".to_string(),
        50,
        vector[0xAA, 0xBB, 0xCC],
        42,
    );

    assert_eq!(listing.is_active(), true);
    assert_eq!(listing.is_finalized(), true);
    assert_eq!(listing.storage_end_epoch(), 50);
    assert_eq!(registry.listing_count(), 1);

    scenario.return_to_sender(seller_cap);
    ts::return_shared(listing);
    ts::return_shared(registry);
    scenario.end();
}

#[test, expected_failure(abort_code = 204, location = wooper::skill)]
fun finalize_already_finalized_fails() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    // Already finalized by setup_and_create_listing — aborts here
    skill::finalize(
        &seller_cap,
        &mut listing,
        &mut registry,
        b"blob_dup".to_string(),
        option::none(),
        vector[b"file.txt".to_string()],
        vector[0u8],
        b"0xblobobj_dup".to_string(),
        50,
        vector[0xAA, 0xBB, 0xCC],
        42,
    );
    abort 0
}

#[test, expected_failure(abort_code = 200, location = wooper::skill)]
fun finalize_wrong_seller_cap_fails() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    skill::create(
        &config,
        b"Skill For Wrong Cap".to_string(),
        b"desc".to_string(),
        1_000_000_000,
        b"prompts".to_string(),
        vector[b"ai".to_string()],
        scenario.ctx(),
    );
    ts::return_shared(config);

    // Create a fake cap as user2
    scenario.next_tx(test_utils::user2());
    let fake_listing_id = object::id_from_address(@0xDE);
    let fake_cap = skill::create_seller_cap_for_testing(fake_listing_id, scenario.ctx());

    scenario.next_tx(test_utils::user2());

    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    // Aborts here — cap's listing ID doesn't match
    skill::finalize(
        &fake_cap,
        &mut listing,
        &mut registry,
        b"blob_bad".to_string(),
        option::none(),
        vector[b"file.txt".to_string()],
        vector[0u8],
        b"0xblobobj_bad".to_string(),
        50,
        vector[0xAA, 0xBB, 0xCC],
        42,
    );
    abort 0
}

// === file_names validation tests ===

#[test, expected_failure(abort_code = 206, location = wooper::skill)]
fun finalize_with_empty_file_names_fails() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    skill::create(
        &config,
        b"No Files Skill".to_string(),
        b"desc".to_string(),
        1_000_000_000,
        b"prompts".to_string(),
        vector[b"ai".to_string()],
        scenario.ctx(),
    );
    ts::return_shared(config);

    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    // Aborts — empty file_names
    skill::finalize(
        &seller_cap,
        &mut listing,
        &mut registry,
        b"blob_x".to_string(),
        option::none(),
        vector[],
        vector[0u8],
        b"0xblobobj_x".to_string(),
        50,
        vector[0xAA, 0xBB, 0xCC],
        42,
    );
    abort 0
}

#[test, expected_failure(abort_code = 207, location = wooper::skill)]
fun finalize_with_too_many_files_fails() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    skill::create(
        &config,
        b"Too Many Files".to_string(),
        b"desc".to_string(),
        1_000_000_000,
        b"prompts".to_string(),
        vector[b"ai".to_string()],
        scenario.ctx(),
    );
    ts::return_shared(config);

    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    // 11 file names — exceeds MAX_FILES (10)
    skill::finalize(
        &seller_cap,
        &mut listing,
        &mut registry,
        b"blob_x".to_string(),
        option::none(),
        vector[
            b"f1.txt".to_string(), b"f2.txt".to_string(), b"f3.txt".to_string(),
            b"f4.txt".to_string(), b"f5.txt".to_string(), b"f6.txt".to_string(),
            b"f7.txt".to_string(), b"f8.txt".to_string(), b"f9.txt".to_string(),
            b"f10.txt".to_string(), b"f11.txt".to_string(),
        ],
        vector[0u8],
        b"0xblobobj_x".to_string(),
        50,
        vector[0xAA, 0xBB, 0xCC],
        42,
    );
    abort 0
}

#[test]
fun finalize_with_multiple_files_succeeds() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    skill::create(
        &config,
        b"Multi-File Skill".to_string(),
        b"Has three files".to_string(),
        2_000_000_000,
        b"agents".to_string(),
        vector[b"agent".to_string()],
        scenario.ctx(),
    );
    ts::return_shared(config);

    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    skill::finalize(
        &seller_cap,
        &mut listing,
        &mut registry,
        b"blob_multi".to_string(),
        option::some(b"quilt_abc".to_string()),
        vector[
            b"agent.md".to_string(),
            b"config.yaml".to_string(),
            b"rules.json".to_string(),
        ],
        vector[0u8, 1, 2, 3, 4],
        b"0xblobobj_multi".to_string(),
        50,
        vector[0xAA, 0xBB, 0xCC],
        42,
    );

    assert_eq!(listing.is_active(), true);
    assert_eq!(listing.is_finalized(), true);
    assert_eq!(listing.file_names().length(), 3);
    assert_eq!(registry.listing_count(), 1);

    scenario.return_to_sender(seller_cap);
    ts::return_shared(listing);
    ts::return_shared(registry);
    scenario.end();
}

// === update_storage_end_epoch tests ===

#[test]
fun update_storage_end_epoch_succeeds() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();

    assert_eq!(listing.storage_end_epoch(), 50);

    skill::update_storage_end_epoch(&seller_cap, &mut listing, 100);
    assert_eq!(listing.storage_end_epoch(), 100);

    scenario.return_to_sender(seller_cap);
    ts::return_shared(listing);
    scenario.end();
}

#[test, expected_failure(abort_code = 200, location = wooper::skill)]
fun update_storage_end_epoch_non_seller_fails() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user2());

    let fake_listing_id = object::id_from_address(@0xDE);
    let fake_cap = skill::create_seller_cap_for_testing(fake_listing_id, scenario.ctx());

    scenario.next_tx(test_utils::user2());

    let mut listing = scenario.take_shared<SkillListing>();

    // Aborts — wrong seller cap
    skill::update_storage_end_epoch(&fake_cap, &mut listing, 100);
    abort 0
}

#[test, expected_failure(abort_code = 208, location = wooper::skill)]
fun update_storage_end_epoch_lower_value_fails() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();

    // Aborts — 30 < current 50
    skill::update_storage_end_epoch(&seller_cap, &mut listing, 30);
    abort 0
}

#[test, expected_failure(abort_code = 208, location = wooper::skill)]
fun update_storage_end_epoch_same_value_fails() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();

    // Aborts — 50 == current 50 (must be strictly greater)
    skill::update_storage_end_epoch(&seller_cap, &mut listing, 50);
    abort 0
}

#[test, expected_failure(abort_code = 205, location = wooper::skill)]
fun update_storage_end_epoch_unfinalized_fails() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    skill::create(
        &config,
        b"Unfinalized".to_string(),
        b"desc".to_string(),
        1_000_000_000,
        b"prompts".to_string(),
        vector[b"ai".to_string()],
        scenario.ctx(),
    );
    ts::return_shared(config);

    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();

    // Aborts — listing not finalized
    skill::update_storage_end_epoch(&seller_cap, &mut listing, 100);
    abort 0
}

#[test]
fun finalize_stores_root_hash_and_nonce() {
    let mut scenario = test_utils::begin();
    setup_and_create_listing(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let listing = scenario.take_shared<SkillListing>();

    assert_eq!(listing.root_hash(), vector[0xAA, 0xBB, 0xCC]);
    assert_eq!(listing.encoding_nonce(), 42);
    assert_eq!(listing.walrus_blob_id(), b"blob_abc123".to_string());

    ts::return_shared(listing);
    scenario.end();
}
