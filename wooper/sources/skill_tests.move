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
        vector[0u8, 1, 2, 3, 4],
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
        vector[0u8, 1, 2, 3, 4],
    );

    assert_eq!(listing.is_active(), true);
    assert_eq!(listing.is_finalized(), true);
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
        vector[0u8],
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
        vector[0u8],
    );
    abort 0
}
