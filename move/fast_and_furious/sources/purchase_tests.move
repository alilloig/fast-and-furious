#[test_only]
module fast_and_furious::purchase_tests;

use sui::test_scenario as ts;
use sui::coin;
use sui::sui::SUI;
use std::unit_test::assert_eq;
use fast_and_furious::marketplace::{Self, MarketplaceConfig, ListingsRegistry};
use fast_and_furious::skill::{Self, SkillListing, SellerCap};
use fast_and_furious::package_listing::{Self, PackageListing};
use fast_and_furious::purchase::{Self, SellerVault, PurchaseReceipt};
use fast_and_furious::test_utils;

// === Helpers ===

/// Sets up marketplace + creates a skill listing as user1 + creates a vault for user1.
fun setup_skill_and_vault(scenario: &mut ts::Scenario) {
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    // Create vault for user1 (seller)
    purchase::create_vault(scenario.ctx());

    scenario.next_tx(test_utils::user1());

    let config = scenario.take_shared<MarketplaceConfig>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    skill::create(
        &config,
        &mut registry,
        b"AI Prompt Pack".to_string(),
        b"Premium AI prompts".to_string(),
        1_000_000_000, // 1 SUI
        b"prompts".to_string(),
        vector[b"ai".to_string()],
        b"blob_abc".to_string(),
        option::none(),
        vector[0u8, 1, 2, 3, 4],
        scenario.ctx(),
    );

    ts::return_shared(config);
    ts::return_shared(registry);
}

// === purchase_skill tests ===

#[test]
fun purchase_skill_success() {
    let mut scenario = test_utils::begin();
    setup_skill_and_vault(&mut scenario);
    scenario.next_tx(test_utils::user2());

    let config = scenario.take_shared<MarketplaceConfig>();
    let listing = scenario.take_shared<SkillListing>();
    let mut vault = scenario.take_shared<SellerVault>();
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());

    purchase::purchase_skill(&config, &listing, &mut vault, payment, scenario.ctx());

    // Verify vault received seller revenue (price - 2.5% fee)
    // Fee: 1_000_000_000 * 250 / 10_000 = 25_000_000
    // Revenue: 1_000_000_000 - 25_000_000 = 975_000_000
    assert_eq!(vault.balance(), 975_000_000);

    ts::return_shared(config);
    ts::return_shared(listing);
    ts::return_shared(vault);
    scenario.next_tx(test_utils::user2());

    // Buyer should have a PurchaseReceipt
    let receipt = scenario.take_from_sender<PurchaseReceipt>();
    assert_eq!(receipt.buyer(), test_utils::user2());
    assert_eq!(receipt.seller(), test_utils::user1());
    assert_eq!(receipt.amount_paid(), 1_000_000_000);
    assert_eq!(receipt.skill_ids().length(), 1);

    scenario.return_to_sender(receipt);
    scenario.end();
}

#[test]
fun fee_split_computed_correctly() {
    let mut scenario = test_utils::begin();
    setup_skill_and_vault(&mut scenario);
    scenario.next_tx(test_utils::user2());

    let config = scenario.take_shared<MarketplaceConfig>();
    let listing = scenario.take_shared<SkillListing>();
    let mut vault = scenario.take_shared<SellerVault>();

    // Overpay to also test change return
    let payment = coin::mint_for_testing<SUI>(2_000_000_000, scenario.ctx());
    purchase::purchase_skill(&config, &listing, &mut vault, payment, scenario.ctx());

    // Vault gets exactly 975_000_000 (price minus 2.5% fee)
    assert_eq!(vault.balance(), 975_000_000);

    ts::return_shared(config);
    ts::return_shared(listing);
    ts::return_shared(vault);
    scenario.next_tx(test_utils::user2());

    // Buyer should get 1 SUI change back as a coin
    let change = scenario.take_from_sender<coin::Coin<SUI>>();
    assert_eq!(change.value(), 1_000_000_000);
    coin::burn_for_testing(change);

    // Also has receipt
    let receipt = scenario.take_from_sender<PurchaseReceipt>();
    scenario.return_to_sender(receipt);
    scenario.end();
}

#[test, expected_failure(abort_code = 400, location = fast_and_furious::purchase)]
fun purchase_skill_inactive_listing_fails() {
    let mut scenario = test_utils::begin();
    setup_skill_and_vault(&mut scenario);
    scenario.next_tx(test_utils::user1());

    // Delist the skill first
    let seller_cap = scenario.take_from_sender<SellerCap>();
    let mut listing = scenario.take_shared<SkillListing>();
    let mut registry = scenario.take_shared<ListingsRegistry>();
    skill::delist(&mut listing, &seller_cap, &mut registry);
    scenario.return_to_sender(seller_cap);
    ts::return_shared(registry);

    // Try to purchase — should abort
    scenario.next_tx(test_utils::user2());
    let config = scenario.take_shared<MarketplaceConfig>();
    let mut vault = scenario.take_shared<SellerVault>();
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());

    purchase::purchase_skill(&config, &listing, &mut vault, payment, scenario.ctx());
    abort 0
}

#[test, expected_failure(abort_code = 401, location = fast_and_furious::purchase)]
fun purchase_skill_insufficient_payment_fails() {
    let mut scenario = test_utils::begin();
    setup_skill_and_vault(&mut scenario);
    scenario.next_tx(test_utils::user2());

    let config = scenario.take_shared<MarketplaceConfig>();
    let listing = scenario.take_shared<SkillListing>();
    let mut vault = scenario.take_shared<SellerVault>();
    // Only 0.5 SUI for a 1 SUI listing
    let payment = coin::mint_for_testing<SUI>(500_000_000, scenario.ctx());

    purchase::purchase_skill(&config, &listing, &mut vault, payment, scenario.ctx());
    abort 0
}

#[test, expected_failure(abort_code = 405, location = fast_and_furious::purchase)]
fun purchase_skill_vault_seller_mismatch_fails() {
    let mut scenario = test_utils::begin();
    setup_skill_and_vault(&mut scenario);
    scenario.next_tx(test_utils::user2());

    let config = scenario.take_shared<MarketplaceConfig>();
    let listing = scenario.take_shared<SkillListing>();
    // Create a vault for user2 directly (wrong seller for this listing)
    let mut wrong_vault = purchase::create_vault_for_testing(test_utils::user2(), scenario.ctx());
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());

    purchase::purchase_skill(&config, &listing, &mut wrong_vault, payment, scenario.ctx());
    abort 0
}

// === create_vault tests ===

#[test]
fun create_vault_success() {
    let mut scenario = test_utils::begin();
    scenario.next_tx(test_utils::user1());

    purchase::create_vault(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    let vault = scenario.take_shared<SellerVault>();
    assert_eq!(vault.vault_seller(), test_utils::user1());
    assert_eq!(vault.balance(), 0);
    ts::return_shared(vault);

    scenario.end();
}

// === withdraw tests ===

#[test]
fun withdraw_success() {
    let mut scenario = test_utils::begin();
    setup_skill_and_vault(&mut scenario);

    // Purchase as user2 so vault has funds
    scenario.next_tx(test_utils::user2());
    let config = scenario.take_shared<MarketplaceConfig>();
    let listing = scenario.take_shared<SkillListing>();
    let mut vault = scenario.take_shared<SellerVault>();
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());
    purchase::purchase_skill(&config, &listing, &mut vault, payment, scenario.ctx());
    ts::return_shared(config);
    ts::return_shared(listing);
    ts::return_shared(vault);

    // Withdraw as user1 (seller)
    scenario.next_tx(test_utils::user1());
    let mut vault = scenario.take_shared<SellerVault>();
    let withdrawn = purchase::withdraw(&mut vault, 500_000_000, scenario.ctx());
    assert_eq!(withdrawn.value(), 500_000_000);
    assert_eq!(vault.balance(), 475_000_000);

    coin::burn_for_testing(withdrawn);
    ts::return_shared(vault);
    scenario.end();
}

#[test, expected_failure(abort_code = 402, location = fast_and_furious::purchase)]
fun withdraw_not_vault_owner_fails() {
    let mut scenario = test_utils::begin();
    setup_skill_and_vault(&mut scenario);

    // Purchase so vault has funds
    scenario.next_tx(test_utils::user2());
    let config = scenario.take_shared<MarketplaceConfig>();
    let listing = scenario.take_shared<SkillListing>();
    let mut vault = scenario.take_shared<SellerVault>();
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());
    purchase::purchase_skill(&config, &listing, &mut vault, payment, scenario.ctx());
    ts::return_shared(config);
    ts::return_shared(listing);
    ts::return_shared(vault);

    // User2 tries to withdraw from user1's vault
    scenario.next_tx(test_utils::user2());
    let mut vault = scenario.take_shared<SellerVault>();
    let _withdrawn = purchase::withdraw(&mut vault, 100_000_000, scenario.ctx());
    abort 0
}

#[test, expected_failure(abort_code = 403, location = fast_and_furious::purchase)]
fun withdraw_insufficient_balance_fails() {
    let mut scenario = test_utils::begin();
    setup_skill_and_vault(&mut scenario);

    // Vault is empty, user1 tries to withdraw
    scenario.next_tx(test_utils::user1());
    let mut vault = scenario.take_shared<SellerVault>();
    let _withdrawn = purchase::withdraw(&mut vault, 1_000_000, scenario.ctx());
    abort 0
}

// === purchase_package tests ===

#[test]
fun purchase_package_success() {
    let mut scenario = test_utils::begin();
    marketplace::init_for_testing(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    // Create vault
    purchase::create_vault(scenario.ctx());
    scenario.next_tx(test_utils::user1());

    // Create two skills
    let config = scenario.take_shared<MarketplaceConfig>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    skill::create(
        &config, &mut registry,
        b"Skill A".to_string(), b"desc".to_string(),
        500_000_000, b"cat".to_string(), vector[b"ai".to_string()],
        b"blob_a".to_string(), option::none(), vector[0u8],
        scenario.ctx(),
    );
    skill::create(
        &config, &mut registry,
        b"Skill B".to_string(), b"desc".to_string(),
        500_000_000, b"cat".to_string(), vector[b"ai".to_string()],
        b"blob_b".to_string(), option::none(), vector[1u8],
        scenario.ctx(),
    );

    ts::return_shared(config);
    ts::return_shared(registry);
    scenario.next_tx(test_utils::user1());

    // Get skill IDs for the package
    // We need to know the IDs — use a deterministic approach
    let config = scenario.take_shared<MarketplaceConfig>();
    let mut registry = scenario.take_shared<ListingsRegistry>();

    // Create package: 2 skills totaling 1 SUI, 10% discount → price = 900_000_000
    let skill_id_a = object::id_from_address(@0x01); // placeholder
    let skill_id_b = object::id_from_address(@0x02);

    package_listing::create(
        &config, &mut registry,
        b"AI Bundle".to_string(), b"Two skills bundled".to_string(),
        vector[skill_id_a, skill_id_b],
        900_000_000, // pre-computed discounted price
        1_000, // 10% discount
        vector[b"bundle".to_string()],
        scenario.ctx(),
    );

    ts::return_shared(config);
    ts::return_shared(registry);
    scenario.next_tx(test_utils::user2());

    // Purchase the package
    let config = scenario.take_shared<MarketplaceConfig>();
    let package = scenario.take_shared<PackageListing>();
    let mut vault = scenario.take_shared<SellerVault>();
    let payment = coin::mint_for_testing<SUI>(900_000_000, scenario.ctx());

    purchase::purchase_package(&config, &package, &mut vault, payment, scenario.ctx());

    // Fee: 900_000_000 * 250 / 10_000 = 22_500_000
    // Revenue: 900_000_000 - 22_500_000 = 877_500_000
    assert_eq!(vault.balance(), 877_500_000);

    ts::return_shared(config);
    ts::return_shared(package);
    ts::return_shared(vault);
    scenario.next_tx(test_utils::user2());

    // Receipt should have both skill IDs
    let receipt = scenario.take_from_sender<PurchaseReceipt>();
    assert_eq!(receipt.skill_ids().length(), 2);
    assert_eq!(receipt.amount_paid(), 900_000_000);
    scenario.return_to_sender(receipt);

    scenario.end();
}
