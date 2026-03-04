/// Module: purchase
/// Purchase receipts, seller vaults, and payment splitting.
module fast_and_furious::purchase;

// === Imports ===
use sui::sui::SUI;
use sui::coin::{Self, Coin};
use sui::balance::{Self, Balance};
use fast_and_furious::marketplace::MarketplaceConfig;
use fast_and_furious::skill::SkillListing;
use fast_and_furious::package_listing::PackageListing;

// === Errors ===
const EListingNotActive: u64 = 400;
const EInsufficientPayment: u64 = 401;
const ENotVaultOwner: u64 = 402;
const EInsufficientVaultBalance: u64 = 403;
#[allow(unused_const)]
const EWrongVersion: u64 = 404;
const EVaultSellerMismatch: u64 = 405;

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
/// One per seller, created via `create_vault`.
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

public struct VaultWithdrawn has copy, drop {
    vault_id: ID,
    seller: address,
    amount: u64,
}

// === Public Functions ===

/// Create a SellerVault for the caller. One per seller, shared object.
public fun create_vault(ctx: &mut TxContext) {
    transfer::share_object(SellerVault {
        id: object::new(ctx),
        seller: ctx.sender(),
        balance: balance::zero(),
    });
}

/// Purchase a single skill. Splits payment: platform fee → fee_recipient, rest → SellerVault.
/// Mints a PurchaseReceipt NFT and transfers to buyer.
#[allow(lint(self_transfer))]
public fun purchase_skill(
    config: &MarketplaceConfig,
    listing: &SkillListing,
    vault: &mut SellerVault,
    mut payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(listing.is_active(), EListingNotActive);
    assert!(vault.seller == listing.seller(), EVaultSellerMismatch);

    let price = listing.price();
    assert!(payment.value() >= price, EInsufficientPayment);

    // Compute fee split
    let platform_fee_amount = (price * config.fee_bps()) / 10_000;
    let seller_revenue = price - platform_fee_amount;

    // Platform fee to fee_recipient
    if (platform_fee_amount > 0) {
        transfer::public_transfer(
            payment.split(platform_fee_amount, ctx),
            config.fee_recipient(),
        );
    };

    // Seller revenue to vault
    vault.balance.join(payment.split(seller_revenue, ctx).into_balance());

    // Return change to buyer (or destroy zero coin)
    if (payment.value() > 0) {
        transfer::public_transfer(payment, ctx.sender());
    } else {
        coin::destroy_zero(payment);
    };

    // Mint receipt
    let receipt = PurchaseReceipt {
        id: object::new(ctx),
        buyer: ctx.sender(),
        skill_ids: vector[object::id(listing)],
        seller: listing.seller(),
        amount_paid: price,
        purchased_at_epoch: ctx.epoch(),
    };
    let receipt_id = object::id(&receipt);

    sui::event::emit(SkillPurchased {
        receipt_id,
        buyer: ctx.sender(),
        skill_ids: vector[object::id(listing)],
        seller: listing.seller(),
        total_paid: price,
        platform_fee: platform_fee_amount,
        seller_revenue,
    });

    transfer::transfer(receipt, ctx.sender());
}

/// Purchase a package (bundle). Uses the package's pre-computed price.
/// Mints a PurchaseReceipt with all skill_ids from the package.
#[allow(lint(self_transfer))]
public fun purchase_package(
    config: &MarketplaceConfig,
    package: &PackageListing,
    vault: &mut SellerVault,
    mut payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(package.is_active(), EListingNotActive);
    assert!(vault.seller == package.seller(), EVaultSellerMismatch);

    let price = package.price();
    assert!(payment.value() >= price, EInsufficientPayment);

    // Compute fee split
    let platform_fee_amount = (price * config.fee_bps()) / 10_000;
    let seller_revenue = price - platform_fee_amount;

    // Platform fee to fee_recipient
    if (platform_fee_amount > 0) {
        transfer::public_transfer(
            payment.split(platform_fee_amount, ctx),
            config.fee_recipient(),
        );
    };

    // Seller revenue to vault
    vault.balance.join(payment.split(seller_revenue, ctx).into_balance());

    // Return change to buyer (or destroy zero coin)
    if (payment.value() > 0) {
        transfer::public_transfer(payment, ctx.sender());
    } else {
        coin::destroy_zero(payment);
    };

    // Mint receipt with all skill IDs from the package
    let skill_ids = package.skill_ids();
    let receipt = PurchaseReceipt {
        id: object::new(ctx),
        buyer: ctx.sender(),
        skill_ids,
        seller: package.seller(),
        amount_paid: price,
        purchased_at_epoch: ctx.epoch(),
    };
    let receipt_id = object::id(&receipt);

    sui::event::emit(SkillPurchased {
        receipt_id,
        buyer: ctx.sender(),
        skill_ids: package.skill_ids(),
        seller: package.seller(),
        total_paid: price,
        platform_fee: platform_fee_amount,
        seller_revenue,
    });

    transfer::transfer(receipt, ctx.sender());
}

/// Seller withdraws from their vault.
public fun withdraw(
    vault: &mut SellerVault,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(ctx.sender() == vault.seller, ENotVaultOwner);
    assert!(vault.balance.value() >= amount, EInsufficientVaultBalance);

    let withdrawn = vault.balance.split(amount);

    sui::event::emit(VaultWithdrawn {
        vault_id: object::id(vault),
        seller: vault.seller,
        amount,
    });

    coin::from_balance(withdrawn, ctx)
}

// === View Functions ===
public fun skill_ids(receipt: &PurchaseReceipt): vector<ID> { receipt.skill_ids }
public fun buyer(receipt: &PurchaseReceipt): address { receipt.buyer }
public fun seller(receipt: &PurchaseReceipt): address { receipt.seller }
public fun amount_paid(receipt: &PurchaseReceipt): u64 { receipt.amount_paid }
public fun balance(vault: &SellerVault): u64 { vault.balance.value() }
public fun vault_seller(vault: &SellerVault): address { vault.seller }

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
public fun create_vault_for_testing(
    seller: address,
    ctx: &mut TxContext,
): SellerVault {
    SellerVault {
        id: object::new(ctx),
        seller,
        balance: balance::zero(),
    }
}

