#[test_only]
module fast_and_furious::package_listing_tests;

use sui::test_scenario as ts;
use std::unit_test::assert_eq;
use fast_and_furious::marketplace::{Self, MarketplaceConfig, ListingsRegistry};
use fast_and_furious::package_listing::{Self, PackageListing, PackageSellerCap};
use fast_and_furious::test_utils;

// === Helpers ===

fun setup_and_create_package(scenario: &mut ts::Scenario) {
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    let skill_id_a = object::id_from_address(@0x0A);
    let skill_id_b = object::id_from_address(@0x0B);

    package_listing::create(
        &config, &mut registry,
        b"AI Bundle".to_string(),
        b"Two skills bundled".to_string(),
        vector[skill_id_a, skill_id_b],
        900_000_000,
        1_000, // 10% discount
        vector[b"ai".to_string(), b"bundle".to_string()],
        scenario.ctx(),
    );

    ts::return_shared(config);
    ts::return_shared(registry);
}

#[test]
fun create_produces_listing_and_cap() {
    let mut scenario = test_utils::begin();
    setup_and_create_package(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<PackageSellerCap>();
    let listing = scenario.take_shared<PackageListing>();

    assert_eq!(listing.seller(), test_utils::user1());
    assert_eq!(listing.price(), 900_000_000);
    assert_eq!(listing.discount_bps(), 1_000);
    assert_eq!(listing.skill_ids().length(), 2);
    assert_eq!(listing.is_active(), true);

    let registry = scenario.take_shared<ListingsRegistry>();
    assert_eq!(registry.listing_count(), 1);
    ts::return_shared(registry);

    assert_eq!(seller_cap.package_listing_id(), object::id(&listing));

    scenario.return_to_sender(seller_cap);
    ts::return_shared(listing);
    scenario.end();
}

#[test, expected_failure(abort_code = 302, location = fast_and_furious::package_listing)]
fun create_empty_skills_fails() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    package_listing::create(
        &config, &mut registry,
        b"Empty".to_string(), b"No skills".to_string(),
        vector[], // empty!
        100, 0,
        vector[b"test".to_string()],
        scenario.ctx(),
    );
    abort 0
}

#[test, expected_failure(abort_code = 301, location = fast_and_furious::package_listing)]
fun create_invalid_discount_fails() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    package_listing::create(
        &config, &mut registry,
        b"Too Cheap".to_string(), b"Over 50% off".to_string(),
        vector[object::id_from_address(@0x01)],
        100, 5_001, // exceeds MAX_DISCOUNT_BPS
        vector[b"test".to_string()],
        scenario.ctx(),
    );
    abort 0
}

#[test, expected_failure(abort_code = 305, location = fast_and_furious::package_listing)]
fun create_zero_price_fails() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    package_listing::create(
        &config, &mut registry,
        b"Free".to_string(), b"Free bundle".to_string(),
        vector[object::id_from_address(@0x01)],
        0, 0, // price = 0
        vector[b"test".to_string()],
        scenario.ctx(),
    );
    abort 0
}

#[test]
fun delist_deactivates_and_unregisters() {
    let mut scenario = test_utils::begin();
    setup_and_create_package(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<PackageSellerCap>();
    let mut listing = scenario.take_shared<PackageListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    package_listing::delist(&mut listing, &seller_cap, &mut registry);

    assert_eq!(listing.is_active(), false);
    assert_eq!(registry.listing_count(), 0);

    scenario.return_to_sender(seller_cap);
    ts::return_shared(listing);
    ts::return_shared(registry);
    scenario.end();
}

#[test, expected_failure(abort_code = 300, location = fast_and_furious::package_listing)]
fun delist_wrong_cap_fails() {
    let mut scenario = test_utils::begin();
    setup_and_create_package(&mut scenario);
    scenario.next_tx(test_utils::user2());

    let fake_id = object::id_from_address(@0xDE);
    let fake_cap = package_listing::create_seller_cap_for_testing(fake_id, scenario.ctx());

    scenario.next_tx(test_utils::user2());

    let mut listing = scenario.take_shared<PackageListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    package_listing::delist(&mut listing, &fake_cap, &mut registry);
    abort 0
}

#[test, expected_failure(abort_code = 304, location = fast_and_furious::package_listing)]
fun delist_already_delisted_fails() {
    let mut scenario = test_utils::begin();
    setup_and_create_package(&mut scenario);
    scenario.next_tx(test_utils::user1());

    let seller_cap = scenario.take_from_sender<PackageSellerCap>();
    let mut listing = scenario.take_shared<PackageListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    package_listing::delist(&mut listing, &seller_cap, &mut registry);
    // Second delist should fail
    package_listing::delist(&mut listing, &seller_cap, &mut registry);
    abort 0
}
