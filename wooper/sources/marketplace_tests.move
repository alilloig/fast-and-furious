#[test_only]
module wooper::marketplace_tests;

use sui::test_scenario as ts;
use std::unit_test::destroy;
use std::unit_test::assert_eq;
use wooper::marketplace::{
    Self,
    MarketplaceConfig,
    AdminCap,
    PackageVersion,
    ListingsRegistry,
};
use wooper::test_utils;

#[test]
fun creates_all_objects_on_init() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::admin());

    let admin_cap = scenario.take_from_sender<AdminCap>();
    scenario.return_to_sender(admin_cap);

    let config = scenario.take_shared<MarketplaceConfig>();
    assert_eq!(config.fee_bps(), 250);
    assert_eq!(config.fee_recipient(), test_utils::admin());
    assert_eq!(config.version(), 1);
    ts::return_shared(config);

    let pv = scenario.take_shared<PackageVersion>();
    assert_eq!(pv.pkg_version(), 1);
    ts::return_shared(pv);

    let registry = scenario.take_shared<ListingsRegistry>();
    assert_eq!(registry.listing_count(), 0);
    ts::return_shared(registry);

    scenario.end();
}

#[test]
fun admin_can_update_fee() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::admin());

    let admin_cap = scenario.take_from_sender<AdminCap>();
    let mut config = scenario.take_shared<MarketplaceConfig>();

    marketplace::update_fee(&mut config, &admin_cap, 500);
    assert_eq!(config.fee_bps(), 500);

    scenario.return_to_sender(admin_cap);
    ts::return_shared(config);
    scenario.end();
}

#[test, expected_failure(abort_code = 101, location = wooper::marketplace)]
fun update_fee_rejects_excessive_fee() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::admin());

    let admin_cap = scenario.take_from_sender<AdminCap>();
    let mut config = scenario.take_shared<MarketplaceConfig>();

    // Aborts here — 10_001 exceeds MAX_FEE_BPS
    marketplace::update_fee(&mut config, &admin_cap, 10_001);
    abort 0
}

#[test]
fun update_fee_allows_max_fee() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::admin());

    let admin_cap = scenario.take_from_sender<AdminCap>();
    let mut config = scenario.take_shared<MarketplaceConfig>();

    marketplace::update_fee(&mut config, &admin_cap, 10_000);
    assert_eq!(config.fee_bps(), 10_000);

    scenario.return_to_sender(admin_cap);
    ts::return_shared(config);
    scenario.end();
}

#[test]
fun admin_can_update_fee_recipient() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::admin());

    let admin_cap = scenario.take_from_sender<AdminCap>();
    let mut config = scenario.take_shared<MarketplaceConfig>();

    marketplace::update_fee_recipient(&mut config, &admin_cap, test_utils::user1());
    assert_eq!(config.fee_recipient(), test_utils::user1());

    scenario.return_to_sender(admin_cap);
    ts::return_shared(config);
    scenario.end();
}

#[test]
fun register_and_unregister_listing() {
    let mut scenario = test_utils::begin();

    let mut registry = marketplace::create_registry_for_testing(scenario.ctx());
    let fake_id = object::id_from_address(@0xFA);
    let tags = vector[b"ai".to_string(), b"prompt".to_string()];

    marketplace::register_listing(&mut registry, fake_id, tags);
    assert_eq!(registry.listing_count(), 1);

    marketplace::unregister_listing(&mut registry, fake_id);
    assert_eq!(registry.listing_count(), 0);

    destroy(registry);
    scenario.end();
}

#[test, expected_failure(abort_code = 103, location = wooper::marketplace)]
fun register_duplicate_listing_fails() {
    let mut scenario = test_utils::begin();

    let mut registry = marketplace::create_registry_for_testing(scenario.ctx());
    let fake_id = object::id_from_address(@0xFA);
    let tags = vector[b"ai".to_string()];

    marketplace::register_listing(&mut registry, fake_id, tags);
    // Aborts here — duplicate registration
    marketplace::register_listing(&mut registry, fake_id, vector[b"other".to_string()]);
    abort 0
}

#[test, expected_failure(abort_code = 104, location = wooper::marketplace)]
fun unregister_nonexistent_listing_fails() {
    let mut scenario = test_utils::begin();

    let mut registry = marketplace::create_registry_for_testing(scenario.ctx());
    let fake_id = object::id_from_address(@0xFA);

    // Aborts here — ID not in registry
    marketplace::unregister_listing(&mut registry, fake_id);
    abort 0
}
