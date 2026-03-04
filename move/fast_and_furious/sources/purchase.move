/// Module: purchase
/// Purchase receipts, seller vaults, and payment splitting (Phase 2 implementation).
#[allow(unused_const, unused_field)]
module fast_and_furious::purchase;

// === Imports ===
use sui::sui::SUI;
use sui::coin::Coin;
use sui::balance::Balance;
use fast_and_furious::marketplace::MarketplaceConfig;
use fast_and_furious::skill::SkillListing;
use fast_and_furious::package_listing::PackageListing;

// === Errors ===
const EListingNotActive: u64 = 400;
const EInsufficientPayment: u64 = 401;
const ENotVaultOwner: u64 = 402;
const EInsufficientVaultBalance: u64 = 403;
const EWrongVersion: u64 = 404;

// === Structs ===

/// Owned NFT — proof of purchase. Holder can decrypt the skill content via Seal.
/// Has `key` only (no `store`) — not Kiosk-compatible.
public struct PurchaseReceipt has key {
    id: UID,
    buyer: address,
    skill_ids: vector<ID>,
    seller: address,
    amount_paid: u64,
    purchased_at_epoch: u64,
}

/// Shared object — accumulates seller revenue from sales.
public struct SellerVault has key {
    id: UID,
    seller: address,
    balance: Balance<SUI>,
}

// === Events ===

public struct SkillPurchased has copy, drop {
    receipt_id: ID,
    buyer: address,
    skill_ids: vector<ID>,
    seller: address,
    total_paid: u64,
    platform_fee: u64,
    seller_revenue: u64,
}

public struct VaultWithdrawal has copy, drop {
    vault_id: ID,
    seller: address,
    amount: u64,
}

// === Public Functions (Phase 2 stubs) ===

/// Purchase a single skill (stub — Phase 2).
public fun purchase_skill(
    _config: &MarketplaceConfig,
    _listing: &SkillListing,
    _vault: &mut SellerVault,
    _payment: Coin<SUI>,
    _ctx: &mut TxContext,
) {
    abort 0
}

/// Purchase a package bundle (stub — Phase 2).
public fun purchase_package(
    _config: &MarketplaceConfig,
    _package: &PackageListing,
    _vault: &mut SellerVault,
    _payment: Coin<SUI>,
    _ctx: &mut TxContext,
) {
    abort 0
}

/// Seller withdraws from their vault (stub — Phase 2).
public fun withdraw(
    _vault: &mut SellerVault,
    _amount: u64,
    _ctx: &mut TxContext,
): Coin<SUI> {
    abort 0
}

/// Create a SellerVault (stub — Phase 2).
public fun create_vault(_ctx: &mut TxContext) {
    abort 0
}

// === View Functions ===
public fun receipt_skill_ids(receipt: &PurchaseReceipt): vector<ID> { receipt.skill_ids }
public fun vault_balance(vault: &SellerVault): u64 { vault.balance.value() }

// === Test-Only Functions ===

#[test_only]
public fun create_receipt_for_testing(
    buyer: address,
    skill_ids: vector<ID>,
    seller: address,
    amount_paid: u64,
    ctx: &mut TxContext,
): PurchaseReceipt {
    PurchaseReceipt {
        id: object::new(ctx),
        buyer,
        skill_ids,
        seller,
        amount_paid,
        purchased_at_epoch: ctx.epoch(),
    }
}

#[test_only]
public fun destroy_receipt_for_testing(receipt: PurchaseReceipt) {
    let PurchaseReceipt { id, .. } = receipt;
    id.delete();
}
